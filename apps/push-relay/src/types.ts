import type { PushEvent } from '@mx-space/push-protocol'

export type ApnsEnvironment = 'development' | 'production'

export type InstallationRecord = {
  id: string
  appId: string
  apnsEnvironment: ApnsEnvironment
  tokenCiphertext: string
  secretHash: string
  revokedAt: Date | null
}

export type ActivationTicketRecord = {
  installationId: string
  expiresAt: Date
  claimedAt: Date | null
}

export type SourceRecord = {
  id: string
  secretCiphertext: string
  origin: string
  revokedAt: Date | null
}

export type DeliveryRecord = {
  id: string
  eventId: string
  installationId: string
  appId: string
  apnsEnvironment: ApnsEnvironment
  tokenCiphertext: string
  event: PushEvent
  attempt: number
}

export interface PushRelayStore {
  createInstallation: (input: {
    id: string
    appId: string
    apnsEnvironment: ApnsEnvironment
    tokenHash: string
    tokenCiphertext: string
    secretHash: string
  }) => Promise<void>
  findInstallation: (id: string) => Promise<InstallationRecord | null>
  updateInstallationToken: (input: {
    id: string
    apnsEnvironment: ApnsEnvironment
    tokenHash: string
    tokenCiphertext: string
  }) => Promise<boolean>
  createActivationTicket: (input: {
    id: string
    ticketHash: string
    installationId: string
    expiresAt: Date
  }) => Promise<void>
  claimActivationTicket: (
    ticketHash: string,
    now: Date,
  ) => Promise<ActivationTicketRecord | null>
  createSource: (input: {
    id: string
    origin: string
    label: string | null
    secretCiphertext: string
  }) => Promise<void>
  findSource: (id: string) => Promise<SourceRecord | null>
  createBinding: (input: {
    id: string
    sourceId: string
    installationId: string
  }) => Promise<string>
  revokeBinding: (
    sourceId: string,
    bindingId: string,
    now: Date,
  ) => Promise<boolean>
  acceptEvent: (input: {
    id: string
    sourceId: string
    deliveryId: string
    event: PushEvent
    now: Date
  }) => Promise<{ accepted: boolean; deliveries: number }>
  claimDeliveries: (limit: number, now: Date) => Promise<DeliveryRecord[]>
  completeDelivery: (
    id: string,
    apnsId: string | null,
    now: Date,
  ) => Promise<void>
  retryDelivery: (
    id: string,
    error: string,
    nextAttemptAt: Date,
    now: Date,
  ) => Promise<void>
  failDelivery: (id: string, error: string, now: Date) => Promise<void>
  revokeInstallation: (id: string, now: Date) => Promise<void>
}

export type ApnsResult = {
  status: number
  apnsId: string | null
  reason: string | null
}

export interface ApnsProvider {
  send: (input: {
    appId: string
    environment: ApnsEnvironment
    deviceToken: string
    event: PushEvent
  }) => Promise<ApnsResult>
}
