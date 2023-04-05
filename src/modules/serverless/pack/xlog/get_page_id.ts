import { defineBuiltInSnippetConfig } from '../../function.types'

export default defineBuiltInSnippetConfig({
  name: 'getPageId',
  method: 'GET',
  code: `import axios from 'axios';

export default async function handler(ctx: Context) {
  const { req } = ctx
  const { query } = req
  const { slug, handle } = query
  return axios.get('https://xlog.app/api/slug2id', {
    params: {
      slug, handle
    }
  }).then(data => data.data).catch(err => ({ err }))
}`,
  path: 'get_page_id',
  reference: 'xlog',
})
