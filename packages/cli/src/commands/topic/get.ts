import { emitSuccess, type OutputOptions } from '../../core/output'
import { isSnowflakeId } from '../../core/resolve'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
  withLangQuery,
} from '../internal/shared'

export async function run(
  slugOrId: string,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const path = isSnowflakeId(slugOrId)
    ? `/topics/${slugOrId}`
    : `/topics/slug/${slugOrId}`
  const res = await client.request(path, { query: withLangQuery(flags) })
  emitSuccess(res.data, out)
}
