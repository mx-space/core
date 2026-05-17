import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildApiClient, type GlobalFlags, resolveContext } from '../internal/shared'

export interface TopicCreateFlags {
  name: string
  slug: string
  description?: string
  icon?: string
}

export async function run(
  opts: TopicCreateFlags,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const body: Record<string, unknown> = {
    name: opts.name,
    slug: opts.slug,
  }
  if (opts.description) body.description = opts.description
  if (opts.icon) body.icon = opts.icon
  if (flags.dryRun) {
    emitSuccess(body, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const res = await client.request('/topics', { method: 'POST', body })
  emitSuccess(res.data, out)
}
