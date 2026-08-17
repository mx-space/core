import { randomUUID } from 'node:crypto'

import {
  ClaimSourceActivationSchema,
  DEFAULT_PUSH_PREFERENCES,
  isPushTimestampFresh,
  PushEventSchema,
  PushPreferencesSchema,
  RegisterInstallationSchema,
  UpdateInstallationTokenSchema,
  verifyPushRequestSignature,
} from '@mx-space/push-protocol'

import type { PushRelayConfig } from './config.js'
import {
  credentialHash,
  credentialsMatch,
  DataVault,
  randomCredential,
} from './crypto.js'
import type { PushRelayStore } from './types.js'

export class RelayHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const parseAuthorization = (value: string | undefined, scheme: string) => {
  if (!value?.startsWith(`${scheme} `)) return null
  const credential = value.slice(scheme.length + 1)
  const separator = credential.indexOf('.')
  if (separator < 1) return null
  return {
    id: credential.slice(0, separator),
    secret: credential.slice(separator + 1),
  }
}

export class PushRelayService {
  private readonly vault: DataVault

  constructor(
    private readonly store: PushRelayStore,
    private readonly config: Pick<
      PushRelayConfig,
      'publicUrl' | 'dataKey' | 'apps'
    >,
  ) {
    this.vault = new DataVault(config.dataKey)
  }

  async registerInstallation(input: unknown) {
    const parsed = RegisterInstallationSchema.parse(input)
    if (!this.config.apps.has(parsed.app_id)) {
      throw new RelayHttpError(
        422,
        'unknown_app',
        'The app is not configured by this relay',
      )
    }

    const installationId = `ins_${randomUUID()}`
    const installationSecret = randomCredential('inssec')
    await this.store.createInstallation({
      id: installationId,
      appId: parsed.app_id,
      apnsEnvironment: parsed.apns_environment,
      tokenHash: credentialHash(parsed.apns_token.toLowerCase()),
      tokenCiphertext: this.vault.encrypt(parsed.apns_token.toLowerCase()),
      secretHash: credentialHash(installationSecret),
    })
    return {
      installation_id: installationId,
      installation_secret: installationSecret,
    }
  }

  async updateInstallationToken(
    installationId: string,
    authorization: string | undefined,
    input: unknown,
  ) {
    const principal = await this.authenticateInstallation(authorization)
    if (principal.id !== installationId) {
      throw new RelayHttpError(
        403,
        'installation_mismatch',
        'Installation credential does not match the requested installation',
      )
    }
    const parsed = UpdateInstallationTokenSchema.parse(input)
    const updated = await this.store.updateInstallationToken({
      id: principal.id,
      apnsEnvironment: parsed.apns_environment,
      tokenHash: credentialHash(parsed.apns_token.toLowerCase()),
      tokenCiphertext: this.vault.encrypt(parsed.apns_token.toLowerCase()),
    })
    if (!updated)
      throw new RelayHttpError(
        404,
        'installation_not_found',
        'Installation not found',
      )
    return { updated: true }
  }

  async createActivationTicket(
    authorization: string | undefined,
    now = new Date(),
  ) {
    const installation = await this.authenticateInstallation(authorization)
    const ticket = randomCredential('act')
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)
    await this.store.createActivationTicket({
      id: `tkt_${randomUUID()}`,
      ticketHash: credentialHash(ticket),
      installationId: installation.id,
      expiresAt,
    })
    return { ticket, expires_at: expiresAt.toISOString() }
  }

  async claimSourceActivation(
    authorization: string | undefined,
    input: unknown,
    now = new Date(),
  ) {
    const parsed = ClaimSourceActivationSchema.parse(input)
    const existingSource = authorization
      ? await this.authenticateSource(authorization)
      : null

    const ticket = await this.store.claimActivationTicket(
      credentialHash(parsed.ticket),
      now,
    )
    if (!ticket) {
      throw new RelayHttpError(
        410,
        'activation_ticket_invalid',
        'Activation ticket is expired or already claimed',
      )
    }

    let sourceId = existingSource?.id
    let sourceSecret: string | undefined
    if (!sourceId) {
      sourceId = `src_${randomUUID()}`
      sourceSecret = randomCredential('srcsec')
      await this.store.createSource({
        id: sourceId,
        origin: parsed.source_origin,
        label: parsed.source_label ?? null,
        secretCiphertext: this.vault.encrypt(sourceSecret),
      })
    } else if (
      existingSource &&
      existingSource.origin !== parsed.source_origin
    ) {
      throw new RelayHttpError(
        409,
        'source_origin_mismatch',
        'Existing source origin does not match',
      )
    }

    const bindingId = await this.store.createBinding({
      id: `bnd_${randomUUID()}`,
      sourceId,
      installationId: ticket.installationId,
      readerId: parsed.reader_id ?? null,
      preferences: parsed.preferences ?? { ...DEFAULT_PUSH_PREFERENCES },
    })
    return {
      source_id: sourceId,
      ...(sourceSecret ? { source_secret: sourceSecret } : {}),
      binding_id: bindingId,
      installation_id: ticket.installationId,
      event_endpoint: `${this.config.publicUrl}/v1/webhooks/mx-core`,
    }
  }

  async acceptEvent(input: {
    rawBody: Buffer
    sourceId: string | undefined
    deliveryId: string | undefined
    timestamp: string | undefined
    signature: string | undefined
    now?: Date
  }) {
    if (
      !input.sourceId ||
      !input.deliveryId ||
      !input.timestamp ||
      !input.signature
    ) {
      throw new RelayHttpError(
        400,
        'signature_headers_missing',
        'Push signature headers are required',
      )
    }
    const now = input.now ?? new Date()
    if (!isPushTimestampFresh(input.timestamp, now.getTime())) {
      throw new RelayHttpError(
        401,
        'stale_request',
        'Push request timestamp is outside the replay window',
      )
    }
    const source = await this.store.findSource(input.sourceId)
    if (!source || source.revokedAt) {
      throw new RelayHttpError(
        401,
        'source_invalid',
        'Push source is unknown or revoked',
      )
    }
    const secret = this.vault.decrypt(source.secretCiphertext)
    if (
      !verifyPushRequestSignature({
        secret,
        timestamp: input.timestamp,
        deliveryId: input.deliveryId,
        rawBody: input.rawBody,
        signature: input.signature,
      })
    ) {
      throw new RelayHttpError(
        401,
        'signature_invalid',
        'Push request signature is invalid',
      )
    }

    let wire: unknown
    try {
      wire = JSON.parse(input.rawBody.toString('utf8'))
    } catch {
      throw new RelayHttpError(400, 'invalid_json', 'Request body must be JSON')
    }
    const event = PushEventSchema.parse(wire)
    if (event.source !== `urn:mx-core:instance:${source.id}`) {
      throw new RelayHttpError(
        422,
        'event_source_mismatch',
        'CloudEvent source does not match its credential',
      )
    }

    const result = await this.store.acceptEvent({
      id: event.id,
      sourceId: source.id,
      deliveryId: input.deliveryId,
      event,
      now,
    })
    return {
      accepted: true as const,
      event_id: event.id,
      deliveries: result.deliveries,
    }
  }

  async revokeBinding(
    authorization: string | undefined,
    bindingId: string,
    now = new Date(),
  ) {
    const source = await this.authenticateSource(authorization)
    const revoked = await this.store.revokeBinding(source.id, bindingId, now)
    if (!revoked) {
      throw new RelayHttpError(404, 'binding_not_found', 'Binding not found')
    }
    return { revoked: true }
  }

  async updateBindingPreferences(
    authorization: string | undefined,
    bindingId: string,
    input: unknown,
  ) {
    const source = await this.authenticateSource(authorization)
    const preferences = PushPreferencesSchema.parse(input)
    const updated = await this.store.updateBindingPreferences({
      sourceId: source.id,
      bindingId,
      preferences,
    })
    if (!updated) {
      throw new RelayHttpError(404, 'binding_not_found', 'Binding not found')
    }
    return {
      updated: true as const,
      binding_id: bindingId,
      preferences,
    }
  }

  private async authenticateInstallation(authorization: string | undefined) {
    const credential = parseAuthorization(authorization, 'Installation')
    if (!credential) {
      throw new RelayHttpError(
        401,
        'installation_unauthorized',
        'Installation authorization is required',
      )
    }
    const installation = await this.store.findInstallation(credential.id)
    if (
      !installation ||
      installation.revokedAt ||
      !credentialsMatch(credential.secret, installation.secretHash)
    ) {
      throw new RelayHttpError(
        401,
        'installation_unauthorized',
        'Installation credential is invalid',
      )
    }
    return installation
  }

  private async authenticateSource(authorization: string | undefined) {
    const credential = parseAuthorization(authorization, 'Source')
    if (!credential) {
      throw new RelayHttpError(
        401,
        'source_unauthorized',
        'Source authorization is invalid',
      )
    }
    const source = await this.store.findSource(credential.id)
    if (!source || source.revokedAt) {
      throw new RelayHttpError(
        401,
        'source_unauthorized',
        'Source authorization is invalid',
      )
    }
    const expected = this.vault.decrypt(source.secretCiphertext)
    if (!credentialsMatch(credential.secret, credentialHash(expected))) {
      throw new RelayHttpError(
        401,
        'source_unauthorized',
        'Source authorization is invalid',
      )
    }
    return source
  }
}
