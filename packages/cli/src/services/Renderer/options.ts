import { FiberRef } from 'effect'

export type OutputMode = 'pretty-json' | 'json' | 'readable' | 'llm' | 'xml'

export interface OutputOptions {
  readonly json: boolean
  readonly output: OutputMode
  readonly quiet: boolean
  readonly verbose: boolean
}

export const defaultOutputOptions: OutputOptions = {
  json: false,
  output: 'readable',
  quiet: false,
  verbose: false,
}

// One FiberRef carries the per-run output options. The bin entry sets it once
// at the root after parsing global flags; tests override it per-Effect via
// `Effect.locally(currentOutputOptions, ...)`. Choosing a FiberRef over a
// command-level context parameter keeps every `Api`/`Renderer`/command body
// free of an explicit options argument while still being fully testable.
export const currentOutputOptions =
  FiberRef.unsafeMake<OutputOptions>(defaultOutputOptions)
