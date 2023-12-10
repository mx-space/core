import type {
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server'
import type {
  AuthenticationResponseJSON,
  CredentialDeviceType,
  RegistrationResponseJSON,
} from '@simplewebauthn/server/script/deps'
import type { UserDocument } from '../user/user.model'

import { BadRequestException, Injectable } from '@nestjs/common'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { ReturnModelType } from '@typegoose/typegoose'

import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/redis/cache.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils'

import { ConfigsService } from '../configs/configs.service'
import { AuthnModel } from './authn.model'

@Injectable()
export class AuthnService {
  constructor(
    @InjectModel(AuthnModel)
    private readonly authnModel: ReturnModelType<typeof AuthnModel>,

    private readonly cacheService: CacheService,
    private readonly configService: ConfigsService,
  ) {}

  private async getConfig() {
    if (isDev) {
      return {
        rpID: 'localhost',
        expectedOrigin: ['http://localhost:9528'],
        expectedRPID: 'localhost',
      }
    }
    const { adminUrl } = await this.configService.get('url')

    const parsedUrl = new URL(adminUrl)
    return {
      rpID: parsedUrl.hostname,
      expectedOrigin: [parsedUrl.origin],
      expectedRPID: parsedUrl.hostname,
    }
  }

  async generateRegistrationOptions(user: UserDocument) {
    const { username, id: userId } = user

    const { rpID } = await this.getConfig()
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
        residentKey: 'preferred',
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
    response: RegistrationResponseJSON & { name: string },
  ) {
    const expectedChallenge = await this.getCurrentChallenge()

    if (!expectedChallenge) {
      throw new BadRequestException('challenge is not found')
    }

    let verification: VerifiedRegistrationResponse

    const { expectedOrigin, expectedRPID } = await this.getConfig()
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

    Object.assign(authenticator, {
      name: response.name,
    })

    await this.authnModel.create(authenticator)

    return verification
  }

  async generateAuthenticationOptions(user: UserDocument) {
    const userAuthenticators: Authenticator[] = await this.authnModel
      .find()
      .lean({ getters: true })

    const { rpID } = await this.getConfig()

    const options = await generateAuthenticationOptions({
      rpID,
      // Require users to use a previously-registered authenticator
      allowCredentials: userAuthenticators.map((authenticator) => ({
        id: authenticator.credentialID,
        type: 'public-key',
      })),
      userVerification: 'preferred',
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
    const { expectedOrigin, expectedRPID } = await this.getConfig()
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

  getAllAuthnItems() {
    return this.authnModel.aggregate([
      {
        $match: {},
      },
    ])
  }

  deleteAuthnItem(id: string) {
    return this.authnModel.deleteOne({
      _id: id,
    })
  }
}

type Authenticator = {
  credentialID: Uint8Array
  credentialPublicKey: Uint8Array
  counter: number
  credentialDeviceType: CredentialDeviceType
  credentialBackedUp: boolean
}
