import { deleteCredentials } from '../../core/config-store'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { type GlobalFlags } from '../_shared'

export async function run(_flags: GlobalFlags, out: OutputOptions) {
  await deleteCredentials()
  emitSuccess({ ok: true }, out)
}
