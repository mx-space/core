import { isIPv4, isIPv6 } from 'net'

const TIMEOUT = 5000

export default async function handler(ctx, timeout = TIMEOUT) {
  const { ip } = ctx.req.query

  if (!ip) {
    ctx.res.throws(422, 'ip is empty')
  }
  const cache = ctx.storage.cache
  const hasCatch = await cache.get(ip)
  if (hasCatch) return hasCatch

  const result = await getIp(ctx, ip)
  await cache.set(ip, result)
  return result
}

async function getIp(ctx, ip, timeout = TIMEOUT) {
  const isV4 = isIPv4(ip)
  const isV6 = isIPv6(ip)
  const { axios } = await ctx.getService('http')
  if (!isV4 && !isV6) {
    ctx.throws(422, 'Invalid IP')
  }
  try {
    const data = await axios
      .get('https://freeipapi.com/api/json/' + ip)
      .then((data) => data.data)
    return {
      cityName: data.cityName,
      countryName: data.countryName,
      ip: data.ipAddress,
      ispDomain: data.asnOrganization || '',
      ownerDomain: data.asnOrganization || '',
      regionName: data.regionName,
    }
  } catch (e) {
    ctx.throws(500, `IP API request failed: ${e.message}`)
  }
}
