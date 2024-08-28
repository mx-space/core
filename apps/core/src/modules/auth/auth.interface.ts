import type { AdapterSession, AdapterUser } from '@mx-space/complied/auth'

export type SessionUser = AdapterSession & { user: AdapterUser }

declare module '@mx-space/complied/auth' {
  export interface AdapterUser {
    isOwner: boolean
  }
}
