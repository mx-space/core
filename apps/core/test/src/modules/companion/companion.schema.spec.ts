import {
  CompanionPresenceClearRequestV2Schema,
  CompanionPresenceRequestV2Schema,
  PublicLiveDeskStateV2Schema,
} from '~/modules/companion/companion.schema'

const makeMeta = () => ({
  schema: 'yohaku.companion.presence',
  schemaVersion: 2,
  requestId: '01K0A5Q2R7Y5VXG4H7Q0F4M9J2',
  deviceId: '01K0A4VDWYSH1JQH4PGY4QM8YT',
  sequence: 124,
  observedAt: '2026-07-16T12:00:00.000Z',
})

const makeApplication = () => ({
  displayName: 'Xcode',
  activity: { key: 'editing', customLabel: null },
  window: null,
  icon: { url: 'https://assets.example.com/apps/xcode.png' },
})

const makeMedia = () => ({
  sessionId: '01K0A5PXA7KPKN6VBYF6M52M2R',
  kind: 'music',
  title: 'Track title',
  artist: 'Artist',
  album: null,
  player: { displayName: 'Music' },
  playback: {
    state: 'playing',
    durationMs: 100_000,
    positionMs: 101_500,
    sampledAt: '2026-07-16T11:59:59.600Z',
    rate: 1,
  },
})

const makeSnapshot = () => ({
  meta: makeMeta(),
  data: {
    availability: 'active',
    lease: { ttlSeconds: 10 },
    application: makeApplication(),
    media: makeMedia(),
  },
})

describe('CompanionPresenceRequestV2Schema', () => {
  it('normalizes accepted lease and playback tolerance into canonical domain values', () => {
    const parsed = CompanionPresenceRequestV2Schema.parse(makeSnapshot())

    expect(parsed.data.lease.ttlSeconds).toBe(30)
    expect(parsed.data.media?.playback.positionMs).toBe(100_000)
  })

  it('requires explicit nullable contexts and rejects undeclared fields', () => {
    const missingContext = structuredClone(makeSnapshot()) as any
    delete missingContext.data.media

    const legacyField = structuredClone(makeSnapshot()) as any
    legacyField.data.application.description = 'Working'

    expect(
      CompanionPresenceRequestV2Schema.safeParse(missingContext).success,
    ).toBe(false)
    expect(
      CompanionPresenceRequestV2Schema.safeParse(legacyField).success,
    ).toBe(false)
  })

  it('enforces availability as a complete snapshot invariant', () => {
    const activeWithoutContext = structuredClone(makeSnapshot())
    activeWithoutContext.data.application = null as any
    activeWithoutContext.data.media = null as any

    const idleWithContext = structuredClone(makeSnapshot())
    idleWithContext.data.availability = 'idle'

    const validIdle = structuredClone(idleWithContext)
    validIdle.data.application = null as any
    validIdle.data.media = null as any

    expect(
      CompanionPresenceRequestV2Schema.safeParse(activeWithoutContext).success,
    ).toBe(false)
    expect(
      CompanionPresenceRequestV2Schema.safeParse(idleWithContext).success,
    ).toBe(false)
    expect(CompanionPresenceRequestV2Schema.safeParse(validIdle).success).toBe(
      true,
    )
  })

  it('rejects contradictory playback and media without a display identity', () => {
    const pausedAtPositiveRate = structuredClone(makeSnapshot())
    pausedAtPositiveRate.data.media.playback.state = 'paused'

    const positionOutsideTolerance = structuredClone(makeSnapshot())
    positionOutsideTolerance.data.media.playback.positionMs = 102_001

    const mediaWithoutIdentity = structuredClone(makeSnapshot())
    mediaWithoutIdentity.data.media.title = null as any
    mediaWithoutIdentity.data.media.artist = null as any

    expect(
      CompanionPresenceRequestV2Schema.safeParse(pausedAtPositiveRate).success,
    ).toBe(false)
    expect(
      CompanionPresenceRequestV2Schema.safeParse(positionOutsideTolerance)
        .success,
    ).toBe(false)
    expect(
      CompanionPresenceRequestV2Schema.safeParse(mediaWithoutIdentity).success,
    ).toBe(false)
  })

  it('rejects non-HTTPS or credential-bearing icons and non-canonical text', () => {
    const insecureIcon = structuredClone(makeSnapshot())
    insecureIcon.data.application.icon.url = 'http://assets.example.com/x.png'

    const credentialBearingIcon = structuredClone(makeSnapshot())
    credentialBearingIcon.data.application.icon.url =
      'https://user:secret@assets.example.com/x.png'

    const untrimmedIcon = structuredClone(makeSnapshot())
    untrimmedIcon.data.application.icon.url =
      ' https://assets.example.com/x.png '

    const untrimmedName = structuredClone(makeSnapshot())
    untrimmedName.data.application.displayName = ' Xcode '

    expect(
      CompanionPresenceRequestV2Schema.safeParse(insecureIcon).success,
    ).toBe(false)
    expect(
      CompanionPresenceRequestV2Schema.safeParse(credentialBearingIcon).success,
    ).toBe(false)
    expect(
      CompanionPresenceRequestV2Schema.safeParse(untrimmedIcon).success,
    ).toBe(false)
    expect(
      CompanionPresenceRequestV2Schema.safeParse(untrimmedName).success,
    ).toBe(false)
  })

  it('measures display-name limits by Unicode scalar and requires millisecond UTC timestamps', () => {
    const scalarBoundary = structuredClone(makeSnapshot())
    scalarBoundary.data.application.displayName = '😀'.repeat(120)

    const overScalarBoundary = structuredClone(scalarBoundary)
    overScalarBoundary.data.application.displayName += '😀'

    const timestampWithoutMilliseconds = structuredClone(makeSnapshot())
    timestampWithoutMilliseconds.meta.observedAt = '2026-07-16T12:00:00Z'

    expect(
      CompanionPresenceRequestV2Schema.safeParse(scalarBoundary).success,
    ).toBe(true)
    expect(
      CompanionPresenceRequestV2Schema.safeParse(overScalarBoundary).success,
    ).toBe(false)
    expect(
      CompanionPresenceRequestV2Schema.safeParse(timestampWithoutMilliseconds)
        .success,
    ).toBe(false)
  })
})

describe('CompanionPresenceClearRequestV2Schema', () => {
  it('accepts an ordered diagnostic clear and rejects unknown reasons', () => {
    const clear = {
      meta: { ...makeMeta(), sequence: 125 },
      data: { reason: 'privacyChanged' },
    }

    expect(CompanionPresenceClearRequestV2Schema.safeParse(clear).success).toBe(
      true,
    )
    expect(
      CompanionPresenceClearRequestV2Schema.safeParse({
        ...clear,
        data: { reason: 'networkLost' },
      }).success,
    ).toBe(false)
  })

  it('rejects sequences outside the JavaScript safe integer boundary', () => {
    const clear = {
      meta: { ...makeMeta(), sequence: Number.MAX_SAFE_INTEGER + 1 },
      data: { reason: 'shutdown' },
    }

    expect(CompanionPresenceClearRequestV2Schema.safeParse(clear).success).toBe(
      false,
    )
  })
})

describe('PublicLiveDeskStateV2Schema', () => {
  const makePublicState = () => ({
    schemaVersion: 2,
    epoch: '01K0A5P1KD0QAFMZKVFNFC7AFN',
    revision: 8451,
    projection: {
      availability: 'active',
      updatedAt: '2026-07-16T12:00:00.180Z',
      expiresAt: '2026-07-16T12:01:30.180Z',
      application: makeApplication(),
      media: null,
    },
  })

  it('accepts a canonical complete public projection or a null projection', () => {
    expect(
      PublicLiveDeskStateV2Schema.safeParse(makePublicState()).success,
    ).toBe(true)
    expect(
      PublicLiveDeskStateV2Schema.safeParse({
        ...makePublicState(),
        projection: null,
      }).success,
    ).toBe(true)
  })

  it('rejects expired chronology and private device fields', () => {
    const invalidChronology = makePublicState()
    invalidChronology.projection.expiresAt =
      invalidChronology.projection.updatedAt

    const privateField = structuredClone(makePublicState()) as any
    privateField.projection.deviceId = makeMeta().deviceId

    expect(
      PublicLiveDeskStateV2Schema.safeParse(invalidChronology).success,
    ).toBe(false)
    expect(PublicLiveDeskStateV2Schema.safeParse(privateField).success).toBe(
      false,
    )
  })
})
