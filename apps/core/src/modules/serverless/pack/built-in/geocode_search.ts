import type { BuiltInFunctionObject } from '../../function.types'
import code from './geocode_search.runtime.mjs?raw'

export default {
  code,
  name: 'geocode_search',
  path: 'geocode_search',
  method: 'GET',
} as BuiltInFunctionObject
