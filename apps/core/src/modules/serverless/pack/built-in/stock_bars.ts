import type { BuiltInFunctionObject } from '../../function.types'

export const code = `
export default async function handler(ctx: Context) {
  const { symbol, interval, from, to } = ctx.query
  if (!symbol) ctx.throws(422, 'symbol is required')
  const allowed = ['5m', '15m', '1h', '1d']
  if (!allowed.includes(interval)) ctx.throws(422, 'invalid interval')

  const tdMap = { '5m': '5min', '15m': '15min', '1h': '1h', '1d': '1day' }
  const sym = String(symbol).toUpperCase()
  const tdInterval = tdMap[interval]

  const cacheKey = \`stock:bars:\${sym}:\${interval}:\${from || ''}:\${to || ''}\`
  const cached = await ctx.storage.cache.get(cacheKey)
  if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached

  const config = await ctx.getService('config')
  const thirdParty = await config.get('thirdPartyServiceIntegration')
  const apiKey = thirdParty && thirdParty.twelveData && thirdParty.twelveData.apiKey
  if (!apiKey) ctx.throws(500, 'Twelve Data API key not configured (Settings → Third-party integrations)')

  const { axios } = await ctx.getService('http')

  const params = {
    symbol: sym,
    interval: tdInterval,
    apikey: apiKey,
    order: 'ASC',
  }
  if (from && to) {
    params.start_date = String(from).slice(0, 10)
    params.end_date = String(to).slice(0, 10)
  } else {
    params.outputsize = '120'
  }

  let j
  try {
    const res = await axios.get('https://api.twelvedata.com/time_series', { params })
    j = res.data
  } catch (e) {
    ctx.throws(502, \`Twelve Data: \${e.message || 'unknown'}\`)
  }
  if (j && (j.status === 'error' || (typeof j.code === 'number' && j.code >= 400))) {
    ctx.throws(502, \`Twelve Data: \${j.message || 'unknown'}\`)
  }
  if (!j || !Array.isArray(j.values) || j.values.length === 0) {
    ctx.throws(404, \`no bars for \${sym}\`)
  }

  const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  const bars = []
  for (const b of j.values) {
    const open = num(b.open)
    const high = num(b.high)
    const low = num(b.low)
    const close = num(b.close)
    if (open == null || high == null || low == null || close == null) continue
    bars.push({
      timestamp: new Date(b.datetime.replace(' ', 'T') + 'Z').getTime(),
      open,
      high,
      low,
      close,
      volume: num(b.volume),
    })
  }

  const metaSym = (j.meta && j.meta.symbol) || sym
  const meta = {
    symbol: metaSym,
    exchange: j.meta && j.meta.exchange,
    currency: j.meta && j.meta.currency,
    timezone: j.meta && j.meta.exchange_timezone,
    longName: metaSym,
    shortName: metaSym,
    asOf: bars.length ? Math.floor(bars[bars.length - 1].timestamp / 1000) : undefined,
  }

  const result = { meta, bars }

  const toMs = to ? new Date(to).getTime() : Date.now()
  const isFrozen = Number.isFinite(toMs) && toMs < Date.now() - 60_000
  const ttl = isFrozen ? 60 * 60 * 24 * 365 : 600
  await ctx.storage.cache.set(cacheKey, JSON.stringify(result), ttl)
  return result
}
`.trim()

export default {
  code,
  name: 'stock_bars',
  path: 'stock_bars',
  method: 'GET',
} as BuiltInFunctionObject
