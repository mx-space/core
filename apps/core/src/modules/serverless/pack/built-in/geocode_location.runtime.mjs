const REGEO_URL = 'https://restapi.amap.com/v3/geocode/regeo'

export default async function handler(ctx) {
  const { latitude, longitude } = ctx.query
  const { axios } = await ctx.getService('http')
  const config = await ctx.getService('config')
  const adminExtra = await config.get('adminExtra')
  const gaodemapKey = adminExtra?.gaodemapKey || ctx.secret?.gaodemapKey

  if (!gaodemapKey) {
    ctx.throws(400, 'Amap (Gaode) API key is not configured')
  }

  try {
    const { data } = await axios.get(REGEO_URL, {
      params: { key: gaodemapKey, location: `${longitude},${latitude}` },
    })
    if (!data) ctx.throws(500, 'Amap (Gaode) API request failed')
    return data
  } catch (e) {
    ctx.throws(500, `Amap (Gaode) API request failed: ${e.message || 'unknown'}`)
  }
}
