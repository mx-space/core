import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildPagePayload, type PageFlagInputs } from '../../core/payload'
import { buildApiClient, type GlobalFlags, resolveContext } from '../internal/shared'

export async function run(
  _id: unknown,
  opts: PageFlagInputs,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const built = await buildPagePayload(opts)
  if (flags.dryRun) {
    emitSuccess(built.payload, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const res = await client.request('/pages', {
    method: 'POST',
    body: built.payload,
  })
  emitSuccess(res.data, out)
}
