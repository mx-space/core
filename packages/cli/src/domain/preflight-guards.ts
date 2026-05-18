/**
 * Single source of truth for preflight exemptions (the `@effect/cli`
 * equivalent of the v0.2.x `preAction` hook in `src/bin/mxs.ts`).
 *
 * Any subcommand registered in `cli/*` MUST match the names declared here —
 * this is the contract. Ported from `src/core/preaction-guards.ts`.
 */

/** Parent command names whose entire subtree is exempt from the none_active guard. */
export const PREFLIGHT_EXEMPT_PARENTS: ReadonlySet<string> = new Set([
  'profile',
])

export interface ExemptCommand {
  readonly parent: string
  readonly name: string
}

/**
 * Individual (parent, name) pairs that are exempt regardless of profile state.
 * `auth login` is included unconditionally so a fresh install can bootstrap.
 */
export const PREFLIGHT_EXEMPT_COMMANDS: readonly ExemptCommand[] = [
  { parent: 'auth', name: 'login' },
]

/**
 * Top-level command names that are exempt from the profile.none_active guard.
 * Used for commands that should work without a configured server (e.g. `mxs update`).
 */
export const PREFLIGHT_EXEMPT_TOPLEVEL: ReadonlySet<string> = new Set([
  'update',
])

export interface GuardInput {
  readonly profileFlag: string | undefined
  readonly apiUrlFlag: string | undefined
  readonly envProfile: string | undefined
  readonly envApiUrl: string | undefined
  readonly currentProfile: string | null
  readonly parentName: string
  readonly commandName: string
}

/** Returns true if the command is exempt from the profile.none_active guard. */
export function isPreflightExempt(input: GuardInput): boolean {
  return (
    PREFLIGHT_EXEMPT_PARENTS.has(input.parentName) ||
    input.commandName === 'profile' ||
    PREFLIGHT_EXEMPT_TOPLEVEL.has(input.commandName) ||
    PREFLIGHT_EXEMPT_COMMANDS.some(
      (c) => c.parent === input.parentName && c.name === input.commandName,
    )
  )
}

/**
 * Returns true if the guard should throw profile.none_active.
 * A resolved profile, any URL override, or an exempt command all suppress it.
 */
export function requiresActiveProfile(input: GuardInput): boolean {
  if (input.profileFlag || input.envProfile) return false
  if (input.apiUrlFlag || input.envApiUrl) return false
  if (input.currentProfile) return false
  if (isPreflightExempt(input)) return false
  return true
}

// ---------------------------------------------------------------------------
// argv inspection — derive the (parentName, commandName) being invoked.
// ---------------------------------------------------------------------------

/** Set of valid top-level subcommand names. Used to walk `process.argv`. */
export const TOPLEVEL_COMMANDS: ReadonlySet<string> = new Set([
  'auth',
  'profile',
  'post',
  'note',
  'page',
  'category',
  'topic',
  'config',
  'update',
])

export interface InvokedCommand {
  readonly parentName: string
  readonly commandName: string
}

/**
 * Inspect argv to determine which command is being invoked. Skips known
 * global flags so `mxs --profile foo post list` resolves to (`post`,`list`).
 *
 * Returns an empty pair when no subcommand is on argv (e.g. `mxs --help`).
 */
export function detectInvokedCommand(
  argv: readonly string[],
  knownGlobalFlags: ReadonlySet<string> = DEFAULT_KNOWN_GLOBAL_FLAGS,
): InvokedCommand {
  const positional: string[] = []
  // argv[0] = node, argv[1] = script — skip both.
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--') break
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      const name = eq === -1 ? arg : arg.slice(0, eq)
      if (
        knownGlobalFlags.has(name) &&
        eq === -1 &&
        FLAG_TAKES_VALUE.has(name)
      ) {
        i++ // skip its value
      }
      continue
    }
    if (arg.startsWith('-')) {
      if (arg === '-q') continue
      continue
    }
    positional.push(arg)
  }
  if (positional.length === 0) return { parentName: '', commandName: '' }
  const first = positional[0]
  if (!TOPLEVEL_COMMANDS.has(first))
    return { parentName: '', commandName: first }
  if (positional.length === 1) return { parentName: '', commandName: first }
  return { parentName: first, commandName: positional[1] }
}

/** Known global flag names; used by `detectInvokedCommand` to skip their values. */
export const DEFAULT_KNOWN_GLOBAL_FLAGS: ReadonlySet<string> = new Set([
  '--json',
  '--output',
  '--api-url',
  '--token',
  '--api-key',
  '--lang',
  '--quiet',
  '--verbose',
  '--dry-run',
  '--profile',
  '--help',
  '--version',
])

/** Subset of global flags that take a value. */
const FLAG_TAKES_VALUE: ReadonlySet<string> = new Set([
  '--output',
  '--api-url',
  '--token',
  '--api-key',
  '--lang',
  '--profile',
])
