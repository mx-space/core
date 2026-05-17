import { MxsError } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'
import { resolvePostId } from './resolve'

export async function run(
  slugOrId: string,
  opts: { force?: boolean },
  flags: GlobalFlags,
  out: OutputOptions,
) {
  if (!opts.force && !flags.dryRun && !process.stdin.isTTY) {
    throw new MxsError({
      code: 'validation.failed',
      message: 'refusing to delete without --force in non-TTY context',
    })
  }
  if (flags.dryRun) {
    emitSuccess({ would_delete: slugOrId }, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const id = await resolvePostId(client, slugOrId)
  await client.request(`/posts/${id}`, { method: 'DELETE' })
  emitSuccess({ deleted: id }, out)
}
