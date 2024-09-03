import * as AuthCore from '@auth/core'
import * as AuthCoreAdapters from '@auth/core/adapters'
import * as AuthCoreErrors from '@auth/core/errors'
import * as AuthCoreGithub from '@auth/core/providers/github'
import * as AuthCoreGoogle from '@auth/core/providers/google'

export const authjs = {
  ...AuthCore,
  ...AuthCoreAdapters,

  ...AuthCoreErrors,
  providers: {
    google: AuthCoreGoogle.default,
    github: AuthCoreGithub.default,
  },
}

export type * from '@auth/core/errors'
export type * from '@auth/core/types'
export type * from '@auth/core/providers/google'
export type * from '@auth/core/providers/github'
export * from '@auth/core'

export type * from '@auth/core/adapters'

export { MongoDBAdapter } from '@auth/mongodb-adapter'
export type { BuiltInProviderType } from '@auth/core/providers/index'
