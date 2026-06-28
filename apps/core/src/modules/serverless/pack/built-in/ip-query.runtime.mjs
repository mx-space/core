import { isIPv4, isIPv6 } from 'net'

const FREEIPAPI_URL = 'https://freeipapi.com/api/json'

export default async function handler(ctx) {
  const { ip } = ctx.req.query
  if (!ip) ctx.res.throws(422, 'ip is empty')

  const cache = ctx.storage.cache
  const cached = await cache.get(ip)
  if (cached) return cached

  if (!isIPv4(ip) && !isIPv6(ip)) ctx.throws(422, 'Invalid IP')

  try {
    const res = await fetch(`${FREEIPAPI_URL}/${encodeURIComponent(ip)}`)
    const data = await res.json()
    const result = {
      cityName: data.cityName,
      countryName: data.countryName,
      ip: data.ipAddress,
      ispDomain: data.asnOrganization || '',
      ownerDomain: data.asnOrganization || '',
      regionName: data.regionName,
    }
    await cache.set(ip, result)
    return result
  } catch (e) {
    ctx.throws(500, `IP API request failed: ${e.message}`)
  }
}
