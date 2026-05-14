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
  await client.request(`/notes/${id}`, { method: 'DELETE' })
  emitSuccess({ deleted: id }, out)
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
