import { IncomingMessage } from 'node:http'
import { nanoid } from '@mx-space/compiled'
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { RequestContext } from '~/common/contexts/request.context'
import { alphabet } from '~/constants/other.constant'
import type { TokenModel, UserModel } from '~/modules/user/user.model'
import { UserModel as User } from '~/modules/user/user.model'
import { DatabaseService } from '~/processors/database/database.service'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { InjectModel } from '~/transformers/model.transformer'
import dayjs from 'dayjs'
import { isDate, omit } from 'lodash'
import { Types } from 'mongoose'
import {
  AUTH_JS_ACCOUNT_COLLECTION,
  AUTH_JS_USER_COLLECTION,
  AuthInstanceInjectKey,
} from './auth.constant'
import type { TokenDto } from './auth.controller'
import { InjectAuthInstance } from './auth.interface'

const { customAlphabet } = nanoid

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly userModel: ReturnModelType<typeof User>,
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JWTService,
    @Inject(AuthInstanceInjectKey)
    private readonly authInstance: InjectAuthInstance,
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

  async getSessionUser(req: IncomingMessage) {
    const auth = this.authInstance.get()
    if (!auth) {
      throw new InternalServerErrorException('auth not found')
    }

    const cookieHeader = new Headers()
    if (!req.headers.cookie) {
      return null
    }
    cookieHeader.set('cookie', req.headers.cookie)
    if (req.headers.origin) {
      cookieHeader.set('origin', req.headers.origin)
    }
    const session = await auth.api.getSession({
      query: {
        disableCookieCache: true,
      },
      headers: cookieHeader,
    })

    const accounts = await auth.api.listUserAccounts({
      headers: cookieHeader,
    })

    if (!accounts) {
      return null
    }

    const providerAccountId = accounts[0].id
    const provider = accounts[0].provider

    return {
      ...session,
      providerAccountId,
      provider,
      user: session?.user,
    }
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
    const userId = session.user?.id
    if (!userId) {
      throw new BadRequestException('user id not found')
    }
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
            // authjs field
            provider: 1,
            providerId: 1,
            type: 1,
            userId: 1,
          },
        },
      )

    // transformer
    if (account?.providerId && !account.provider) {
      account.provider = account.providerId
    }

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
}
