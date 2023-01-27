import { createClient } from './core'

export * from './controllers'
export * from './models'
export * from './dtos'

export { createClient, RequestError } from './core'
export type { HTTPClient } from './core'
export { camelcaseKeys as simpleCamelcaseKeys } from './utils/camelcase-keys'

// eslint-disable-next-line import/no-default-export
export default createClient
