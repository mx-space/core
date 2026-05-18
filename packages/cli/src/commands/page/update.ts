import type { ApiClient } from '../../core/api-client'
import { MxsError, MxsErrorCode } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildPagePayload, type PageFlagInputs } from '../../core/payload'
import { isSnowflakeId } from '../../core/resolve'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
} from '../internal/shared'

export async function run(
  slugOrId: string,
  opts: PageFlagInputs,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const built = await buildPagePayload(opts)
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
  const id = await resolveId(client, slugOrId)
  const res = await client.request(`/pages/${id}`, {
    method: 'PATCH',
    body: built.payload,
  })
  emitSuccess(res.data, out)
}

async function resolveId(client: ApiClient, slugOrId: string): Promise<string> {
  if (isSnowflakeId(slugOrId)) return slugOrId
  const res = await client.request<{ id: string }>(`/pages/slug/${slugOrId}`)
  if (!res.data?.id)
    throw new MxsError({
      code: MxsErrorCode.ResourceNotFound,
      message: `page not found: ${slugOrId}`,
    })
  return res.data.id
}
