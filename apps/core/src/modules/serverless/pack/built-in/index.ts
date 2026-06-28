import geocode_location from './geocode_location'
import geocode_search from './geocode_search'
import ipQuery from './ip-query'
import stock_bars from './stock_bars'
import stock_quote from './stock_quote'

export const builtInSnippets = [
  ipQuery,
  geocode_location,
  geocode_search,
  stock_quote,
  stock_bars,
].map(($) => (($.reference = 'built-in'), $))
