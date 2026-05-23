import { FiberRef } from 'effect'

import type { OutputMode } from '../services/Renderer'

// ---------------------------------------------------------------------------
// Parsed global flags — derived once at bin startup by walking `process.argv`.
// ---------------------------------------------------------------------------

export interface GlobalFlags {
  readonly json: boolean
  readonly output: OutputMode
  readonly apiUrl?: string
  readonly token?: string
  readonly apiKey?: string
  readonly lang?: string
  readonly quiet: boolean
  readonly verbose: boolean
  readonly dryRun: boolean
  readonly profile?: string
}

export const defaultGlobalFlags: GlobalFlags = {
  json: false,
  output: 'readable',
  quiet: false,
  verbose: false,
  dryRun: false,
}

const VALID_OUTPUT_MODES: ReadonlySet<OutputMode> = new Set<OutputMode>([
  'pretty-json',
  'json',
  'readable',
  'llm',
  'xml',
])

const isOutputMode = (s: string): s is OutputMode =>
  VALID_OUTPUT_MODES.has(s as OutputMode)

/** Long-name flags that take a value (consume the next argv slot if no `=`). */
const VALUE_FLAGS: ReadonlySet<string> = new Set([
  '--output',
  '--api-url',
  '--token',
  '--api-key',
  '--lang',
  '--profile',
])

/** Long-name boolean flags (no value). */
const BOOL_FLAGS: ReadonlySet<string> = new Set([
  '--json',
  '--quiet',
  '--verbose',
  '--dry-run',
])

/** Aliases handled separately because they share the leading dash. */
const SHORT_BOOL_FLAGS: Record<string, keyof GlobalFlags> = {
  '-q': 'quiet',
}

/**
 * Walk `argv` once, extracting recognized global flags and returning both the
 * resolved `GlobalFlags` and the residual `argv` (with those flags removed).
 *
 * Unknown flags pass through untouched — `@effect/cli` will surface them at
 * the proper command layer.
 *
 * Notes:
 *   - Both `--key value` and `--key=value` are supported for value flags.
 *   - argv[0] (node) and argv[1] (script) pass through unchanged.
 *   - We stop processing global flags at the first `--` (POSIX convention).
 */
export const parseGlobalFlags = (
  argv: readonly string[],
): { readonly flags: GlobalFlags; readonly rest: readonly string[] } => {
  const rest: string[] = []
  let json = false
  let output: OutputMode = 'readable'
  let apiUrl: string | undefined
  let token: string | undefined
  let apiKey: string | undefined
  let lang: string | undefined
  let quiet = false
  let verbose = false
  let dryRun = false
  let profile: string | undefined

  // Preserve argv[0] (node) and argv[1] (script).
  if (argv.length > 0) rest.push(argv[0])
  if (argv.length > 1) rest.push(argv[1])

  let passThrough = false
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (passThrough) {
      rest.push(arg)
      continue
    }
    if (arg === '--') {
      passThrough = true
      rest.push(arg)
      continue
    }
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      const name = eqIdx === -1 ? arg : arg.slice(0, eqIdx)
      const inlineValue = eqIdx === -1 ? undefined : arg.slice(eqIdx + 1)

      if (BOOL_FLAGS.has(name)) {
        if (name === '--json') json = true
        else if (name === '--quiet') quiet = true
        else if (name === '--verbose') verbose = true
        else if (name === '--dry-run') dryRun = true
        continue
      }
      if (VALUE_FLAGS.has(name)) {
        const value =
          inlineValue !== undefined
            ? inlineValue
            : i + 1 < argv.length
              ? argv[++i]
              : undefined
        if (value === undefined) continue
        if (name === '--output') {
          if (isOutputMode(value)) output = value
        } else if (name === '--api-url') {
          apiUrl = value
        } else if (name === '--token') {
          token = value
        } else if (name === '--api-key') {
          apiKey = value
        } else if (name === '--lang') {
          lang = value
        } else if (name === '--profile') {
          profile = value
        }
        continue
      }
      // Unknown long flag → pass through.
      rest.push(arg)
      continue
    }
    // Short flags.
    if (arg.startsWith('-') && arg.length > 1 && !arg.startsWith('--')) {
      const target = SHORT_BOOL_FLAGS[arg]
      if (target === 'quiet') {
        quiet = true
        continue
      }
      rest.push(arg)
      continue
    }
    rest.push(arg)
  }

  return {
    flags: {
      json,
      output: json ? 'json' : output,
      apiUrl,
      token,
      apiKey,
      lang,
      quiet,
      verbose,
      dryRun,
      profile,
    },
    rest,
  }
}

// ---------------------------------------------------------------------------
// FiberRef: --dry-run. Read by `Api.layer({...})` at construction time;
// surfaced as a FiberRef as well so individual handlers can introspect when
// they need bespoke dry-run behaviour (none today; placeholder for v2/v3).
// ---------------------------------------------------------------------------

export const currentDryRun: FiberRef.FiberRef<boolean> =
  FiberRef.unsafeMake<boolean>(false)

// ---------------------------------------------------------------------------
// FiberRef: --profile. The flag is already threaded into `Api.layer` via
// `StoreOverrides`, but commands that talk to the Profile/Config services
// directly (notably `auth login`, which creates profiles) need to read it
// without re-parsing argv. Set once in `bin/mxs.ts` after `parseGlobalFlags`.
// ---------------------------------------------------------------------------

export const currentProfileFlag: FiberRef.FiberRef<string | undefined> =
  FiberRef.unsafeMake<string | undefined>(undefined)
