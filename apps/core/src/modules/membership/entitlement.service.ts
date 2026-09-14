import { Injectable } from '@nestjs/common'
import type { z } from 'zod'

import type { PostEntitlementReasonSchema } from '~/common/response/meta.types'
import {
  isInFreeWindow,
  readPaywallMeta,
} from '~/modules/post/post-paywall.util'

import { ConfigsService } from '../configs/configs.service'
import { ArticlePurchaseRepository } from './article-purchase.repository'
import { MembershipRepository } from './membership.repository'
import {
  type MembershipAvailability,
  resolveAppleIapAvailability,
  resolveArticlePurchaseAvailability,
  resolveMembershipAvailability,
} from './membership.types'
import { PaymentProviderRegistry } from './providers/provider.registry'

export type PostEntitlementReason = z.infer<typeof PostEntitlementReasonSchema>

export type PostEntitlement = {
  reason: PostEntitlementReason
  locked: boolean
}

export type EntitledPost = {
  id: string
  isPremium?: boolean | null
  isPublished?: boolean | null
  meta?: unknown
}

type PostEntitlementInput = {
  post: EntitledPost
  isOwner: boolean
  readerId?: string
}

const entitlement = (reason: PostEntitlementReason): PostEntitlement => ({
  reason,
  locked: reason === 'locked',
})

@Injectable()
export class EntitlementService {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly configsService: ConfigsService,
    private readonly articlePurchaseRepository: ArticlePurchaseRepository,
    private readonly providers: PaymentProviderRegistry,
  ) {}

  async isActiveMember(readerId: string): Promise<boolean> {
    const membership = await this.membershipRepository.findByReaderId(readerId)
    if (!membership) return false
    if (membership.status !== 'active' && membership.status !== 'on_hold')
      return false
    return membership.currentPeriodEnd.getTime() > Date.now()
  }

  async getActiveMemberIds(readerIds: string[]): Promise<Set<string>> {
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

  async resolvePostEntitlement(
    input: PostEntitlementInput,
  ): Promise<PostEntitlement> {
    const result = await this.resolvePostEntitlements({
      posts: [input.post],
      isOwner: input.isOwner,
      readerId: input.readerId,
    })
    return result.get(String(input.post.id)) ?? entitlement('locked')
  }

  async resolvePostEntitlements(input: {
    posts: EntitledPost[]
    isOwner: boolean
    readerId?: string
  }): Promise<Map<string, PostEntitlement>> {
    const result = new Map<string, PostEntitlement>()
    const pendingIds: string[] = []
    const now = new Date()
    for (const post of input.posts) {
      const id = String(post.id)
      if (!post.isPremium) result.set(id, entitlement('public'))
      else if (input.isOwner) result.set(id, entitlement('owner'))
      else if (post.isPublished && isInFreeWindow(post.meta, now))
        result.set(id, entitlement('free-window'))
      else pendingIds.push(id)
    }
    if (pendingIds.length === 0) return result

    const config = await this.configsService.get('membership')
    const purchasable =
      resolveMembershipAvailability(config).enabled ||
      resolveAppleIapAvailability(config).enabled ||
      resolveArticlePurchaseAvailability(config).enabled
    if (!purchasable) {
      for (const id of pendingIds) result.set(id, entitlement('public'))
      return result
    }

    const { readerId } = input
    const [paidIds, isMember] = readerId
      ? await Promise.all([
          this.articlePurchaseRepository.findPaidPostIds(readerId, pendingIds),
          this.isActiveMember(readerId),
        ])
      : [new Set<string>(), false]
    for (const id of pendingIds) {
      result.set(
        id,
        entitlement(
          paidIds.has(id) ? 'purchase' : isMember ? 'membership' : 'locked',
        ),
      )
    }
    return result
  }

  async isEntitledToPremium(input: PostEntitlementInput): Promise<boolean> {
    return !(await this.resolvePostEntitlement(input)).locked
  }

  async isPremiumLocked(input: PostEntitlementInput): Promise<boolean> {
    return (await this.resolvePostEntitlement(input)).locked
  }

  async getAvailability(): Promise<MembershipAvailability> {
    const config = await this.configsService.get('membership')
    return resolveMembershipAvailability(config)
  }

  async isMembershipPurchasable(): Promise<boolean> {
    const config = await this.configsService.get('membership')
    return (
      resolveMembershipAvailability(config).enabled ||
      resolveAppleIapAvailability(config).enabled
    )
  }

  async isArticlePurchaseAvailable(): Promise<boolean> {
    const config = await this.configsService.get('membership')
    return resolveArticlePurchaseAvailability(config).enabled
  }

  async resolveArticlePurchaseMeta(meta: unknown): Promise<{
    enabled: boolean
    price?: { amount: number; currency: string }
  }> {
    const config = await this.configsService.get('membership')
    const available = resolveArticlePurchaseAvailability(config).enabled
    const enabled = available && readPaywallMeta(meta).purchaseEnabled !== false
    if (!enabled) return { enabled: false }

    const adapter = this.providers.get(config.provider)
    const pricing =
      adapter?.getProductPricing && config.articleProductId
        ? await adapter
            .getProductPricing(config.articleProductId)
            .catch(() => null)
        : null
    return pricing ? { enabled: true, price: pricing } : { enabled: true }
  }
}
