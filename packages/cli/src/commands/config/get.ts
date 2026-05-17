import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildApiClient, type GlobalFlags, resolveContext } from '../internal/shared'

export async function run(key: string, flags: GlobalFlags, out: OutputOptions) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const res = await client.request(`/options/${key}`)
  emitSuccess(res.data, out)
}
