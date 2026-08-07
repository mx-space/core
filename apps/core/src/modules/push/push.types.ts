import type { PushEvent } from '@mx-space/push-protocol'

export type PushRelaySourceRow = {
  id: string
  relayUrl: string
  remoteSourceId: string
  sourceSecret: string
  eventEndpoint: string
  enabled: boolean
}

export type PushRelayBindingRow = {
  id: string
  sourceId: string
  remoteBindingId: string
  installationId: string
  ownerId: string
  relayUrl: string
  revokedAt: Date | null
}

export type PushRelayDeliveryRow = {
  id: string
  source: PushRelaySourceRow
  event: PushEvent
  attempt: number
}
