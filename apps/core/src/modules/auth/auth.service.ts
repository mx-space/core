import dayjs from 'dayjs'
import jwt from 'jsonwebtoken'
import { isDate, omit } from 'lodash'
import { customAlphabet } from 'nanoid/async'
import type { TokenModel, UserModel } from '~/modules/user/user.model'
import type { TokenDto } from './auth.controller'

import { Clerk } from '@clerk/clerk-sdk-node'
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'

import { alphabet } from '~/constants/other.constant'
import { UserModel as User } from '~/modules/user/user.model'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { InjectModel } from '~/transformers/model.transformer'

import { ConfigsService } from '../configs/configs.service'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  constructor(
    @InjectModel(User) private readonly userModel: ReturnModelType<typeof User>,

    private readonly jwtService: JWTService,

    @Inject(forwardRef(() => ConfigsService))
    private readonly configs: ConfigsService,
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

  async verifyClerkJWT(jwtToken: string) {
    const clerkOptions = await this.configs.get('clerkOptions')
    const { enable, pemKey, secretKey, adminUserId } = clerkOptions
    if (!enable) return false

    if (jwtToken === undefined) {
      return false
    }

    try {
      if (jwtToken) {
        const { sub: userId } = jwt.verify(jwtToken, pemKey) as {
          sub: string
        }

        // 1. promise user is exist
        const user = await Clerk({
          secretKey,
        }).users.getUser(userId)

        return user.id === adminUserId
      }
    } catch (error) {
      this.logger.error(`clerk jwt valid error: ${error.message}`)
      return false
    }
  }
}
