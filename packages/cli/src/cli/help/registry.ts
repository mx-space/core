// ---------------------------------------------------------------------------
// Per-command help registry.
//
// Each top-level command module (auth, post, profile, ..., update) calls
// `registerCommandHelp({...})` at import time to publish its own help
// metadata. The root and group renderers in `./index.ts` consume the
// registry instead of hard-coding the command list in one place.
//
// The registry is a module-level Map keyed by command name. Insertion order
// is preserved, but the canonical display order is decided by
// `COMMAND_ORDER` in `./index.ts` (decoupled from import order).
// ---------------------------------------------------------------------------

export interface VerbDescriptor {
  readonly name: string
  readonly args?: readonly string[]
  readonly description: string
}

export interface LeafOptionHelp {
  readonly flag: string
  readonly description: string
}

export interface CommandHelp {
  readonly name: string
  readonly description: string
  // For groups: the list of verbs and their hand-curated arg summaries. The
  // canonical, exhaustive option list still lives in the per-verb
  // `Command.make(...)` definition and surfaces via
  // `mxs <group> <verb> --help` (rendered by @effect/cli).
  readonly verbs?: readonly VerbDescriptor[]
  // For leaf top-level commands (e.g. `update`): mark as leaf and provide a
  // flag table for the group help renderer.
  readonly isLeaf?: boolean
  readonly leafOptions?: readonly LeafOptionHelp[]
  // Bundled skill chapter slug, if any. Surfaces in `mxs <group> --help` as a
  // pointer for AI agents. Leave undefined when no dedicated chapter exists.
  readonly skillChapter?: string
}

const REGISTRY = new Map<string, CommandHelp>()

/**
 * Register help metadata for a top-level command. Returns the registered
 * entry so callers can reuse `entry.description` for
 * `Command.withDescription(...)` without restating the string.
 */
export const registerCommandHelp = (help: CommandHelp): CommandHelp => {
  REGISTRY.set(help.name, help)
  return help
}

export const getCommandHelp = (name: string): CommandHelp | undefined =>
  REGISTRY.get(name)

export const getAllCommandHelp = (): readonly CommandHelp[] => [
  ...REGISTRY.values(),
]

export const getRegisteredNames = (): readonly string[] => [...REGISTRY.keys()]

export const isRegisteredCommand = (name: string): boolean => REGISTRY.has(name)

export const isLeafCommand = (name: string): boolean =>
  REGISTRY.get(name)?.isLeaf === true
