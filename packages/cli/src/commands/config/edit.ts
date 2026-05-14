import { runEditorRoundTrip } from '../../core/editor'
import { MxsError } from '../../core/errors'
import { emitInfo, emitSuccess, type OutputOptions } from '../../core/output'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'

export async function run(flags: GlobalFlags, out: OutputOptions) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const res = await client.request<Record<string, unknown>>('/options')
  const initial = JSON.stringify(res.data ?? {}, null, 2)
  const next = await runEditorRoundTrip({
    filename: 'mxs-config.json',
    initialContent: initial,
  })
  if (next.trim() === initial.trim()) {
    emitInfo('no changes', out)
    return
  }
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(next)
  } catch (err: any) {
    throw new MxsError({
      code: 'validation.failed',
      message: `invalid JSON: ${err?.message ?? err}`,
    })
  }
  if (flags.dryRun) {
    emitSuccess(parsed, out)
    return
  }
  const results: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed)) {
    const r = await client.request(`/options/${key}`, {
      method: 'PATCH',
      body: value,
    })
    results[key] = r.data
  }
  emitSuccess(results, out)
}
