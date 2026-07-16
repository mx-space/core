import {
  type ClaimCompanionPairingInput,
  COMPANION_CLIENT_VERSION_HEADER,
  type CompanionPresenceClearRequestV2,
  type CompanionPresenceRequestV2,
  type CreateCompanionPairingInput,
} from '~/dtos/companion'
import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type {
  IRequestHandler,
  RequestProxyResult,
  RequestProxyResultWithMeta,
} from '~/interfaces/request'
import type {
  CompanionCapabilities,
  CompanionDevice,
  CompanionDeviceRevocationResult,
  CompanionPairingClaimResult,
  CompanionPairingResult,
  CompanionPresenceMutationResultV2,
  CompanionPublicPresenceResultV2,
  CompanionResponseMetaV2,
} from '~/models/companion'
import { autoBind } from '~/utils/auto-bind'

import type { HTTPClient } from '../core'

declare module '@mx-space/api-client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    companion: CompanionController<ResponseWrapper>
  }
}

export class CompanionController<ResponseWrapper> implements IController {
  base = 'companion'
  name = 'companion'

  constructor(private readonly client: HTTPClient) {
    autoBind(this)
  }

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  getCapabilities(): RequestProxyResultWithMeta<
    CompanionCapabilities,
    ResponseWrapper,
    CompanionResponseMetaV2
  > {
    return this.proxy.capabilities.get<CompanionCapabilities>()
  }

  createPairing(
    input: CreateCompanionPairingInput = {},
  ): RequestProxyResult<CompanionPairingResult, ResponseWrapper> {
    return this.proxy.pairings.post<CompanionPairingResult>({ data: input })
  }

  claimPairing(
    input: ClaimCompanionPairingInput,
  ): RequestProxyResult<CompanionPairingClaimResult, ResponseWrapper> {
    return this.proxy.pairings.claim.post<CompanionPairingClaimResult>({
      data: input,
    })
  }

  getDevices(): RequestProxyResult<CompanionDevice[], ResponseWrapper> {
    return this.proxy.devices.get<CompanionDevice[]>()
  }

  revokeDevice(
    deviceId: string,
  ): RequestProxyResult<CompanionDeviceRevocationResult, ResponseWrapper> {
    return this.proxy
      .devices(deviceId)
      .delete<CompanionDeviceRevocationResult>()
  }

  replacePresence(
    request: CompanionPresenceRequestV2,
    clientVersion: string,
  ): RequestProxyResultWithMeta<
    CompanionPresenceMutationResultV2,
    ResponseWrapper,
    CompanionResponseMetaV2
  > {
    return this.proxy.presence.put<CompanionPresenceMutationResultV2>({
      data: request,
      headers: { [COMPANION_CLIENT_VERSION_HEADER]: clientVersion },
    })
  }

  clearPresence(
    request: CompanionPresenceClearRequestV2,
    clientVersion: string,
  ): RequestProxyResultWithMeta<
    CompanionPresenceMutationResultV2,
    ResponseWrapper,
    CompanionResponseMetaV2
  > {
    return this.proxy.presence.clear.post<CompanionPresenceMutationResultV2>({
      data: request,
      headers: { [COMPANION_CLIENT_VERSION_HEADER]: clientVersion },
    })
  }

  getPublicPresence(): RequestProxyResultWithMeta<
    CompanionPublicPresenceResultV2,
    ResponseWrapper,
    CompanionResponseMetaV2
  > {
    return this.proxy.presence.public.get<CompanionPublicPresenceResultV2>()
  }
}
