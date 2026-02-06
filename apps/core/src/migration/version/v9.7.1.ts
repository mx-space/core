import { USER_COLLECTION_NAME } from '~/constants/db.constant'
import { AUTH_JS_USER_COLLECTION } from '~/modules/auth/auth.constant'
import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

const normalizeUsername = (username?: string | null) => {
  if (!username) {
    return ''
  }
  return username.trim().toLowerCase()
}

export default defineMigration(
  'v9.7.1-better-auth-username-migration',
  async (db: Db) => {
    const readers = db.collection(AUTH_JS_USER_COLLECTION)
    const owner = await db.collection(USER_COLLECTION_NAME).findOne({})
    if (!owner) {
      return
    }

    const ownerReader = await readers.findOne({ isOwner: true })
    const now = new Date()
    const username = normalizeUsername(owner.username)
    const displayUsername = owner.name ?? owner.username ?? ''

    if (!ownerReader) {
      const newOwner = {
        name: owner.name ?? owner.username ?? 'owner',
        email: owner.mail ?? 'owner@local',
        emailVerified: true,
        image: owner.avatar ?? null,
        createdAt: now,
        updatedAt: now,
        isOwner: true,
        handle: owner.username ?? '',
        username: username || undefined,
        displayUsername: displayUsername || undefined,
      }
      await readers.insertOne(newOwner)
      return
    }

    const updates: Record<string, any> = {}
    if (!ownerReader.isOwner) {
      updates.isOwner = true
    }
    if (!ownerReader.email && owner.mail) {
      updates.email = owner.mail
    }
    if (!ownerReader.name && owner.name) {
      updates.name = owner.name
    }
    if (!ownerReader.image && owner.avatar) {
      updates.image = owner.avatar
    }
    if (
      owner.username &&
      (!ownerReader.handle || ownerReader.handle !== owner.username)
    ) {
      updates.handle = owner.username
    }
    if (
      username &&
      (!ownerReader.username || ownerReader.username !== username)
    ) {
      updates.username = username
    }
    if (
      displayUsername &&
      (!ownerReader.displayUsername ||
        ownerReader.displayUsername !== displayUsername)
    ) {
      updates.displayUsername = displayUsername
    }
    if (ownerReader.emailVerified !== true) {
      updates.emailVerified = true
    }
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = now
      await readers.updateOne({ _id: ownerReader._id }, { $set: updates })
    }
  },
)
