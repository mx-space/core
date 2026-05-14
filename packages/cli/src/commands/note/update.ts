import type { ApiClient } from '../../core/api-client'
import { MxsError } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildNotePayload, type NoteFlagInputs } from '../../core/payload'
import { isSnowflakeId } from '../../core/resolve'
import { buildResolver, resolveTopicRefs } from '../_resolve-helpers'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'

export async function run(
  slugOrId: string,
  opts: NoteFlagInputs,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const built = await buildNotePayload(opts)
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
  await resolveTopicRefs(built.payload, resolver)
  const id = await resolveId(client, slugOrId)
  const res = await client.request(`/notes/${id}`, {
    method: 'PATCH',
    body: built.payload,
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
