import type { BuiltInFunctionObject } from '../../function.types'

const ipQueryFnCode =
  "import { isIPv4, isIPv6 } from 'net'\n\nconst TIMEOUT = 5000\n\nexport default async function handler(ctx: Context, timeout = TIMEOUT) {\n  const { ip } = ctx.req.query\n\n  if (!ip) { ctx.res.throws(422, 'ip is empty') }\n  const cache = ctx.storage.cache\n  const hasCatch = await cache.get(ip)\n  if (hasCatch) return hasCatch\n\n  const result = await getIp(ctx, ip);\n  await cache.set(ip, result)\n  return result\n}\n\nasync function getIp(ctx: Context, ip: string, timeout = TIMEOUT) {\n  const isV4 = isIPv4(ip)\n  const isV6 = isIPv6(ip)\n  const { axios } = await (ctx.getService('http'))\n  if (!isV4 && !isV6) {\n    ctx.throws(422, 'Invalid IP')\n  }\n  try {\n    const data = await axios.get('https://freeipapi.com/api/json/' + ip).then(data => data.data) as FreeIpApiResponse\n    const res: FinalIpRecord = {\n      cityName: data.cityName,\n      countryName: data.countryName,\n      ip: data.ipAddress,\n      ispDomain: data.asnOrganization || '',\n      ownerDomain: data.asnOrganization || '',\n      regionName: data.regionName\n    }\n\n    return res\n  } catch (e) {\n    ctx.throws(500, `IP API 调用失败，${e.message}`)\n  }\n};\n\n\ninterface FinalIpRecord {\n  cityName: string\n  countryName: string\n  ip: string\n  ispDomain: string\n  ownerDomain: string\n  regionName: string\n}\ninterface FreeIpApiResponse {\n  ipVersion: number;\n  ipAddress: string;\n  latitude: number;\n  longitude: number;\n  countryName: string;\n  countryCode: string;\n  cityName: string;\n  regionName: string;\n  regionCode: string;\n  continent: string;\n  continentCode: string;\n  asn: string;\n  asnOrganization: string;\n  isProxy: boolean;\n}"

export default {
  code: ipQueryFnCode,
  path: 'ip',
  name: 'ip-query',
  method: 'GET',
} as BuiltInFunctionObject
