import {
  UserModel as User,
  UserDocument,
  TokenModel,
} from '~/modules/user/user.model'
import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ReturnModelType, DocumentType } from '@typegoose/typegoose'
import { customAlphabet } from 'nanoid/async'
import { InjectModel } from 'nestjs-typegoose'
import { JwtPayload } from './interfaces/jwt-payload.interface'
import { TokenDto } from './auth.controller'
import { isDate, omit } from 'lodash'
import dayjs from 'dayjs'

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly userModel: ReturnModelType<typeof User>,
    private readonly jwtService: JwtService,
  ) {}

  async signToken(_id: string) {
    const { authCode } = await this.userModel.findById(_id).select('authCode')
    const payload = {
      _id,
      authCode,
    }

    return this.jwtService.sign(payload)
  }
  async verifyPayload(payload: JwtPayload): Promise<UserDocument> {
    const user = await this.userModel.findById(payload._id).select('+authCode')

    return user && user.authCode === payload.authCode ? user : null
  }
  private async getAccessTokens(): Promise<DocumentType<TokenModel>[]> {
    return (await this.userModel.findOne().select('apiToken').lean())
      .apiToken as any
  }
  async getAllAccessToken() {
    return (await this.getAccessTokens()).map((token) => ({
      id: token._id,
      ...omit(token, ['_id', '__v', 'token']),
    })) as any as TokenModel[]
  }

  async getTokenSecret(id: string) {
    const tokens = await this.getAccessTokens()
    // note: _id is ObjectId not equal to string
    return tokens.find((token) => String(token._id) === id)
  }

  async generateAccessToken() {
    const ap = customAlphabet(
      '1234567890' +
        Array(26)
          .fill(null)
          .map((_, i) => String.fromCharCode(97 + i))
          .join(''),
      40,
    )
    return await ap()
  }

  async verifyCustomToken(token: string) {
    const user = await this.userModel.findOne({}).lean().select('+apiToken')

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
