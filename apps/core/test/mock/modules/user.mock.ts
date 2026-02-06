import { OwnerService } from '~/modules/owner/owner.service'
import { defineProvider } from 'test/helper/defineProvider'

export const userProvider = defineProvider({
  provide: OwnerService,
  useValue: {},
})

export const ownerProvider = userProvider
