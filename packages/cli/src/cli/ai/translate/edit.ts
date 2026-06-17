import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationJson } from '../../../domain/errors'
import { Ai, type AiTranslationPatch } from '../../../services/Ai'
import { Editor } from '../../../services/Editor'
import { Renderer } from '../../../services/Renderer'

const recordId = Args.text({ name: 'recordId' })

const PATCH_KEYS = [
  'title',
  'text',
  'subtitle',
  'summary',
  'tags',
  'content',
] as const

const editableFieldsOf = (
  doc: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const key of PATCH_KEYS) {
    if (doc[key] !== undefined) out[key] = doc[key]
  }
  return out
}

const formatJson = (value: Record<string, unknown>): string =>
  `${JSON.stringify(value, null, 2)}\n`

const parseEnvelope = (raw: string): AiTranslationPatch => {
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('expected a JSON object')
  }
  const obj = parsed as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  if ('title' in obj) {
    if (typeof obj.title !== 'string') throw new Error('title must be a string')
    patch.title = obj.title
  }
  if ('text' in obj) {
    if (typeof obj.text !== 'string') throw new Error('text must be a string')
    patch.text = obj.text
  }
  if ('subtitle' in obj) {
    if (obj.subtitle !== null && typeof obj.subtitle !== 'string')
      throw new Error('subtitle must be a string or null')
    patch.subtitle = obj.subtitle
  }
  if ('summary' in obj) {
    if (typeof obj.summary !== 'string')
      throw new Error('summary must be a string')
    patch.summary = obj.summary
  }
  if ('tags' in obj) {
    if (
      !Array.isArray(obj.tags) ||
      !obj.tags.every((t) => typeof t === 'string')
    )
      throw new Error('tags must be an array of strings')
    patch.tags = obj.tags
  }
  if ('content' in obj) {
    if (typeof obj.content !== 'string')
      throw new Error('content must be a string')
    patch.content = obj.content
  }
  return patch as AiTranslationPatch
}

const unwrapDoc = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
    return r.data as Record<string, unknown>
  }
  return r
}

export const edit = Command.make('edit', { recordId }, ({ recordId }) =>
  Effect.gen(function* () {
    const ai = yield* Ai
    const editor = yield* Editor
    const renderer = yield* Renderer
    const current = unwrapDoc(yield* ai.getTranslation(recordId))
    const initial = formatJson(editableFieldsOf(current))
    const next = yield* editor.openEditor({
      filename: `ai-translation-${recordId}.json`,
      initialContent: initial,
    })
    if (next.trim() === initial.trim()) {
      yield* renderer.emitInfo('no changes')
      return
    }
    const parsed = yield* Effect.try({
      try: () => parseEnvelope(next),
      catch: (err) =>
        new ValidationJson({
          message: err instanceof Error ? err.message : String(err),
          cause: err,
        }),
    })
    const res = yield* ai.updateTranslation(recordId, parsed)
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('edit an AI translation via $EDITOR'))
