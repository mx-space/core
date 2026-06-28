const QUOTE_URL = 'https://api.twelvedata.com/quote'
const SERIES_URL = 'https://api.twelvedata.com/time_series'
const CACHE_TTL_SEC = 60
const SPARK_INTERVAL = '5min'
const SPARK_BARS = 78

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default async function handler(ctx) {
  const { symbol } = ctx.query
  if (!symbol) ctx.throws(422, 'symbol is required')

  const sym = String(symbol).toUpperCase()
  const cacheKey = `stock:quote:${sym}`
  const cached = await ctx.storage.cache.get(cacheKey)
  if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached

  const config = await ctx.getService('config')
  const thirdParty = await config.get('thirdPartyServiceIntegration')
  const apiKey = String(thirdParty?.twelveData?.apiKey ?? '').trim()
  if (!apiKey) {
    ctx.throws(
      500,
      'Twelve Data API key not configured (Settings → Third-party integrations)',
    )
  }

  const safeFetch = async (url, params) => {
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`${url}?${qs}`, { headers: { Accept: 'application/json' } })
    const data = await res.json()
    if (data?.status === 'error' || (typeof data?.code === 'number' && data.code >= 400)) {
      throw new Error(`Twelve Data: ${data.message || 'unknown'}`)
    }
    return data
  }

  const quote = await safeFetch(QUOTE_URL, { symbol: sym, apikey: apiKey })

  let sparkline = []
  try {
    const series = await safeFetch(SERIES_URL, {
      symbol: sym,
      interval: SPARK_INTERVAL,
      outputsize: String(SPARK_BARS),
      apikey: apiKey,
    })
    if (Array.isArray(series?.values)) {
      sparkline = series.values
        .slice()
        .reverse()
        .map((b) => ({
          timestamp: new Date(`${b.datetime.replace(' ', 'T')}Z`).getTime(),
          close: Number(b.close),
        }))
        .filter((p) => Number.isFinite(p.close))
    }
  } catch {}

  const fiftyTwoWeek = quote.fifty_two_week
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
    fiftyTwoWeekHigh: num(fiftyTwoWeek?.high) || num(quote.high),
    fiftyTwoWeekLow: num(fiftyTwoWeek?.low) || num(quote.low),
    volume: num(quote.volume),
    sparkline,
    asOf: quote.last_quote_at || quote.timestamp || Math.floor(Date.now() / 1000),
    marketState: quote.is_market_open === true ? 'regular' : 'closed',
  }

  await ctx.storage.cache.set(cacheKey, JSON.stringify(result), CACHE_TTL_SEC)
  return result
}
