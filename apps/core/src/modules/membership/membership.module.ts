import { Module } from '@nestjs/common'

import { BillingWebhookEventRepository } from './billing-webhook-event.repository'
import { EntitlementService } from './entitlement.service'
import { MembershipRepository } from './membership.repository'
import { MembershipService } from './membership.service'
import { DodoProvider } from './providers/dodo.provider'

@Module({
  providers: [
    MembershipService,
    EntitlementService,
    MembershipRepository,
    BillingWebhookEventRepository,
    DodoProvider,
  ],
  exports: [
    MembershipService,
    EntitlementService,
    MembershipRepository,
    DodoProvider,
  ],
})
export class MembershipModule {}
