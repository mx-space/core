/**
 * Unit-level integration tests for the bin/mxs.ts wiring:
 * - --profile flag validation (profile.invalid_name)
 * - legacy migration runs once in preAction (quiet suppression)
 * - profile flag flows into resolveConfig overrides
 *
 * These tests exercise the logic imported directly rather than via subprocess
 * spawning, which would require a compiled binary. Subprocess gaps are documented.
 */
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEV_DEFAULT_PROFILE_ENV,
  DEV_DEFAULT_PROFILE_NAME,
  shouldUseDevDefaultProfile,
} from '../../src/core/config-store'
import { MxsError, MxsErrorCode } from '../../src/core/errors'
import {
  requiresActiveProfile,
  type GuardInput,
} from '../../src/core/preaction-guards'
import { getCurrentProfile, validateProfileName } from '../../src/core/profile'

// ---------------------------------------------------------------------------
// Helpers / environment isolation
// ---------------------------------------------------------------------------

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-bin-'))
  origXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(async () => {
  if (origXdg === undefined) {
    delete process.env.XDG_CONFIG_HOME
  } else {
    process.env.XDG_CONFIG_HOME = origXdg
  }
  await fs.rm(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function mxsDir(): string {
  return path.join(tmpDir, 'mxs')
}

// ---------------------------------------------------------------------------
// --profile flag: validateProfileName is called at the boundary
// ---------------------------------------------------------------------------

describe('--profile flag validation', () => {
  it('accepts valid profile names', () => {
    expect(() => validateProfileName('default')).not.toThrow()
    expect(() => validateProfileName('my-profile')).not.toThrow()
    expect(() => validateProfileName('prod_01')).not.toThrow()
    expect(() => validateProfileName('a')).not.toThrow()
    expect(() => validateProfileName('a'.repeat(32))).not.toThrow()
  })

  it('rejects uppercase letters', () => {
    expect(() => validateProfileName('Prod')).toThrow(MxsError)
    expect(() => validateProfileName('PROD')).toThrow(MxsError)
  })

  it('rejects names longer than 32 chars', () => {
    expect(() => validateProfileName('a'.repeat(33))).toThrow(MxsError)
  })

  it('rejects empty string', () => {
    expect(() => validateProfileName('')).toThrow(MxsError)
  })

  it('rejects reserved name "current"', () => {
    expect(() => validateProfileName('current')).toThrow(MxsError)
  })

  it('invalid name error matches profile.invalid_name intent', () => {
    // The preAction hook wraps validateProfileName error into profile.invalid_name.
    // Test that wrapping logic produces the correct code.
    let caught: MxsError | undefined
    try {
      validateProfileName('UPPER')
    } catch (err) {
      if (err instanceof MxsError) {
        caught = new MxsError({
          code: MxsErrorCode.ProfileInvalidName,
          message: err.message,
          hint: 'profile name must match ^[a-z0-9_-]{1,32}$ and must not be "current"',
        })
      }
    }
    expect(caught).toBeDefined()
    expect(caught?.code).toBe('profile.invalid_name')
    expect(caught?.hint).toContain('[a-z0-9_-]')
  })
})

// ---------------------------------------------------------------------------
// Legacy migration triggered from preAction
// ---------------------------------------------------------------------------

describe('legacy migration in preAction', () => {
  it('migrates legacy config to profiles/default when present', async () => {
    const dir = mxsDir()
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      path.join(dir, 'config.json'),
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )

    const { runLegacyMigrationIfNeeded } = await import(
      '../../src/core/migration'
    )

    const messages: string[] = []
    const result = await runLegacyMigrationIfNeeded({
      report: (line) => messages.push(line),
      isTTY: false,
    })

    expect(result).not.toBeNull()
    expect(result?.profile).toBe('default')

    const profileConfigPath = path.join(
      dir,
      'profiles',
      'default',
      'config.json',
    )
    const written = JSON.parse(await fs.readFile(profileConfigPath, 'utf8'))
    expect(written.api_url).toBe('https://blog.example.com')

    const currentPath = path.join(dir, 'current')
    const current = (await fs.readFile(currentPath, 'utf8')).trim()
    expect(current).toBe('default')

    expect(messages.some((m) => m.includes("profile 'default'"))).toBe(true)
  })

  it('suppresses migration output when quiet (report: null)', async () => {
    const dir = mxsDir()
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      path.join(dir, 'config.json'),
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )

    const stderrLines: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
      stderrLines.push(String(chunk))
      return true
    })

    const { runLegacyMigrationIfNeeded } = await import(
      '../../src/core/migration'
    )

    await runLegacyMigrationIfNeeded({ report: null, isTTY: false })

    const migrationLine = stderrLines.find((l) =>
      l.includes("profile 'default'"),
    )
    expect(migrationLine).toBeUndefined()
  })

  it('is a no-op when profiles/ dir already exists (no legacy files)', async () => {
    const dir = mxsDir()
    await fs.mkdir(path.join(dir, 'profiles', 'default'), { recursive: true })

    const { runLegacyMigrationIfNeeded } = await import(
      '../../src/core/migration'
    )

    const result = await runLegacyMigrationIfNeeded({ report: null })
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// profile flag flows into StoreOverrides.profile → resolveConfig
// ---------------------------------------------------------------------------

describe('--profile flows into resolveConfig', () => {
  it('resolveConfig uses the profile override from flags', async () => {
    const dir = mxsDir()
    const profileDir = path.join(dir, 'profiles', 'staging')
    await fs.mkdir(profileDir, { recursive: true, mode: 0o700 })
    await fs.writeFile(
      path.join(profileDir, 'config.json'),
      JSON.stringify({ api_url: 'https://staging.example.com' }),
      { mode: 0o644 },
    )
    await fs.writeFile(path.join(dir, 'current'), 'default\n')

    const { resolveConfig } = await import('../../src/core/config-store')

    const resolved = await resolveConfig({ profile: 'staging' })

    expect(resolved.profileName).toBe('staging')
    expect(resolved.apiUrl).toBe('https://staging.example.com')
    expect(resolved.profileExplicit).toBe(true)
  })

  it('profileExplicit is false when profile comes from current file', async () => {
    const dir = mxsDir()
    const profileDir = path.join(dir, 'profiles', 'default')
    await fs.mkdir(profileDir, { recursive: true, mode: 0o700 })
    await fs.writeFile(
      path.join(profileDir, 'config.json'),
      JSON.stringify({ api_url: 'https://blog.example.com' }),
      { mode: 0o644 },
    )
    await fs.writeFile(path.join(dir, 'current'), 'default\n')

    const { resolveConfig } = await import('../../src/core/config-store')

    const resolved = await resolveConfig({})

    expect(resolved.profileName).toBe('default')
    expect(resolved.profileExplicit).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// profile.none_active guard in preAction
// Tests use the real requiresActiveProfile() from core/preaction-guards.ts,
// which is the same function bin/mxs.ts's preAction calls.
// ---------------------------------------------------------------------------

/**
 * Build a GuardInput from the given partial options and run requiresActiveProfile.
 * Returns an MxsError instance (mirroring what preAction would throw) or null.
 */
async function runNoneActiveGuard(opts: {
  profile?: string
  apiUrl?: string
  commandName: string
  parentName: string
}): Promise<MxsError | null> {
  const currentProfile = await getCurrentProfile()
  const effectiveCurrentProfile =
    currentProfile ||
    (shouldUseDevDefaultProfile({
      profileOverride: opts.profile,
      envProfile: process.env.MXS_PROFILE,
      apiUrlOverride: opts.apiUrl,
      envApiUrl: process.env.MXS_API_URL,
      currentProfile,
    })
      ? DEV_DEFAULT_PROFILE_NAME
      : null)
  const throws = requiresActiveProfile({
    profileFlag: opts.profile,
    apiUrlFlag: opts.apiUrl,
    envProfile: process.env.MXS_PROFILE?.trim(),
    envApiUrl: process.env.MXS_API_URL?.trim(),
    currentProfile: effectiveCurrentProfile,
    parentName: opts.parentName,
    commandName: opts.commandName,
  } satisfies GuardInput)

  if (throws) {
    return new MxsError({
      code: MxsErrorCode.ProfileNoneActive,
      message: 'no active mxs profile',
      hint: 'run `mxs profile use <name>` to switch, or `mxs auth login --profile <name>` to create one',
    })
  }
  return null
}

describe('profile.none_active guard', () => {
  let origMxsProfile: string | undefined
  let origMxsApiUrl: string | undefined
  let origDevDefaultProfile: string | undefined

  beforeEach(() => {
    origMxsProfile = process.env.MXS_PROFILE
    origMxsApiUrl = process.env.MXS_API_URL
    origDevDefaultProfile = process.env[DEV_DEFAULT_PROFILE_ENV]
    delete process.env.MXS_PROFILE
    delete process.env.MXS_API_URL
    delete process.env[DEV_DEFAULT_PROFILE_ENV]
  })

  afterEach(() => {
    if (origMxsProfile === undefined) delete process.env.MXS_PROFILE
    else process.env.MXS_PROFILE = origMxsProfile
    if (origMxsApiUrl === undefined) delete process.env.MXS_API_URL
    else process.env.MXS_API_URL = origMxsApiUrl
    if (origDevDefaultProfile === undefined) {
      delete process.env[DEV_DEFAULT_PROFILE_ENV]
    } else {
      process.env[DEV_DEFAULT_PROFILE_ENV] = origDevDefaultProfile
    }
  })

  it('throws profile.none_active when no profile, no env, no URL override on a generic command', async () => {
    // No current file written in tmpDir → getCurrentProfile returns null
    const err = await runNoneActiveGuard({
      commandName: 'list',
      parentName: 'post',
    })
    expect(err).toBeInstanceOf(MxsError)
    expect(err!.code).toBe('profile.none_active')
  })

  it('does not throw when MXS_API_URL is set (URL override bypasses the guard)', async () => {
    process.env.MXS_API_URL = 'https://blog.example.com'
    const err = await runNoneActiveGuard({
      commandName: 'list',
      parentName: 'post',
    })
    expect(err).toBeNull()
  })

  it('does not throw when --api-url flag is set', async () => {
    const err = await runNoneActiveGuard({
      apiUrl: 'https://blog.example.com',
      commandName: 'list',
      parentName: 'post',
    })
    expect(err).toBeNull()
  })

  it('does not throw when MXS_PROFILE env is set', async () => {
    // MXS_PROFILE set → effectiveProfile is truthy (guard passes even if profile
    // dir doesn't exist yet — resolveConfig handles that separately)
    process.env.MXS_PROFILE = 'staging'
    const err = await runNoneActiveGuard({
      commandName: 'list',
      parentName: 'post',
    })
    expect(err).toBeNull()
  })

  it('does not throw when a current profile file exists', async () => {
    // Write a current pointer in tmpDir (XDG_CONFIG_HOME is set in beforeEach)
    const dir = mxsDir()
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'current'), 'default\n', {
      encoding: 'utf8',
    })
    const err = await runNoneActiveGuard({
      commandName: 'list',
      parentName: 'post',
    })
    expect(err).toBeNull()
  })

  it('does not throw when the dev bin enables the virtual local-dev profile', async () => {
    process.env[DEV_DEFAULT_PROFILE_ENV] = '1'
    const err = await runNoneActiveGuard({
      commandName: 'list',
      parentName: 'post',
    })
    expect(err).toBeNull()
  })

  it('does not throw for a profile subcommand (exempted — Task 4)', async () => {
    // TODO: full coverage in Task 4 once `mxs profile use` / `mxs profile ls`
    // are implemented. For now we validate the exemption guard itself.
    const err = await runNoneActiveGuard({
      commandName: 'use',
      parentName: 'profile',
    })
    expect(err).toBeNull()
  })

  it('does not throw for auth login even without --profile (fresh-install bootstrap)', async () => {
    // Spec §3: bare `mxs auth login` on a clean machine must NOT throw
    // profile.none_active — the login command itself creates the default profile.
    const err = await runNoneActiveGuard({
      commandName: 'login',
      parentName: 'auth',
    })
    expect(err).toBeNull()
  })

  it('does not throw for auth login when --profile is explicitly passed', async () => {
    const err = await runNoneActiveGuard({
      commandName: 'login',
      parentName: 'auth',
      profile: 'newprofile',
    })
    expect(err).toBeNull()
  })
})
