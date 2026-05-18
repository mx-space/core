import { Effect, FiberRef } from 'effect'

import { isColorEnabled, renderMarkdownToAnsi } from '../../cli/render'
import type { CliError } from '../../domain/errors'
import { emitErrorSync } from './errors'
import { renderReadableGeneric } from './lists'
import {
  currentOutputOptions,
  type OutputMode,
  type OutputOptions,
} from './options'
import { color, writeStderr, writeStdout } from './primitives'
import type { View, ViewCtx } from './view'

export interface RendererService {
  /** Active output configuration in the current fiber. */
  readonly options: Effect.Effect<OutputOptions>
  /** Typed view dispatch — primary path. */
  readonly emit: <T>(view: View<T>, data: T) => Effect.Effect<void>
  /** Generic success payload for ad-hoc data (mutation responses, etc.). */
  readonly emitSuccess: (data: unknown) => Effect.Effect<void>
  /** Info line on stderr (suppressed by `--quiet` / `--json`). */
  readonly emitInfo: (message: string) => Effect.Effect<void>
  /** Warning line on stderr (suppressed by `--json`). */
  readonly emitWarn: (message: string) => Effect.Effect<void>
  /** Error envelope or pretty error to stderr/stdout per output mode. */
  readonly emitError: (err: CliError) => Effect.Effect<void>
  /**
   * Emit a bespoke ANSI/text view (ad-hoc, no schema — banners). In `--json`
   * mode the function is never called — `data` is wrapped as a JSON envelope.
   */
  readonly emitView: (
    data: unknown,
    view: (ctx: { readonly color: boolean }) => string,
  ) => Effect.Effect<void>
  /** Convenience for `emitView` whose body is a markdown source string. */
  readonly emitMarkdown: (
    data: unknown,
    markdown: () => string,
  ) => Effect.Effect<void>
  /**
   * Multi-line info block on stderr. Honours `--quiet` / `--json` like
   * `emitInfo`; useful for boxed banners (device-code, etc.).
   */
  readonly emitInfoBlock: (
    block: (ctx: { readonly color: boolean }) => string,
  ) => Effect.Effect<void>
}

export const makeService = (): RendererService => {
  const getOpts: Effect.Effect<OutputOptions> =
    FiberRef.get(currentOutputOptions)

  const emitSuccessSync = (data: unknown, opts: OutputOptions): void => {
    if (opts.json || opts.output === 'json') {
      writeStdout(`${JSON.stringify({ ok: true, data })}\n`)
      return
    }
    if (data === null || data === undefined) return
    if (typeof data === 'string') {
      writeStdout(`${data}\n`)
      return
    }
    if (opts.output === 'readable') {
      const rendered = renderReadableGeneric(data)
      if (rendered) writeStdout(`${rendered}\n`)
      return
    }
    writeStdout(`${JSON.stringify(data, null, 2)}\n`)
  }

  return {
    options: getOpts,

    emit: <T>(view: View<T>, data: T) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => {
          // JSON family bypasses the view entirely — kind-agnostic envelope.
          if (opts.json || opts.output === 'json') {
            writeStdout(`${JSON.stringify({ ok: true, data })}\n`)
            return
          }
          if (opts.output === 'pretty-json') {
            writeStdout(`${JSON.stringify(data, null, 2)}\n`)
            return
          }
          const mode: OutputMode = opts.output
          if (!view.modes.has(mode)) {
            writeStderr(
              `${color(process.stderr, 31, '✘')} unsupported --output value for ${view.kind}: ${mode}\n`,
            )
            return
          }
          let text: string
          if (mode === 'xml' && view.xml) {
            text = view.xml(data)
          } else if (mode === 'llm' && view.llm) {
            text = view.llm(data)
          } else if (mode === 'llm') {
            // Fallback: render readable with color disabled — strips all ANSI.
            const ctx: ViewCtx = { color: false, verbose: opts.verbose }
            text = view.readable(data, ctx)
          } else {
            const ctx: ViewCtx = {
              color: isColorEnabled(process.stdout),
              verbose: opts.verbose,
            }
            text = view.readable(data, ctx)
          }
          writeStdout(`${text}\n`)
        }),
      ),

    emitSuccess: (data) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => emitSuccessSync(data, opts)),
      ),

    emitInfo: (message) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => {
          if (opts.quiet || opts.json) return
          writeStderr(`${message}\n`)
        }),
      ),

    emitWarn: (message) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => {
          if (opts.json) return
          writeStderr(`${color(process.stderr, 33, 'warn')}: ${message}\n`)
        }),
      ),

    emitError: (err) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => emitErrorSync(err, opts)),
      ),

    emitView: (data, view) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => {
          if (opts.json || opts.output === 'json') {
            writeStdout(`${JSON.stringify({ ok: true, data })}\n`)
            return
          }
          if (opts.output === 'pretty-json') {
            if (data !== null && data !== undefined) {
              writeStdout(`${JSON.stringify(data, null, 2)}\n`)
            }
            return
          }
          if (data === null || data === undefined) return
          const color = isColorEnabled(process.stdout)
          const text = view({ color })
          if (text) writeStdout(`${text}\n`)
        }),
      ),

    emitMarkdown: (data, markdown) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => {
          if (opts.json || opts.output === 'json') {
            writeStdout(`${JSON.stringify({ ok: true, data })}\n`)
            return
          }
          if (opts.output === 'pretty-json') {
            if (data !== null && data !== undefined) {
              writeStdout(`${JSON.stringify(data, null, 2)}\n`)
            }
            return
          }
          if (data === null || data === undefined) return
          const color = isColorEnabled(process.stdout)
          const text = renderMarkdownToAnsi(markdown(), { color })
          if (text) writeStdout(`${text}\n`)
        }),
      ),

    emitInfoBlock: (block) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => {
          if (opts.quiet || opts.json) return
          const color = isColorEnabled(process.stderr)
          const text = block({ color })
          if (text) writeStderr(`${text}\n`)
        }),
      ),
  }
}
