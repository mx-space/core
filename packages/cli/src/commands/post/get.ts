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
  const path = isSnowflakeId(slugOrId)
    ? `/posts/${slugOrId}`
    : `/posts/-/${slugOrId}`
  const res = await client.request(path, {
    query: { prefer: 'lexical' },
  })
  emitSuccess(res.data, out)
}
