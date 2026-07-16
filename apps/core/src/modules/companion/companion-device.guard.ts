import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { HttpStatus, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { AppException } from '~/common/errors/exception.types'
import type { CompanionDeviceScope } from '~/database/schema'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

import { CompanionCredentialService } from './companion-credential.service'
import {
  COMPANION_DEVICE_LAST_SEEN_WRITE_INTERVAL_MS,
  CompanionDeviceErrorCode,
} from './companion-device.constants'
import { CompanionDeviceRepository } from './companion-device.repository'

export const COMPANION_DEVICE_SCOPE_METADATA = Symbol(
  'CompanionDeviceRequiredScopes',
)

export interface CompanionDevicePrincipal {
  deviceId: string
  ownerId: string
  scopes: CompanionDeviceScope[]
}

@Injectable()
export class CompanionDeviceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly repository: CompanionDeviceRepository,
    private readonly credentials: CompanionCredentialService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getNestExecutionContextRequest(context)
    const token = this.extractBearerToken(request.headers.authorization)
    const deviceId = token && this.credentials.deviceIdFromToken(token)
    if (!token || !deviceId) throw this.deviceRevoked()

    const device = await this.repository.findDeviceById(deviceId)
    if (
      !device ||
      device.revokedAt ||
      !this.credentials.verifyDeviceToken(token, device.tokenHash)
    ) {
      throw this.deviceRevoked()
    }

    const requiredScopes =
      this.reflector.getAllAndOverride<CompanionDeviceScope[]>(
        COMPANION_DEVICE_SCOPE_METADATA,
        [context.getHandler(), context.getClass()],
      ) ?? []
    if (requiredScopes.some((scope) => !device.scopes.includes(scope))) {
      throw new AppException(
        CompanionDeviceErrorCode.scopeDenied,
        'Companion device does not have the required scope.',
        HttpStatus.FORBIDDEN,
      )
    }

    const principal: CompanionDevicePrincipal = {
      deviceId: device.id,
      ownerId: device.ownerId,
      scopes: [...device.scopes],
    }
    Object.assign(request, { companionDevice: principal })
    Object.assign(request.raw, { companionDevice: principal })

    await this.repository.markLastSeen(
      device.id,
      new Date(),
      COMPANION_DEVICE_LAST_SEEN_WRITE_INTERVAL_MS,
    )
    return true
  }

  private extractBearerToken(
    authorization: string | string[] | undefined,
  ): string | null {
    if (typeof authorization !== 'string') return null
    return /^bearer (\S+)$/i.exec(authorization)?.[1] ?? null
  }

  private deviceRevoked() {
    return new AppException(
      CompanionDeviceErrorCode.deviceRevoked,
      'Companion device token is invalid or revoked.',
      HttpStatus.UNAUTHORIZED,
    )
  }
}
