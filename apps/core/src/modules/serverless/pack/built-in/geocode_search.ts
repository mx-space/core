import type { BuiltInFunctionObject } from '../../function.types'

export const code = `
import { URLSearchParams } from 'url'
export default async function handler(ctx: Context) {
  let { keywords } = ctx.query
  keywords = keywords.replace(/\\s/g, '|')

  const { axios } = await ctx.getService('http')
  const config = await ctx.getService('config')

  const adminExtra = await config.get('adminExtra')
  const gaodemapKey = adminExtra?.gaodemapKey || secret.gaodemapKey

  if (!gaodemapKey) {
    ctx.throws(422, '高德地图 API Key 未配置')
  }

  const params = new URLSearchParams([
    ['key', gaodemapKey],
    ['keywords', keywords],
  ])

  let errorMessage = ''

  const { data } = await axios.get(
    \`https://restapi.amap.com/v3/place/text?\${params.toString()}\`,
  )
    .catch((error) => {
      errorMessage = error.message
    })
  if (!data) {
    ctx.throws(500,
      \`高德地图 API 调用失败，\${errorMessage}\`,
    )
  }
  return data

}`.trim()

export default {
  code,
  name: 'geocode_search',
  path: 'geocode_search',
  method: 'GET',
} as BuiltInFunctionObject
