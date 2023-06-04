import { defineProvider } from 'test/helper/defineProvider'

import { UserService } from '~/modules/user/user.service'

export const userProvider = defineProvider({
  provide: UserService,
  useValue: {},
})
