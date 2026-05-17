import { emitSuccess, type OutputOptions } from '../../core/output'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
  withLangQuery,
} from '../internal/shared'

export async function run(flags: GlobalFlags, out: OutputOptions) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const res = await client.request<{ data: unknown[] } | unknown[]>(
    '/topics/all',
    { query: withLangQuery(flags) },
  )
  emitSuccess(res.data, out)
}
