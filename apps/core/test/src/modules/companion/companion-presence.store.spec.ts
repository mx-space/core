import { redisHelper } from 'test/helper/redis-mock.helper'
import { vi } from 'vitest'

import { BusinessEvents } from '~/constants/business-event.constant'
import {
  CompanionPresenceClearRequestV2Schema,
  CompanionPresenceRequestV2Schema,
  PublicLiveDeskStateV2Schema,
} from '~/modules/companion/companion.schema'
import type {
  CompanionDeviceRevokedError,
  CompanionSequenceError,
} from '~/modules/companion/companion-presence.store'
import { CompanionPresenceStore } from '~/modules/companion/companion-presence.store'
import { getRedisKey } from '~/utils/redis.util'

const DEVICE_A = '01K0A4VDWYSH1JQH4PGY4QM8YT'
const DEVICE_B = '019c7aa4-a124-719d-970f-a4bb8b12d92d'

const makeSnapshot = (input: {
  deviceId?: string
  requestId?: string
  sequence?: number
  displayName?: string
  ttlSeconds?: number
}) =>
  CompanionPresenceRequestV2Schema.parse({
    meta: {
      schema: 'yohaku.companion.presence',
      schemaVersion: 2,
      requestId: input.requestId ?? '01K0A5Q2R7Y5VXG4H7Q0F4M9J2',
      deviceId: input.deviceId ?? DEVICE_A,
      sequence: input.sequence ?? 0,
      observedAt: '2026-07-16T12:00:00.000Z',
    },
    data: {
      availability: 'active',
      lease: { ttlSeconds: input.ttlSeconds ?? 30 },
      application: {
        displayName: input.displayName ?? 'Xcode',
        activity: { key: 'editing', customLabel: null },
        window: null,
        icon: null,
      },
      media: null,
    },
  })

const makeClear = (deviceId: string, sequence: number) =>
  CompanionPresenceClearRequestV2Schema.parse({
    meta: {
      schema: 'yohaku.companion.presence',
      schemaVersion: 2,
      requestId: crypto.randomUUID(),
      deviceId,
      sequence,
      observedAt: '2026-07-16T12:00:10.000Z',
    },
    data: { reason: 'paused' },
  })

describe('CompanionPresenceStore', () => {
  const broadcast = vi.fn()
  let store: CompanionPresenceStore

  beforeEach(async () => {
    const helper = await redisHelper
    await helper.RedisService.getClient().flushall()
    broadcast.mockReset()
    store = new CompanionPresenceStore(
      helper.RedisService as any,
      {
        broadcast,
      } as any,
    )
  })

  it('initializes an empty epoch baseline and emits the same canonical state', async () => {
    const state = await store.getPublicState(
      new Date('2026-07-16T12:00:00.000Z'),
    )

    expect(PublicLiveDeskStateV2Schema.parse(state)).toEqual(state)
    expect(state.revision).toBe(0)
    expect(state.projection).toBeNull()
    expect(broadcast).toHaveBeenCalledWith(
      BusinessEvents.COMPANION_PRESENCE_CHANGED,
      state,
    )
  })

  it('changes epoch instead of regressing revision when an authority marker is lost', async () => {
    const helper = await redisHelper
    const accepted = await store.putSnapshot(
      makeSnapshot({}),
      new Date('2026-07-16T12:00:00.000Z'),
    )
    await helper.RedisService.getClient().del(
      getRedisKey('companion:presence:revision'),
    )
    broadcast.mockClear()

    const rebuilt = await store.getPublicState(
      new Date('2026-07-16T12:00:01.000Z'),
    )

    expect(rebuilt.epoch).not.toBe(accepted.state.epoch)
    expect(rebuilt.revision).toBe(0)
    expect(rebuilt.projection).toBeNull()
    expect(broadcast).toHaveBeenCalledWith(
      BusinessEvents.COMPANION_PRESENCE_CHANGED,
      rebuilt,
    )
  })

  it('returns the original accepted result for an exact retry without extending its lease', async () => {
    const request = makeSnapshot({})
    const first = await store.putSnapshot(
      request,
      new Date('2026-07-16T12:00:00.000Z'),
    )
    broadcast.mockClear()

    const retry = await store.putSnapshot(
      request,
      new Date('2026-07-16T12:00:20.000Z'),
    )

    expect(retry).toEqual(first)
    expect(retry.receivedAt).toBe('2026-07-16T12:00:00.000Z')
    expect(retry.state.projection?.expiresAt).toBe('2026-07-16T12:00:30.000Z')
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('replays a committed broadcast marker before acknowledging it', async () => {
    await store.putSnapshot(
      makeSnapshot({}),
      new Date('2026-07-16T12:00:00.000Z'),
    )
    expect(broadcast).toHaveBeenCalledTimes(1)

    await store.flushPendingBroadcast()
    await store.flushPendingBroadcast()
    await store.flushPendingBroadcast()

    expect(broadcast).toHaveBeenCalledTimes(3)
  })

  it('distinguishes conflicting and stale sequences while exposing only the accepted counter', async () => {
    await store.putSnapshot(
      makeSnapshot({ sequence: 2 }),
      new Date('2026-07-16T12:00:00.000Z'),
    )

    await expect(
      store.putSnapshot(
        makeSnapshot({
          sequence: 2,
          requestId: '019c7aa4-a124-719d-970f-a4bb8b12d92d',
        }),
        new Date('2026-07-16T12:00:01.000Z'),
      ),
    ).rejects.toMatchObject<Partial<CompanionSequenceError>>({
      code: 'COMPANION_SEQUENCE_CONFLICT',
      acceptedSequence: 2,
    })

    await expect(
      store.putSnapshot(
        makeSnapshot({ sequence: 1 }),
        new Date('2026-07-16T12:00:02.000Z'),
      ),
    ).rejects.toMatchObject<Partial<CompanionSequenceError>>({
      code: 'COMPANION_SEQUENCE_STALE',
      acceptedSequence: 2,
    })
  })

  it('cannot let an older concurrent operation overwrite a newer sequence', async () => {
    await store.putSnapshot(
      makeSnapshot({ sequence: 0 }),
      new Date('2026-07-16T12:00:00.000Z'),
    )
    const sequenceOne = makeSnapshot({
      sequence: 1,
      requestId: '00000000-0000-4000-8000-000000000001',
      displayName: 'Sequence One',
    })
    const sequenceTwo = makeSnapshot({
      sequence: 2,
      requestId: '00000000-0000-4000-8000-000000000002',
      displayName: 'Sequence Two',
    })

    const outcomes = await Promise.allSettled([
      store.putSnapshot(sequenceOne, new Date('2026-07-16T12:00:01.000Z')),
      store.putSnapshot(sequenceTwo, new Date('2026-07-16T12:00:02.000Z')),
    ])

    expect(outcomes[1].status).toBe('fulfilled')
    if (outcomes[0].status === 'rejected') {
      expect(outcomes[0].reason).toMatchObject({
        code: 'COMPANION_SEQUENCE_STALE',
        acceptedSequence: 2,
      })
    }

    const exactRetry = await store.putSnapshot(
      sequenceTwo,
      new Date('2026-07-16T12:00:03.000Z'),
    )
    expect(exactRetry.acceptedSequence).toBe(2)
    expect(exactRetry.state.projection?.application?.displayName).toBe(
      'Sequence Two',
    )
  })

  it('selects one latest device and atomically falls back on clear and expiry', async () => {
    const first = await store.putSnapshot(
      makeSnapshot({ deviceId: DEVICE_A, displayName: 'Xcode' }),
      new Date('2026-07-16T12:00:00.000Z'),
    )
    const second = await store.putSnapshot(
      makeSnapshot({ deviceId: DEVICE_B, displayName: 'Safari' }),
      new Date('2026-07-16T12:00:05.000Z'),
    )

    expect(first.state.revision).toBe(1)
    expect(second.state.revision).toBe(2)
    expect(second.state.projection?.application?.displayName).toBe('Safari')

    const cleared = await store.clear(
      makeClear(DEVICE_B, 1),
      new Date('2026-07-16T12:00:10.000Z'),
    )
    expect(cleared.state.revision).toBe(3)
    expect(cleared.state.projection?.application?.displayName).toBe('Xcode')

    const expired = await store.getPublicState(
      new Date('2026-07-16T12:00:30.000Z'),
    )
    expect(expired.revision).toBe(4)
    expect(expired.projection).toBeNull()
  })

  it('uses the record expiry as authority when the deadline index is lost', async () => {
    const helper = await redisHelper
    await store.putSnapshot(
      makeSnapshot({}),
      new Date('2026-07-16T12:00:00.000Z'),
    )
    await helper.RedisService.getClient().del(
      getRedisKey('companion:presence:deadlines'),
    )

    const expired = await store.getPublicState(
      new Date('2026-07-16T12:00:31.000Z'),
    )

    expect(expired.projection).toBeNull()
    const storedRecord = await helper.RedisService.getClient().hget(
      getRedisKey('companion:presence:records'),
      DEVICE_A,
    )
    expect(storedRecord).not.toContain('Xcode')
    expect(JSON.parse(storedRecord ?? '{}')).toEqual({ acceptedSequence: 0 })
  })

  it('bounds a clear retry result that contains another device fallback', async () => {
    const helper = await redisHelper
    await store.putSnapshot(
      makeSnapshot({
        deviceId: DEVICE_A,
        displayName: 'Xcode',
        ttlSeconds: 120,
      }),
      new Date('2026-07-16T12:00:00.000Z'),
    )
    await store.putSnapshot(
      makeSnapshot({
        deviceId: DEVICE_B,
        displayName: 'Safari',
        ttlSeconds: 120,
      }),
      new Date('2026-07-16T12:00:05.000Z'),
    )
    const clearRequest = makeClear(DEVICE_B, 1)
    const cleared = await store.clear(
      clearRequest,
      new Date('2026-07-16T12:00:10.000Z'),
    )
    const retry = await store.clear(
      clearRequest,
      new Date('2026-07-16T12:00:20.000Z'),
    )
    expect(retry).toEqual(cleared)
    expect(retry.state.projection?.application?.displayName).toBe('Xcode')

    await store.getPublicState(new Date('2026-07-16T12:02:11.000Z'))
    const clearedDeviceRecord = await helper.RedisService.getClient().hget(
      getRedisKey('companion:presence:records'),
      DEVICE_B,
    )
    expect(clearedDeviceRecord).not.toContain('Xcode')
    expect(clearedDeviceRecord).not.toContain('Safari')
    expect(JSON.parse(clearedDeviceRecord ?? '{}')).toEqual({
      acceptedSequence: 1,
    })
  })

  it('scrubs an expired clear result even when its deadline member is lost', async () => {
    const helper = await redisHelper
    await store.putSnapshot(
      makeSnapshot({
        deviceId: DEVICE_A,
        displayName: 'Xcode',
        ttlSeconds: 120,
      }),
      new Date('2026-07-16T12:00:00.000Z'),
    )
    await store.putSnapshot(
      makeSnapshot({
        deviceId: DEVICE_B,
        displayName: 'Safari',
        ttlSeconds: 120,
      }),
      new Date('2026-07-16T12:00:05.000Z'),
    )
    const clearRequest = makeClear(DEVICE_B, 1)
    await store.clear(clearRequest, new Date('2026-07-16T12:00:10.000Z'))
    await helper.RedisService.getClient().zrem(
      getRedisKey('companion:presence:deadlines'),
      DEVICE_B,
    )

    await expect(
      store.clear(clearRequest, new Date('2026-07-16T12:02:11.000Z')),
    ).rejects.toMatchObject<Partial<CompanionSequenceError>>({
      code: 'COMPANION_SEQUENCE_CONFLICT',
      acceptedSequence: 1,
    })
    const storedRecord = await helper.RedisService.getClient().hget(
      getRedisKey('companion:presence:records'),
      DEVICE_B,
    )
    expect(storedRecord).not.toContain('Xcode')
    expect(storedRecord).not.toContain('Safari')
    expect(JSON.parse(storedRecord ?? '{}')).toEqual({ acceptedSequence: 1 })
  })

  it('does not revise public state when a non-selected device is cleared', async () => {
    await store.putSnapshot(
      makeSnapshot({ deviceId: DEVICE_A, displayName: 'Xcode' }),
      new Date('2026-07-16T12:00:00.000Z'),
    )
    const selected = await store.putSnapshot(
      makeSnapshot({ deviceId: DEVICE_B, displayName: 'Safari' }),
      new Date('2026-07-16T12:00:05.000Z'),
    )
    broadcast.mockClear()

    const result = await store.clear(
      makeClear(DEVICE_A, 1),
      new Date('2026-07-16T12:00:10.000Z'),
    )

    expect(result.state).toEqual(selected.state)
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('expires content-bearing idempotency state and rejects an exact retry without replaying it', async () => {
    const request = makeSnapshot({})
    await store.putSnapshot(request, new Date('2026-07-16T12:00:00.000Z'))
    broadcast.mockClear()

    await expect(
      store.putSnapshot(request, new Date('2026-07-16T12:00:31.000Z')),
    ).rejects.toMatchObject<Partial<CompanionSequenceError>>({
      code: 'COMPANION_SEQUENCE_CONFLICT',
      acceptedSequence: 0,
    })

    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(broadcast.mock.calls[0][1]).toMatchObject({
      revision: 2,
      projection: null,
    })

    const helper = await redisHelper
    const storedRecord = await helper.RedisService.getClient().hget(
      getRedisKey('companion:presence:records'),
      DEVICE_A,
    )
    expect(storedRecord).not.toContain('Xcode')
    expect(JSON.parse(storedRecord ?? '{}')).toEqual({ acceptedSequence: 0 })
  })

  it('removes a selected revoked device and makes repeated revocation idempotent', async () => {
    const helper = await redisHelper
    await store.putSnapshot(
      makeSnapshot({ deviceId: DEVICE_A, displayName: 'Xcode' }),
      new Date('2026-07-16T12:00:00.000Z'),
    )
    await store.putSnapshot(
      makeSnapshot({ deviceId: DEVICE_B, displayName: 'Safari' }),
      new Date('2026-07-16T12:00:05.000Z'),
    )

    const firstState = await store.removeDevice(
      DEVICE_B,
      new Date('2026-07-16T12:00:06.000Z'),
    )

    const firstTombstone = await helper.RedisService.getClient().hget(
      getRedisKey('companion:presence:revoked-devices'),
      DEVICE_B,
    )
    broadcast.mockClear()
    const repeatedState = await store.removeDevice(
      DEVICE_B,
      new Date('2026-07-16T12:00:07.000Z'),
    )
    const repeatedTombstone = await helper.RedisService.getClient().hget(
      getRedisKey('companion:presence:revoked-devices'),
      DEVICE_B,
    )

    expect(firstState.revision).toBe(3)
    expect(firstState.projection?.application?.displayName).toBe('Xcode')
    expect(JSON.stringify(firstState)).not.toContain(DEVICE_B)
    expect(repeatedState).toEqual(firstState)
    expect(repeatedTombstone).toBe(firstTombstone)
    expect(firstTombstone).toBe('2026-07-16T12:00:06.000Z')
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('rejects post-auth in-flight snapshot and clear mutations after revocation', async () => {
    const helper = await redisHelper
    await store.putSnapshot(
      makeSnapshot({ sequence: 0 }),
      new Date('2026-07-16T12:00:00.000Z'),
    )
    const inFlightSnapshot = makeSnapshot({
      sequence: 1,
      requestId: '00000000-0000-4000-8000-000000000001',
      displayName: 'Must Not Return',
    })
    const revokedState = await store.removeDevice(
      DEVICE_A,
      new Date('2026-07-16T12:00:01.000Z'),
    )
    broadcast.mockClear()

    await expect(
      store.putSnapshot(inFlightSnapshot, new Date('2026-07-16T12:00:02.000Z')),
    ).rejects.toMatchObject<Partial<CompanionDeviceRevokedError>>({
      code: 'COMPANION_DEVICE_REVOKED',
    })
    await expect(
      store.clear(makeClear(DEVICE_A, 1), new Date('2026-07-16T12:00:03.000Z')),
    ).rejects.toMatchObject<Partial<CompanionDeviceRevokedError>>({
      code: 'COMPANION_DEVICE_REVOKED',
    })

    expect(
      await helper.RedisService.getClient().hget(
        getRedisKey('companion:presence:records'),
        DEVICE_A,
      ),
    ).toBeNull()
    expect(
      await store.getPublicState(new Date('2026-07-16T12:00:04.000Z')),
    ).toEqual(revokedState)
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('keeps the public state revoked for either Redis ordering of concurrent revoke and PUT', async () => {
    const helper = await redisHelper
    const racingRedis = helper.RedisService.getClient().duplicate()
    await racingRedis.ping()
    const racingStore = new CompanionPresenceStore({
      getClient: () => racingRedis,
    } as any)

    try {
      await store.putSnapshot(
        makeSnapshot({ sequence: 0 }),
        new Date('2026-07-16T12:00:00.000Z'),
      )
      const outcomes = await Promise.allSettled([
        store.removeDevice(DEVICE_A, new Date('2026-07-16T12:00:01.000Z')),
        racingStore.putSnapshot(
          makeSnapshot({
            sequence: 1,
            requestId: '00000000-0000-4000-8000-000000000001',
            displayName: 'Racing PUT',
          }),
          new Date('2026-07-16T12:00:01.000Z'),
        ),
      ])

      expect(outcomes[0].status).toBe('fulfilled')
      if (outcomes[1].status === 'rejected') {
        expect(outcomes[1].reason).toMatchObject({
          code: 'COMPANION_DEVICE_REVOKED',
        })
      }
      await expect(
        store.getPublicState(new Date('2026-07-16T12:00:02.000Z')),
      ).resolves.toMatchObject({ projection: null })
      await expect(
        helper.RedisService.getClient().hget(
          getRedisKey('companion:presence:records'),
          DEVICE_A,
        ),
      ).resolves.toBeNull()
      await expect(
        helper.RedisService.getClient().hexists(
          getRedisKey('companion:presence:revoked-devices'),
          DEVICE_A,
        ),
      ).resolves.toBe(1)
    } finally {
      await racingRedis.quit()
    }
  })

  it('preserves revocation authority when ephemeral Redis authority is reinitialized', async () => {
    const helper = await redisHelper
    const accepted = await store.putSnapshot(
      makeSnapshot({ sequence: 0 }),
      new Date('2026-07-16T12:00:00.000Z'),
    )
    await store.removeDevice(DEVICE_A, new Date('2026-07-16T12:00:01.000Z'))
    await helper.RedisService.getClient().del(
      getRedisKey('companion:presence:revision'),
    )
    broadcast.mockClear()

    await expect(
      store.putSnapshot(
        makeSnapshot({ sequence: 1 }),
        new Date('2026-07-16T12:00:02.000Z'),
      ),
    ).rejects.toMatchObject<Partial<CompanionDeviceRevokedError>>({
      code: 'COMPANION_DEVICE_REVOKED',
    })

    const rebuilt = await store.getPublicState(
      new Date('2026-07-16T12:00:03.000Z'),
    )
    expect(rebuilt.epoch).not.toBe(accepted.state.epoch)
    expect(rebuilt).toMatchObject({ revision: 0, projection: null })
    expect(
      await helper.RedisService.getClient().hget(
        getRedisKey('companion:presence:revoked-devices'),
        DEVICE_A,
      ),
    ).toBe('2026-07-16T12:00:01.000Z')
    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(broadcast.mock.calls[0][1]).toMatchObject({
      revision: 0,
      projection: null,
    })
  })
})
