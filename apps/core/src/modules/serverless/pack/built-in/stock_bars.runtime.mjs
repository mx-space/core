const SERIES_URL = 'https://api.twelvedata.com/time_series'
const INTERVAL_MAP = { '5m': '5min', '15m': '15min', '1h': '1h', '1d': '1day' }
const ALLOWED_INTERVALS = Object.keys(INTERVAL_MAP)
const DEFAULT_OUTPUTSIZE = '120'
const TTL_LIVE_SEC = 600
const TTL_FROZEN_SEC = 60 * 60 * 24 * 365
const FREEZE_THRESHOLD_MS = 60_000

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export default async function handler(ctx) {
  const { symbol, interval, from, to } = ctx.query
  if (!symbol) ctx.throws(422, 'symbol is required')
  if (!ALLOWED_INTERVALS.includes(interval)) ctx.throws(422, 'invalid interval')

  const sym = String(symbol).toUpperCase()
  const tdInterval = INTERVAL_MAP[interval]

  const cacheKey = `stock:bars:${sym}:${interval}:${from || ''}:${to || ''}`
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

  const { axios } = await ctx.getService('http')

  const params = {
    symbol: sym,
    interval: tdInterval,
    apikey: apiKey,
    order: 'ASC',
    ...(from && to
      ? {
          start_date: String(from).slice(0, 10),
          end_date: String(to).slice(0, 10),
        }
      : { outputsize: DEFAULT_OUTPUTSIZE }),
  }

  let payload
  try {
    const res = await axios.get(SERIES_URL, { params })
    payload = res.data
  } catch (e) {
    ctx.throws(502, `Twelve Data: ${e.message || 'unknown'}`)
  }
  if (
    payload?.status === 'error' ||
    (typeof payload?.code === 'number' && payload.code >= 400)
  ) {
    ctx.throws(502, `Twelve Data: ${payload.message || 'unknown'}`)
  }
  if (!Array.isArray(payload?.values) || payload.values.length === 0) {
    ctx.throws(404, `no bars for ${sym}`)
  }

  const bars = []
  for (const b of payload.values) {
    const open = num(b.open)
    const high = num(b.high)
    const low = num(b.low)
    const close = num(b.close)
    if (open == null || high == null || low == null || close == null) continue
    bars.push({
      timestamp: new Date(`${b.datetime.replace(' ', 'T')}Z`).getTime(),
      open,
      high,
      low,
      close,
      volume: num(b.volume),
    })
  }

  const metaSym = payload.meta?.symbol || sym
  const meta = {
    symbol: metaSym,
    exchange: payload.meta?.exchange,
    currency: payload.meta?.currency,
    timezone: payload.meta?.exchange_timezone,
    longName: metaSym,
    shortName: metaSym,
    asOf: bars.length ? Math.floor(bars.at(-1).timestamp / 1000) : undefined,
  }

  const result = { meta, bars }

  const toMs = to ? new Date(to).getTime() : Date.now()
  const isFrozen = Number.isFinite(toMs) && toMs < Date.now() - FREEZE_THRESHOLD_MS
  const ttl = isFrozen ? TTL_FROZEN_SEC : TTL_LIVE_SEC
  await ctx.storage.cache.set(cacheKey, JSON.stringify(result), ttl)
  return result
}
