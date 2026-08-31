import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminDraftEdit } from '../../domain/admin-link'
import { coerceMeta, parseEnvelope } from '../../domain/envelope'
import { ValidationXml } from '../../domain/errors'
import { buildNotePayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Editor } from '../../services/Editor'
import { Lexical } from '../../services/Lexical'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import {
  normalizeData,
  publishSavedDraft,
  saveDraftPayload,
} from '../draft/_shared'
import { noteWriteOptions, resolveTopicRefs, toNoteFlagInputs } from './_flags'

const slugOrId = Args.text({ name: 'slugOrId' })

const esc = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

interface NoteForEditor {
  id?: string
  title?: string
  slug?: string
  contentFormat?: string
  content?: string
  isPublished?: boolean
  mood?: string
  weather?: string
}

const materializeForEditor = (slugOrId: string) =>
  Effect.gen(function* () {
    const api = yield* Api
    const resolver = yield* Resolver
    const lexical = yield* Lexical
    const id = yield* resolver.resolveNoteId(slugOrId)
    const note = normalizeData<NoteForEditor>(
      yield* api.request(`/notes/${id}`, { query: { prefer: 'lexical' } }),
    )
    let inner: string
    if (note.contentFormat === 'lexical' && note.content) {
      const state = JSON.parse(note.content)
      inner = yield* lexical.payloadToLitexml(state)
    } else {
      inner = note.content ?? ''
    }
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
  })

const applyNoteEnvelopeMeta = (
  payload: Record<string, unknown>,
  rawMeta: Record<string, unknown>,
): Record<string, unknown> => {
  const next = { ...payload }
  const meta = coerceMeta(rawMeta)
  if (meta.title !== undefined) next.title = meta.title
  if (meta.slug !== undefined) next.slug = meta.slug
  if (meta.topic !== undefined) next.__topicName = meta.topic
  if (meta.state !== undefined) next.isPublished = meta.state === 'publish'
  if (meta.mood !== undefined) next.mood = meta.mood
  if (meta.weather !== undefined) next.weather = meta.weather
  if (meta.publicAt !== undefined) next.publicAt = meta.publicAt
  if (meta.password !== undefined) next.password = meta.password
  if (meta.bookmark !== undefined) next.bookmark = meta.bookmark
  if (meta.location !== undefined) next.location = meta.location
  return next
}

export const edit = Command.make(
  'edit',
  { slugOrId, ...noteWriteOptions },
  ({ slugOrId, ...rest }) =>
    Effect.gen(function* () {
      const flags = toNoteFlagInputs(rest)
      const api = yield* Api
      const editor = yield* Editor
      const renderer = yield* Renderer
      const resolver = yield* Resolver
      const id = yield* resolver.resolveNoteId(slugOrId)
      const current = normalizeData<NoteForEditor>(
        yield* api.request(`/notes/${id}`),
      )

      if (!flags.file && flags.content === undefined) {
        const xml = yield* materializeForEditor(slugOrId)
        const next = yield* editor.openEditor({
          filename: `note-${slugOrId}.xml`,
          initialContent: xml,
        })
        if (next.trim() === xml.trim()) {
          yield* renderer.emitInfo('no changes')
          return
        }
        const parsed = yield* Effect.try({
          try: () => parseEnvelope(next, 'note'),
          catch: (err) =>
            err instanceof ValidationXml
              ? err
              : new ValidationXml({ message: String(err), cause: err }),
        })
        const built = yield* buildNotePayload({
          ...flags,
          content: parsed.contentXml,
          format: flags.format ?? 'lexical',
        })
        const payload = applyNoteEnvelopeMeta(built.payload, parsed.meta)
        const resolved = yield* resolveTopicRefs(payload)
        const shouldPublish =
          typeof resolved.isPublished === 'boolean'
            ? resolved.isPublished
            : current.isPublished !== false
        delete resolved.isPublished
        const saved = yield* saveDraftPayload(api, 'note', resolved, id)
        const response = shouldPublish
          ? yield* publishSavedDraft(api, saved.draft)
          : saved.response
        yield* renderer.emitSuccess(response)
        if (rest.open && saved.draft.id) {
          yield* openAdminDraftEdit('notes', saved.draft.id, id)
        }
        return
      }

      const built = yield* buildNotePayload(flags)
      const resolved = yield* resolveTopicRefs(built.payload)
      const shouldPublish =
        typeof resolved.isPublished === 'boolean'
          ? resolved.isPublished
          : current.isPublished !== false
      delete resolved.isPublished
      const saved = yield* saveDraftPayload(api, 'note', resolved, id)
      const response = shouldPublish
        ? yield* publishSavedDraft(api, saved.draft)
        : saved.response
      yield* renderer.emitSuccess(response)
      if (rest.open && saved.draft.id) {
        yield* openAdminDraftEdit('notes', saved.draft.id, id)
      }
    }),
).pipe(Command.withDescription('edit a note via $EDITOR or flags'))
