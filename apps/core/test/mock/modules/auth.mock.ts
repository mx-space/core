import { defineProvider } from 'test/helper/defineProvider'

import { AuthService } from '~/modules/auth/auth.service'

export const authProvider = defineProvider({
  useValue: {},
  provide: AuthService,
})
