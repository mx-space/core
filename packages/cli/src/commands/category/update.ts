import { emitSuccess, type OutputOptions } from '../../core/output'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
} from '../internal/shared'
import { resolveCategoryId } from './resolve'

export interface CategoryUpdateFlags {
  name?: string
  slug?: string
  type?: 'category' | 'tag'
  icon?: string
}

export async function run(
  slugOrId: string,
  opts: CategoryUpdateFlags,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const body: Record<string, unknown> = {}
  if (opts.name) body.name = opts.name
  if (opts.slug) body.slug = opts.slug
  if (opts.type) body.type = opts.type === 'tag' ? 1 : 0
  if (opts.icon) body.icon = opts.icon
  if (flags.dryRun) {
    emitSuccess({ id: slugOrId, body }, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const id = await resolveCategoryId(client, slugOrId)
  const res = await client.request(`/categories/${id}`, {
    method: 'PATCH',
    body,
  })
  emitSuccess(res.data, out)
}
