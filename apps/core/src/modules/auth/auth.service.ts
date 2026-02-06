import { IncomingMessage } from 'node:http'
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { RequestContext } from '~/common/contexts/request.context'
import { BizException } from '~/common/exceptions/biz.exception'
import {
  ACCOUNT_COLLECTION_NAME,
  OWNER_PROFILE_COLLECTION_NAME,
  READER_COLLECTION_NAME,
} from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { alphabet } from '~/constants/other.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { getAvatar } from '~/utils/tool.util'
import { hashPassword } from 'better-auth/crypto'
import { Types } from 'mongoose'
import { customAlphabet } from 'nanoid'
import { AuthInstanceInjectKey } from './auth.constant'
import type { TokenDto } from './auth.controller'
import type { InjectAuthInstance } from './auth.interface'
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
    private readonly databaseService: DatabaseService,
    @Inject(AuthInstanceInjectKey)
    private readonly authInstance: InjectAuthInstance,
  ) {}

  private get readersCollection() {
    return this.databaseService.db.collection(READER_COLLECTION_NAME)
  }

  private get accountsCollection() {
    return this.databaseService.db.collection(ACCOUNT_COLLECTION_NAME)
  }

  private resolveObjectId(id: string) {
    return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null
  }

  private buildUserIdQuery(userId: string): Record<string, any> {
    const objectId = this.resolveObjectId(userId)
    return objectId ? { _id: objectId } : { _id: userId }
  }

  private buildAccountUserIdQuery(userId: string): Record<string, any> {
    const objectId = this.resolveObjectId(userId)
    return objectId ? { userId: { $in: [userId, objectId] } } : { userId }
  }

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
      (error as { code?: number }).code === 11000
    )
  }

  async getAllAccessToken() {
    const ownerId = await this.getOwnerReaderId()
    if (!ownerId) {
      return []
    }
    const keys = await this.databaseService.db
      .collection('apikey')
      .find(this.buildAccountUserIdQuery(ownerId))
      .toArray()

    return keys.map((token) => ({
      id: token._id?.toString(),
      token: token.key,
      name: token.name,
      created: token.createdAt,
      expired: token.expiresAt ?? undefined,
    }))
  }

  async getTokenSecret(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return null
    }
    const token = await this.databaseService.db
      .collection('apikey')
      .findOne({ _id: new Types.ObjectId(id) })

    if (!token) {
      return null
    }
    return {
      id: token._id?.toString(),
      token: token.key,
      name: token.name,
      created: token.createdAt,
      expired: token.expiresAt ?? undefined,
    }
  }

  async generateAccessToken() {
    const nanoid = customAlphabet(alphabet, 40)()

    return `txo${nanoid}`
  }

  isCustomToken(token: string) {
    return token.startsWith('txo') && token.length - 3 === 40
  }

  async verifyCustomToken(
    token: string,
  ): Promise<[true, { userId: string }] | [false, null]> {
    const apiKey = await this.verifyApiKey(token)
    if (!apiKey) {
      return [false, null]
    }
    return [true, { userId: apiKey.userId }]
  }

  async saveToken(model: TokenDto & { token: string }) {
    const ownerId = await this.getOwnerReaderId()
    if (!ownerId) {
      throw new BizException(ErrorCodeEnum.AuthUserIdNotFound)
    }
    const now = new Date()
    const start = model.token.slice(0, 6)
    const prefix = model.token.startsWith('txo') ? 'txo' : undefined
    await this.databaseService.db.collection('apikey').insertOne({
      name: model.name,
      start,
      prefix,
      key: model.token,
      userId: ownerId,
      enabled: true,
      rateLimitEnabled: true,
      requestCount: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: model.expired ?? null,
    })
    return model
  }

  async deleteToken(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return
    }
    await this.databaseService.db
      .collection('apikey')
      .deleteOne({ _id: new Types.ObjectId(id) })
  }

  async createOwnerByCredential(input: CreateOwnerByCredentialInput) {
    const normalizedUsername = this.normalizeUsername(input.username)
    if (!normalizedUsername) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'username is required',
      )
    }
    if (typeof input.password !== 'string' || input.password.length === 0) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'password is required',
      )
    }
    const mail = this.normalizeOptional(input.mail)
    if (!mail) {
      throw new BizException(ErrorCodeEnum.InvalidParameter, 'mail is required')
    }

    const ownerCount = await this.readersCollection.countDocuments({
      role: 'owner',
    })
    if (ownerCount > 0) {
      throw new BizException(ErrorCodeEnum.UserAlreadyExists)
    }

    const exists = await this.readersCollection.findOne(
      { $or: [{ username: normalizedUsername }, { email: mail }] },
      { projection: { _id: 1 } },
    )
    if (exists) {
      throw new BizException(ErrorCodeEnum.UserAlreadyExists)
    }

    const rawUsername =
      this.normalizeOptional(input.username) || normalizedUsername
    const displayName = this.normalizeOptional(input.name) || rawUsername
    const avatar = this.normalizeOptional(input.avatar) || getAvatar(mail)
    const now = new Date()
    const readerId = new Types.ObjectId()
    const passwordHash = await hashPassword(input.password)
    const ownerProfileCollection = this.databaseService.db.collection(
      OWNER_PROFILE_COLLECTION_NAME,
    )

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

    let readerInserted = false
    try {
      await this.readersCollection.insertOne({
        _id: readerId,
        name: displayName,
        email: mail,
        emailVerified: true,
        image: avatar,
        createdAt: now,
        updatedAt: now,
        role: 'owner',
        handle: rawUsername,
        username: normalizedUsername,
        displayUsername: displayName,
      })
      readerInserted = true

      await this.accountsCollection.insertOne({
        accountId: readerId.toString(),
        providerId: 'credential',
        userId: readerId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      })

      await ownerProfileCollection.updateOne(
        { readerId },
        {
          $set: profilePatch,
          $setOnInsert: {
            readerId,
            created: now,
          },
        },
        { upsert: true },
      )
    } catch (error) {
      if (readerInserted) {
        await Promise.all([
          this.readersCollection.deleteOne({ _id: readerId }),
          this.accountsCollection.deleteMany({
            providerId: 'credential',
            userId: { $in: [readerId, readerId.toString()] },
          }),
          ownerProfileCollection.deleteOne({ readerId }),
        ])
      }

      if (this.isDuplicateKeyError(error)) {
        throw new BizException(ErrorCodeEnum.UserAlreadyExists)
      }

      throw error
    }

    return 'OK'
  }

  async getSessionUser(req: IncomingMessage) {
    return this.getSessionUserFromHeaders(
      this.buildHeadersFromRequest(req.headers),
    )
  }

  async getSessionUserFromHeaders(headers: Headers) {
    const auth = this.authInstance.get()
    if (!auth) {
      throw new InternalServerErrorException('auth not found')
    }

    if (!headers.get('cookie')) {
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

    let sessionUser = session?.user
    if (sessionUser?.id && !sessionUser.role) {
      const reader = await this.readersCollection.findOne(
        this.buildUserIdQuery(sessionUser.id),
        { projection: { role: 1 } },
      )
      if (reader?.role) {
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
      throw new BizException(ErrorCodeEnum.AuthFailed)
    }
    const session = await this.getSessionUser(req)
    if (!session) {
      throw new BizException(ErrorCodeEnum.AuthSessionNotFound)
    }
    const userId = session.user?.id
    if (!userId) {
      throw new BizException(ErrorCodeEnum.AuthUserIdNotFound)
    }

    return this.transferOwnerRole(userId)
  }

  async transferOwnerRole(targetUserId: string) {
    const target = await this.readersCollection.findOne(
      this.buildUserIdQuery(targetUserId),
      { projection: { _id: 1 } },
    )
    if (!target?._id) {
      throw new BizException(ErrorCodeEnum.AuthUserIdNotFound)
    }

    const now = new Date()
    await this.readersCollection.updateMany(
      { role: 'owner', _id: { $ne: target._id } },
      { $set: { role: 'reader', updatedAt: now } },
    )
    await this.readersCollection.updateOne(
      { _id: target._id },
      { $set: { role: 'owner', updatedAt: now } },
    )

    const ownerCount = await this.readersCollection.countDocuments({
      role: 'owner',
    })
    if (ownerCount !== 1) {
      throw new BizException(
        ErrorCodeEnum.AuthFailed,
        'owner role consistency check failed',
      )
    }
    return 'OK'
  }

  async revokeOwnerRole(targetUserId: string) {
    const target = await this.readersCollection.findOne(
      this.buildUserIdQuery(targetUserId),
      { projection: { _id: 1, role: 1 } },
    )
    if (!target?._id) {
      throw new BizException(ErrorCodeEnum.AuthUserIdNotFound)
    }
    if (target.role !== 'owner') {
      return 'OK'
    }

    const ownerCount = await this.readersCollection.countDocuments({
      role: 'owner',
    })
    if (ownerCount <= 1) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'owner must be unique and cannot be empty',
      )
    }

    await this.readersCollection.updateOne(
      { _id: target._id },
      { $set: { role: 'reader', updatedAt: new Date() } },
    )
    return 'OK'
  }

  async getOauthUserAccount(providerAccountId: string) {
    const account = await this.databaseService.db
      .collection(ACCOUNT_COLLECTION_NAME)
      .findOne(
        {
          providerAccountId,
        },
        {
          projection: {
            providerAccountId: 1,
            provider: 1,
            providerId: 1,
            type: 1,
            userId: 1,
          },
        },
      )

    if (account?.providerId && !account.provider) {
      account.provider = account.providerId
    }

    if (account?.userId) {
      const user = await this.databaseService.db
        .collection(READER_COLLECTION_NAME)
        .findOne(
          {
            _id: account.userId,
          },
          {
            projection: {
              email: 1,
              name: 1,
              image: 1,
              role: 1,
              handle: 1,
              _id: 1,
            },
          },
        )

      if (user) Object.assign(account, user)
    }

    return {
      ...account,
      id: account?.userId.toString(),
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
    const count = await this.accountsCollection.countDocuments({
      ...this.buildAccountUserIdQuery(ownerId),
      providerId: 'credential',
    })
    return count > 0
  }

  async hasPasskey() {
    const ownerId = await this.getOwnerReaderId()
    if (!ownerId) {
      return false
    }
    const count = await this.databaseService.db
      .collection('passkey')
      .countDocuments(this.buildAccountUserIdQuery(ownerId))
    return count > 0
  }

  getApiKeyFromRequest(req: {
    headers?: Record<string, string | string[] | undefined>
    query?: Record<string, any>
  }) {
    const headers = req.headers || {}
    const query = req.query || {}
    const apiKeyHeaderValue =
      headers['x-api-key'] || headers['X-API-Key'] || undefined
    const apiKeyHeader = Array.isArray(apiKeyHeaderValue)
      ? apiKeyHeaderValue[0]
      : apiKeyHeaderValue
    if (apiKeyHeader) {
      return { key: apiKeyHeader, deprecated: false }
    }

    const authorizationValue =
      headers.authorization || headers.Authorization || undefined
    const authorization = Array.isArray(authorizationValue)
      ? authorizationValue[0]
      : authorizationValue
    if (authorization) {
      const match = authorization.match(/^Bearer\s+(\S+)$/i)
      if (match) {
        return { key: match[1], deprecated: true }
      }
    }

    if (typeof query.token === 'string') {
      return { key: query.token, deprecated: true }
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
    if (!result?.valid || !result.key) {
      return null
    }
    return result.key
  }

  private async getOwnerReaderId() {
    const owner = await this.readersCollection
      .find({ role: 'owner' }, { projection: { _id: 1 } })
      .sort({ createdAt: 1, _id: 1 })
      .limit(1)
      .next()
    if (!owner?._id) {
      return null
    }
    return owner._id.toString()
  }

  async isOwnerReaderId(userId: string | Types.ObjectId) {
    const id = typeof userId === 'string' ? userId : userId.toString()
    if (!Types.ObjectId.isValid(id)) {
      return false
    }
    const owner = await this.readersCollection.findOne(
      { _id: new Types.ObjectId(id), role: 'owner' },
      { projection: { _id: 1 } },
    )
    return !!owner
  }

  private buildHeadersFromRequest(
    headers: Record<string, string | string[] | undefined>,
  ) {
    const header = new Headers()
    const cookieValue = headers.cookie
    const cookie = Array.isArray(cookieValue) ? cookieValue[0] : cookieValue
    if (typeof cookie === 'string' && cookie.length > 0) {
      header.set('cookie', cookie)
    }
    const originValue = headers.origin
    const origin = Array.isArray(originValue) ? originValue[0] : originValue
    if (typeof origin === 'string' && origin.length > 0) {
      header.set('origin', origin)
    }
    return header
  }

  async getReaderById(userId: string): Promise<SessionUser | null> {
    if (!userId) {
      return null
    }
    const reader = await this.readersCollection.findOne(
      this.buildUserIdQuery(userId),
      {
        projection: {
          _id: 1,
          email: 1,
          name: 1,
          image: 1,
          role: 1,
          handle: 1,
          username: 1,
          displayUsername: 1,
        },
      },
    )
    if (!reader) {
      return null
    }
    return {
      id: reader._id?.toString(),
      email: reader.email,
      name: reader.name,
      image: reader.image,
      role: reader.role,
      handle: reader.handle,
      username: reader.username,
      displayUsername: reader.displayUsername,
    }
  }
}
