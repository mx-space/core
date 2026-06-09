import { Args, Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminEdit } from '../../domain/admin-link'
import { ValidationJson } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Editor } from '../../services/Editor'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import { editableFieldsOf } from './_flags'

const nameOrId = Args.text({ name: 'nameOrId' })
const openFlag = Options.boolean('open').pipe(
  Options.withDescription(
    'After success, open the admin edit page in the default browser.',
  ),
)
const silentFlag = Options.boolean('silent').pipe(
  Options.withDescription(
    'On success, emit a minimal `ok` instead of the full server response.',
  ),
)

const unwrapDoc = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
    return r.data as Record<string, unknown>
  }
  return r
}

const formatJson = (value: Record<string, unknown>): string =>
  `${JSON.stringify(value, null, 2)}\n`

const parseEnvelope = (raw: string): Record<string, unknown> => {
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('expected a JSON object')
  }
  return parsed as Record<string, unknown>
}

export const edit = Command.make(
  'edit',
  { nameOrId, open: openFlag, silent: silentFlag },
  ({ nameOrId, open, silent }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const editor = yield* Editor
      const renderer = yield* Renderer
      const resolver = yield* Resolver
      const id = yield* resolver.resolveProjectId(nameOrId)
      const current = unwrapDoc(yield* api.request(`/projects/${id}`))
      const initial = formatJson(editableFieldsOf(current))
      const next = yield* editor.openEditor({
        filename: `project-${id}.json`,
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
      const res = yield* api.request(`/projects/${id}`, {
        method: 'PATCH',
        body: parsed,
      })
      yield* resolver.invalidate('project')
      yield* renderer.emitSuccess(silent ? { ok: true } : res)
      if (open) yield* openAdminEdit('projects', id)
    }),
).pipe(Command.withDescription('edit a project via $EDITOR (JSON envelope)'))
