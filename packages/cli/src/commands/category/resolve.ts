import type { ApiClient } from '../../core/api-client'
import { MxsError, MxsErrorCode } from '../../core/errors'
import { isSnowflakeId } from '../../core/resolve'

interface CategoryEnvelope {
  data?: { id?: string }
}

export async function resolveCategoryId(
  client: ApiClient,
  slugOrId: string,
): Promise<string> {
  if (isSnowflakeId(slugOrId)) return slugOrId
  const res = await client.request<CategoryEnvelope>(
    `/categories/${encodeURIComponent(slugOrId)}`,
  )
  const id = res.data?.data?.id
  if (!id) {
    throw new MxsError({
      code: MxsErrorCode.ResourceNotFound,
      message: `category not found: ${slugOrId}`,
    })
  }
  return id
}
