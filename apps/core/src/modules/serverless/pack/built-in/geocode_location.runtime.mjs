const REGEO_URL = 'https://restapi.amap.com/v3/geocode/regeo'

export default async function handler(ctx) {
  const { latitude, longitude } = ctx.query
  const config = await ctx.getService('config')
  const adminExtra = await config.get('adminExtra')
  const gaodemapKey = adminExtra?.gaodemapKey || ctx.secret?.gaodemapKey

  if (!gaodemapKey) {
    ctx.throws(400, 'Amap (Gaode) API key is not configured')
  }

  const url = `${REGEO_URL}?${new URLSearchParams({
    key: gaodemapKey,
    location: `${longitude},${latitude}`,
  })}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    if (!data) ctx.throws(500, 'Amap (Gaode) API request failed')
    return data
  } catch (e) {
    ctx.throws(500, `Amap (Gaode) API request failed: ${e.message || 'unknown'}`)
  }
}
