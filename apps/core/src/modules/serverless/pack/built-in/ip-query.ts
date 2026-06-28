import type { BuiltInFunctionObject } from '../../function.types'
import code from './ip-query.runtime.mjs?raw'

export default {
  code,
  path: 'ip',
  name: 'ip-query',
  method: 'GET',
} as BuiltInFunctionObject
