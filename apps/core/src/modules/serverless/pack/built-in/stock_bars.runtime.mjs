const AGGS_URL = 'https://api.polygon.io/v2/aggs/ticker'
const TICKER_URL = 'https://api.polygon.io/v3/reference/tickers'
const INTERVAL_MAP = {
  '5m': { mult: 5, span: 'minute' },
  '15m': { mult: 15, span: 'minute' },
  '1h': { mult: 1, span: 'hour' },
  '1d': { mult: 1, span: 'day' },
}
const ALLOWED_INTERVALS = Object.keys(INTERVAL_MAP)
const DEFAULT_LOOKBACK_DAYS = { '5m': 5, '15m': 5, '1h': 30, '1d': 180 }
const TTL_LIVE_SEC = 600
const TTL_FROZEN_SEC = 60 * 60 * 24 * 365
const FREEZE_THRESHOLD_MS = 60_000
const TICKER_CACHE_TTL_SEC = 60 * 60 * 24
const EXCHANGE_NAME = {
  XNAS: 'NASDAQ',
  XNYS: 'NYSE',
  ARCX: 'NYSE Arca',
  BATS: 'CBOE BZX',
  XASE: 'NYSE American',
  IEXG: 'IEX',
}

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const ymd = (ms) => {
  const d = new Date(ms)
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${m}-${day}`
}

export default async function handler(ctx) {
  const { symbol, interval, from, to } = ctx.query
  if (!symbol) ctx.throws(422, 'symbol is required')
  if (!ALLOWED_INTERVALS.includes(interval)) ctx.throws(422, 'invalid interval')

  const sym = String(symbol).toUpperCase()
  const { mult, span } = INTERVAL_MAP[interval]

  const cacheKey = `stock:bars:${sym}:${interval}:${from || ''}:${to || ''}`
  const cached = await ctx.storage.cache.get(cacheKey)
  if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached

  const config = await ctx.getService('config')
  const thirdParty = await config.get('thirdPartyServiceIntegration')
  const apiKey = String(thirdParty?.polygon?.apiKey ?? '').trim()
  if (!apiKey) {
    ctx.throws(
      500,
      'Polygon.io API key not configured (Settings → Third-party integrations)',
    )
  }

  const now = Date.now()
  let fromMs
  let toMs
  if (from && to) {
    fromMs = new Date(from).getTime()
    toMs = new Date(to).getTime()
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      ctx.throws(422, 'invalid from/to')
    }
  } else {
    toMs = now
    fromMs = now - DEFAULT_LOOKBACK_DAYS[interval] * 86_400_000
  }

  const aggsUrl =
    `${AGGS_URL}/${encodeURIComponent(sym)}/range/${mult}/${span}/` +
    `${ymd(fromMs)}/${ymd(toMs)}` +
    `?adjusted=true&sort=asc&limit=5000&apiKey=${encodeURIComponent(apiKey)}`

  let payload
  try {
    const res = await fetch(aggsUrl, { headers: { Accept: 'application/json' } })
    payload = await res.json()
  } catch (e) {
    ctx.throws(502, `Polygon.io: ${e.message || 'unknown'}`)
  }

  if (payload?.status && payload.status !== 'OK' && payload.status !== 'DELAYED') {
    ctx.throws(
      502,
      `Polygon.io: ${payload.error || payload.message || payload.status}`,
    )
  }

  const results = Array.isArray(payload?.results) ? payload.results : []
  const bars = []
  for (const r of results) {
    if (r.t < fromMs || r.t > toMs) continue
    const open = num(r.o)
    const high = num(r.h)
    const low = num(r.l)
    const close = num(r.c)
    if (open == null || high == null || low == null || close == null) continue
    bars.push({
      timestamp: r.t,
      open,
      high,
      low,
      close,
      volume: num(r.v),
    })
  }
  if (bars.length === 0) ctx.throws(404, `no bars for ${sym}`)

  const tickerCacheKey = `stock:ticker:${sym}`
  let tickerInfo = await ctx.storage.cache.get(tickerCacheKey)
  if (tickerInfo && typeof tickerInfo === 'string') tickerInfo = JSON.parse(tickerInfo)
  if (!tickerInfo) {
    try {
      const tRes = await fetch(
        `${TICKER_URL}/${encodeURIComponent(sym)}?apiKey=${encodeURIComponent(apiKey)}`,
        { headers: { Accept: 'application/json' } },
      )
      const tJson = await tRes.json()
      tickerInfo = tJson?.results || {}
      await ctx.storage.cache.set(
        tickerCacheKey,
        JSON.stringify(tickerInfo),
        TICKER_CACHE_TTL_SEC,
      )
    } catch {
      tickerInfo = {}
    }
  }

  const exchangeCode = tickerInfo?.primary_exchange
  const meta = {
    symbol: tickerInfo?.ticker || sym,
    exchange:
      (exchangeCode && (EXCHANGE_NAME[exchangeCode] || exchangeCode)) || undefined,
    currency: (tickerInfo?.currency_name || 'USD').toUpperCase(),
    timezone: 'America/New_York',
    longName: tickerInfo?.name || sym,
    shortName: tickerInfo?.name || sym,
    asOf: Math.floor(bars.at(-1).timestamp / 1000),
  }

  const result = { meta, bars }

  const isFrozen = Number.isFinite(toMs) && toMs < now - FREEZE_THRESHOLD_MS
  const ttl = isFrozen ? TTL_FROZEN_SEC : TTL_LIVE_SEC
  await ctx.storage.cache.set(cacheKey, JSON.stringify(result), ttl)
  return result
}
