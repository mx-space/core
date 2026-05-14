import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'

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
    query: {
      page: opts.page,
      size: opts.size,
      state: opts.state,
      sortBy: opts.sort,
    },
  })
  emitSuccess(res.data, out)
}
