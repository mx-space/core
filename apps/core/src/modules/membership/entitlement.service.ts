import { Injectable } from '@nestjs/common'

import type { EntityId } from '~/shared/id/entity-id'

import { ConfigsService } from '../configs/configs.service'
import { MembershipRepository } from './membership.repository'
import {
  type MembershipAvailability,
  resolveMembershipAvailability,
} from './membership.types'

@Injectable()
export class EntitlementService {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly configsService: ConfigsService,
  ) {}

  async isActiveMember(readerId: EntityId | string): Promise<boolean> {
    const membership = await this.membershipRepository.findByReaderId(readerId)
    if (!membership) return false
    if (membership.status !== 'active' && membership.status !== 'on_hold')
      return false
    return membership.currentPeriodEnd.getTime() > Date.now()
  }

  async getActiveMemberIds(
    readerIds: (EntityId | string)[],
  ): Promise<Set<string>> {
    const unique = [...new Set(readerIds.map(String))]
    if (unique.length === 0) return new Set()
    const rows = await this.membershipRepository.findByReaderIds(unique)
    const now = Date.now()
    const active = new Set<string>()
    for (const row of rows) {
      const entitled =
        (row.status === 'active' || row.status === 'on_hold') &&
        row.currentPeriodEnd.getTime() > now
      if (entitled) active.add(String(row.readerId))
    }
    return active
  }

  async getAvailability(): Promise<MembershipAvailability> {
    const config = await this.configsService.get('membership')
    return resolveMembershipAvailability(config)
  }

  async isMembershipPurchasable(): Promise<boolean> {
    return (await this.getAvailability()).enabled
  }
}
