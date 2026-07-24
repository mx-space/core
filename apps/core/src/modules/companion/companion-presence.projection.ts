import { createHash } from 'node:crypto'

import type {
  CompanionPresenceRequestV2,
  PublicLiveDeskProjectionV2,
  PublicMediaPresenceV2,
} from './companion.types'

const MAX_POSITION_ADVANCE_MS = 5_000
const MAX_CLOCK_SKEW_MS = 30_000

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value === null || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  )
}

export const canonicalJSONStringify = (value: unknown) =>
  JSON.stringify(canonicalize(value))

export const fingerprintCompanionMutation = (
  kind: 'snapshot' | 'clear',
  request: unknown,
) =>
  createHash('sha256')
    .update(canonicalJSONStringify({ kind, request }))
    .digest('hex')

const normalizeMedia = (
  media: NonNullable<CompanionPresenceRequestV2['data']['media']>,
  receivedAt: Date,
): PublicMediaPresenceV2 => {
  const { playback } = media
  let positionMs = playback.positionMs

  if (positionMs !== null) {
    const networkDeltaMs = receivedAt.getTime() - Date.parse(playback.sampledAt)
    if (
      playback.state === 'playing' &&
      Math.abs(networkDeltaMs) <= MAX_CLOCK_SKEW_MS
    ) {
      positionMs +=
        Math.min(MAX_POSITION_ADVANCE_MS, Math.max(0, networkDeltaMs)) *
        playback.rate
    }

    positionMs = Math.max(0, positionMs)
    if (playback.durationMs !== null) {
      positionMs = Math.min(positionMs, playback.durationMs)
    }
    positionMs = Math.round(positionMs)
  }

  return {
    sessionId: media.sessionId,
    kind: media.kind,
    title: media.title,
    artist: media.artist,
    album: media.album,
    artwork: media.artwork,
    link: media.link,
    player: media.player,
    playback: {
      state: playback.state,
      durationMs: playback.durationMs,
      positionMs,
      anchorAt: receivedAt.toISOString(),
      rate: playback.rate,
    },
  }
}

export const createPublicLiveDeskProjection = (
  request: CompanionPresenceRequestV2,
  receivedAt: Date,
): PublicLiveDeskProjectionV2 => {
  return {
    availability: request.data.availability,
    updatedAt: receivedAt.toISOString(),
    expiresAt: new Date(
      receivedAt.getTime() + request.data.lease.ttlSeconds * 1_000,
    ).toISOString(),
    application: request.data.application,
    media:
      request.data.media === null
        ? null
        : normalizeMedia(request.data.media, receivedAt),
  }
}
