import { Injectable } from '@nestjs/common'

import type { EntityId } from '~/shared/id/entity-id'

import { MembershipRepository } from './membership.repository'

@Injectable()
export class EntitlementService {
  constructor(private readonly membershipRepository: MembershipRepository) {}

  async isActiveMember(readerId: EntityId | string): Promise<boolean> {
    const membership = await this.membershipRepository.findByReaderId(readerId)
    if (!membership) return false
    if (membership.status !== 'active' && membership.status !== 'on_hold')
      return false
    return membership.currentPeriodEnd.getTime() > Date.now()
  }
}
