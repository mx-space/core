import { defineBuiltInSnippetConfig } from '../../function.types'

export default defineBuiltInSnippetConfig({
  name: 'getSummary',
  method: 'GET',
  code: `import axios from 'axios';

export default async function handler(ctx: Context) {
  const { req } = ctx
  const { query } = req
  const { cid, lang } = query
  return axios.get('https://xlog.app/api/summary', {
    params: {
      cid, lang: lang || 'zh-CN'
    }
  }).then(data => data.data).catch(err => ({ err }))
}`,
  path: 'get_summary',
  reference: 'xlog',
})
