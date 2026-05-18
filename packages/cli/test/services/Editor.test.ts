import { promises as fs } from 'node:fs'
import { EventEmitter } from 'node:events'
import os from 'node:os'
import path from 'node:path'

import * as Clack from '@clack/prompts'
import { NodeContext } from '@effect/platform-node'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect, vi } from 'vitest'

import { ValidationFailed } from '../../src/domain/errors'
import { Editor } from '../../src/services/Editor'

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
  text: vi.fn(),
}))

const EditorLive = Editor.Default.pipe(
  // Editor depends on FileSystem from @effect/platform; NodeContext provides it.
  (layer) => layer,
)

describe('Editor — readFileOrStdin', () => {
  it.effect('reads a real file from disk', () =>
    Effect.gen(function* () {
      const dir = yield* Effect.promise(() =>
        fs.mkdtemp(path.join(os.tmpdir(), 'mxs-editor-test-')),
      )
      const file = path.join(dir, 'sample.txt')
      yield* Effect.promise(() => fs.writeFile(file, 'hello\n', 'utf8'))
      const editor = yield* Editor
      const contents = yield* editor.readFileOrStdin(file)
      expect(contents).toBe('hello\n')
      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }))
    }).pipe(Effect.provide(EditorLive), Effect.provide(NodeContext.layer)),
  )

  it.effect('returns ValidationFailed for a missing file', () =>
    Effect.gen(function* () {
      const editor = yield* Editor
      const result = yield* Effect.either(
        editor.readFileOrStdin('/nonexistent/path/that/should/not/exist.txt'),
      )
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(ValidationFailed)
      }
    }).pipe(Effect.provide(EditorLive), Effect.provide(NodeContext.layer)),
  )
})

describe('Editor — service shape', () => {
  it.effect('exposes openEditor / prompt / confirm / readFileOrStdin', () =>
    Effect.gen(function* () {
      const editor = yield* Editor
      expect(typeof editor.openEditor).toBe('function')
      expect(typeof editor.prompt).toBe('function')
      expect(typeof editor.confirm).toBe('function')
      expect(typeof editor.readFileOrStdin).toBe('function')
    }).pipe(Effect.provide(EditorLive), Effect.provide(NodeContext.layer)),
  )

  it.effect('openEditor fails fast when $EDITOR is unset', () =>
    Effect.gen(function* () {
      // Snapshot + clear env vars.
      const prevEditor = process.env.EDITOR
      const prevVisual = process.env.VISUAL
      delete process.env.EDITOR
      delete process.env.VISUAL
      try {
        const editor = yield* Editor
        const result = yield* Effect.either(
          editor.openEditor({ filename: 'x.txt', initialContent: '' }),
        )
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Generic')
        }
      } finally {
        if (prevEditor !== undefined) process.env.EDITOR = prevEditor
        if (prevVisual !== undefined) process.env.VISUAL = prevVisual
      }
    }).pipe(Effect.provide(EditorLive), Effect.provide(NodeContext.layer)),
  )

  it.effect('openEditor round-trips through an explicit editor command', () =>
    Effect.gen(function* () {
      const editor = yield* Editor
      const node = process.execPath
      const script =
        "require('fs').writeFileSync(process.argv[1], 'edited', 'utf8')"
      const result = yield* editor.openEditor({
        filename: 'roundtrip.txt',
        initialContent: 'initial',
        editor: `${JSON.stringify(node)} -e ${JSON.stringify(script)}`,
      })
      expect(result).toBe('edited')
    }).pipe(Effect.provide(EditorLive), Effect.provide(NodeContext.layer)),
  )

  it.effect('openEditor maps a nonzero editor exit to Generic', () =>
    Effect.gen(function* () {
      const editor = yield* Editor
      const result = yield* Effect.either(
        editor.openEditor({
          filename: 'fail.txt',
          initialContent: 'initial',
          editor: `${JSON.stringify(process.execPath)} -e "process.exit(7)"`,
        }),
      )
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('Generic')
        expect(result.left.message).toContain('editor exited with code 7')
      }
    }).pipe(Effect.provide(EditorLive), Effect.provide(NodeContext.layer)),
  )
})

describe('Editor — prompts', () => {
  it.effect('prompt and confirm return clack values', () =>
    Effect.gen(function* () {
      const textSpy = vi.mocked(Clack.text).mockResolvedValue('answer')
      const confirmSpy = vi.mocked(Clack.confirm).mockResolvedValue(true)
      try {
        const editor = yield* Editor
        const answer = yield* editor.prompt('Question', {
          initialValue: 'default',
          placeholder: 'placeholder',
        })
        const ok = yield* editor.confirm('Confirm?', { initialValue: true })
        expect(answer).toBe('answer')
        expect(ok).toBe(true)
        expect(textSpy).toHaveBeenCalledWith({
          message: 'Question',
          initialValue: 'default',
          placeholder: 'placeholder',
        })
        expect(confirmSpy).toHaveBeenCalledWith({
          message: 'Confirm?',
          initialValue: true,
        })
      } finally {
        textSpy.mockReset()
        confirmSpy.mockReset()
      }
    }).pipe(Effect.provide(EditorLive), Effect.provide(NodeContext.layer)),
  )

  it.effect('prompt and confirm map cancellation to Generic', () =>
    Effect.gen(function* () {
      const cancel = Symbol('cancel')
      const isCancelSpy = vi
        .mocked(Clack.isCancel)
        .mockImplementation((value) => value === cancel)
      const textSpy = vi
        .mocked(Clack.text)
        .mockResolvedValue(cancel as unknown as string)
      const confirmSpy = vi
        .mocked(Clack.confirm)
        .mockResolvedValue(cancel as unknown as boolean)
      try {
        const editor = yield* Editor
        const promptResult = yield* Effect.either(editor.prompt('Question'))
        const confirmResult = yield* Effect.either(editor.confirm('Confirm?'))
        expect(promptResult._tag).toBe('Left')
        expect(confirmResult._tag).toBe('Left')
        if (promptResult._tag === 'Left') {
          expect(promptResult.left._tag).toBe('Generic')
        }
        if (confirmResult._tag === 'Left') {
          expect(confirmResult.left._tag).toBe('Generic')
        }
      } finally {
        isCancelSpy.mockReset()
        textSpy.mockReset()
        confirmSpy.mockReset()
      }
    }).pipe(Effect.provide(EditorLive), Effect.provide(NodeContext.layer)),
  )

  it.effect('prompt and confirm map clack rejections to Generic', () =>
    Effect.gen(function* () {
      const textSpy = vi.mocked(Clack.text).mockRejectedValue('text failed')
      const confirmSpy = vi
        .mocked(Clack.confirm)
        .mockRejectedValue(new Error('confirm failed'))
      try {
        const editor = yield* Editor
        const promptResult = yield* Effect.either(editor.prompt('Question'))
        const confirmResult = yield* Effect.either(editor.confirm('Confirm?'))
        expect(promptResult._tag).toBe('Left')
        expect(confirmResult._tag).toBe('Left')
        if (promptResult._tag === 'Left') {
          expect(promptResult.left.message).toBe('text failed')
        }
        if (confirmResult._tag === 'Left') {
          expect(confirmResult.left.message).toBe('confirm failed')
        }
      } finally {
        textSpy.mockReset()
        confirmSpy.mockReset()
      }
    }).pipe(Effect.provide(EditorLive), Effect.provide(NodeContext.layer)),
  )
})

describe('Editor — stdin', () => {
  it.effect('reads from stdin when path is "-"', () =>
    Effect.gen(function* () {
      const fakeStdin = new EventEmitter() as EventEmitter & {
        isPaused: () => boolean
        resume: () => void
      }
      fakeStdin.isPaused = () => true
      fakeStdin.resume = vi.fn(() => {
        queueMicrotask(() => {
          fakeStdin.emit('data', 'hello ')
          fakeStdin.emit('data', Buffer.from('world'))
          fakeStdin.emit('end')
        })
      })
      const descriptor = Object.getOwnPropertyDescriptor(process, 'stdin')
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        value: fakeStdin,
      })
      try {
        const promise = Effect.runPromise(
          Effect.gen(function* () {
            const editor = yield* Editor
            return yield* editor.readFileOrStdin('-')
          }).pipe(Effect.provide(EditorLive), Effect.provide(NodeContext.layer)),
        )
        const result = yield* Effect.promise(() => promise)
        expect(result).toBe('hello world')
        expect(fakeStdin.resume).toHaveBeenCalledOnce()
      } finally {
        if (descriptor) Object.defineProperty(process, 'stdin', descriptor)
      }
    }),
  )
})
