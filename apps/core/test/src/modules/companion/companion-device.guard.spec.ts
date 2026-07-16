import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { describe, expect, it, vi } from 'vitest'

import type { AppException } from '~/common/errors/exception.types'
import { CompanionCredentialService } from '~/modules/companion/companion-credential.service'
import {
  CompanionDeviceGuard,
  type CompanionDevicePrincipal,
} from '~/modules/companion/companion-device.guard'
import type {
  CompanionDeviceRecord,
  CompanionDeviceRepository,
} from '~/modules/companion/companion-device.repository'

const createContext = (request: Record<string, any>): ExecutionContext =>
  ({
    getClass: () => class TestController {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext

describe('CompanionDeviceGuard', () => {
  const credentials = new CompanionCredentialService()

  const setup = (
    requiredScopes: string[],
    patch?: Partial<CompanionDeviceRecord>,
  ) => {
    const credential = credentials.createDeviceCredential()
    const device: CompanionDeviceRecord = {
      id: credential.deviceId,
      ownerId: 'owner-1',
      name: 'MacBook Pro',
      tokenHash: credential.tokenHash,
      scopes: ['companion:presence:write'],
      createdAt: new Date(),
      updatedAt: null,
      lastSeenAt: null,
      revokedAt: null,
      presenceClearedAt: null,
      ...patch,
    }
    const repository = {
      findDeviceById: vi.fn().mockResolvedValue(device),
      markLastSeen: vi.fn().mockResolvedValue(undefined),
    } as unknown as CompanionDeviceRepository
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(requiredScopes),
    } as unknown as Reflector
    const guard = new CompanionDeviceGuard(reflector, repository, credentials)
    const request = {
      headers: { authorization: `Bearer ${credential.token}` },
      raw: {},
    }
    return { credential, device, guard, repository, request }
  }

  it('attaches a redacted principal for a valid scoped token', async () => {
    const { credential, guard, repository, request } = setup([
      'companion:presence:write',
    ])

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true)
    expect(request).not.toHaveProperty('token')
    expect(request.raw).not.toHaveProperty('token')
    expect(request).toHaveProperty('companionDevice', {
      deviceId: credential.deviceId,
      ownerId: 'owner-1',
      scopes: ['companion:presence:write'],
    } satisfies CompanionDevicePrincipal)
    expect(repository.markLastSeen).toHaveBeenCalledOnce()
  })

  it('rejects insufficient scope without attaching a principal', async () => {
    const { guard, request } = setup(['companion:moment:write'])

    const result = guard.canActivate(createContext(request))
    await expect(result).rejects.toMatchObject({
      code: 'COMPANION_SCOPE_DENIED',
    } satisfies Partial<AppException>)
    expect(request).not.toHaveProperty('companionDevice')
  })

  it('collapses revoked and invalid credentials into the same unauthorized response', async () => {
    const { guard, request } = setup(['companion:presence:write'], {
      revokedAt: new Date(),
    })

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toMatchObject({
      code: 'COMPANION_DEVICE_REVOKED',
    } satisfies Partial<AppException>)
  })
})
