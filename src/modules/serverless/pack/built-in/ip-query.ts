const interfaceCode = `
interface IPResponseData {
  code: number
  success: boolean
  message: string
  data: Data
  location: string
  myip: string
  time: string
}
interface Data {
  ip: string
  dec: string
  country: string
  countryCode: string
  province: string
  city: string
  districts: string
  idc: string
  isp: string
  net: string
  protocol: string
  begin: string
  end: string
}
`

const ipQueryFnCode =
  `
import { isIPv4, isIPv6 } from 'net'
import { URLSearchParams } from 'url'

const timeout = 5000

export default async function handler(ctx: Context) {
  const { ip } = ctx.query
  if (!ip) { ctx.throws(422, 'ip is empty') }
  const cache = ctx.storage.cache
  const hasCatch = await cache.get(ip)
  if (hasCatch) return JSON.parse(hasCatch)

  const result = await getIp(ctx, ip);
  await cache.set(ip, result)
  return result
}

async function getIp(ctx: Context, ip: string) {
  const isV4 = isIPv4(ip)
  const isV6 = isIPv6(ip)
  const { axios } = await (ctx.getService('http'))
  if (!isV4 && !isV6) {
    ctx.throws(422, 'Invalid IP')
  }
  try {
    // const getIpQueryEndpoint = (ip, type: 'v4' | 'v6') =>
    //   \`https://ip$\{type}.ip.mir6.com/api_json.php?ip=$\{ip}&token=mir6.com\`

    if (isV4) {
      const data = await axios.get(
        \`https://ipv4.ip.mir6.com/api_json.php?ip=$\{ip}&token=mir6.com\`,
        {
          timeout,
        },
      ) as IPResponseData

      const {
        data: { city, country, districts, isp, province, net },
      } = data.data
      return {
        cityName: districts,
        countryName: country + province,
        regionName: city,
        ip,
        ispDomain: isp,
        ownerDomain: isp || net,
      }
    } else {
      const { data } = (await axios.get(
       \`http://ip-api.com/json/$\{ip}\`,
        {
          timeout,
        },
      )) as any

      const res = {
        cityName: data.city,
        countryName: data.country,
        ip: data.query,
        ispDomain: data.as,
        ownerDomain: data.org,
        regionName: data.region_name,
      } as const

      return res
    }
  } catch (e) {
    ctx.throws(500, \`IP API 调用失败，$\{e.message}\`)
  }
};
` + `\n${interfaceCode}`

// eslint-disable-next-line import/no-default-export
export default {
  code: ipQueryFnCode,
  path: 'ip',
}
