import type { BuiltInFunctionObject } from '../../function.types'

export const code = `
export default async function handler(ctx: Context) {
  const { symbol } = ctx.query
  if (!symbol) ctx.throws(422, 'symbol is required')

  const sym = String(symbol).toUpperCase()
  const cacheKey = \`stock:quote:\${sym}\`
  const cached = await ctx.storage.cache.get(cacheKey)
  if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached

  const config = await ctx.getService('config')
  const thirdParty = await config.get('thirdPartyServiceIntegration')
  const apiKey = thirdParty && thirdParty.twelveData && thirdParty.twelveData.apiKey
  if (!apiKey) ctx.throws(500, 'Twelve Data API key not configured (Settings → Third-party integrations)')

  const { axios } = await ctx.getService('http')

  const safeFetch = async (url) => {
    const res = await axios.get(url, { headers: { Accept: 'application/json' } })
    const j = res.data
    if (j && (j.status === 'error' || (typeof j.code === 'number' && j.code >= 400))) {
      throw new Error(\`Twelve Data: \${j.message || 'unknown'}\`)
    }
    return j
  }

  const encodedSym = encodeURIComponent(sym)
  const quote = await safeFetch(
    \`https://api.twelvedata.com/quote?symbol=\${encodedSym}&apikey=\${apiKey}\`,
  )

  let sparkline = []
  try {
    const series = await safeFetch(
      \`https://api.twelvedata.com/time_series?symbol=\${encodedSym}&interval=5min&outputsize=78&apikey=\${apiKey}\`,
    )
    if (series && Array.isArray(series.values)) {
      sparkline = series.values
        .slice()
        .reverse()
        .map((b) => ({
          timestamp: new Date(b.datetime.replace(' ', 'T') + 'Z').getTime(),
          close: Number(b.close),
        }))
        .filter((p) => Number.isFinite(p.close))
    }
  } catch (_) {}

  const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const asOf = quote.last_quote_at || quote.timestamp || Math.floor(Date.now() / 1000)
  const isOpen = quote.is_market_open === true

  const result = {
    symbol: quote.symbol || sym,
    exchange: quote.exchange,
    longName: quote.name,
    shortName: quote.name,
    currency: quote.currency || 'USD',
    price: num(quote.close),
    previousClose: num(quote.previous_close),
    dayHigh: num(quote.high),
    dayLow: num(quote.low),
    fiftyTwoWeekHigh: num(quote.fifty_two_week && quote.fifty_two_week.high) || num(quote.high),
    fiftyTwoWeekLow: num(quote.fifty_two_week && quote.fifty_two_week.low) || num(quote.low),
    volume: num(quote.volume),
    sparkline,
    asOf,
    marketState: isOpen ? 'regular' : 'closed',
  }

  await ctx.storage.cache.set(cacheKey, JSON.stringify(result), 60)
  return result
}
`.trim()

export default {
  code,
  name: 'stock_quote',
  path: 'stock_quote',
  method: 'GET',
} as BuiltInFunctionObject
