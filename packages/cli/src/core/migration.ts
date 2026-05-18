import { promises as fs } from 'node:fs'

import { confirm, isCancel } from '@clack/prompts'

import {
  getLegacyConfigPath,
  getLegacyCredentialsPath,
  stripLegacyConfigFields,
} from './config-store'
import { MxsError, MxsErrorCode } from './errors'
import {
  getProfilesDir,
  setCurrentProfile,
  writeProfileConfig,
  writeProfileCredentials,
} from './profile'

export interface MigrationOptions {
  /** Defaults to process.stdin.isTTY && process.stdout.isTTY. */
  isTTY?: boolean
  /** Injected for tests. Called when TTY + legacy api_url present. Resolves true to set production; may resolve a cancel symbol (Ctrl-C). */
  promptIsProduction?: (apiUrl: string) => Promise<boolean | symbol>
  /** Where to emit status messages. Defaults to process.stderr. Pass `null` to suppress. */
  report?: ((line: string) => void) | null
}

export interface MigrationResult {
  /** The profile name that was created ('default') on a successful migration, or null when only stale-cleanup happened. */
  profile: string | null
  /** Whether the migrated profile was marked production. */
  production: boolean
  /** True if a stale-legacy cleanup happened (profiles/ existed but legacy files were still present). */
  cleanedStaleLegacy: boolean
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p)
    return true
  } catch (err: any) {
    if (err?.code === 'ENOENT') return false
    throw err
  }
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await fs.stat(p)
    return s.isDirectory()
  } catch (err: any) {
    if (err?.code === 'ENOENT') return false
    throw err
  }
}

function emit(report: MigrationOptions['report'], line: string): void {
  if (report === null) return
  if (report !== undefined) {
    report(line)
    return
  }
  process.stderr.write(`${line}\n`)
}

async function tryUnlink(
  p: string,
  report: MigrationOptions['report'],
): Promise<void> {
  try {
    await fs.unlink(p)
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      emit(
        report,
        `mxs: warning: could not remove stale legacy file ${p}: ${(err as Error).message}`,
      )
    }
  }
}

export async function runLegacyMigrationIfNeeded(
  opts?: MigrationOptions,
): Promise<MigrationResult | null> {
  const report = opts?.report

  const legacyConfigPath = getLegacyConfigPath()
  const legacyCredentialsPath = getLegacyCredentialsPath()

  const [hasConfig, hasCreds] = await Promise.all([
    fileExists(legacyConfigPath),
    fileExists(legacyCredentialsPath),
  ])

  // No-op fast path: neither legacy file exists.
  if (!hasConfig && !hasCreds) {
    return null
  }

  const profilesDir = getProfilesDir()
  const profilesDirExists = await dirExists(profilesDir)

  // Stale-cleanup branch: profiles/ exists but legacy files are still present.
  if (profilesDirExists) {
    const toRemove: string[] = []
    if (hasConfig) toRemove.push(legacyConfigPath)
    if (hasCreds) toRemove.push(legacyCredentialsPath)

    for (const p of toRemove) {
      await tryUnlink(p, report)
    }

    emit(
      report,
      `mxs: removed stale legacy config files at ${toRemove.join(', ')}`,
    )

    return { profile: null, production: false, cleanedStaleLegacy: true }
  }

  // Full migration branch.
  let legacyConfig: Record<string, unknown> = {}
  if (hasConfig) {
    try {
      const raw = await fs.readFile(legacyConfigPath, 'utf8')
      legacyConfig = JSON.parse(raw)
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        throw new MxsError({
          code: MxsErrorCode.ConfigMigrationFailed,
          message: `failed to read legacy config at ${legacyConfigPath}: ${(err as Error).message}`,
          cause: err,
        })
      }
    }
  }

  let legacyCredentials: Record<string, unknown> | null = null
  if (hasCreds) {
    try {
      const raw = await fs.readFile(legacyCredentialsPath, 'utf8')
      legacyCredentials = JSON.parse(raw)
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        throw new MxsError({
          code: MxsErrorCode.ConfigMigrationFailed,
          message: `failed to read legacy credentials at ${legacyCredentialsPath}: ${(err as Error).message}`,
          cause: err,
        })
      }
    }
  }

  let production = false
  const tty =
    opts?.isTTY ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)
  const apiUrl =
    typeof legacyConfig.api_url === 'string' ? legacyConfig.api_url : undefined

  if (tty && apiUrl) {
    const answer = opts?.promptIsProduction
      ? await opts.promptIsProduction(apiUrl)
      : await confirm({
          message: `Is "${apiUrl}" a production environment?`,
          initialValue: false,
        })
    production = isCancel(answer) ? false : Boolean(answer)
  }

  // Write profile config. If this fails, do NOT delete legacy files.
  const migratedConfig: Record<string, unknown> = stripLegacyConfigFields(
    legacyConfig,
  ) as Record<string, unknown>
  if (production) {
    migratedConfig.production = true
  } else {
    delete migratedConfig.production
  }

  try {
    await writeProfileConfig('default', migratedConfig as any)
  } catch (err: any) {
    throw new MxsError({
      code: MxsErrorCode.ConfigMigrationFailed,
      message: `failed to write profile config during migration: ${(err as Error).message}`,
      cause: err,
    })
  }

  // Write credentials if they exist.
  if (legacyCredentials !== null) {
    try {
      await writeProfileCredentials('default', legacyCredentials as any)
    } catch (err: any) {
      throw new MxsError({
        code: MxsErrorCode.ConfigMigrationFailed,
        message: `failed to write profile credentials during migration: ${(err as Error).message}`,
        cause: err,
      })
    }
  }

  // Set current profile before deleting legacy files so that if this throws
  // the user can still recover (legacy files are still on disk).
  await setCurrentProfile('default')

  // Delete legacy files. If deletion fails, warn but do not abort.
  if (hasConfig) {
    await tryUnlink(legacyConfigPath, report)
  }
  if (hasCreds) {
    await tryUnlink(legacyCredentialsPath, report)
  }

  emit(report, `mxs: migrated single-profile config to profile 'default'.`)

  return { profile: 'default', production, cleanedStaleLegacy: false }
}
