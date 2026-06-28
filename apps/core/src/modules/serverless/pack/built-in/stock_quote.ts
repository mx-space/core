import type { BuiltInFunctionObject } from '../../function.types'
import code from './stock_quote.runtime.mjs?raw'

export default {
  code,
  name: 'stock_quote',
  path: 'stock_quote',
  method: 'GET',
} as BuiltInFunctionObject
