import type { CreateAuth } from './auth.implement'

export type AuthInstance = Awaited<ReturnType<typeof CreateAuth>>['auth']
export type InjectAuthInstance = {
  get: () => AuthInstance
  set: (value: AuthInstance) => void
}
