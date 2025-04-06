import { createClient } from './core'

export * from './controllers'
export * from './models'
export * from './dtos'

export { createClient, RequestError } from './core'
export type { HTTPClient } from './core'
export { camelcaseKeys as simpleCamelcaseKeys } from './utils/camelcase-keys'

export default createClient
export type { IRequestAdapter } from './interfaces/adapter'
