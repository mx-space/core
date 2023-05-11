import { defineBuiltInSnippetConfig } from '../../function.types'

export default defineBuiltInSnippetConfig({
  name: 'getPageId',
  method: 'GET',
  code: `import axios from 'axios';

export default async function handler(ctx: Context) {
  const { req } = ctx
  const { query } = req
  const { slug, characterId } = query
  return axios.get('https://xlog.app/api/slug2id', {
    params: {
      slug, characterId
    },
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:14.2) Gecko/20100101 Firefox/14.2.1"
    }
  }).then(data => data.data).catch(err => ({ err }))
}`,
  path: 'get_page_id',
  reference: 'xlog',
})
