import { CompanionPresenceRequestV2Schema } from '~/modules/companion/companion.schema'
import {
  assertCompanionProjectionPolicy,
  canonicalJSONStringify,
  CompanionProjectionPolicyError,
  createPublicLiveDeskProjection,
  fingerprintCompanionMutation,
} from '~/modules/companion/companion-presence.projection'

const makeRequest = () =>
  CompanionPresenceRequestV2Schema.parse({
    meta: {
      schema: 'yohaku.companion.presence',
      schemaVersion: 2,
      requestId: '01K0A5Q2R7Y5VXG4H7Q0F4M9J2',
      deviceId: '01K0A4VDWYSH1JQH4PGY4QM8YT',
      sequence: 0,
      observedAt: '2026-07-16T12:00:00.000Z',
    },
    data: {
      availability: 'active',
      lease: { ttlSeconds: 90 },
      application: {
        displayName: 'Xcode',
        activity: { key: 'editing', customLabel: null },
        window: null,
        icon: null,
      },
      media: {
        sessionId: '01K0A5PXA7KPKN6VBYF6M52M2R',
        kind: 'music',
        title: 'Track title',
        artist: 'Artist',
        album: null,
        player: { displayName: 'Music' },
        playback: {
          state: 'playing',
          durationMs: 203_000,
          positionMs: 72_400,
          sampledAt: '2026-07-16T11:59:59.600Z',
          rate: 1,
        },
      },
    },
  })

describe('Companion public projection normalization', () => {
  it('anchors playing media at server receipt time without trusting distant clocks', () => {
    const request = makeRequest()
    const projection = createPublicLiveDeskProjection(
      request,
      new Date('2026-07-16T12:00:00.180Z'),
    )

    expect(projection.updatedAt).toBe('2026-07-16T12:00:00.180Z')
    expect(projection.expiresAt).toBe('2026-07-16T12:01:30.180Z')
    expect(projection.media?.playback).toEqual({
      state: 'playing',
      durationMs: 203_000,
      positionMs: 72_980,
      anchorAt: '2026-07-16T12:00:00.180Z',
      rate: 1,
    })

    const distantClock = structuredClone(request)
    distantClock.data.media!.playback.sampledAt = '2026-07-16T11:58:00.000Z'
    expect(
      createPublicLiveDeskProjection(
        distantClock,
        new Date('2026-07-16T12:00:00.180Z'),
      ).media?.playback.positionMs,
    ).toBe(72_400)
  })

  it('preserves an unknown position as null instead of manufacturing zero', () => {
    const request = makeRequest()
    request.data.media!.playback.positionMs = null

    expect(
      createPublicLiveDeskProjection(
        request,
        new Date('2026-07-16T12:00:00.180Z'),
      ).media?.playback.positionMs,
    ).toBeNull()
  })

  it('uses a key-order-independent fingerprint while retaining request identity', () => {
    const request = makeRequest()
    const reordered = JSON.parse(canonicalJSONStringify(request))

    expect(fingerprintCompanionMutation('snapshot', reordered)).toBe(
      fingerprintCompanionMutation('snapshot', request),
    )

    reordered.meta.requestId = '019c7aa4-a124-719d-970f-a4bb8b12d92d'
    expect(fingerprintCompanionMutation('snapshot', reordered)).not.toBe(
      fingerprintCompanionMutation('snapshot', request),
    )
  })

  it('rejects arbitrary tracking hosts and accepts only an explicit icon allowlist', () => {
    const request = makeRequest()
    request.data.application!.icon = {
      url: 'https://assets.example.com/apps/xcode.png',
    }

    expect(() => assertCompanionProjectionPolicy(request, new Set())).toThrow(
      CompanionProjectionPolicyError,
    )
    expect(() =>
      assertCompanionProjectionPolicy(request, new Set(['assets.example.com'])),
    ).not.toThrow()
  })
})
