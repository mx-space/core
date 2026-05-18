import type { ApiClient } from '../../core/api-client'
import { MxsError, MxsErrorCode } from '../../core/errors'
import { isSnowflakeId } from '../../core/resolve'

interface PostSlugUrl {
  path?: string
}

interface PostIdResult {
  id?: string
}

export async function resolvePostReadPath(
  client: ApiClient,
  slugOrId: string,
): Promise<string> {
  if (isSnowflakeId(slugOrId)) return `/posts/${slugOrId}`

  const resolved = await client.request<PostSlugUrl>(
    `/posts/get-url/${encodeURIComponent(slugOrId)}`,
  )
  const path = resolved.data?.path
  if (!path) {
    throw new MxsError({
      code: MxsErrorCode.ResourceNotFound,
      message: `post not found: ${slugOrId}`,
    })
  }
  return `/posts${path.startsWith('/') ? path : `/${path}`}`
}

export async function resolvePostId(
  client: ApiClient,
  slugOrId: string,
): Promise<string> {
  if (isSnowflakeId(slugOrId)) return slugOrId

  const path = await resolvePostReadPath(client, slugOrId)
  const res = await client.request<PostIdResult>(path)
  if (!res.data?.id) {
    throw new MxsError({
      code: MxsErrorCode.ResourceNotFound,
      message: `post not found: ${slugOrId}`,
    })
  }
  return res.data.id
}
