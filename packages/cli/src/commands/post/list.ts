import { emitPostList } from '../../core/document-output'
import type { OutputOptions } from '../../core/output'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
  withLangQuery,
} from '../internal/shared'

export interface PostListFlags {
  page?: number
  size?: number
  state?: string
  sort?: string
}

export async function run(
  opts: PostListFlags,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const res = await client.request<{
    data: unknown[]
    pagination?: unknown
  }>('/posts', {
    query: withLangQuery(flags, {
      page: opts.page,
      size: opts.size,
      state: opts.state,
      sortBy: opts.sort,
    }),
  })
  emitPostList(res.data, out)
}
