import { randomUUID } from 'node:crypto'

import { HttpStatus, Inject, Injectable } from '@nestjs/common'

import { AppException } from '~/common/errors/exception.types'
import type { CompanionDeviceScope } from '~/database/schema'

import { CompanionCredentialService } from './companion-credential.service'
import {
  COMPANION_PAIRING_TTL_MS,
  CompanionDeviceErrorCode,
} from './companion-device.constants'
import { CompanionDeviceRepository } from './companion-device.repository'
import {
  COMPANION_PRESENCE_REVOCATION_PORT,
  type CompanionPresenceRevocationPort,
} from './companion-presence-revocation.port'

const isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code === '23505'

@Injectable()
export class CompanionDeviceService {
  constructor(
    private readonly repository: CompanionDeviceRepository,
    private readonly credentials: CompanionCredentialService,
    @Inject(COMPANION_PRESENCE_REVOCATION_PORT)
    private readonly presenceRevocation: CompanionPresenceRevocationPort,
  ) {}

  async createPairing(
    ownerId: string,
    scopes: CompanionDeviceScope[],
    now = new Date(),
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const credential = this.credentials.createPairingCredential()
      const expiresAt = new Date(now.getTime() + COMPANION_PAIRING_TTL_MS)
      try {
        const pairing = await this.repository.createPairing({
          id: randomUUID(),
          ownerId,
          codeHash: credential.codeHash,
          scopes,
          expiresAt,
        })
        return {
          pairingId: pairing.id,
          pairingCode: credential.displayCode,
          expiresAt: pairing.expiresAt.toISOString(),
        }
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 2) throw error
      }
    }
    throw new Error('Unable to allocate Companion pairing credential.')
  }

  async claimPairing(
    pairingCode: string,
    deviceName: string,
    now = new Date(),
  ) {
    const codeHash = this.credentials.hashPairingCode(pairingCode)
    if (!codeHash) throw this.pairingExpired()

    const credential = this.credentials.createDeviceCredential()
    const claimed = await this.repository.claimPairing({
      codeHash,
      claimedAt: now,
      device: {
        id: credential.deviceId,
        name: deviceName,
        tokenHash: credential.tokenHash,
      },
    })
    if (!claimed) throw this.pairingExpired()

    return {
      deviceId: claimed.device.id,
      deviceToken: credential.token,
      scopes: claimed.device.scopes,
      nextSequence: 0,
    }
  }

  async listDevices(ownerId: string) {
    const devices = await this.repository.listDevices(ownerId)
    return devices.map((device) => ({
      id: device.id,
      name: device.name,
      scopes: device.scopes,
      createdAt: device.createdAt.toISOString(),
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      revokedAt: device.revokedAt?.toISOString() ?? null,
    }))
  }

  async revokeDevice(ownerId: string, deviceId: string, now = new Date()) {
    const device = await this.repository.revokeDevice(ownerId, deviceId, now)
    if (!device) {
      throw new AppException(
        CompanionDeviceErrorCode.deviceNotFound,
        'Companion device was not found.',
        HttpStatus.NOT_FOUND,
      )
    }

    if (!device.presenceClearedAt) {
      await this.presenceRevocation.removeDevice(device.id)
      await this.repository.markPresenceCleared(device.id, now)
    }

    return {
      deviceId: device.id,
      revokedAt: (device.revokedAt ?? now).toISOString(),
    }
  }

  private pairingExpired() {
    // Expired, consumed, malformed, and unknown codes deliberately collapse to
    // one response so the claim endpoint cannot be used as an oracle.
    return new AppException(
      CompanionDeviceErrorCode.pairingExpired,
      'Pairing code is invalid, expired, or already consumed.',
      HttpStatus.GONE,
    )
  }
}
