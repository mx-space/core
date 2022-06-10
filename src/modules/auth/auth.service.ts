import dayjs from 'dayjs'
import { isDate, omit } from 'lodash'
import { customAlphabet } from 'nanoid/async'

import { Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'

import { alphabet } from '~/constants/other.constant'
import {
  TokenModel,
  UserModel as User,
  UserModel,
} from '~/modules/user/user.model'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { InjectModel } from '~/transformers/model.transformer'

import { TokenDto } from './auth.controller'

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly userModel: ReturnModelType<typeof User>,
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
    return await ap()
  }

  async verifyCustomToken(
    token: string,
  ): Promise<Readonly<[boolean, UserModel | null]>> {
    const user = await this.userModel.findOne({}).lean().select('+apiToken')
    if (!user) {
      return [false, null] as const
    }
    const tokens = user.apiToken
    if (!tokens || !Array.isArray(tokens)) {
      return [false, null] as const
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

    return valid ? [true, await this.userModel.findOne().lean()] : [false, null]
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
}
