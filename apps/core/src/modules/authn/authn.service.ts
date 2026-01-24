import { Injectable } from '@nestjs/common'
import type {
  AuthenticationResponseJSON,
  CredentialDeviceType,
  RegistrationResponseJSON,
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers'
import type { ReturnModelType } from '@typegoose/typegoose'
import { RequestContext } from '~/common/contexts/request.context'
import { BizException } from '~/common/exceptions/biz.exception'
import { RedisKeys } from '~/constants/cache.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { RedisService } from '~/processors/redis/redis.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils/redis.util'
import { ConfigsService } from '../configs/configs.service'
import type { UserDocument } from '../user/user.model'
import { AuthnModel } from './authn.model'

@Injectable()
export class AuthnService {
  constructor(
    @InjectModel(AuthnModel)
    private readonly authnModel: ReturnModelType<typeof AuthnModel>,

    private readonly redisService: RedisService,
    private readonly configService: ConfigsService,
  ) {}

  private async getConfig() {
    const headers = RequestContext.currentRequest()?.headers
    const origin = headers?.origin
    const host = (() => {
      try {
        return new URL(origin ?? '').hostname
      } catch {
        return null
      }
    })()
    if (isDev) {
      return {
        rpID: host ?? 'localhost',
        expectedOrigin: origin ?? ['http://localhost:9528'],
        expectedRPID: host ?? 'localhost',
      }
    }
    const { adminUrl } = await this.configService.get('url')

    const parsedUrl = new URL(adminUrl)
    return {
      rpID: host ?? parsedUrl.hostname,
      expectedOrigin: origin ?? [parsedUrl.origin],
      expectedRPID: host ?? parsedUrl.hostname,
    }
  }

  async generateRegistrationOptions(user: UserDocument) {
    const { username, id: userId } = user

    const { rpID } = await this.getConfig()
    const userAuthenticators = await this.authnModel.find().lean()
    const registrationOptions = await generateRegistrationOptions({
      rpName: 'MixSpace',
      rpID,
      userID: isoUint8Array.fromUTF8String(userId),
      userName: username,

      excludeCredentials: userAuthenticators.map((authenticator) => {
        return {
          id: isoBase64URL.fromBuffer(
            new Uint8Array(authenticator.credentialID),
          ),
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
    const redisClient = this.redisService.getClient()
    await redisClient.set(getRedisKey(RedisKeys.Authn), challenge)
    // 5 min
    await redisClient.expire(getRedisKey(RedisKeys.Authn), 1000 * 60 * 5)
  }

  private async getCurrentChallenge() {
    return await this.redisService.getClient().get(getRedisKey(RedisKeys.Authn))
  }

  async verifyRegistrationResponse(
    user: UserDocument,
    response: RegistrationResponseJSON & { name: string },
  ) {
    const expectedChallenge = await this.getCurrentChallenge()

    if (!expectedChallenge) {
      throw new BizException(ErrorCodeEnum.AuthChallengeMissing)
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
      throw new BizException(ErrorCodeEnum.AuthFailed, error.message)
    }

    const { registrationInfo } = verification

    if (!registrationInfo) {
      throw new BizException(ErrorCodeEnum.AuthRegistrationMissing)
    }
    const { credential, credentialDeviceType, credentialBackedUp } =
      registrationInfo

    const authenticator: Authenticator = {
      credentialID: isoBase64URL.toBuffer(credential.id),
      credentialPublicKey: credential.publicKey,
      counter: credential.counter,
      credentialDeviceType,
      credentialBackedUp,
    }

    Object.assign(authenticator, {
      name: response.name,
    })

    await this.authnModel.create(authenticator)

    return verification
  }

  async generateAuthenticationOptions() {
    const userAuthenticators: Authenticator[] = await this.authnModel
      .find()
      .lean({ getters: true })

    const { rpID } = await this.getConfig()

    const options = await generateAuthenticationOptions({
      rpID,
      // Require users to use a previously-registered authenticator
      allowCredentials: userAuthenticators.map((authenticator) => ({
        id: isoBase64URL.fromBuffer(new Uint8Array(authenticator.credentialID)),
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
      throw new BizException(ErrorCodeEnum.AuthChallengeExpired)
    }

    let [authenticator] = (await this.authnModel.aggregate([
      { $match: { credentialID: response.id } },
    ])) as any as AuthnModel[]

    if (!authenticator) {
      throw new BizException(
        ErrorCodeEnum.AuthFailed,
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
        credential: {
          id: isoBase64URL.fromBuffer(
            new Uint8Array(authenticator.credentialID),
          ),
          publicKey: new Uint8Array(authenticator.credentialPublicKey),
          counter: authenticator.counter,
        },

        requireUserVerification: false,
      })
    } catch (error) {
      console.error(error)
      throw new BizException(ErrorCodeEnum.AuthFailed, error.message)
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

  async hasAuthnItem() {
    return (await this.authnModel.countDocuments()) > 0
  }
}

type Authenticator = {
  credentialID: Uint8Array
  credentialPublicKey: Uint8Array
  counter: number
  credentialDeviceType: CredentialDeviceType
  credentialBackedUp: boolean
}
