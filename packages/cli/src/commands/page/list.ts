import { emitSuccess, type OutputOptions } from '../../core/output'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
  withLangQuery,
} from '../internal/shared'

export async function run(
  _opts: unknown,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const res = await client.request<{ data: unknown[] }>('/pages', {
    query: withLangQuery(flags),
  })
  emitSuccess(res.data, out)
}
