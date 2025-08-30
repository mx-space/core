import { UserService } from '~/modules/user/user.service'
import { defineProvider } from 'test/helper/defineProvider'

export const userProvider = defineProvider({
  provide: UserService,
  useValue: {},
})
