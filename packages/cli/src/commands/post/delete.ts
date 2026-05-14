import type { ApiClient } from '../../core/api-client'
import { MxsError } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { isSnowflakeId } from '../../core/resolve'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'

export async function run(
  slugOrId: string,
  opts: { force?: boolean },
  flags: GlobalFlags,
  out: OutputOptions,
) {
  if (!opts.force && !flags.dryRun && !process.stdin.isTTY) {
    throw new MxsError({
      code: 'validation.failed',
      message: 'refusing to delete without --force in non-TTY context',
    })
  }
  if (flags.dryRun) {
    emitSuccess({ would_delete: slugOrId }, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const id = await resolveId(client, slugOrId)
  await client.request(`/posts/${id}`, { method: 'DELETE' })
  emitSuccess({ deleted: id }, out)
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
