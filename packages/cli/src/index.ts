// Public surface for `@mx-space/cli`. The v0.3 rewrite is internal: most of
// what we exported in v0.2.x was structural plumbing that has since been
// replaced by Effect services. Downstream consumers that still want to
// programmatically drive the CLI use `run` below; everything else is
// available through the namespaced `domain/`, `services/`, `cli/` exports.

export { run } from './bin/mxs'
export {
  type CliError,
  type CliErrorTag,
  codeForTag,
  defaultMessageFor,
  type ErrorEnvelope,
  exitCodeForError,
  exitCodeForTag,
  tagToCode,
  toErrorEnvelope,
} from './domain/errors'
export {
  defaultGlobalFlags,
  type GlobalFlags,
  parseGlobalFlags,
} from './domain/runtime-flags'
export type { OutputMode, OutputOptions } from './services/Renderer'
