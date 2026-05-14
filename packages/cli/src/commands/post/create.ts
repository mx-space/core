import { emitInfo, emitSuccess, type OutputOptions } from '../../core/output'
import { buildPostPayload, type PostFlagInputs } from '../../core/payload'
import { buildResolver, resolveCategoryRefs } from '../_resolve-helpers'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'

export async function run(
  opts: PostFlagInputs,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const built = await buildPostPayload(opts)
  if (flags.dryRun) {
    emitInfo('dry-run — payload below', out)
    emitSuccess(built.payload, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const resolver = buildResolver(client)
  await resolveCategoryRefs(built.payload, resolver)
  const res = await client.request('/posts', {
    method: 'POST',
    body: built.payload,
  })
  emitSuccess(res.data, out)
}
