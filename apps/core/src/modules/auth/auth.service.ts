import { IncomingMessage } from 'node:http'

import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { hashPassword } from 'better-auth/crypto'
import { customAlphabet } from 'nanoid'

import { RequestContext } from '~/common/contexts/request.context'
import { AppErrorCode, createAppException } from '~/common/errors'
import { alphabet } from '~/constants/other.constant'
import { SnowflakeService } from '~/shared/id/snowflake.service'
import { getAvatar } from '~/utils/tool.util'

import { OwnerRepository } from '../owner/owner.repository'
import { ReaderRepository } from '../reader/reader.repository'
import { AuthInstanceInjectKey } from './auth.constant'
import type { TokenDto } from './auth.controller'
import type { InjectAuthInstance } from './auth.interface'
import { AuthRepository } from './auth.repository'
import type { SessionUser } from './auth.types'

type CreateOwnerByCredentialInput = {
  username: string
  password: string
  mail: string
  name?: string
  url?: string
  avatar?: string
  introduce?: string
  socialIds?: Record<string, string | number>
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly readerRepository: ReaderRepository,
    private readonly ownerRepository: OwnerRepository,
    @Inject(AuthInstanceInjectKey)
    private readonly authInstance: InjectAuthInstance,
    private readonly snowflakeService: SnowflakeService,
  ) {}

  private normalizeOptional(value?: string | null) {
    if (typeof value !== 'string') {
      return undefined
    }
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
  }

  private normalizeUsername(username: string) {
    return username.trim().toLowerCase()
  }

  private isDuplicateKeyError(error: unknown) {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      ((error as { code?: number | string }).code === 11000 ||
        (error as { code?: number | string }).code === '23505')
    )
  }

  private pickFirstHeader(
    headers: Record<string, string | string[] | undefined>,
    ...names: string[]
  ): string | undefined {
    for (const name of names) {
      const value = headers[name]
      const picked = Array.isArray(value) ? value[0] : value
      if (typeof picked === 'string' && picked.length > 0) {
        return picked
      }
    }
    return undefined
  }

  async getAllAccessToken() {
    const ownerId = await this.getOwnerReaderId()
    if (!ownerId) {
      return []
    }
    const keys = await this.authRepository.listApiKeysForUser(ownerId)

    return keys.map((token) => ({
      id: token.id,
      // Never re-expose the full secret on list responses. The plaintext key is
      // shown once at creation; afterwards the list only carries a masked
      // display value. The full secret is fetched on demand via getTokenSecret.
      token: this.maskApiKey(token),
      name: token.name,
      createdAt: token.createdAt,
      expired: token.expiresAt ?? undefined,
    }))
  }

  private maskApiKey(token: {
    key?: string | null
    start?: string | null
    prefix?: string | null
  }): string {
    const prefix = token.prefix || ''
    const start = token.start || token.key?.slice(0, 6) || ''
    const visible = `${prefix}${start}`
    return visible ? `${visible}••••••••` : '••••••••••••••••••••••••'
  }

  async getTokenSecret(id: string) {
    const token = await this.authRepository.findApiKeyById(id)

    if (!token) {
      return null
    }
    return {
      id: token.id,
      token: token.key,
      name: token.name,
      createdAt: token.createdAt,
      expired: token.expiresAt ?? undefined,
    }
  }

  async generateAccessToken() {
    const nanoid = customAlphabet(alphabet, 40)()

    return `txo${nanoid}`
  }

  async verifyCustomToken(
    token: string,
  ): Promise<[true, { userId: string }] | [false, null]> {
    const apiKey = await this.verifyApiKey(token)
    if (!apiKey) {
      return [false, null]
    }
    return [true, { userId: apiKey.referenceId }]
  }

  async createAccessToken(body: TokenDto) {
    const auth = this.authInstance.get()
    if (!auth) {
      throw new InternalServerErrorException('auth not found')
    }

    const ownerId = await this.getOwnerReaderId()
    if (!ownerId) {
      throw createAppException(AppErrorCode.AUTH_USER_ID_NOT_FOUND)
    }

    const expiresIn =
      body.expired instanceof Date
        ? Math.floor((body.expired.getTime() - Date.now()) / 1000)
        : undefined

    if (expiresIn !== undefined && expiresIn <= 0) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'expired must be in the future',
      })
    }

    const created = await auth.api.createApiKey({
      body: {
        name: body.name,
        userId: ownerId,
        ...(expiresIn ? { expiresIn } : {}),
      },
    })

    return {
      name: created.name ?? body.name,
      token: created.key,
      expired: created.expiresAt ? new Date(created.expiresAt) : undefined,
    }
  }

  async saveToken(model: TokenDto & { token: string }) {
    const ownerId = await this.getOwnerReaderId()
    if (!ownerId) {
      throw createAppException(AppErrorCode.AUTH_USER_ID_NOT_FOUND)
    }
    const now = new Date()
    const start = model.token.slice(0, 6)
    const prefix = model.token.startsWith('txo') ? 'txo' : undefined
    await this.authRepository.createApiKey({
      id: this.snowflakeService.nextId(),
      name: model.name,
      start,
      prefix,
      key: model.token,
      userId: ownerId,
      referenceId: ownerId,
      enabled: true,
      rateLimitEnabled: true,
      expiresAt: model.expired ?? null,
      lastRefillAt: now,
    })
    return model
  }

  async deleteToken(id: string) {
    await this.authRepository.deleteApiKey(id)
  }

  async createOwnerByCredential(input: CreateOwnerByCredentialInput) {
    const normalizedUsername = this.normalizeUsername(input.username)
    if (!normalizedUsername) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'username is required',
      })
    }
    if (typeof input.password !== 'string' || input.password.length === 0) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'password is required',
      })
    }
    const mail = this.normalizeOptional(input.mail)
    if (!mail) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'mail is required',
      })
    }

    const ownerCount = await this.readerRepository.countOwners()
    if (ownerCount > 0) {
      throw createAppException(AppErrorCode.USER_ALREADY_EXISTS)
    }

    const exists = await this.readerRepository.existsByUsernameOrEmail(
      normalizedUsername,
      mail,
    )
    if (exists) {
      throw createAppException(AppErrorCode.USER_ALREADY_EXISTS)
    }

    const rawUsername =
      this.normalizeOptional(input.username) || normalizedUsername
    const displayName = this.normalizeOptional(input.name) || rawUsername
    const avatar = this.normalizeOptional(input.avatar) || getAvatar(mail)
    const readerId = this.snowflakeService.nextId()
    const passwordHash = await hashPassword(input.password)

    const profilePatch: Record<string, any> = {
      mail,
    }
    const url = this.normalizeOptional(input.url)
    if (url) {
      profilePatch.url = url
    }
    const introduce = this.normalizeOptional(input.introduce)
    if (introduce) {
      profilePatch.introduce = introduce
    }
    if (input.socialIds && Object.keys(input.socialIds).length > 0) {
      profilePatch.socialIds = input.socialIds
    }

    try {
      await this.readerRepository.create({
        id: readerId,
        name: displayName,
        email: mail,
        emailVerified: true,
        image: avatar,
        role: 'owner',
        handle: rawUsername,
        username: normalizedUsername,
        displayUsername: displayName,
      })

      await this.authRepository.createAccount({
        id: this.snowflakeService.nextId(),
        providerAccountId: readerId,
        providerId: 'credential',
        userId: readerId,
        password: passwordHash,
      })

      await this.ownerRepository.upsertByReaderId(readerId, {
        id: readerId,
        ...profilePatch,
      })
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw createAppException(AppErrorCode.USER_ALREADY_EXISTS)
      }

      throw error
    }

    return 'OK'
  }

  private readonly sessionUserPromiseByRequest = new WeakMap<
    IncomingMessage,
    ReturnType<AuthService['getSessionUserFromHeaders']>
  >()

  getSessionUser(req: IncomingMessage) {
    const cached = this.sessionUserPromiseByRequest.get(req)
    if (cached) return cached

    const promise = this.getSessionUserFromHeaders(
      this.buildHeadersFromRequest(req.headers),
    )
    // Only memoize in-flight/successful resolutions: callers (e.g. RolesGuard)
    // swallow transient failures and retry, so a rejection must not be cached.
    promise.catch(() => {
      if (this.sessionUserPromiseByRequest.get(req) === promise) {
        this.sessionUserPromiseByRequest.delete(req)
      }
    })
    this.sessionUserPromiseByRequest.set(req, promise)
    return promise
  }

  async getSessionUserFromHeaders(headers: Headers) {
    const auth = this.authInstance.get()
    if (!auth) {
      throw new InternalServerErrorException('auth not found')
    }

    if (!headers.get('cookie') && !headers.get('authorization')) {
      return null
    }
    const session = await auth.api.getSession({
      query: {
        disableCookieCache: true,
      },
      headers,
    })

    if (!session) {
      return null
    }

    const accounts = await auth.api.listUserAccounts({
      headers,
    })

    if (!accounts || accounts.length === 0) {
      return null
    }

    const sessionProvider = (session as { session?: { provider?: string } })
      .session?.provider
    const matchedAccount = sessionProvider
      ? accounts.find((account) => account.providerId === sessionProvider)
      : undefined
    const primaryAccount = matchedAccount || accounts[0]
    const providerAccountId = primaryAccount.accountId || primaryAccount.id
    const provider = primaryAccount.providerId

    let sessionUser = session?.user as (typeof session)['user'] & {
      role?: string
      handle?: string
    }
    if (sessionUser?.id) {
      const reader = await this.readerRepository.findById(sessionUser.id)
      if (reader?.bannedAt) {
        return null
      }
      if (reader?.role && !sessionUser.role) {
        sessionUser = { ...sessionUser, role: reader.role }
      }
    }

    return {
      ...session,
      providerAccountId,
      provider: provider || sessionProvider,
      user: sessionUser,
    }
  }

  async setCurrentOauthAsOwner() {
    const req = RequestContext.currentRequest()
    if (!req) {
      throw createAppException(AppErrorCode.AUTH_FAILED)
    }
    const session = await this.getSessionUser(req)
    if (!session) {
      throw createAppException(AppErrorCode.AUTH_SESSION_NOT_FOUND)
    }
    const userId = session.user?.id
    if (!userId) {
      throw createAppException(AppErrorCode.AUTH_USER_ID_NOT_FOUND)
    }

    return this.transferOwnerRole(userId)
  }

  async transferOwnerRole(targetUserId: string) {
    const target = await this.readerRepository.findById(targetUserId)
    if (!target?.id) {
      throw createAppException(AppErrorCode.AUTH_USER_ID_NOT_FOUND)
    }

    await this.readerRepository.setOwnersExceptToReader(target.id)
    await this.readerRepository.setRole(target.id, 'owner')

    const ownerCount = await this.readerRepository.countOwners()
    if (ownerCount !== 1) {
      throw createAppException(AppErrorCode.AUTH_FAILED, {
        message: 'owner role consistency check failed',
      })
    }
    return 'OK'
  }

  async revokeOwnerRole(targetUserId: string) {
    const target = await this.readerRepository.findById(targetUserId)
    if (!target?.id) {
      throw createAppException(AppErrorCode.AUTH_USER_ID_NOT_FOUND)
    }
    if (target.role !== 'owner') {
      return 'OK'
    }

    const ownerCount = await this.readerRepository.countOwners()
    if (ownerCount <= 1) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'owner must be unique and cannot be empty',
      })
    }

    await this.readerRepository.setRole(target.id, 'reader')
    return 'OK'
  }

  async getOauthUserAccount(providerAccountId: string) {
    const account =
      await this.authRepository.findAccountByProviderAccountId(
        providerAccountId,
      )

    if (!account) {
      return { id: undefined }
    }

    const user = account.userId
      ? await this.readerRepository.findById(account.userId)
      : null

    return {
      ...account,
      provider: account.providerId,
      ...(user
        ? {
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            handle: user.handle,
          }
        : {}),
      id: account.userId,
    }
  }

  getOauthProviders() {
    return Object.keys(this.authInstance.get().options.socialProviders || {})
  }

  async hasCredentialAccount() {
    const ownerId = await this.getOwnerReaderId()
    if (!ownerId) {
      return false
    }
    const accounts = await this.authRepository.findAccountsForUser(ownerId)
    return accounts.some((account) => account.providerId === 'credential')
  }

  async hasPasskey() {
    const ownerId = await this.getOwnerReaderId()
    if (!ownerId) {
      return false
    }
    const count = await this.authRepository.countPasskeysForUser(ownerId)
    return count > 0
  }

  getApiKeyFromRequest(req: {
    headers?: Record<string, string | string[] | undefined>
  }) {
    const headers = req.headers || {}

    // Only the `x-api-key` header is honored. The legacy `?token=` query path
    // was removed: query strings leak into access logs, the Referer header, and
    // browser history, and are trivially replayable for full owner access.
    const apiKeyHeader = this.pickFirstHeader(headers, 'x-api-key', 'X-API-Key')
    if (apiKeyHeader) {
      return { key: apiKeyHeader }
    }

    return null
  }

  async verifyApiKey(token: string) {
    const auth = this.authInstance.get()
    if (!auth) {
      throw new InternalServerErrorException('auth not found')
    }
    const result = await auth.api.verifyApiKey({
      body: {
        key: token,
      },
    })
    if (!result?.valid || !result.key?.referenceId) {
      return this.verifyLegacyApiKey(token)
    }
    return result.key
  }

  private async verifyLegacyApiKey(token: string) {
    const legacyDoc = await this.authRepository.findApiKey(token)

    if (!legacyDoc) {
      return null
    }

    if (legacyDoc.enabled === false) {
      return null
    }

    if (legacyDoc.expiresAt && legacyDoc.expiresAt.getTime() <= Date.now()) {
      return null
    }

    const referenceId =
      legacyDoc.referenceId ||
      (legacyDoc.userId ? legacyDoc.userId.toString() : null)

    if (!referenceId) {
      return null
    }

    return {
      ...legacyDoc,
      referenceId,
      configId: legacyDoc.configId ?? 'default',
      enabled: legacyDoc.enabled ?? true,
      rateLimitEnabled: legacyDoc.rateLimitEnabled ?? true,
      requestCount: legacyDoc.requestCount ?? 0,
    }
  }

  private async getOwnerReaderId() {
    const owner = await this.readerRepository.findOwner()
    if (!owner?.id) {
      return null
    }
    return owner.id
  }

  async isOwnerReaderId(userId: string) {
    const owner = await this.readerRepository.findById(userId)
    return owner?.role === 'owner'
  }

  private buildHeadersFromRequest(
    headers: Record<string, string | string[] | undefined>,
  ) {
    const header = new Headers()
    const cookie = this.pickFirstHeader(headers, 'cookie')
    if (cookie) {
      header.set('cookie', cookie)
    }
    const origin = this.pickFirstHeader(headers, 'origin')
    if (origin) {
      header.set('origin', origin)
    }
    const authorization = this.pickFirstHeader(
      headers,
      'authorization',
      'Authorization',
    )
    if (authorization) {
      header.set('authorization', authorization)
    }
    return header
  }

  async getReaderById(userId: string): Promise<SessionUser | null> {
    if (!userId) {
      return null
    }
    const reader = await this.readerRepository.findById(userId)
    if (!reader) {
      return null
    }
    return {
      id: reader.id,
      email: reader.email,
      name: reader.name,
      image: reader.image,
      role: reader.role as 'reader' | 'owner',
      handle: reader.handle,
      username: reader.username,
      displayUsername: reader.displayUsername,
    }
  }
}
