import { defineProvider } from 'test/helper/defineProvider'

import { EntitlementService } from '~/modules/membership/entitlement.service'

const publicEntitlement = { reason: 'public' as const, locked: false }

export const entitlementProvider = defineProvider({
  provide: EntitlementService,
  useValue: {
    async isActiveMember() {
      return false
    },
    async resolvePostEntitlement() {
      return publicEntitlement
    },
    async resolvePostEntitlements(input: { posts: Array<{ id: unknown }> }) {
      return new Map(
        input.posts.map((post) => [String(post.id), publicEntitlement]),
      )
    },
    async resolveArticlePurchaseMeta() {
      return { enabled: false }
    },
  },
})
