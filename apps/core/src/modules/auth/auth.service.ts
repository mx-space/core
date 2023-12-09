import dayjs from 'dayjs'
import jwt from 'jsonwebtoken'
import { isDate, omit } from 'lodash'
import { customAlphabet } from 'nanoid/async'
import type {
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server'
import type {
  AuthenticationResponseJSON,
  CredentialDeviceType,
  RegistrationResponseJSON,
} from '@simplewebauthn/server/script/deps'
import type {
  TokenModel,
  UserDocument,
  UserModel,
} from '~/modules/user/user.model'
import type { TokenDto } from './auth.controller'

import { Clerk } from '@clerk/clerk-sdk-node'
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { ReturnModelType } from '@typegoose/typegoose'

import { RedisKeys } from '~/constants/cache.constant'
import { alphabet } from '~/constants/other.constant'
import { UserModel as User } from '~/modules/user/user.model'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { CacheService } from '~/processors/redis/cache.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils'

import { ConfigsService } from '../configs/configs.service'
import { AuthnModel } from './authn.model'

// TODO
const rpID = 'localhost'
const expectedOrigin = ['http://localhost:9528']
const expectedRPID = 'localhost'
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  constructor(
    @InjectModel(User) private readonly userModel: ReturnModelType<typeof User>,
    @InjectModel(AuthnModel)
    private readonly authnModel: ReturnModelType<typeof AuthnModel>,

    private readonly jwtService: JWTService,

    @Inject(forwardRef(() => ConfigsService))
    private readonly configs: ConfigsService,

    private readonly cacheService: CacheService,
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

  async generateRegistrationOptions(user: UserDocument) {
    const { username, id: userId } = user

    const userAuthenticators = await this.authnModel.find().lean()
    const registrationOptions = await generateRegistrationOptions({
      rpName: 'MixSpace',
      rpID,
      userID: userId,
      userName: username,

      excludeCredentials: userAuthenticators.map((authenticator) => {
        return {
          id: authenticator.credentialID,
          type: 'public-key',
          // Optional
          // transports: authenticator.transports,
        }
      }),

      authenticatorSelection: {
        // Defaults
        residentKey: 'discouraged',
        userVerification: 'preferred',
        // Optional
        authenticatorAttachment: 'platform',
      },
    })

    const storedData = {
      registrationOptions,
      credentials: null,
    }

    await this.setCurrentChallenge(registrationOptions.challenge)

    return storedData
  }

  private async setCurrentChallenge(challenge: string) {
    await this.cacheService.set(
      getRedisKey(RedisKeys.Authn),
      challenge,
      // 5 min
      1000 * 60 * 5,
    )
  }

  private async getCurrentChallenge() {
    return await this.cacheService.get<string>(getRedisKey(RedisKeys.Authn))
  }

  async verifyRegistrationResponse(
    user: UserDocument,
    response: RegistrationResponseJSON,
  ) {
    const expectedChallenge = await this.getCurrentChallenge()

    if (!expectedChallenge) {
      throw new BadRequestException('challenge is not found')
    }

    let verification: VerifiedRegistrationResponse

    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,

        requireUserVerification: false,
      })
    } catch (error) {
      console.error(error)
      throw new BadRequestException(error.message)
    }

    const { registrationInfo } = verification

    if (!registrationInfo) {
      throw new BadRequestException('registrationInfo is not found')
    }
    const {
      credentialPublicKey,
      credentialID,
      counter,
      credentialDeviceType,
      credentialBackedUp,
    } = registrationInfo

    const authenticator: Authenticator = {
      credentialID,
      credentialPublicKey,
      counter,
      credentialDeviceType,
      credentialBackedUp,
    }

    await this.authnModel.create(authenticator)

    return verification
  }

  async generateAuthenticationOptions(user: UserDocument) {
    const userAuthenticators: Authenticator[] = await this.authnModel
      .find()
      .lean({ getters: true })

    const options = await generateAuthenticationOptions({
      rpID,
      // Require users to use a previously-registered authenticator
      allowCredentials: userAuthenticators.map((authenticator) => ({
        id: authenticator.credentialID,
        type: 'public-key',
      })),
      userVerification: 'discouraged',
    })

    // (Pseudocode) Remember this challenge for this user

    await this.setCurrentChallenge(options.challenge)
    return options
  }

  async verifyAuthenticationResponse(response: AuthenticationResponseJSON) {
    const expectedChallenge = await this.getCurrentChallenge()

    if (!expectedChallenge) {
      throw new BadRequestException('challenge is outdate')
    }

    let [authenticator] = (await this.authnModel.aggregate([
      { $match: { credentialID: response.id } },
    ])) as any as AuthnModel[]

    if (!authenticator) {
      throw new BadRequestException(
        `Could not find authenticator ${response.id}`,
      )
    }

    authenticator = (await this.authnModel
      .findById((authenticator as any)._id)
      .lean({
        getters: true,
      }))!

    let verification: VerifiedAuthenticationResponse
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
        authenticator,

        requireUserVerification: false,
      })
    } catch (error) {
      console.error(error)
      throw new BadRequestException(error.message)
    }

    return verification
  }
}

type Authenticator = {
  credentialID: Uint8Array
  credentialPublicKey: Uint8Array
  counter: number
  credentialDeviceType: CredentialDeviceType
  credentialBackedUp: boolean
}
