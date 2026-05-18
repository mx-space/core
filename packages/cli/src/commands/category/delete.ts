import { MxsError, MxsErrorCode } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
} from '../internal/shared'
import { resolveCategoryId } from './resolve'

export async function run(
  slugOrId: string,
  opts: { force?: boolean },
  flags: GlobalFlags,
  out: OutputOptions,
) {
  if (!opts.force && !flags.dryRun && !process.stdin.isTTY) {
    throw new MxsError({
      code: MxsErrorCode.ValidationFailed,
      message: 'refusing to delete without --force in non-TTY context',
    })
  }
  if (flags.dryRun) {
    emitSuccess({ would_delete: slugOrId }, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const id = await resolveCategoryId(client, slugOrId)
  await client.request(`/categories/${id}`, { method: 'DELETE' })
  emitSuccess({ deleted: id }, out)
}
