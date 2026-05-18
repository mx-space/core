import type { ApiClient } from '../../core/api-client'
import { MxsError, MxsErrorCode } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { isSnowflakeId } from '../../core/resolve'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
} from '../internal/shared'

export interface TopicUpdateFlags {
  name?: string
  slug?: string
  description?: string
  icon?: string
}

export async function run(
  slugOrId: string,
  opts: TopicUpdateFlags,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const body: Record<string, unknown> = {}
  if (opts.name) body.name = opts.name
  if (opts.slug) body.slug = opts.slug
  if (opts.description) body.description = opts.description
  if (opts.icon) body.icon = opts.icon
  if (flags.dryRun) {
    emitSuccess({ id: slugOrId, body }, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const id = await resolveId(client, slugOrId)
  const res = await client.request(`/topics/${id}`, {
    method: 'PATCH',
    body,
  })
  emitSuccess(res.data, out)
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
