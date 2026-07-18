import { Module } from '@nestjs/common'

import { BillingWebhookEventRepository } from './billing-webhook-event.repository'
import { EntitlementService } from './entitlement.service'
import { MembershipController } from './membership.controller'
import { MembershipRepository } from './membership.repository'
import { MembershipService } from './membership.service'
import { DodoProvider } from './providers/dodo.provider'
import { PaymentProviderRegistry } from './providers/provider.registry'

@Module({
  controllers: [MembershipController],
  providers: [
    MembershipService,
    EntitlementService,
    MembershipRepository,
    BillingWebhookEventRepository,
    DodoProvider,
    PaymentProviderRegistry,
  ],
  exports: [EntitlementService],
})
export class MembershipModule {}
