import type { ApiClient } from '../../core/api-client'
import { runEditorRoundTrip } from '../../core/editor'
import { parseEnvelope } from '../../core/envelope'
import { serializeFromLexical } from '../../core/litexml-codec'
import { emitInfo, emitSuccess, type OutputOptions } from '../../core/output'
import { buildNotePayload, type NoteFlagInputs } from '../../core/payload'
import { applyNoteEnvelopeMeta } from '../internal/envelope-overlays'
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
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)

  if (!opts.file && opts.content === undefined) {
    const xml = await materializeForEditor(client, slugOrId)
    const next = await runEditorRoundTrip({
      filename: `note-${slugOrId}.xml`,
      initialContent: xml,
    })
    if (next.trim() === xml.trim()) {
      emitInfo('no changes', out)
      return
    }
    const parsed = parseEnvelope(next, 'note')
    const built = await buildNotePayload({
      ...opts,
      content: parsed.contentXml,
      format: opts.format ?? 'lexical',
    })
    applyNoteEnvelopeMeta(built.payload, parsed.meta)
    if (flags.dryRun) {
      emitSuccess(built.payload, out)
      return
    }
    const resolver = buildResolver(client)
    await resolveTopicRefs(built.payload, resolver)
    const id = await resolveNoteId(client, slugOrId)
    const res = await client.request(`/notes/${id}`, {
      method: 'PUT',
      body: built.payload,
    })
    emitSuccess(res.data, out)
    return
  }

  const built = await buildNotePayload(opts)
  if (flags.dryRun) {
    emitSuccess(built.payload, out)
    return
  }
  const resolver = buildResolver(client)
  await resolveTopicRefs(built.payload, resolver)
  const id = await resolveId(client, slugOrId)
  const res = await client.request(`/notes/${id}`, {
    method: 'PUT',
    body: built.payload,
  })
  emitSuccess(res.data, out)
}

async function materializeForEditor(
  client: ApiClient,
  slugOrId: string,
): Promise<string> {
  const id = await resolveNoteId(client, slugOrId)
  const res = await client.request<{
    id?: string
    title?: string
    slug?: string
    contentFormat?: string
    content?: string
    isPublished?: boolean
    mood?: string
    weather?: string
  }>(`/notes/${id}`, { query: { prefer: 'lexical' } })
  const note: any = res.data
  const inner =
    note.contentFormat === 'lexical' && note.content
      ? serializeFromLexical(JSON.parse(note.content))
      : (note.content ?? '')
  return `<mxnote>
  <meta>
    <title>${esc(note.title ?? '')}</title>
    ${note.slug ? `<slug>${esc(note.slug)}</slug>` : ''}
    <state>${note.isPublished ? 'publish' : 'draft'}</state>
    ${note.mood ? `<mood>${esc(note.mood)}</mood>` : ''}
    ${note.weather ? `<weather>${esc(note.weather)}</weather>` : ''}
  </meta>
  <content>
${inner}
  </content>
</mxnote>
`
}

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
