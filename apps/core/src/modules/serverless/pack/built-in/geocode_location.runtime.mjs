export default async function handler(ctx) {
  const { latitude, longitude } = ctx.query
  const { axios } = await ctx.getService('http')
  const config = await ctx.getService('config')
  const adminExtra = await config.get('adminExtra')
  const gaodemapKey = adminExtra?.gaodemapKey || secret.gaodemapKey

  if (!gaodemapKey) {
    ctx.throws(400, 'Amap (Gaode) API key is not configured')
  }
  const { data } = await axios
    .get(
      `https://restapi.amap.com/v3/geocode/regeo?key=${gaodemapKey}&location=${longitude},${latitude}`,
    )
    .catch(() => null)

  if (!data) {
    ctx.throws(500, 'Amap (Gaode) API request failed')
  }
  return data
}
