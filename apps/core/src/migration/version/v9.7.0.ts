import {
  READER_COLLECTION_NAME,
  USER_COLLECTION_NAME,
} from '~/constants/db.constant'
import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

const base64UrlToBase64 = (value: string) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padding = normalized.length % 4
  const pad = padding === 0 ? '' : '='.repeat(4 - padding)
  return `${normalized}${pad}`
}

export default defineMigration(
  'v9.7.0-better-auth-migration',
  async (db: Db) => {
    const readers = db.collection(READER_COLLECTION_NAME)
    let owner = await readers.findOne({ isOwner: true })

    if (!owner) {
      owner = await readers.findOne({})
      if (owner && !owner.isOwner) {
        await readers.updateOne({ _id: owner._id }, { $set: { isOwner: true } })
      }
    }

    if (!owner) {
      const legacyOwner = await db.collection(USER_COLLECTION_NAME).findOne({})
      if (!legacyOwner) {
        return
      }

      const now = new Date()
      const newOwner = {
        name: legacyOwner.name ?? legacyOwner.username ?? 'owner',
        email: legacyOwner.mail ?? 'owner@local',
        emailVerified: true,
        image: legacyOwner.avatar ?? null,
        createdAt: now,
        updatedAt: now,
        isOwner: true,
        handle: legacyOwner.username ?? '',
      }
      const result = await readers.insertOne(newOwner)
      owner = {
        _id: result.insertedId,
        ...newOwner,
      }
    }

    if (!owner?._id) {
      return
    }

    const ownerId = owner._id.toString()
    const apiKeyCollection = db.collection('apikey')
    const ownerUser = await db
      .collection(USER_COLLECTION_NAME)
      .findOne({}, { projection: { apiToken: 1 } })
    const apiTokens = ownerUser?.apiToken

    if (Array.isArray(apiTokens)) {
      for (const token of apiTokens) {
        if (!token?.token) continue
        const exists = await apiKeyCollection.findOne({ key: token.token })
        if (exists) continue

        const createdAt = token.created ? new Date(token.created) : new Date()
        const expiresAt = token.expired ? new Date(token.expired) : null
        await apiKeyCollection.insertOne({
          name: token.name ?? 'txo',
          start: token.token.slice(0, 6),
          prefix: token.token.startsWith('txo') ? 'txo' : undefined,
          key: token.token,
          userId: ownerId,
          enabled: true,
          rateLimitEnabled: true,
          requestCount: 0,
          createdAt,
          updatedAt: createdAt,
          expiresAt,
        })
      }
    }

    const passkeyCollection = db.collection('passkey')
    const authnCollection = db.collection('authn')
    const authnItems = await authnCollection.find().toArray()

    for (const item of authnItems) {
      if (!item?.credentialID || !item?.credentialPublicKey) continue
      const existing = await passkeyCollection.findOne({
        credentialID: String(item.credentialID),
      })
      if (existing) continue

      const createdAt = item.created ? new Date(item.created) : new Date()
      const publicKey = base64UrlToBase64(String(item.credentialPublicKey))

      await passkeyCollection.insertOne({
        name: item.name,
        publicKey,
        userId: ownerId,
        credentialID: String(item.credentialID),
        counter: item.counter ?? 0,
        deviceType: item.credentialDeviceType ?? 'singleDevice',
        backedUp: item.credentialBackedUp ?? false,
        transports: item.transports ?? undefined,
        createdAt,
        aaguid: item.aaguid ?? undefined,
      })
    }
  },
)
