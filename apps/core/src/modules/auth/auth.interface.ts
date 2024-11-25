import type { AdapterSession, AdapterUser } from '@mx-space/complied/auth'
import type { CreateAuth } from './auth.implement'

export type SessionUser = AdapterSession & {
  user: AdapterUser
  provider: string
  providerAccountId: string
}

declare module '@mx-space/complied/auth' {
  export interface AdapterUser {
    isOwner: boolean
  }
}

export type AuthInstance = ReturnType<typeof CreateAuth>['auth']
export type InjectAuthInstance = {
  get: () => AuthInstance
  set: (value: AuthInstance) => void
}
