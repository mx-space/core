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
  const res = await client.request(`/notes/${id}/publish`, {
    method: 'PATCH',
    body: { isPublished: publish },
  })
  emitSuccess(res.data, out)
}

async function resolveId(client: ApiClient, slugOrId: string): Promise<string> {
  if (isSnowflakeId(slugOrId)) return slugOrId
  if (/^\d+$/.test(slugOrId)) {
    const res = await client.request<any>(`/notes/nid/${slugOrId}`, {
      query: { single: '1' },
    })
    const id = res.data?.data?.id ?? res.data?.id
    if (!id)
      throw new MxsError({
        code: 'resource.not_found',
        message: `note not found: ${slugOrId}`,
      })
    return id
  }
  return slugOrId
}
