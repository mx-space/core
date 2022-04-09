import dayjs from 'dayjs'
import { isDate, omit } from 'lodash'
import { customAlphabet } from 'nanoid/async'

import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { DocumentType, ReturnModelType } from '@typegoose/typegoose'

import { MasterLostException } from '~/common/exceptions/master-lost.exception'
import {
  TokenModel,
  UserModel as User,
  UserDocument,
} from '~/modules/user/user.model'
import { InjectModel } from '~/transformers/model.transformer'

import { TokenDto } from './auth.controller'
import { JwtPayload } from './interfaces/jwt-payload.interface'

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly userModel: ReturnModelType<typeof User>,
    private readonly jwtService: JwtService,
  ) {}

  async signToken(_id: string) {
    const user = await this.userModel.findById(_id).select('authCode')
    if (!user) {
      throw new MasterLostException()
    }
    const authCode = user.authCode
    const payload = {
      _id,
      authCode,
    }

    return this.jwtService.sign(payload)
  }
  async verifyPayload(payload: JwtPayload): Promise<UserDocument | null> {
    const user = await this.userModel.findById(payload._id).select('+authCode')

    if (!user) {
      throw new MasterLostException()
    }

    return user && user.authCode === payload.authCode ? user : null
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
    const ap = customAlphabet(
      `1234567890${Array(26)
        .fill(null)
        .map((_, i) => String.fromCharCode(97 + i))
        .join('')}`,
      40,
    )
    return await ap()
  }

  async verifyCustomToken(token: string): Promise<boolean> {
    const user = await this.userModel.findOne({}).lean().select('+apiToken')
    if (!user) {
      return false
    }
    const tokens = user.apiToken
    if (!tokens || !Array.isArray(tokens)) {
      return false
    }
    return tokens.some((doc) => {
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
