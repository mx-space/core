import type { ApiClient } from '../../core/api-client'
import { MxsError } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildPostPayload, type PostFlagInputs } from '../../core/payload'
import { isSnowflakeId } from '../../core/resolve'
import { buildResolver, resolveCategoryRefs } from '../_resolve-helpers'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'

export async function run(
  slugOrId: string,
  opts: PostFlagInputs,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const built = await buildPostPayload(opts)
  if (opts.content === undefined && !opts.file) {
    delete built.payload.content
    delete built.payload.text
    delete built.payload.contentFormat
  }
  if (flags.dryRun) {
    emitSuccess(built.payload, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const resolver = buildResolver(client)
  await resolveCategoryRefs(built.payload, resolver)
  const id = await resolveId(client, slugOrId)
  const res = await client.request(`/posts/${id}`, {
    method: 'PATCH',
    body: built.payload,
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
