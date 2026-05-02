import { Inject, Injectable } from '@nestjs/common'
import { and, eq, lte, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  accounts,
  apiKeys,
  passkeys,
  sessions,
  verifications,
} from '~/database/schema'
import { BaseRepository } from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

export interface AccountRow {
  id: string
  userId: string
  accountId: string | null
  providerId: string
  providerAccountId: string | null
  password: string | null
  type: string | null
  accessToken: string | null
  refreshToken: string | null
  accessTokenExpiresAt: Date | null
  refreshTokenExpiresAt: Date | null
  scope: string | null
  idToken: string | null
  raw: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date | null
}

export interface SessionRow {
  id: string
  userId: string
  token: string
  expiresAt: Date | null
  ipAddress: string | null
  userAgent: string | null
  provider: string | null
  createdAt: Date
  updatedAt: Date | null
}

export interface ApiKeyRow {
  id: string
  userId: string | null
  referenceId: string | null
  configId: string | null
  name: string | null
  key: string
  start: string | null
  prefix: string | null
  enabled: boolean
  rateLimitEnabled: boolean
  rateLimitTimeWindow: number | null
  rateLimitMax: number | null
  requestCount: number
  remaining: number | null
  refillInterval: number | null
  refillAmount: number | null
  expiresAt: Date | null
  lastRefillAt: Date | null
  lastRequest: Date | null
  permissions: unknown
  metadata: unknown
  createdAt: Date
  updatedAt: Date | null
}

export interface VerificationRow {
  id: string
  identifier: string
  value: string
  expiresAt: Date
}

export interface PasskeyRow {
  id: string
  userId: string
  name: string | null
  credentialId: string
  publicKey: string
  counter: number
  deviceType: string | null
  backedUp: boolean
  transports: string[] | null
  aaguid: string | null
  createdAt: Date
  updatedAt: Date | null
}

const mapAccount = (row: typeof accounts.$inferSelect): AccountRow => ({
  id: row.id,
  userId: row.userId,
  accountId: row.accountId,
  providerId: row.providerId,
  providerAccountId: row.providerAccountId,
  password: row.password,
  type: row.type,
  accessToken: row.accessToken,
  refreshToken: row.refreshToken,
  accessTokenExpiresAt: row.accessTokenExpiresAt,
  refreshTokenExpiresAt: row.refreshTokenExpiresAt,
  scope: row.scope,
  idToken: row.idToken,
  raw: row.raw,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const mapSession = (row: typeof sessions.$inferSelect): SessionRow => ({
  id: row.id,
  userId: row.userId,
  token: row.token,
  expiresAt: row.expiresAt,
  ipAddress: row.ipAddress,
  userAgent: row.userAgent,
  provider: row.provider,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const mapApiKey = (row: typeof apiKeys.$inferSelect): ApiKeyRow => ({
  id: row.id,
  userId: row.userId,
  referenceId: row.referenceId,
  configId: row.configId,
  name: row.name,
  key: row.key,
  start: row.start,
  prefix: row.prefix,
  enabled: row.enabled,
  rateLimitEnabled: row.rateLimitEnabled,
  rateLimitTimeWindow: row.rateLimitTimeWindow,
  rateLimitMax: row.rateLimitMax,
  requestCount: row.requestCount,
  remaining: row.remaining,
  refillInterval: row.refillInterval,
  refillAmount: row.refillAmount,
  expiresAt: row.expiresAt,
  lastRefillAt: row.lastRefillAt,
  lastRequest: row.lastRequest,
  permissions: row.permissions,
  metadata: row.metadata,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

@Injectable()
export class AuthRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  // ── accounts ─────────────────────────────────────────────────────────

  async findAccountByProvider(
    providerId: string,
    providerAccountId: string,
  ): Promise<AccountRow | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.providerId, providerId),
          eq(accounts.providerAccountId, providerAccountId),
        )!,
      )
      .limit(1)
    return row ? mapAccount(row) : null
  }

  async findAccountsForUser(userId: string): Promise<AccountRow[]> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
    return rows.map(mapAccount)
  }

  async createAccount(input: {
    id: string
    userId: string
    providerId: string
    providerAccountId?: string | null
    password?: string | null
    type?: string | null
    accessToken?: string | null
    refreshToken?: string | null
    accessTokenExpiresAt?: Date | null
    refreshTokenExpiresAt?: Date | null
    scope?: string | null
    idToken?: string | null
    raw?: Record<string, unknown> | null
  }): Promise<AccountRow> {
    const [row] = await this.db
      .insert(accounts)
      .values({
        id: input.id,
        userId: input.userId,
        providerId: input.providerId,
        providerAccountId: input.providerAccountId ?? null,
        password: input.password ?? null,
        type: input.type ?? null,
        accessToken: input.accessToken ?? null,
        refreshToken: input.refreshToken ?? null,
        accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt ?? null,
        scope: input.scope ?? null,
        idToken: input.idToken ?? null,
        raw: input.raw ?? null,
      })
      .returning()
    return mapAccount(row)
  }

  async updateAccountPassword(id: string, password: string): Promise<void> {
    await this.db
      .update(accounts)
      .set({ password, updatedAt: new Date() })
      .where(eq(accounts.id, id))
  }

  // ── sessions ─────────────────────────────────────────────────────────

  async findSessionByToken(token: string): Promise<SessionRow | null> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1)
    return row ? mapSession(row) : null
  }

  async createSession(input: {
    id: string
    userId: string
    token: string
    expiresAt?: Date | null
    ipAddress?: string | null
    userAgent?: string | null
    provider?: string | null
  }): Promise<SessionRow> {
    const [row] = await this.db
      .insert(sessions)
      .values({
        id: input.id,
        userId: input.userId,
        token: input.token,
        expiresAt: input.expiresAt ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        provider: input.provider ?? null,
      })
      .returning()
    return mapSession(row)
  }

  async deleteSession(token: string): Promise<boolean> {
    const result = await this.db
      .delete(sessions)
      .where(eq(sessions.token, token))
      .returning({ id: sessions.id })
    return result.length > 0
  }

  async deleteExpiredSessions(now: Date = new Date()): Promise<number> {
    const result = await this.db
      .delete(sessions)
      .where(lte(sessions.expiresAt, now))
      .returning({ id: sessions.id })
    return result.length
  }

  // ── api keys ─────────────────────────────────────────────────────────

  async findApiKey(key: string): Promise<ApiKeyRow | null> {
    const [row] = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.key, key))
      .limit(1)
    return row ? mapApiKey(row) : null
  }

  async listApiKeysForUser(userId: string): Promise<ApiKeyRow[]> {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
    return rows.map(mapApiKey)
  }

  async createApiKey(input: {
    id: string
    userId?: string | null
    referenceId?: string | null
    configId?: string | null
    name?: string | null
    key: string
    start?: string | null
    prefix?: string | null
    enabled?: boolean
    rateLimitEnabled?: boolean
    rateLimitTimeWindow?: number | null
    rateLimitMax?: number | null
    remaining?: number | null
    refillInterval?: number | null
    refillAmount?: number | null
    expiresAt?: Date | null
    lastRefillAt?: Date | null
    permissions?: unknown
    metadata?: unknown
  }): Promise<ApiKeyRow> {
    const [row] = await this.db
      .insert(apiKeys)
      .values({
        id: input.id,
        userId: input.userId ?? null,
        referenceId: input.referenceId ?? null,
        configId: input.configId ?? null,
        name: input.name ?? null,
        key: input.key,
        start: input.start ?? null,
        prefix: input.prefix ?? null,
        enabled: input.enabled ?? true,
        rateLimitEnabled: input.rateLimitEnabled ?? false,
        rateLimitTimeWindow: input.rateLimitTimeWindow ?? null,
        rateLimitMax: input.rateLimitMax ?? null,
        remaining: input.remaining ?? null,
        refillInterval: input.refillInterval ?? null,
        refillAmount: input.refillAmount ?? null,
        expiresAt: input.expiresAt ?? null,
        lastRefillAt: input.lastRefillAt ?? null,
        permissions: input.permissions,
        metadata: input.metadata,
      })
      .returning()
    return mapApiKey(row)
  }

  async incrementApiKeyUsage(id: string): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({
        requestCount: sql`${apiKeys.requestCount} + 1`,
        lastRequest: new Date(),
      })
      .where(eq(apiKeys.id, id))
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const result = await this.db
      .delete(apiKeys)
      .where(eq(apiKeys.id, id))
      .returning({ id: apiKeys.id })
    return result.length > 0
  }

  // ── verifications (Better Auth uses these for email flows) ───────────

  async createVerification(input: {
    id: string
    identifier: string
    value: string
    expiresAt: Date
  }): Promise<VerificationRow> {
    const [row] = await this.db
      .insert(verifications)
      .values({
        id: input.id,
        identifier: input.identifier,
        value: input.value,
        expiresAt: input.expiresAt,
      })
      .returning()
    return {
      id: row.id,
      identifier: row.identifier,
      value: row.value,
      expiresAt: row.expiresAt,
    }
  }

  async findVerification(identifier: string): Promise<VerificationRow | null> {
    const [row] = await this.db
      .select()
      .from(verifications)
      .where(eq(verifications.identifier, identifier))
      .limit(1)
    if (!row) return null
    return {
      id: row.id,
      identifier: row.identifier,
      value: row.value,
      expiresAt: row.expiresAt,
    }
  }

  async deleteVerification(identifier: string): Promise<boolean> {
    const result = await this.db
      .delete(verifications)
      .where(eq(verifications.identifier, identifier))
      .returning({ id: verifications.id })
    return result.length > 0
  }

  // ── passkeys ─────────────────────────────────────────────────────────

  async findPasskeyByCredentialId(
    credentialId: string,
  ): Promise<PasskeyRow | null> {
    const [row] = await this.db
      .select()
      .from(passkeys)
      .where(eq(passkeys.credentialId, credentialId))
      .limit(1)
    if (!row) return null
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      credentialId: row.credentialId,
      publicKey: row.publicKey,
      counter: row.counter,
      deviceType: row.deviceType,
      backedUp: row.backedUp,
      transports: row.transports,
      aaguid: row.aaguid,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  async createPasskey(input: {
    id: string
    userId: string
    name?: string | null
    credentialId: string
    publicKey: string
    counter?: number
    deviceType?: string | null
    backedUp?: boolean
    transports?: string[] | null
    aaguid?: string | null
  }): Promise<string> {
    await this.db.insert(passkeys).values({
      id: input.id,
      userId: input.userId,
      name: input.name ?? null,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      counter: input.counter ?? 0,
      deviceType: input.deviceType ?? null,
      backedUp: input.backedUp ?? false,
      transports: input.transports ?? null,
      aaguid: input.aaguid ?? null,
    })
    return input.id
  }

  async incrementPasskeyCounter(credentialId: string, by = 1): Promise<void> {
    await this.db
      .update(passkeys)
      .set({ counter: sql`${passkeys.counter} + ${by}` })
      .where(eq(passkeys.credentialId, credentialId))
  }

  async deletePasskey(credentialId: string): Promise<boolean> {
    const result = await this.db
      .delete(passkeys)
      .where(eq(passkeys.credentialId, credentialId))
      .returning({ id: passkeys.id })
    return result.length > 0
  }
}
