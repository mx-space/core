import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'

import type { MembershipProvider } from '../membership.types'
import { DodoProvider } from './dodo.provider'
import type { PaymentProviderAdapter } from './provider.interface'

@Injectable()
export class PaymentProviderRegistry {
  private readonly registry: Partial<
    Record<MembershipProvider, PaymentProviderAdapter>
  >

  constructor(dodoProvider: DodoProvider) {
    this.registry = { dodo: dodoProvider }
  }

  get(provider?: string | null): PaymentProviderAdapter | undefined {
    if (!provider) return undefined
    return this.registry[provider as MembershipProvider]
  }

  resolve(provider?: string | null): PaymentProviderAdapter {
    const adapter = this.get(provider)
    if (!adapter) {
      throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
    }
    return adapter
  }
}
