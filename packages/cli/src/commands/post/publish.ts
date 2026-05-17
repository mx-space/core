import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildApiClient, type GlobalFlags, resolveContext } from '../internal/shared'
import { resolvePostId } from './resolve'

export async function run(
  slugOrId: string,
  publish: boolean,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const id = await resolvePostId(client, slugOrId)
  if (flags.dryRun) {
    emitSuccess({ would_set: { id, isPublished: publish } }, out)
    return
  }
  const res = await client.request(`/posts/${id}`, {
    method: 'PATCH',
    body: { isPublished: publish },
  })
  emitSuccess(res.data, out)
}
