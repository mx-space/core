import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'

export interface CategoryCreateFlags {
  name: string
  slug: string
  type?: 'category' | 'tag'
  icon?: string
}

export async function run(
  opts: CategoryCreateFlags,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const body: Record<string, unknown> = {
    name: opts.name,
    slug: opts.slug,
  }
  if (opts.type) body.type = opts.type === 'tag' ? 1 : 0
  if (opts.icon) body.icon = opts.icon
  if (flags.dryRun) {
    emitSuccess(body, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const res = await client.request('/categories', {
    method: 'POST',
    body,
  })
  emitSuccess(res.data, out)
}
