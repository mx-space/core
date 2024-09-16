import { IncomingMessage } from 'node:http'
import dayjs from 'dayjs'
import { isDate, omit } from 'lodash'
import { Types } from 'mongoose'
import type { TokenModel, UserModel } from '~/modules/user/user.model'
import type { TokenDto } from './auth.controller'

import { nanoid } from '@mx-space/complied'
import {
  Auth,
  createActionURL,
  Session,
  setEnvDefaults,
} from '@mx-space/complied/auth'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'

import { RequestContext } from '~/common/contexts/request.context'
import { alphabet } from '~/constants/other.constant'
import { UserModel as User } from '~/modules/user/user.model'
import { DatabaseService } from '~/processors/database/database.service'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { InjectModel } from '~/transformers/model.transformer'

import {
  AUTH_JS_ACCOUNT_COLLECTION,
  AUTH_JS_USER_COLLECTION,
  AuthConfigInjectKey,
} from './auth.constant'
import { ServerAuthConfig } from './auth.implement'
import { SessionUser } from './auth.interface'

const { customAlphabet } = nanoid

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthConfigInjectKey) private readonly authConfig: ServerAuthConfig,
    @InjectModel(User) private readonly userModel: ReturnModelType<typeof User>,
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JWTService,
  ) {}

  get jwtServicePublic() {
    return this.jwtService
  }

  private async getAccessTokens() {
    return (await this.userModel.findOne().select('apiToken').lean())
      ?.apiToken as TokenModel[] | undefined
  }
  async getAllAccessToken() {
    const tokens = await this.getAccessTokens()
    if (!tokens) {
      return []
    }
    return tokens.map((token) => ({
      // @ts-ignore
      id: token._id,
      ...omit(token, ['_id', '__v']),
    })) as any as TokenModel[]
  }

  async getTokenSecret(id: string) {
    const tokens = await this.getAccessTokens()
    if (!tokens) {
      return null
    }
    // note: _id is ObjectId not equal to string
    // @ts-ignore
    return tokens.find((token) => String(token._id) === id)
  }

  async generateAccessToken() {
    const ap = customAlphabet(alphabet, 40)
    const nanoid = await ap()

    return `txo${nanoid}`
  }

  isCustomToken(token: string) {
    return token.startsWith('txo') && token.length - 3 === 40
  }

  async verifyCustomToken(
    token: string,
  ): Promise<[true, UserModel] | [false, null]> {
    const user = await this.userModel.findOne({}).lean().select('+apiToken')

    if (!user) {
      return [false, null]
    }
    const tokens = user.apiToken
    if (!tokens || !Array.isArray(tokens)) {
      return [false, null]
    }
    const valid = tokens.some((doc) => {
      if (doc.token === token) {
        if (typeof doc.expired === 'undefined') {
          return true
        } else if (isDate(doc.expired)) {
          const isExpired = dayjs(new Date()).isAfter(doc.expired)
          return isExpired ? false : true
        }
      }
      return false
    })

    return valid ? [true, user] : [false, null]
  }

  async saveToken(model: TokenDto & { token: string }) {
    await this.userModel.updateOne(
      {},
      {
        $push: {
          apiToken: { created: new Date(), ...model },
        },
      },
    )
    return model
  }

  async deleteToken(id: string) {
    await this.userModel.updateOne(
      {},
      {
        $pull: {
          apiToken: {
            _id: id,
          },
        },
      },
    )
  }

  private async getSessionBase(req: IncomingMessage, config: ServerAuthConfig) {
    setEnvDefaults(process.env, config)

    const protocol = (req.headers['x-forwarded-proto'] || 'http') as string
    const url = createActionURL(
      'session',
      protocol,
      // @ts-expect-error

      new Headers(req.headers),
      process.env,
      config.basePath,
    )

    const response = await Auth(
      new Request(url, { headers: { cookie: req.headers.cookie ?? '' } }),
      config,
    )

    const { status = 200 } = response

    const data = await response.json()

    if (!data || !Object.keys(data).length) return null
    if (status === 200) return data
  }

  getSessionUser(req: IncomingMessage) {
    const { authConfig } = this
    return new Promise<SessionUser | null>((resolve) => {
      this.getSessionBase(req, {
        ...authConfig,
        callbacks: {
          ...authConfig.callbacks,
          session: async (params) => {
            const token = params.token

            let user = params.user ?? params.token
            if (typeof token?.providerAccountId === 'string') {
              const existUser = (await this.getOauthUserAccount(
                token.providerAccountId,
              )) as any

              if (existUser) {
                user = existUser
              }
            }

            resolve({
              ...params.session,
              ...params.user,
              user,
              provider: token.provider,
              providerAccountId: token.providerAccountId,
            } as SessionUser)

            const session =
              (await authConfig.callbacks?.session?.(params)) ?? params.session

            return {
              user,
              ...session,
            } satisfies Session
          },
        },
      }).then((session) => {
        if (!session) {
          resolve(null)
        }
      })
    })
  }

  async setCurrentOauthAsOwner() {
    const req = RequestContext.currentRequest()
    if (!req) {
      throw new BadRequestException()
    }
    const session = await this.getSessionUser(req)
    if (!session) {
      throw new BadRequestException('session not found')
    }
    const userId = session.userId
    await this.databaseService.db.collection(AUTH_JS_USER_COLLECTION).updateOne(
      {
        _id: new Types.ObjectId(userId),
      },
      {
        $set: {
          isOwner: true,
        },
      },
    )
    return 'OK'
  }

  async getOauthUserAccount(providerAccountId: string) {
    const account = await this.databaseService.db
      .collection(AUTH_JS_ACCOUNT_COLLECTION)
      .findOne(
        {
          providerAccountId,
        },
        {
          projection: {
            providerAccountId: 1,
            provider: 1,
            type: 1,
            userId: 1,
          },
        },
      )

    if (account?.userId) {
      const user = await this.databaseService.db
        .collection(AUTH_JS_USER_COLLECTION)
        .findOne(
          {
            _id: account.userId,
          },
          {
            projection: {
              email: 1,
              name: 1,
              image: 1,
              isOwner: 1,
              handle: 1,
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
    return this.authConfig.providers.map((p) => p.name)
  }
}
