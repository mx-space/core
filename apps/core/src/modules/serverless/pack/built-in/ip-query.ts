import type { BuiltInFunctionObject } from '../../function.types'

const ipQueryFnCode =
  "import { isIPv4, isIPv6 } from 'net';\nimport { URLSearchParams } from 'url';\n\nconst TIMEOUT = 5000;\n\nexport default async function handler(ctx: Context, timeout = TIMEOUT) {\n  const { ip } = ctx.req.query\n\n  if (!ip) { ctx.res.throws(422, 'ip is empty') }\n  const cache = ctx.storage.cache\n  const hasCatch = await cache.get(ip)\n\n  if (hasCatch) {\n    const cachedData = typeof hasCatch === 'string' ? JSON.parse(hasCatch) : hasCatch;\n    return cachedData;\n  }\n\n  const result = await getIp(ctx, ip);\n  await cache.set(ip, result)\n  return result\n}\n\nasync function getIp(ctx: Context, ip: string, timeout = TIMEOUT) {\n  const isV4 = isIPv4(ip)\n  const isV6 = isIPv6(ip)\n  const { axios } = await (ctx.getService('http'))\n  if (!isV4 && !isV6) {\n    ctx.throws(422, 'Invalid IP')\n  }\n  try {\n    const data = await axios.get(`http://ip-api.com/json/${ip}?lang=zh-CN`).then(data => data.data) as Ip\n    const res: FinalIpRecord = {\n      cityName: data.city,\n      countryName: data.country,\n      ip: data.query,\n      ispDomain: data.isp,\n      ownerDomain: data.org,\n      regionName: data.regionName\n    }\n\n    return res\n  } catch (e) {\n    ctx.throws(500, `IP API 调用失败，${e.message}`)\n  }\n};\n\ninterface FinalIpRecord {\n  cityName: string\n  countryName: string\n  ip: string\n  ispDomain: string\n  ownerDomain: string\n  regionName: string\n}\n\ninterface Ip {\n  country: string;\n  countryCode: string;\n  region: string;\n  regionName: string;\n  city: string;\n  zip: string;\n  lat: number;\n  lon: number;\n  timezone: string;\n  isp: string;\n  org: string;\n  as: string;\n  query: string;\n}"

export default {
  code: ipQueryFnCode,
  path: 'ip',
  name: 'ip-query',
  method: 'GET',
} as BuiltInFunctionObject
