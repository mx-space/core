import geocode_location from './geocode_location'
import geocode_search from './geocode_search'
import ipQuery from './ip-query'

export const builtInSnippets = [ipQuery, geocode_location, geocode_search].map(
  ($) => (($.reference = 'built-in'), $),
)
