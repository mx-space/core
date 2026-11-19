import { fileURLToPath } from 'node:url'

import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { ScriptTarget } from 'tsrs/ast'
import { API, ModuleKind, ModuleResolutionKind } from 'tsrs/sync'

import { BusinessEvents } from '../src/event.enum'
import { clearedEvent, snapshotEvent } from './fixtures/companion-presence-event.fixture'

const fixturePath = fileURLToPath(
  new URL('./fixtures/companion-presence-event.fixture.ts', import.meta.url),
)

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

const api = new API({ cwd: packageRoot })

afterAll(() => {
  api.close()
})

describe('Companion presence event contract', () => {
  it('uses one public event for snapshot and clear state changes', () => {
    expect(BusinessEvents.COMPANION_PRESENCE_CHANGED).toBe(
      'companion_presence.changed',
    )
    expect([snapshotEvent.type, clearedEvent.type]).toEqual([
      BusinessEvents.COMPANION_PRESENCE_CHANGED,
      BusinessEvents.COMPANION_PRESENCE_CHANGED,
    ])
    expect(snapshotEvent.payload.projection).not.toBeNull()
    expect(clearedEvent.payload.projection).toBeNull()
  })

  it('type-checks EventPayloadMapping and GenericEvent against public state', () => {
    const program = api.createProgram([fixturePath], {
      module: ModuleKind.ESNext,
      moduleResolution: ModuleResolutionKind.Bundler,
      skipLibCheck: true,
      strict: true,
      target: ScriptTarget.ES2020,
      types: ['node'],
    })
    const diagnostics = [
      ...program.getSyntacticDiagnostics(fixturePath),
      ...program.getSemanticDiagnostics(fixturePath),
    ].filter(
      (diagnostic) =>
        diagnostic.fileName &&
        path.resolve(diagnostic.fileName) === fixturePath,
    )

    expect(diagnostics.map((diagnostic) => diagnostic.text)).toEqual([])
  })
})
