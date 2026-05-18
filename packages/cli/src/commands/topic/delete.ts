import type { ApiClient } from '../../core/api-client'
import { MxsError, MxsErrorCode } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { isSnowflakeId } from '../../core/resolve'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
} from '../internal/shared'

export async function run(
  slugOrId: string,
  opts: { force?: boolean },
  flags: GlobalFlags,
  out: OutputOptions,
) {
  if (!opts.force && !flags.dryRun && !process.stdin.isTTY) {
    throw new MxsError({
      code: MxsErrorCode.ValidationFailed,
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
  await client.request(`/topics/${id}`, { method: 'DELETE' })
  emitSuccess({ deleted: id }, out)
}

async function resolveId(client: ApiClient, slugOrId: string): Promise<string> {
  if (isSnowflakeId(slugOrId)) return slugOrId
  const res = await client.request<{ id?: string }>(`/topics/slug/${slugOrId}`)
  if (!res.data?.id)
    throw new MxsError({
      code: MxsErrorCode.ResourceNotFound,
      message: `topic not found: ${slugOrId}`,
    })
  return res.data.id
}
