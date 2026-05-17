import type { ApiClient } from '../../core/api-client'
import { MxsError } from '../../core/errors'
import { isSnowflakeId } from '../../core/resolve'

interface NidEnvelope {
  data?: { id?: string }
  id?: string
}

export async function resolveNoteId(
  client: ApiClient,
  slugOrId: string,
): Promise<string> {
  if (isSnowflakeId(slugOrId)) return slugOrId
  if (/^\d+$/.test(slugOrId)) {
    const res = await client.request<NidEnvelope>(
      `/notes/nid/${encodeURIComponent(slugOrId)}`,
      { query: { single: '1' } },
    )
    const id = res.data?.data?.id ?? res.data?.id
    if (!id) {
      throw new MxsError({
        code: 'resource.not_found',
        message: `note not found: ${slugOrId}`,
      })
    }
    return id
  }
  throw new MxsError({
    code: 'validation.failed',
    message: `invalid note reference: ${slugOrId} (use snowflake id or numeric nid)`,
  })
}
