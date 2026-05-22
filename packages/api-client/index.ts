import { createClient } from './core'

export * from './controllers'
export type { HTTPClient } from './core'
export { createClient, RequestError } from './core'
export { metaFor } from './core/meta-for'
export * from './dtos'
export * from './models'
export { camelcaseKeys as simpleCamelcaseKeys } from './utils/camelcase-keys'

export default createClient
export type { IRequestAdapter } from './interfaces/adapter'
