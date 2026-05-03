import { CollectionRefTypes } from '~/constants/db.constant'
import {
  accounts,
  activities,
  aiAgentConversations,
  aiInsights,
  aiSummaries,
  aiTranslations,
  analyzes,
  apiKeys,
  authIdMap,
  categories,
  comments,
  drafts,
  fileReferences,
  links,
  notes,
  options,
  ownerProfiles,
  pages,
  passkeys,
  pollVoteOptions,
  pollVotes,
  posts,
  projects,
  readers,
  recentlies,
  says,
  searchDocuments,
  serverlessLogs,
  serverlessStorages,
  sessions,
  slugTrackers,
  snippets,
  subscribes,
  topics,
  translationEntries,
  verifications,
  webhookEvents,
  webhooks,
} from '~/database/schema'

import { allocateForCollection, createResolver, mongoHexOf } from './id-map'
import type { MigrationContext, MigrationStep } from './types'

const upsert = async <T extends Record<string, unknown>>(
  ctx: MigrationContext,
  table: any,
  rows: T[],
) => {
  if (ctx.mode !== 'apply' || rows.length === 0) return
  const chunkSize = 200
  let inserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    try {
      const result = await ctx.pg
        .insert(table)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: (table as any).id })
      inserted += result.length
    } catch (err) {
      ctx.reports.warnings.push({
        collection:
          table[Symbol.for('drizzle:Name') as any]?.toString() ?? 'unknown',
        mongoId: 'batch',
        reason: (err as Error).message,
      })
    }
  }
  const skipped = rows.length - inserted
  if (skipped > 0) {
    const name =
      table[Symbol.for('drizzle:Name') as any]?.toString() ?? 'unknown'
    ctx.reports.warnings.push({
      collection: name,
      mongoId: `${skipped}/${rows.length} rows`,
      reason: `skipped (conflict) — re-run detected existing rows`,
    })
  }
}

const recordLoad = (ctx: MigrationContext, collection: string, n: number) => {
  ctx.reports.rowsLoaded[collection] =
    (ctx.reports.rowsLoaded[collection] ?? 0) + n
}

const collect = async <T>(
  ctx: MigrationContext,
  collection: string,
): Promise<T[]> => {
  const docs = await ctx.mongo.collection(collection).find({}).toArray()
  return docs as unknown as T[]
}

const collectAuth = async <T>(
  ctx: MigrationContext,
  collection: string,
  aliases: string[] = [],
): Promise<T[]> => {
  const docs = await collect<T>(ctx, collection)
  if (docs.length > 0 || aliases.length === 0) return docs
  for (const alias of aliases) {
    const aliasDocs = await collect<T>(ctx, alias)
    if (aliasDocs.length > 0) return aliasDocs
  }
  return docs
}

const recordAuthIds = async (
  ctx: MigrationContext,
  collection: string,
  ids: string[],
) => {
  if (ctx.mode !== 'apply' || ids.length === 0) return
  const now = new Date()
  const rows = ids.map((id) => ({
    collection,
    mongoId: id,
    pgId: id,
    createdAt: now,
  }))
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    await ctx.pg
      .insert(authIdMap)
      .values(rows.slice(i, i + chunkSize))
      .onConflictDoNothing()
  }
}

type ContentRefTarget = {
  collection: 'posts' | 'notes' | 'pages' | 'recentlies'
  refType: CollectionRefTypes
}

const CONTENT_REF_TYPE_ALIASES: Record<string, ContentRefTarget> = {
  posts: { collection: 'posts', refType: CollectionRefTypes.Post },
  post: { collection: 'posts', refType: CollectionRefTypes.Post },
  Post: { collection: 'posts', refType: CollectionRefTypes.Post },
  notes: { collection: 'notes', refType: CollectionRefTypes.Note },
  note: { collection: 'notes', refType: CollectionRefTypes.Note },
  Note: { collection: 'notes', refType: CollectionRefTypes.Note },
  pages: { collection: 'pages', refType: CollectionRefTypes.Page },
  page: { collection: 'pages', refType: CollectionRefTypes.Page },
  Page: { collection: 'pages', refType: CollectionRefTypes.Page },
  recentlies: {
    collection: 'recentlies',
    refType: CollectionRefTypes.Recently,
  },
  recently: {
    collection: 'recentlies',
    refType: CollectionRefTypes.Recently,
  },
  Recently: {
    collection: 'recentlies',
    refType: CollectionRefTypes.Recently,
  },
}

const normalizeContentRefType = (value: unknown): ContentRefTarget | null => {
  if (typeof value !== 'string') return null
  return CONTENT_REF_TYPE_ALIASES[value] ?? null
}

const dateOrNull = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const normalizeLegacyJsonbObject = (
  ctx: MigrationContext,
  collection: string,
  mongoId: unknown,
  field: string,
  value: unknown,
): Record<string, unknown> | null => {
  if (value === undefined || value === null || value === '') return null

  let normalized = value
  if (typeof value === 'string') {
    try {
      normalized = JSON.parse(value)
    } catch {
      ctx.reports.warnings.push({
        collection,
        mongoId: String(mongoId),
        reason: `${field} contains invalid JSON string`,
      })
      return null
    }
  }

  if (normalized === null) return null
  if (isPlainObject(normalized)) return normalized

  ctx.reports.warnings.push({
    collection,
    mongoId: String(mongoId),
    reason: `${field} must be a JSON object; received ${
      Array.isArray(normalized) ? 'array' : typeof normalized
    }`,
  })
  return null
}

export const stepCategories: MigrationStep = {
  name: 'categories',
  async allocate(ctx) {
    await allocateForCollection(ctx, 'categories')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'categories')
    const docs = await collect<any>(ctx, 'categories')
    const rows = docs.map((d) => ({
      id: resolver.self(d._id),
      name: d.name,
      slug: d.slug,
      type: d.type ?? 0,
      createdAt: dateOrNull(d.created) ?? new Date(),
    }))
    await upsert(ctx, categories, rows)
    recordLoad(ctx, 'categories', rows.length)
  },
}

export const stepTopics: MigrationStep = {
  name: 'topics',
  async allocate(ctx) {
    await allocateForCollection(ctx, 'topics')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'topics')
    const docs = await collect<any>(ctx, 'topics')
    const rows = docs.map((d) => ({
      id: resolver.self(d._id),
      name: d.name,
      slug: d.slug ?? d.name,
      description: d.description ?? '',
      introduce: d.introduce ?? null,
      icon: d.icon ?? null,
      createdAt: dateOrNull(d.created) ?? new Date(),
    }))
    await upsert(ctx, topics, rows)
    recordLoad(ctx, 'topics', rows.length)
  },
}

export const stepReaders: MigrationStep = {
  name: 'readers',
  async allocate(ctx) {
    await allocateForCollection(ctx, 'readers')
  },
  async load(ctx) {
    const readerDocs = await collectAuth<any>(ctx, 'readers')
    const readerRows = readerDocs
      .map((d) => {
        const id = mongoHexOf(d._id)
        if (!id) return null
        return {
          id,
          email: d.email ?? null,
          emailVerified: Boolean(d.emailVerified ?? false),
          name: d.name ?? null,
          handle: d.handle ?? null,
          username: d.username ?? null,
          displayUsername: d.displayUsername ?? null,
          image: d.image ?? null,
          role: d.role ?? 'reader',
          createdAt: dateOrNull(d.createdAt ?? d.created) ?? new Date(),
          updatedAt: dateOrNull(d.updatedAt ?? d.updated),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, readers, readerRows)
    await recordAuthIds(
      ctx,
      'readers',
      readerRows.map((row) => row.id),
    )
    recordLoad(ctx, 'readers', readerRows.length)
  },
}

export const stepOwnerProfiles: MigrationStep = {
  name: 'owner_profiles',
  dependsOn: ['readers'],
  async load(ctx) {
    const profileDocs = await collectAuth<any>(ctx, 'owner_profiles')
    const profileRows = profileDocs
      .map((d) => {
        const id = mongoHexOf(d._id)
        const readerId = mongoHexOf(d.readerId)
        if (!id || !readerId) {
          ctx.reports.missingRefs.push({
            collection: 'owner_profiles',
            field: !id ? '_id' : 'readerId',
            mongoId: String(!id ? d._id : d.readerId),
          })
          return null
        }
        return {
          id,
          readerId,
          mail: d.mail ?? null,
          url: d.url ?? null,
          introduce: d.introduce ?? null,
          lastLoginIp: d.lastLoginIp ?? null,
          lastLoginTime: dateOrNull(d.lastLoginTime),
          socialIds: d.socialIds ?? null,
          createdAt: dateOrNull(d.created) ?? new Date(),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, ownerProfiles, profileRows)
    await recordAuthIds(
      ctx,
      'owner_profiles',
      profileRows.map((row) => row.id),
    )
    recordLoad(ctx, 'owner_profiles', profileRows.length)
  },
}

export const stepAccounts: MigrationStep = {
  name: 'accounts',
  dependsOn: ['readers'],
  async load(ctx) {
    const docs = await collectAuth<any>(ctx, 'accounts')
    const rows = docs
      .map((d) => {
        const id = mongoHexOf(d._id)
        const userId = mongoHexOf(d.userId)
        if (!id || !userId) {
          ctx.reports.missingRefs.push({
            collection: 'accounts',
            field: !id ? '_id' : 'userId',
            mongoId: String(!id ? d._id : d.userId),
          })
          return null
        }
        return {
          id,
          userId,
          accountId: d.accountId ?? d.providerAccountId ?? userId,
          providerId: d.providerId ?? d.provider ?? 'credential',
          providerAccountId: d.providerAccountId ?? null,
          password: d.password ?? null,
          type: d.type ?? null,
          accessToken: d.accessToken ?? null,
          refreshToken: d.refreshToken ?? null,
          accessTokenExpiresAt: dateOrNull(d.accessTokenExpiresAt),
          refreshTokenExpiresAt: dateOrNull(d.refreshTokenExpiresAt),
          scope: d.scope ?? null,
          idToken: d.idToken ?? null,
          raw: d.raw ?? null,
          createdAt: dateOrNull(d.createdAt ?? d.created) ?? new Date(),
          updatedAt: dateOrNull(d.updatedAt ?? d.updated),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, accounts, rows)
    await recordAuthIds(
      ctx,
      'accounts',
      rows.map((row) => row.id),
    )
    recordLoad(ctx, 'accounts', rows.length)
  },
}

export const stepSessions: MigrationStep = {
  name: 'sessions',
  dependsOn: ['readers'],
  async load(ctx) {
    const docs = await collectAuth<any>(ctx, 'sessions')
    const rows = docs
      .map((d) => {
        const id = mongoHexOf(d._id)
        const userId = mongoHexOf(d.userId)
        if (!id || !userId) {
          ctx.reports.missingRefs.push({
            collection: 'sessions',
            field: !id ? '_id' : 'userId',
            mongoId: String(!id ? d._id : d.userId),
          })
          return null
        }
        return {
          id,
          userId,
          token: d.token ?? d.sessionToken,
          expiresAt: dateOrNull(d.expiresAt),
          ipAddress: d.ipAddress ?? null,
          userAgent: d.userAgent ?? null,
          provider: d.provider ?? null,
          createdAt: dateOrNull(d.createdAt ?? d.created) ?? new Date(),
          updatedAt: dateOrNull(d.updatedAt ?? d.updated),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, sessions, rows)
    await recordAuthIds(
      ctx,
      'sessions',
      rows.map((row) => row.id),
    )
    recordLoad(ctx, 'sessions', rows.length)
  },
}

export const stepApiKeys: MigrationStep = {
  name: 'api_keys',
  dependsOn: ['readers'],
  async load(ctx) {
    const docs = await collectAuth<any>(ctx, 'api_keys', ['apikey'])
    const rows = docs
      .map((d) => {
        const id = mongoHexOf(d._id)
        const userId = mongoHexOf(d.userId)
        const referenceId = mongoHexOf(d.referenceId ?? d.userId)
        if (!id) return null
        return {
          id,
          userId,
          referenceId,
          configId: d.configId ?? 'default',
          name: d.name ?? null,
          key: d.key,
          start: d.start ?? null,
          prefix: d.prefix ?? null,
          enabled: d.enabled ?? true,
          rateLimitEnabled: d.rateLimitEnabled ?? false,
          rateLimitTimeWindow: d.rateLimitTimeWindow ?? null,
          rateLimitMax: d.rateLimitMax ?? null,
          requestCount: d.requestCount ?? 0,
          remaining: d.remaining ?? null,
          refillInterval: d.refillInterval ?? null,
          refillAmount: d.refillAmount ?? null,
          expiresAt: dateOrNull(d.expiresAt),
          lastRefillAt: dateOrNull(d.lastRefillAt),
          lastRequest: dateOrNull(d.lastRequest),
          permissions: d.permissions ?? null,
          metadata: d.metadata ?? null,
          createdAt: dateOrNull(d.createdAt ?? d.created) ?? new Date(),
          updatedAt: dateOrNull(d.updatedAt ?? d.updated),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, apiKeys, rows)
    await recordAuthIds(
      ctx,
      'api_keys',
      rows.map((row) => row.id),
    )
    recordLoad(ctx, 'api_keys', rows.length)
  },
}

export const stepPasskeys: MigrationStep = {
  name: 'passkeys',
  dependsOn: ['readers'],
  async load(ctx) {
    const docs = await collectAuth<any>(ctx, 'passkeys', ['passkey'])
    const rows = docs
      .map((d) => {
        const id = mongoHexOf(d._id)
        const userId = mongoHexOf(d.userId)
        if (!id || !userId) {
          ctx.reports.missingRefs.push({
            collection: 'passkeys',
            field: !id ? '_id' : 'userId',
            mongoId: String(!id ? d._id : d.userId),
          })
          return null
        }
        return {
          id,
          userId,
          name: d.name ?? null,
          credentialId: d.credentialId ?? d.credentialID,
          publicKey: d.publicKey,
          counter: d.counter ?? 0,
          deviceType: d.deviceType ?? null,
          backedUp: d.backedUp ?? false,
          transports: d.transports ?? null,
          aaguid: d.aaguid ?? null,
          createdAt: dateOrNull(d.createdAt ?? d.created) ?? new Date(),
          updatedAt: dateOrNull(d.updatedAt ?? d.updated),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, passkeys, rows)
    await recordAuthIds(
      ctx,
      'passkeys',
      rows.map((row) => row.id),
    )
    recordLoad(ctx, 'passkeys', rows.length)
  },
}

export const stepVerifications: MigrationStep = {
  name: 'verifications',
  async load(ctx) {
    const docs = await collectAuth<any>(ctx, 'verifications', ['verification'])
    const rows = docs
      .map((d) => {
        const id = mongoHexOf(d._id)
        if (!id) return null
        return {
          id,
          identifier: d.identifier,
          value: d.value,
          expiresAt: dateOrNull(d.expiresAt) ?? new Date(),
          createdAt: dateOrNull(d.createdAt ?? d.created) ?? new Date(),
          updatedAt: dateOrNull(d.updatedAt ?? d.updated),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, verifications, rows)
    await recordAuthIds(
      ctx,
      'verifications',
      rows.map((row) => row.id),
    )
    recordLoad(ctx, 'verifications', rows.length)
  },
}

export const stepPosts: MigrationStep = {
  name: 'posts',
  dependsOn: ['categories'],
  async allocate(ctx) {
    await allocateForCollection(ctx, 'posts')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'posts')
    const docs = await collect<any>(ctx, 'posts')
    const rows = docs
      .map((d) => {
        const categoryId = resolver.ref(
          'categories',
          d.categoryId,
          'categoryId',
          true,
        )
        if (!categoryId) return null
        return {
          id: resolver.self(d._id),
          title: d.title,
          slug: d.slug,
          text: d.text ?? null,
          content: d.content ?? null,
          contentFormat: d.contentFormat ?? 'markdown',
          summary: d.summary ?? null,
          images: d.images ?? null,
          meta: normalizeLegacyJsonbObject(ctx, 'posts', d._id, 'meta', d.meta),
          tags: d.tags ?? [],
          modifiedAt: dateOrNull(d.modified),
          categoryId,
          copyright: d.copyright ?? true,
          isPublished: d.isPublished ?? true,
          readCount: d.count?.read ?? 0,
          likeCount: d.count?.like ?? 0,
          pinAt: dateOrNull(d.pin),
          pinOrder: typeof d.pinOrder === 'number' ? d.pinOrder : null,
          createdAt: dateOrNull(d.created) ?? new Date(),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, posts, rows)
    recordLoad(ctx, 'posts', rows.length)
  },
}

export const stepNotes: MigrationStep = {
  name: 'notes',
  dependsOn: ['topics'],
  async allocate(ctx) {
    await allocateForCollection(ctx, 'notes')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'notes')
    const docs = await collect<any>(ctx, 'notes')
    const rows = docs.map((d) => ({
      id: resolver.self(d._id),
      nid: d.nid,
      title: d.title ?? null,
      slug: d.slug ?? null,
      text: d.text ?? null,
      content: d.content ?? null,
      contentFormat: d.contentFormat ?? 'markdown',
      images: d.images ?? null,
      meta: normalizeLegacyJsonbObject(ctx, 'notes', d._id, 'meta', d.meta),
      isPublished: d.isPublished ?? true,
      password: d.password ?? null,
      publicAt: dateOrNull(d.publicAt),
      mood: d.mood ?? null,
      weather: d.weather ?? null,
      bookmark: Boolean(d.bookmark ?? false),
      coordinates: d.coordinates ?? null,
      location: d.location ?? null,
      readCount: d.count?.read ?? 0,
      likeCount: d.count?.like ?? 0,
      topicId: resolver.ref('topics', d.topicId, 'topicId', false),
      createdAt: dateOrNull(d.created) ?? new Date(),
      modifiedAt: dateOrNull(d.modified),
    }))
    await upsert(ctx, notes, rows)
    recordLoad(ctx, 'notes', rows.length)
  },
}

export const stepPages: MigrationStep = {
  name: 'pages',
  async allocate(ctx) {
    await allocateForCollection(ctx, 'pages')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'pages')
    const docs = await collect<any>(ctx, 'pages')
    const rows = docs.map((d) => ({
      id: resolver.self(d._id),
      title: d.title,
      slug: d.slug,
      subtitle: d.subtitle ?? null,
      text: d.text ?? null,
      content: d.content ?? null,
      contentFormat: d.contentFormat ?? 'markdown',
      images: d.images ?? null,
      meta: normalizeLegacyJsonbObject(ctx, 'pages', d._id, 'meta', d.meta),
      order: d.order ?? 1,
      createdAt: dateOrNull(d.created) ?? new Date(),
      modifiedAt: dateOrNull(d.modified),
    }))
    await upsert(ctx, pages, rows)
    recordLoad(ctx, 'pages', rows.length)
  },
}

export const stepRecentlies: MigrationStep = {
  name: 'recentlies',
  dependsOn: ['posts', 'notes', 'pages'],
  async allocate(ctx) {
    await allocateForCollection(ctx, 'recentlies')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'recentlies')
    const docs = await collect<any>(ctx, 'recentlies')
    const rows = docs.map((d) => {
      const refTarget = normalizeContentRefType(d.refType)
      const refId = refTarget
        ? resolver.ref(refTarget.collection, d.ref ?? d.refId, 'refId', false)
        : null
      return {
        id: resolver.self(d._id),
        content: d.content ?? '',
        type: d.type ?? 'text',
        metadata: d.metadata ?? null,
        refType: refTarget?.refType ?? null,
        refId,
        commentsIndex: d.commentsIndex ?? 0,
        allowComment: d.allowComment ?? true,
        up: d.up ?? 0,
        down: d.down ?? 0,
        createdAt: dateOrNull(d.created) ?? new Date(),
        modifiedAt: dateOrNull(d.modified),
      }
    })
    await upsert(ctx, recentlies, rows)
    recordLoad(ctx, 'recentlies', rows.length)
  },
}

export const stepComments: MigrationStep = {
  name: 'comments',
  dependsOn: ['posts', 'notes', 'pages', 'recentlies', 'readers'],
  async allocate(ctx) {
    await allocateForCollection(ctx, 'comments')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'comments')
    const docs = await collect<any>(ctx, 'comments')
    const rows = docs
      .map((d) => {
        const refTarget = normalizeContentRefType(d.refType)
        if (!refTarget) {
          ctx.reports.warnings.push({
            collection: 'comments',
            mongoId: String(d._id),
            reason: `unknown refType ${d.refType}`,
          })
          return null
        }
        const refId = resolver.ref(
          refTarget.collection,
          d.ref ?? d.refId,
          'refId',
          true,
        )
        if (!refId) return null
        return {
          id: resolver.self(d._id),
          refType: refTarget.refType,
          refId,
          author: d.author ?? null,
          mail: d.mail ?? null,
          url: d.url ?? null,
          text: d.text,
          state: d.state ?? 0,
          parentCommentId: resolver.ref(
            'comments',
            d.parent,
            'parentCommentId',
            false,
          ),
          rootCommentId: resolver.ref(
            'comments',
            d.root,
            'rootCommentId',
            false,
          ),
          replyCount: d.replyCount ?? 0,
          latestReplyAt: dateOrNull(d.latestReplyAt),
          isDeleted: Boolean(d.isDeleted ?? false),
          deletedAt: dateOrNull(d.deletedAt),
          ip: d.ip ?? null,
          agent: d.agent ?? null,
          pin: Boolean(d.pin ?? false),
          location: d.location ?? null,
          isWhispers: Boolean(d.isWhispers ?? false),
          avatar: d.avatar ?? null,
          authProvider: d.authProvider ?? null,
          meta: d.meta ?? null,
          readerId: mongoHexOf(d.readerId),
          editedAt: dateOrNull(d.editedAt),
          anchor: d.anchor ?? null,
          createdAt: dateOrNull(d.created) ?? new Date(),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, comments, rows)
    recordLoad(ctx, 'comments', rows.length)
  },
}

export const stepDrafts: MigrationStep = {
  name: 'drafts',
  dependsOn: ['posts', 'notes', 'pages'],
  async allocate(ctx) {
    await allocateForCollection(ctx, 'drafts')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'drafts')
    const docs = await collect<any>(ctx, 'drafts')
    const rows = docs.map((d) => {
      const refTarget = normalizeContentRefType(d.refType)
      const refCollection = refTarget?.collection ?? (d.refType as string)
      const refType = refTarget?.refType ?? (d.refType as string)
      const refId = resolver.ref(refCollection, d.refId, 'refId', false)
      return {
        id: resolver.self(d._id),
        refType: refType as CollectionRefTypes,
        refId,
        title: d.title ?? '',
        text: d.text ?? '',
        content: d.content ?? null,
        contentFormat: d.contentFormat ?? 'markdown',
        images: d.images ?? null,
        meta: normalizeLegacyJsonbObject(ctx, 'drafts', d._id, 'meta', d.meta),
        typeSpecificData: d.typeSpecificData ?? null,
        history: d.history ?? [],
        version: d.version ?? 1,
        publishedVersion: d.publishedVersion ?? null,
        createdAt: dateOrNull(d.created) ?? new Date(),
        updatedAt: dateOrNull(d.updated),
      }
    })
    await upsert(ctx, drafts, rows)
    recordLoad(ctx, 'drafts', rows.length)
  },
}

export const stepSimpleCollections: MigrationStep[] = [
  {
    name: 'options',
    async allocate(ctx) {
      await allocateForCollection(ctx, 'options')
    },
    async load(ctx) {
      const resolver = createResolver(ctx, 'options')
      const docs = await collect<any>(ctx, 'options')
      const rows = docs.map((d) => ({
        id: resolver.self(d._id),
        name: d.name,
        value: d.value ?? null,
      }))
      await upsert(ctx, options, rows)
      recordLoad(ctx, 'options', rows.length)
    },
  },
  {
    name: 'links',
    async allocate(ctx) {
      await allocateForCollection(ctx, 'links')
    },
    async load(ctx) {
      const resolver = createResolver(ctx, 'links')
      const docs = await collect<any>(ctx, 'links')
      const rows = docs.map((d) => ({
        id: resolver.self(d._id),
        name: d.name,
        url: d.url,
        avatar: d.avatar ?? null,
        description: d.description ?? null,
        type: d.type ?? 0,
        state: d.state ?? 0,
        email: d.email ?? null,
        createdAt: dateOrNull(d.created) ?? new Date(),
      }))
      await upsert(ctx, links, rows)
      recordLoad(ctx, 'links', rows.length)
    },
  },
  {
    name: 'projects',
    async allocate(ctx) {
      await allocateForCollection(ctx, 'projects')
    },
    async load(ctx) {
      const resolver = createResolver(ctx, 'projects')
      const docs = await collect<any>(ctx, 'projects')
      const rows = docs.map((d) => ({
        id: resolver.self(d._id),
        name: d.name,
        description: d.description,
        previewUrl: d.previewUrl ?? null,
        docUrl: d.docUrl ?? null,
        projectUrl: d.projectUrl ?? null,
        images: d.images ?? null,
        avatar: d.avatar ?? null,
        text: d.text ?? null,
        createdAt: dateOrNull(d.created) ?? new Date(),
      }))
      await upsert(ctx, projects, rows)
      recordLoad(ctx, 'projects', rows.length)
    },
  },
  {
    name: 'says',
    async allocate(ctx) {
      await allocateForCollection(ctx, 'says')
    },
    async load(ctx) {
      const resolver = createResolver(ctx, 'says')
      const docs = await collect<any>(ctx, 'says')
      const rows = docs.map((d) => ({
        id: resolver.self(d._id),
        text: d.text,
        source: d.source ?? null,
        author: d.author ?? null,
        createdAt: dateOrNull(d.created) ?? new Date(),
      }))
      await upsert(ctx, says, rows)
      recordLoad(ctx, 'says', rows.length)
    },
  },
  {
    name: 'snippets',
    async allocate(ctx) {
      await allocateForCollection(ctx, 'snippets')
    },
    async load(ctx) {
      const resolver = createResolver(ctx, 'snippets')
      const docs = await collect<any>(ctx, 'snippets')
      const rows = docs.map((d) => ({
        id: resolver.self(d._id),
        type: d.type ?? null,
        private: Boolean(d.private ?? false),
        raw: d.raw ?? '',
        name: d.name,
        reference: d.reference ?? 'root',
        comment: d.comment ?? null,
        metatype: d.metatype ?? null,
        schema: d.schema ?? null,
        method: d.method ?? null,
        customPath: d.customPath ?? null,
        secret: d.secret ?? null,
        enable: d.enable ?? true,
        builtIn: Boolean(d.builtIn ?? false),
        compiledCode: d.compiledCode ?? null,
        createdAt: dateOrNull(d.created) ?? new Date(),
        updatedAt: dateOrNull(d.updated),
      }))
      await upsert(ctx, snippets, rows)
      recordLoad(ctx, 'snippets', rows.length)
    },
  },
  {
    name: 'subscribes',
    async allocate(ctx) {
      await allocateForCollection(ctx, 'subscribes')
    },
    async load(ctx) {
      const resolver = createResolver(ctx, 'subscribes')
      const docs = await collect<any>(ctx, 'subscribes')
      const rows = docs.map((d) => ({
        id: resolver.self(d._id),
        email: d.email,
        cancelToken: d.cancelToken,
        subscribe: d.subscribe ?? 0,
        verified: Boolean(d.verified ?? false),
        createdAt: dateOrNull(d.created) ?? new Date(),
      }))
      await upsert(ctx, subscribes, rows)
      recordLoad(ctx, 'subscribes', rows.length)
    },
  },
  {
    name: 'activities',
    async allocate(ctx) {
      await allocateForCollection(ctx, 'activities')
    },
    async load(ctx) {
      const resolver = createResolver(ctx, 'activities')
      const docs = await collect<any>(ctx, 'activities')
      const rows = docs.map((d) => ({
        id: resolver.self(d._id),
        type: d.type ?? null,
        payload: d.payload ?? null,
        createdAt: dateOrNull(d.created) ?? new Date(),
      }))
      await upsert(ctx, activities, rows)
      recordLoad(ctx, 'activities', rows.length)
    },
  },
  {
    name: 'analyzes',
    async allocate(ctx) {
      await allocateForCollection(ctx, 'analyzes')
    },
    async load(ctx) {
      const resolver = createResolver(ctx, 'analyzes')
      const docs = await collect<any>(ctx, 'analyzes')
      const rows = docs.map((d) => ({
        id: resolver.self(d._id),
        timestamp: dateOrNull(d.timestamp ?? d.created) ?? new Date(),
        ip: d.ip ?? null,
        ua: d.ua ?? null,
        country: d.country ?? null,
        path: d.path ?? null,
        referer: d.referer ?? null,
      }))
      await upsert(ctx, analyzes, rows)
      recordLoad(ctx, 'analyzes', rows.length)
    },
  },
]

export const stepFileReferences: MigrationStep = {
  name: 'file_references',
  dependsOn: ['posts', 'notes', 'pages', 'drafts'],
  async allocate(ctx) {
    await allocateForCollection(ctx, 'file_references')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'file_references')
    const docs = await collect<any>(ctx, 'file_references')
    const refMap: Record<string, { collection: string; refType: string }> = {
      post: { collection: 'posts', refType: 'post' },
      posts: { collection: 'posts', refType: 'post' },
      note: { collection: 'notes', refType: 'note' },
      notes: { collection: 'notes', refType: 'note' },
      page: { collection: 'pages', refType: 'page' },
      pages: { collection: 'pages', refType: 'page' },
      draft: { collection: 'drafts', refType: 'draft' },
      drafts: { collection: 'drafts', refType: 'draft' },
      comment: { collection: 'comments', refType: 'comment' },
      comments: { collection: 'comments', refType: 'comment' },
    }
    const rows = docs.map((d) => {
      const refTarget = d.refType ? refMap[d.refType] : null
      const refId = refTarget
        ? resolver.ref(refTarget.collection, d.refId, 'refId', false)
        : null
      return {
        id: resolver.self(d._id),
        fileUrl: d.fileUrl,
        fileName: d.fileName,
        status: d.status ?? 'pending',
        refId,
        refType: refTarget?.refType ?? d.refType ?? null,
        s3ObjectKey: d.s3ObjectKey ?? null,
        createdAt: dateOrNull(d.created) ?? new Date(),
      }
    })
    await upsert(ctx, fileReferences, rows)
    recordLoad(ctx, 'file_references', rows.length)
  },
}

export const stepPolls: MigrationStep = {
  name: 'poll_votes',
  async allocate(ctx) {
    await allocateForCollection(ctx, 'poll_votes')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'poll_votes')
    const docs = await collect<any>(ctx, 'poll_votes')
    const voteRows = docs.map((d) => ({
      id: resolver.self(d._id),
      pollId: d.pollId,
      voterFingerprint: d.voterFingerprint,
      createdAt: dateOrNull(d.created) ?? new Date(),
    }))
    await upsert(ctx, pollVotes, voteRows)
    recordLoad(ctx, 'poll_votes', voteRows.length)

    const optionRows = docs.flatMap((d) => {
      const voteId = resolver.self(d._id)
      const optionIds: string[] = Array.isArray(d.optionIds) ? d.optionIds : []
      return optionIds.map((optionId) => ({ voteId, optionId }))
    })
    await upsert(ctx, pollVoteOptions, optionRows)
    recordLoad(ctx, 'poll_vote_options', optionRows.length)
  },
}

export const stepSlugTrackers: MigrationStep = {
  name: 'slug_trackers',
  dependsOn: ['posts', 'notes', 'pages'],
  async allocate(ctx) {
    await allocateForCollection(ctx, 'slug_trackers')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'slug_trackers')
    const docs = await collect<any>(ctx, 'slug_trackers')
    const rows = docs
      .map((d) => {
        // Resolve target by inspecting collection candidates
        const candidates = ['posts', 'notes', 'pages']
        let targetId: bigint | null = null
        for (const coll of candidates) {
          const t = resolver.ref(coll, d.targetId, 'targetId', false)
          if (t) {
            targetId = t
            break
          }
        }
        if (!targetId) {
          ctx.reports.missingRefs.push({
            collection: 'slug_trackers',
            field: 'targetId',
            mongoId: String(d.targetId ?? 'null'),
          })
          return null
        }
        return {
          id: resolver.self(d._id),
          slug: d.slug,
          type: d.type,
          targetId,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, slugTrackers, rows)
    recordLoad(ctx, 'slug_trackers', rows.length)
  },
}

export const stepWebhooks: MigrationStep = {
  name: 'webhooks',
  async allocate(ctx) {
    await allocateForCollection(ctx, 'webhooks')
    await allocateForCollection(ctx, 'webhook_events')
  },
  async load(ctx) {
    const hookResolver = createResolver(ctx, 'webhooks')
    const eventResolver = createResolver(ctx, 'webhook_events')

    const hookDocs = await collect<any>(ctx, 'webhooks')
    await upsert(
      ctx,
      webhooks,
      hookDocs.map((d) => ({
        id: hookResolver.self(d._id),
        timestamp: dateOrNull(d.timestamp ?? d.created) ?? new Date(),
        payloadUrl: d.payloadUrl,
        events: d.events ?? [],
        enabled: d.enabled ?? true,
        secret: d.secret ?? '',
        scope: d.scope ?? null,
      })),
    )
    recordLoad(ctx, 'webhooks', hookDocs.length)

    const eventDocs = await collect<any>(ctx, 'webhook_events')
    const eventRows = eventDocs
      .map((d) => {
        const hookId = eventResolver.ref(
          'webhooks',
          d.hookId ?? d.webhookId,
          'hookId',
          true,
        )
        if (!hookId) return null
        return {
          id: eventResolver.self(d._id),
          timestamp: dateOrNull(d.timestamp ?? d.created),
          headers: d.headers ?? null,
          payload: d.payload ?? null,
          event: d.event ?? null,
          response: d.response ?? null,
          success: d.success ?? null,
          hookId,
          status: d.status ?? 0,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, webhookEvents, eventRows)
    recordLoad(ctx, 'webhook_events', eventRows.length)
  },
}

export const stepAi: MigrationStep = {
  name: 'ai',
  dependsOn: ['posts', 'notes', 'pages'],
  async allocate(ctx) {
    await Promise.all([
      allocateForCollection(ctx, 'ai_summaries'),
      allocateForCollection(ctx, 'ai_insights'),
      allocateForCollection(ctx, 'ai_translations'),
      allocateForCollection(ctx, 'translation_entries'),
      allocateForCollection(ctx, 'ai_agent_conversations'),
    ])
  },
  async load(ctx) {
    const summaryResolver = createResolver(ctx, 'ai_summaries')
    const insightsResolver = createResolver(ctx, 'ai_insights')
    const translationResolver = createResolver(ctx, 'ai_translations')
    const entryResolver = createResolver(ctx, 'translation_entries')
    const agentResolver = createResolver(ctx, 'ai_agent_conversations')

    const candidates = ['posts', 'notes', 'pages']
    const resolveContentRef = (
      mongoId: any,
      sourceColl: string,
    ): bigint | null => {
      for (const coll of candidates) {
        const t = ctx.idMap.get(coll)?.get(String(mongoId))
        if (t) return t
      }
      ctx.reports.missingRefs.push({
        collection: sourceColl,
        field: 'refId',
        mongoId: String(mongoId),
      })
      return null
    }

    const summaryDocs = await collect<any>(ctx, 'ai_summaries')
    const summaryRows = summaryDocs
      .map((d) => {
        const refId = resolveContentRef(d.refId, 'ai_summaries')
        if (!refId) return null
        return {
          id: summaryResolver.self(d._id),
          hash: d.hash,
          summary: d.summary,
          refId,
          lang: d.lang ?? null,
          createdAt: dateOrNull(d.created) ?? new Date(),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, aiSummaries, summaryRows)
    recordLoad(ctx, 'ai_summaries', summaryRows.length)

    const insightsDocs = await collect<any>(ctx, 'ai_insights')
    const insightsRows = insightsDocs
      .map((d) => {
        const refId = resolveContentRef(d.refId, 'ai_insights')
        if (!refId) return null
        return {
          id: insightsResolver.self(d._id),
          refId,
          lang: d.lang,
          hash: d.hash,
          content: d.content,
          isTranslation: Boolean(d.isTranslation ?? false),
          sourceInsightsId: d.sourceInsightsId
            ? insightsResolver.ref(
                'ai_insights',
                d.sourceInsightsId,
                'sourceInsightsId',
                false,
              )
            : null,
          sourceLang: d.sourceLang ?? null,
          modelInfo: d.modelInfo ?? null,
          createdAt: dateOrNull(d.created) ?? new Date(),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, aiInsights, insightsRows)
    recordLoad(ctx, 'ai_insights', insightsRows.length)

    const translationDocs = await collect<any>(ctx, 'ai_translations')
    const translationRows = translationDocs
      .map((d) => {
        const refId = resolveContentRef(d.refId, 'ai_translations')
        if (!refId) return null
        return {
          id: translationResolver.self(d._id),
          hash: d.hash,
          refId,
          refType: normalizeContentRefType(d.refType)?.refType ?? d.refType,
          lang: d.lang,
          sourceLang: d.sourceLang,
          title: d.title,
          text: d.text,
          subtitle: d.subtitle ?? null,
          summary: d.summary ?? null,
          tags: d.tags ?? [],
          sourceModifiedAt: dateOrNull(d.sourceModifiedAt),
          aiModel: d.aiModel ?? null,
          aiProvider: d.aiProvider ?? null,
          contentFormat: d.contentFormat ?? null,
          content: d.content ?? null,
          sourceBlockSnapshots: d.sourceBlockSnapshots ?? null,
          sourceMetaHashes: d.sourceMetaHashes ?? null,
          createdAt: dateOrNull(d.created) ?? new Date(),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, aiTranslations, translationRows)
    recordLoad(ctx, 'ai_translations', translationRows.length)

    const entryDocs = await collect<any>(ctx, 'translation_entries')
    await upsert(
      ctx,
      translationEntries,
      entryDocs.map((d) => ({
        id: entryResolver.self(d._id),
        keyPath: d.keyPath,
        lang: d.lang,
        keyType: d.keyType,
        lookupKey: d.lookupKey,
        sourceText: d.sourceText,
        translatedText: d.translatedText,
        sourceUpdatedAt: dateOrNull(d.sourceUpdatedAt),
        createdAt: dateOrNull(d.created) ?? new Date(),
      })),
    )
    recordLoad(ctx, 'translation_entries', entryDocs.length)

    const agentDocs = await collect<any>(ctx, 'ai_agent_conversations')
    const agentRows = agentDocs
      .map((d) => {
        const refId = resolveContentRef(d.refId, 'ai_agent_conversations')
        if (!refId) return null
        return {
          id: agentResolver.self(d._id),
          refId,
          refType: normalizeContentRefType(d.refType)?.refType ?? d.refType,
          title: d.title ?? null,
          messages: d.messages ?? [],
          model: d.model,
          providerId: d.providerId,
          reviewState: d.reviewState ?? null,
          diffState: d.diffState ?? null,
          messageCount: Array.isArray(d.messages) ? d.messages.length : 0,
          createdAt: dateOrNull(d.created) ?? new Date(),
          updatedAt: dateOrNull(d.updated),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, aiAgentConversations, agentRows)
    recordLoad(ctx, 'ai_agent_conversations', agentRows.length)
  },
}

export const stepSearchDocuments: MigrationStep = {
  name: 'search_documents',
  dependsOn: ['posts', 'notes', 'pages'],
  async allocate(ctx) {
    await allocateForCollection(ctx, 'search_documents')
  },
  async load(ctx) {
    const resolver = createResolver(ctx, 'search_documents')
    const docs = await collect<any>(ctx, 'search_documents')
    const SINGULAR: Record<string, 'post' | 'note' | 'page'> = {
      posts: 'post',
      notes: 'note',
      pages: 'page',
    }
    const rows = docs
      .map((d) => {
        const refTarget = normalizeContentRefType(d.refType)
        if (!refTarget) return null
        const singular = SINGULAR[refTarget.collection]
        if (!singular) return null
        const refId = resolver.ref(refTarget.collection, d.refId, 'refId', true)
        if (!refId) return null
        return {
          id: resolver.self(d._id),
          refType: singular,
          refId,
          title: d.title,
          searchText: d.searchText,
          terms: d.terms ?? [],
          titleTermFreq: d.titleTermFreq ?? {},
          bodyTermFreq: d.bodyTermFreq ?? {},
          titleLength: d.titleLength ?? 0,
          bodyLength: d.bodyLength ?? 0,
          slug: d.slug ?? null,
          nid: d.nid ?? null,
          isPublished: d.isPublished ?? true,
          publicAt: dateOrNull(d.publicAt),
          hasPassword: Boolean(d.hasPassword ?? false),
          createdAt: dateOrNull(d.created) ?? new Date(),
          modifiedAt: dateOrNull(d.modified),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    await upsert(ctx, searchDocuments, rows)
    recordLoad(ctx, 'search_documents', rows.length)
  },
}

export const stepServerless: MigrationStep = {
  name: 'serverless',
  async allocate(ctx) {
    await allocateForCollection(ctx, 'serverless_storages')
    await allocateForCollection(ctx, 'serverless_logs')
  },
  async load(ctx) {
    const storageResolver = createResolver(ctx, 'serverless_storages')
    const logResolver = createResolver(ctx, 'serverless_logs')

    const storageDocs = await collect<any>(ctx, 'serverless_storages')
    await upsert(
      ctx,
      serverlessStorages,
      storageDocs.map((d) => ({
        id: storageResolver.self(d._id),
        namespace: d.namespace,
        key: d.key,
        value: d.value,
      })),
    )
    recordLoad(ctx, 'serverless_storages', storageDocs.length)

    const logDocs = await collect<any>(ctx, 'serverless_logs')
    await upsert(
      ctx,
      serverlessLogs,
      logDocs.map((d) => ({
        id: logResolver.self(d._id),
        functionId: null,
        reference: d.reference,
        name: d.name,
        method: d.method ?? null,
        ip: d.ip ?? null,
        status: d.status ?? 'success',
        executionTime: d.executionTime ?? 0,
        logs: d.logs ?? null,
        error: d.error ?? null,
        createdAt: dateOrNull(d.created) ?? new Date(),
      })),
    )
    recordLoad(ctx, 'serverless_logs', logDocs.length)
  },
}

export const ALL_STEPS: MigrationStep[] = [
  stepCategories,
  stepTopics,
  stepReaders,
  stepOwnerProfiles,
  stepAccounts,
  stepSessions,
  stepApiKeys,
  stepPasskeys,
  stepVerifications,
  stepPosts,
  stepNotes,
  stepPages,
  stepRecentlies,
  stepComments,
  stepDrafts,
  ...stepSimpleCollections,
  stepFileReferences,
  stepPolls,
  stepSlugTrackers,
  stepWebhooks,
  stepAi,
  stepSearchDocuments,
  stepServerless,
]
