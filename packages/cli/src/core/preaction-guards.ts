/**
 * Single source of truth for preAction exemptions.
 *
 * Any command registration in bin/mxs.ts (or future Task 4 profile commands)
 * MUST match the names declared here exactly — this is the contract.
 */

/** Parent command names whose entire subtree is exempt from the none_active guard. */
export const PREACTION_EXEMPT_PARENTS: ReadonlySet<string> = new Set([
  'profile',
])

export interface ExemptCommand {
  parent: string
  name: string
}

/**
 * Individual (parent, name) pairs that are exempt regardless of profile state.
 * `auth login` is included unconditionally so a fresh install can bootstrap.
 */
export const PREACTION_EXEMPT_COMMANDS: readonly ExemptCommand[] = [
  { parent: 'auth', name: 'login' },
]

export interface GuardInput {
  profileFlag: string | undefined
  apiUrlFlag: string | undefined
  envProfile: string | undefined
  envApiUrl: string | undefined
  currentProfile: string | null
  parentName: string
  commandName: string
}

/**
 * Top-level command names that are exempt from the profile.none_active guard.
 * Used for commands that should work without a configured server (e.g. `mxs update`).
 */
export const PREACTION_EXEMPT_TOPLEVEL: ReadonlySet<string> = new Set([
  'update',
])

/** Returns true if the command is exempt from the profile.none_active guard. */
export function isPreActionExempt(input: GuardInput): boolean {
  return (
    PREACTION_EXEMPT_PARENTS.has(input.parentName) ||
    input.commandName === 'profile' ||
    PREACTION_EXEMPT_TOPLEVEL.has(input.commandName) ||
    PREACTION_EXEMPT_COMMANDS.some(
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
  if (isPreActionExempt(input)) return false
  return true
}
