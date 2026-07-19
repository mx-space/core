import { defineProvider } from 'test/helper/defineProvider'

import { EntitlementService } from '~/modules/membership/entitlement.service'

export const entitlementProvider = defineProvider({
  provide: EntitlementService,
  useValue: {
    async isActiveMember() {
      return false
    },
  },
})
