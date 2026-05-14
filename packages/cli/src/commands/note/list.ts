import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'

export interface NoteListFlags {
  page?: number
  size?: number
  state?: string
  sort?: string
}

export async function run(
  opts: NoteListFlags,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const res = await client.request<{ data: unknown[] }>('/notes', {
    query: {
      page: opts.page,
      size: opts.size,
      sortBy: opts.sort,
    },
  })
  emitSuccess(res.data, out)
}
