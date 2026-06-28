import type { BuiltInFunctionObject } from '../../function.types'
import code from './geocode_location.runtime.mjs?raw'

export default {
  name: 'geocode_location',
  path: 'geocode_location',
  code,
  method: 'GET',
} as BuiltInFunctionObject
