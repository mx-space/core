import { BusinessEvents } from '../../src/event.enum'
import type { PublicLiveDeskStateV2 } from '../../src/models.generated'
import type { EventPayloadMapping, GenericEvent } from '../../src/types'

type IsExact<TLeft, TRight> = [TLeft] extends [TRight]
  ? [TRight] extends [TLeft]
    ? true
    : false
  : false

type Assert<TValue extends true> = TValue

type ChangedPayload =
  EventPayloadMapping[BusinessEvents.COMPANION_PRESENCE_CHANGED]

export type CompanionChangedPayloadContract = Assert<
  IsExact<ChangedPayload, PublicLiveDeskStateV2>
>

export const snapshotState = {
  schemaVersion: 2,
  epoch: 'epoch-1',
  revision: 8,
  projection: {
    availability: 'active',
    updatedAt: '2026-07-16T12:00:00.000Z',
    expiresAt: '2026-07-16T12:01:30.000Z',
    application: {
      displayName: 'Xcode',
      activity: { key: 'editing', customLabel: null },
      window: null,
      icon: null,
    },
    media: null,
  },
} satisfies PublicLiveDeskStateV2

export const clearedState = {
  schemaVersion: 2,
  epoch: 'epoch-1',
  revision: 9,
  projection: null,
} satisfies PublicLiveDeskStateV2

type CompanionChangedEvent = Extract<
  GenericEvent,
  { type: BusinessEvents.COMPANION_PRESENCE_CHANGED }
>

export const snapshotEvent: CompanionChangedEvent = {
  type: BusinessEvents.COMPANION_PRESENCE_CHANGED,
  payload: snapshotState,
}

export const clearedEvent: CompanionChangedEvent = {
  type: BusinessEvents.COMPANION_PRESENCE_CHANGED,
  payload: clearedState,
}
