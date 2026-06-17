import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationJson } from '../../../../domain/errors'
import { Ai, type AiService } from '../../../../services/Ai'
import { Editor } from '../../../../services/Editor'
import { Renderer } from '../../../../services/Renderer'

const recordId = Args.text({ name: 'recordId' })

const formatJson = (value: { translatedText: string }): string =>
  `${JSON.stringify(value, null, 2)}\n`

const parseEnvelope = (raw: string): { translatedText: string } => {
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('expected a JSON object')
  }
  const obj = parsed as Record<string, unknown>
  if (typeof obj.translatedText !== 'string' || !obj.translatedText) {
    throw new Error('expected non-empty `translatedText` string')
  }
  return { translatedText: obj.translatedText }
}

const asRows = (raw: unknown): ReadonlyArray<Record<string, unknown>> => {
  if (Array.isArray(raw))
    return raw.filter(
      (r): r is Record<string, unknown> => !!r && typeof r === 'object',
    )
  if (raw && typeof raw === 'object') {
    const data = (raw as { data?: unknown }).data
    if (Array.isArray(data))
      return data.filter(
        (r): r is Record<string, unknown> => !!r && typeof r === 'object',
      )
  }
  return []
}

const fetchEntry = (
  ai: AiService,
  id: string,
): Effect.Effect<Record<string, unknown> | null> =>
  Effect.gen(function* () {
    const MAX = 20
    for (let page = 1; page <= MAX; page++) {
      const raw = yield* ai
        .listEntries({ page, size: 50 })
        .pipe(Effect.catchAll(() => Effect.succeed<unknown>(null)))
      if (!raw) return null
      const rows = asRows(raw)
      for (const row of rows) {
        if (row.id === id) return row
      }
      if (rows.length < 50) break
    }
    return null
  })

export const edit = Command.make('edit', { recordId }, ({ recordId }) =>
  Effect.gen(function* () {
    const ai = yield* Ai
    const editor = yield* Editor
    const renderer = yield* Renderer
    const found = yield* fetchEntry(ai, recordId)
    const initial = formatJson({
      translatedText:
        typeof found?.translatedText === 'string' ? found.translatedText : '',
    })
    const next = yield* editor.openEditor({
      filename: `ai-entry-${recordId}.json`,
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
    const res = yield* ai.updateEntry(recordId, parsed)
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('edit a translation entry via $EDITOR'))
