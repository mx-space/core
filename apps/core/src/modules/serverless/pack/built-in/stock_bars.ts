import type { BuiltInFunctionObject } from '../../function.types'
import code from './stock_bars.runtime.mjs?raw'

export default {
  code,
  name: 'stock_bars',
  path: 'stock_bars',
  method: 'GET',
} as BuiltInFunctionObject
