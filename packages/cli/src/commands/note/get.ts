import { emitSuccess, type OutputOptions } from '../../core/output'
import { isSnowflakeId } from '../../core/resolve'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'

export async function run(
  slugOrId: string,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  if (isSnowflakeId(slugOrId)) {
    const res = await client.request(`/notes/${slugOrId}`, {
      query: { prefer: 'lexical' },
    })
    emitSuccess(res.data, out)
    return
  }
  if (/^\d+$/.test(slugOrId)) {
    const res = await client.request(`/notes/nid/${slugOrId}`, {
      query: { single: '1', prefer: 'lexical' },
    })
    emitSuccess(res.data, out)
    return
  }
  const res = await client.request(`/notes/${slugOrId}`, {
    query: { prefer: 'lexical' },
  })
  emitSuccess(res.data, out)
}
