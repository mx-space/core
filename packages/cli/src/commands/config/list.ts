import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildApiClient, type GlobalFlags, resolveContext } from '../internal/shared'

export async function run(flags: GlobalFlags, out: OutputOptions) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const res = await client.request('/options')
  emitSuccess(res.data, out)
}
