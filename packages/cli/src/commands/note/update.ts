import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildNotePayload, type NoteFlagInputs } from '../../core/payload'
import { buildResolver, resolveTopicRefs } from '../internal/resolve-helpers'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
} from '../internal/shared'
import { resolveNoteId } from './resolve'

export async function run(
  slugOrId: string,
  opts: NoteFlagInputs,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const built = await buildNotePayload(opts)
  if (opts.content === undefined && !opts.file) {
    delete built.payload.content
    delete built.payload.text
    delete built.payload.contentFormat
  }
  if (flags.dryRun) {
    emitSuccess(built.payload, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const resolver = buildResolver(client)
  await resolveTopicRefs(built.payload, resolver)
  const id = await resolveNoteId(client, slugOrId)
  const res = await client.request(`/notes/${id}`, {
    method: 'PATCH',
    body: built.payload,
  })
  emitSuccess(res.data, out)
}
