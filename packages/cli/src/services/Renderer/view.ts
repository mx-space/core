import type { OutputMode } from './options'

export interface ViewCtx {
  readonly color: boolean
  /** Reserved for per-view verbosity toggles (e.g. `whoami --verbose`). */
  readonly verbose: boolean
}

export interface View<T> {
  /** Human-readable kind label used only in error messages. Not a lookup key. */
  readonly kind: string
  /** Modes this view supports. `json` / `pretty-json` are always supported by the service. */
  readonly modes: ReadonlySet<OutputMode>
  readonly readable: (data: T, ctx: ViewCtx) => string
  /** Optional. Missing llm falls back to readable with color disabled. */
  readonly llm?: (data: T) => string
  readonly xml?: (data: T) => string
}
