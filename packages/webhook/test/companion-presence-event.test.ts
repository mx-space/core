import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { BusinessEvents } from '../src/event.enum'
import { clearedEvent, snapshotEvent } from './fixtures/companion-presence-event.fixture'

const fixturePath = fileURLToPath(
  new URL('./fixtures/companion-presence-event.fixture.ts', import.meta.url),
)

describe('Companion presence event contract', () => {
  it('uses one public event for snapshot and clear state changes', () => {
    expect(BusinessEvents.COMPANION_PRESENCE_CHANGED).toBe(
      'companion.presence.changed',
    )
    expect([snapshotEvent.type, clearedEvent.type]).toEqual([
      BusinessEvents.COMPANION_PRESENCE_CHANGED,
      BusinessEvents.COMPANION_PRESENCE_CHANGED,
    ])
    expect(snapshotEvent.payload.projection).not.toBeNull()
    expect(clearedEvent.payload.projection).toBeNull()
  })

  it('type-checks EventPayloadMapping and GenericEvent against public state', () => {
    const program = ts.createProgram({
      rootNames: [fixturePath],
      options: {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ES2020,
        types: ['node'],
      },
    })
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .filter(
        (diagnostic) =>
          diagnostic.file &&
          fileURLToPath(new URL(`file://${diagnostic.file.fileName}`)) ===
            fixturePath,
      )

    expect(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      ),
    ).toEqual([])
  })
})
