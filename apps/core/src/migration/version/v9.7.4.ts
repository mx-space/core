import {
  OWNER_PROFILE_COLLECTION_NAME,
  USER_COLLECTION_NAME,
} from '~/constants/db.constant'
import {
  AUTH_JS_ACCOUNT_COLLECTION,
  AUTH_JS_USER_COLLECTION,
} from '~/modules/auth/auth.constant'
import type { Db, Filter, ObjectId } from 'mongodb'
import { defineMigration } from '../helper'

const normalizeUsername = (username?: string | null) => {
  if (!username) {
    return ''
  }
  return username.trim().toLowerCase()
}

const toDate = (value: unknown) => {
  if (!value) return undefined
  const date = new Date(value as any)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const buildReaderIdQuery = (id: string | ObjectId): Filter<any> => {
  if (typeof id === 'string') {
    return { _id: id }
  }
  return { _id: id }
}

export default defineMigration(
  'v9.7.4-owner-profile-and-password-migration',
  async (db: Db) => {
    const readers = db.collection(AUTH_JS_USER_COLLECTION)
    const accounts = db.collection(AUTH_JS_ACCOUNT_COLLECTION)
    const users = db.collection(USER_COLLECTION_NAME)
    const ownerProfiles = db.collection(OWNER_PROFILE_COLLECTION_NAME)

    await ownerProfiles.createIndex(
      { readerId: 1 },
      { unique: true, name: 'owner_profile_readerId_unique' },
    )

    const legacyOwner = await users.findOne(
      {},
      {
        projection: {
          username: 1,
          name: 1,
          avatar: 1,
          mail: 1,
          url: 1,
          introduce: 1,
          socialIds: 1,
          lastLoginTime: 1,
          lastLoginIp: 1,
          password: 1,
          created: 1,
        },
      },
    )

    let ownerReaders = await readers
      .find({ role: 'owner' })
      .sort({ createdAt: 1, _id: 1 })
      .toArray()

    if (ownerReaders.length === 0) {
      if (legacyOwner) {
        const now = new Date()
        const username = normalizeUsername(legacyOwner.username)
        const inserted = await readers.insertOne({
          name: legacyOwner.name ?? legacyOwner.username ?? 'owner',
          email: legacyOwner.mail ?? 'owner@local',
          emailVerified: true,
          image: legacyOwner.avatar ?? null,
          createdAt: toDate(legacyOwner.created) ?? now,
          updatedAt: now,
          role: 'owner',
          handle: legacyOwner.username ?? '',
          username: username || undefined,
          displayUsername:
            legacyOwner.name ?? legacyOwner.username ?? undefined,
        })

        ownerReaders = await readers
          .find(buildReaderIdQuery(inserted.insertedId))
          .toArray()
      } else {
        const fallbackReader = await readers
          .find({})
          .sort({ createdAt: 1, _id: 1 })
          .limit(1)
          .next()
        if (fallbackReader?._id) {
          await readers.updateOne(
            { _id: fallbackReader._id },
            { $set: { role: 'owner', updatedAt: new Date() } },
          )
          ownerReaders = [{ ...fallbackReader, role: 'owner' }]
        }
      }
    }

    if (ownerReaders.length === 0) {
      return
    }

    const ownerReader = ownerReaders[0]
    if (!ownerReader?._id) {
      return
    }

    if (legacyOwner) {
      const username = normalizeUsername(legacyOwner.username)
      const updates: Record<string, any> = {}
      if (!ownerReader.name && legacyOwner.name) {
        updates.name = legacyOwner.name
      }
      if (!ownerReader.email && legacyOwner.mail) {
        updates.email = legacyOwner.mail
      }
      if (!ownerReader.image && legacyOwner.avatar) {
        updates.image = legacyOwner.avatar
      }
      if (
        legacyOwner.username &&
        (!ownerReader.handle || ownerReader.handle !== legacyOwner.username)
      ) {
        updates.handle = legacyOwner.username
      }
      if (
        username &&
        (!ownerReader.username || ownerReader.username !== username)
      ) {
        updates.username = username
      }
      if (
        legacyOwner.name &&
        (!ownerReader.displayUsername ||
          ownerReader.displayUsername !== legacyOwner.name)
      ) {
        updates.displayUsername = legacyOwner.name
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date()
        await readers.updateOne({ _id: ownerReader._id }, { $set: updates })
      }

      const existingProfile = await ownerProfiles.findOne({
        readerId: ownerReader._id,
      })
      const profilePatch: Record<string, any> = {}
      if (!existingProfile?.mail && legacyOwner.mail) {
        profilePatch.mail = legacyOwner.mail
      }
      if (!existingProfile?.url && legacyOwner.url) {
        profilePatch.url = legacyOwner.url
      }
      if (!existingProfile?.introduce && legacyOwner.introduce) {
        profilePatch.introduce = legacyOwner.introduce
      }
      if (!existingProfile?.socialIds && legacyOwner.socialIds) {
        profilePatch.socialIds = legacyOwner.socialIds
      }
      if (!existingProfile?.lastLoginTime && legacyOwner.lastLoginTime) {
        profilePatch.lastLoginTime = toDate(legacyOwner.lastLoginTime)
      }
      if (!existingProfile?.lastLoginIp && legacyOwner.lastLoginIp) {
        profilePatch.lastLoginIp = legacyOwner.lastLoginIp
      }

      if (Object.keys(profilePatch).length > 0 || !existingProfile) {
        await ownerProfiles.updateOne(
          { readerId: ownerReader._id },
          {
            $set: profilePatch,
            $setOnInsert: {
              readerId: ownerReader._id,
              created: toDate(legacyOwner.created) ?? new Date(),
            },
          },
          { upsert: true },
        )
      }

      if (legacyOwner.password) {
        const ownerReaderId = ownerReader._id
        const ownerReaderIdString = ownerReaderId.toString()
        const account = await accounts.findOne(
          {
            providerId: 'credential',
            userId: { $in: [ownerReaderIdString, ownerReaderId] },
          },
          {
            projection: { _id: 1, password: 1 },
          },
        )
        if (!account) {
          const now = new Date()
          await accounts.insertOne({
            accountId: ownerReaderIdString,
            providerId: 'credential',
            userId: ownerReaderId,
            password: legacyOwner.password,
            createdAt: now,
            updatedAt: now,
          })
        } else if (!account.password) {
          await accounts.updateOne(
            { _id: account._id },
            {
              $set: {
                password: legacyOwner.password,
                updatedAt: new Date(),
              },
            },
          )
        }
      }
    }
  },
)
