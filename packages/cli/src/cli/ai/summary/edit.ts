import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationJson } from '../../../domain/errors'
import { Ai } from '../../../services/Ai'
import { Editor } from '../../../services/Editor'
import { Renderer } from '../../../services/Renderer'

const recordId = Args.text({ name: 'recordId' })

interface SummaryEnvelope {
  summary: string
}

const formatJson = (value: SummaryEnvelope): string =>
  `${JSON.stringify(value, null, 2)}\n`

const parseEnvelope = (raw: string): SummaryEnvelope => {
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('expected a JSON object')
  }
  const obj = parsed as Record<string, unknown>
  if (typeof obj.summary !== 'string') {
    throw new Error('expected `summary` field of type string')
  }
  return { summary: obj.summary }
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
    const current = unwrapDoc(yield* ai.getSummary(recordId))
    const initial = formatJson({
      summary: typeof current.summary === 'string' ? current.summary : '',
    })
    const next = yield* editor.openEditor({
      filename: `ai-summary-${recordId}.json`,
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
    const res = yield* ai.updateSummary(recordId, parsed)
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('edit an AI summary via $EDITOR'))
