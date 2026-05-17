import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildNotePayload, type NoteFlagInputs } from '../../core/payload'
import { buildResolver, resolveTopicRefs } from '../internal/resolve-helpers'
import { buildApiClient, type GlobalFlags, resolveContext } from '../internal/shared'

export async function run(
  opts: NoteFlagInputs,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const built = await buildNotePayload(opts)
  if (flags.dryRun) {
    emitSuccess(built.payload, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const resolver = buildResolver(client)
  await resolveTopicRefs(built.payload, resolver)
  const res = await client.request('/notes', {
    method: 'POST',
    body: built.payload,
  })
  emitSuccess(res.data, out)
}
