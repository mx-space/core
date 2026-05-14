import type { ApiClient } from '../../core/api-client'
import { MxsError } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { isSnowflakeId } from '../../core/resolve'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'

export async function run(
  slugOrId: string,
  publish: boolean,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const id = await resolveId(client, slugOrId)
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

async function resolveId(client: ApiClient, slugOrId: string): Promise<string> {
  if (isSnowflakeId(slugOrId)) return slugOrId
  const res = await client.request<{ id: string }>(`/posts/-/${slugOrId}`)
  if (!res.data?.id)
    throw new MxsError({
      code: 'resource.not_found',
      message: `post not found: ${slugOrId}`,
    })
  return res.data.id
}
