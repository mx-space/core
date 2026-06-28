const PLACE_URL = 'https://restapi.amap.com/v3/place/text'

export default async function handler(ctx) {
  const { keywords } = ctx.query
  if (!keywords) ctx.throws(422, 'keywords is required')

  const { axios } = await ctx.getService('http')
  const config = await ctx.getService('config')
  const adminExtra = await config.get('adminExtra')
  const gaodemapKey = adminExtra?.gaodemapKey || ctx.secret?.gaodemapKey

  if (!gaodemapKey) {
    ctx.throws(422, 'Amap (Gaode) API key is not configured')
  }

  try {
    const { data } = await axios.get(PLACE_URL, {
      params: { key: gaodemapKey, keywords: keywords.replace(/\s/g, '|') },
    })
    if (!data) ctx.throws(500, 'Amap (Gaode) API request failed')
    return data
  } catch (e) {
    ctx.throws(500, `Amap (Gaode) API request failed: ${e.message || 'unknown'}`)
  }
}
