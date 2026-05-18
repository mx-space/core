import { type Dirent, promises as fs } from 'node:fs'
import path from 'node:path'

import { getConfigDir } from './config-dir'
import {
  type ConfigShape,
  type CredentialsShape,
  stripLegacyConfigFields,
} from './config-store'
import { MxsError, MxsErrorCode } from './errors'

export { getConfigDir }

export const PROFILE_NAME_RE = /^[\d_a-z-]{1,32}$/

export const RESERVED_PROFILE_NAMES = new Set(['current'])

export function validateProfileName(name: string): void {
  if (!name || name.length === 0) {
    throw new MxsError({
      code: MxsErrorCode.ValidationFailed,
      message: 'profile name must not be empty',
    })
  }
  if (RESERVED_PROFILE_NAMES.has(name)) {
    throw new MxsError({
      code: MxsErrorCode.ValidationFailed,
      message: `profile name '${name}' is reserved`,
    })
  }
  if (!PROFILE_NAME_RE.test(name)) {
    throw new MxsError({
      code: MxsErrorCode.ValidationFailed,
      message: `profile name '${name}' is invalid; must match ^[a-z0-9_-]{1,32}$`,
    })
  }
}

export function getProfilesDir(): string {
  return path.join(getConfigDir(), 'profiles')
}

export function getCurrentPath(): string {
  return path.join(getConfigDir(), 'current')
}

export function getProfileDir(name: string): string {
  return path.join(getProfilesDir(), name)
}

export function getProfileConfigPath(name: string): string {
  return path.join(getProfileDir(name), 'config.json')
}

export function getProfileCredentialsPath(name: string): string {
  return path.join(getProfileDir(name), 'credentials.json')
}

export async function listProfiles(): Promise<string[]> {
  const dir = getProfilesDir()
  let entries: Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (err: any) {
    if (err?.code === 'ENOENT') return []
    throw err
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
}

export async function getCurrentProfile(): Promise<string | null> {
  const p = getCurrentPath()
  try {
    const raw = await fs.readFile(p, 'utf8')
    const name = raw.trim()
    return name.length > 0 ? name : null
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null
    throw err
  }
}

export async function setCurrentProfile(name: string): Promise<void> {
  validateProfileName(name)
  const dir = getProfileDir(name)
  try {
    const stat = await fs.stat(dir)
    if (!stat.isDirectory()) {
      throw new MxsError({
        code: MxsErrorCode.ValidationFailed,
        message: `profile '${name}' does not exist`,
      })
    }
  } catch (err: any) {
    if (err instanceof MxsError) throw err
    if (err?.code === 'ENOENT') {
      throw new MxsError({
        code: MxsErrorCode.ValidationFailed,
        message: `profile '${name}' does not exist`,
      })
    }
    throw err
  }
  await fs.writeFile(getCurrentPath(), `${name}\n`, { encoding: 'utf8' })
}

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, 'utf8')
    return JSON.parse(raw) as T
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null
    if (err instanceof SyntaxError) {
      throw new MxsError({
        code: MxsErrorCode.Generic,
        message: `failed to parse ${p}: ${err.message}`,
      })
    }
    throw err
  }
}

async function ensureProfileDir(name: string): Promise<void> {
  const dir = getProfileDir(name)
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  try {
    await fs.chmod(dir, 0o700)
  } catch {}
}

export type ProfileConfigShape = ConfigShape
export type ProfileCredentialsShape = CredentialsShape

export async function readProfileConfig(
  name: string,
): Promise<ProfileConfigShape> {
  const data = await readJsonIfExists<Record<string, unknown>>(
    getProfileConfigPath(name),
  )
  return stripLegacyConfigFields(data ?? {})
}

export async function writeProfileConfig(
  name: string,
  cfg: ProfileConfigShape,
): Promise<void> {
  await ensureProfileDir(name)
  const p = getProfileConfigPath(name)
  await fs.writeFile(p, JSON.stringify(cfg, null, 2), { mode: 0o644 })
  try {
    await fs.chmod(p, 0o644)
  } catch {}
}

export async function readProfileCredentials(
  name: string,
): Promise<ProfileCredentialsShape | null> {
  const p = getProfileCredentialsPath(name)
  const data = await readJsonIfExists<ProfileCredentialsShape>(p)
  if (data) {
    await enforceProfileCredentialsMode(p)
  }
  return data
}

export async function writeProfileCredentials(
  name: string,
  creds: ProfileCredentialsShape,
): Promise<void> {
  await ensureProfileDir(name)
  const p = getProfileCredentialsPath(name)
  await fs.writeFile(p, JSON.stringify(creds, null, 2), { mode: 0o600 })
  await fs.chmod(p, 0o600)
}

export async function deleteProfileCredentials(name: string): Promise<void> {
  const p = getProfileCredentialsPath(name)
  try {
    await fs.unlink(p)
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err
  }
}

export async function removeProfile(name: string): Promise<void> {
  const dir = getProfileDir(name)
  try {
    await fs.stat(dir)
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      throw new MxsError({
        code: MxsErrorCode.ResourceNotFound,
        message: `profile '${name}' does not exist`,
      })
    }
    throw err
  }
  await fs.rm(dir, { recursive: true, force: true })
}

async function enforceProfileCredentialsMode(p: string): Promise<boolean> {
  let stats
  try {
    stats = await fs.stat(p)
  } catch (err: any) {
    if (err?.code === 'ENOENT') return false
    throw err
  }
  const mode = stats.mode & 0o777
  if (mode !== 0o600) {
    process.stderr.write(
      `mxs: credentials file ${p} had mode ${mode.toString(8)}; chmod 600\n`,
    )
    await fs.chmod(p, 0o600)
    return true
  }
  return false
}
