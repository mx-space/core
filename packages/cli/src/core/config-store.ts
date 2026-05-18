import { promises as fs } from 'node:fs'
import path from 'node:path'

import { getConfigDir } from './config-dir'
import { MxsError, MxsErrorCode } from './errors'
import {
  getCurrentProfile,
  getProfileConfigPath,
  getProfileCredentialsPath,
  getProfileDir,
  readProfileConfig,
  readProfileCredentials,
} from './profile'

export { getConfigDir }

export interface ConfigShape {
  api_url?: string
  api_version?: number
  production?: boolean
}

export interface CredentialsShape {
  access_token: string
  refresh_token?: string
  expires_at: number
  user?: {
    id?: string
    email?: string
    name?: string
  }
}

export interface ResolvedConfig {
  apiUrl: string
  apiBase: string
  authBase: string
  apiVersion: number
  clientId: string
  token?: string
  apiKey?: string
  configPath: string
  credentialsPath: string
  profileName: string | null
  isProduction: boolean
  profileExplicit: boolean
  urlOverridden: boolean
}

export interface StoreOverrides {
  apiUrl?: string
  token?: string
  apiKey?: string
  profile?: string
}

export const DEFAULT_CLIENT_ID = 'mxs-cli'

/** Legacy fields written by older mxs versions; ignored on read and never written back. */
export const LEGACY_CONFIG_FIELDS = [
  'api_base',
  'auth_base',
  'client_id',
] as const

export function stripLegacyConfigFields(
  cfg: Record<string, unknown>,
): ConfigShape {
  const out: Record<string, unknown> = { ...cfg }
  for (const k of LEGACY_CONFIG_FIELDS) delete out[k]
  return out as ConfigShape
}

export const DEV_DEFAULT_PROFILE_ENV = 'MXS_CLI_DEV_DEFAULT_PROFILE'
export const DEV_DEFAULT_API_URL_ENV = 'MXS_CLI_DEV_API_URL'
export const DEV_DEFAULT_PROFILE_NAME = 'local-dev'
export const DEV_DEFAULT_API_URL = 'http://localhost:2333'

export interface DevDefaultProfileInput {
  profileOverride?: string
  envProfile?: string
  apiUrlOverride?: string
  envApiUrl?: string
  currentProfile?: string | null
}

export function isDevDefaultProfileEnabled(): boolean {
  return process.env[DEV_DEFAULT_PROFILE_ENV] === '1'
}

export function getDevDefaultApiUrl(): string {
  return process.env[DEV_DEFAULT_API_URL_ENV]?.trim() || DEV_DEFAULT_API_URL
}

export function shouldUseDevDefaultProfile(
  input: DevDefaultProfileInput,
): boolean {
  return (
    isDevDefaultProfileEnabled() &&
    !input.profileOverride?.trim() &&
    !input.envProfile?.trim() &&
    !input.apiUrlOverride?.trim() &&
    !input.envApiUrl?.trim()
  )
}

function buildDevDefaultProfileConfig(): ConfigShape {
  const { baseUrl } = parseApiUrl(getDevDefaultApiUrl())
  return {
    api_url: baseUrl,
    api_version: 2,
    production: false,
  }
}

export function getLegacyConfigPath(): string {
  return path.join(getConfigDir(), 'config.json')
}

export function getLegacyCredentialsPath(): string {
  return path.join(getConfigDir(), 'credentials.json')
}

/** @deprecated Use getLegacyConfigPath for migration logic only */
export function getConfigPath(): string {
  return getLegacyConfigPath()
}

/** @deprecated Use getLegacyCredentialsPath for migration logic only */
export function getCredentialsPath(): string {
  return getLegacyCredentialsPath()
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

export async function readConfig(): Promise<ConfigShape> {
  const data = await readJsonIfExists<ConfigShape>(getLegacyConfigPath())
  return data ?? {}
}

export async function writeConfig(cfg: ConfigShape): Promise<void> {
  const dir = getConfigDir()
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(getLegacyConfigPath(), JSON.stringify(cfg, null, 2), {
    mode: 0o644,
  })
  try {
    await fs.chmod(getLegacyConfigPath(), 0o644)
  } catch {}
}

/**
 * @deprecated Read from profile credentials via `readProfileCredentials` in core/profile.ts.
 * Kept for the legacy migration read path and api-client auto-refresh; remove after full profile migration.
 */
export async function readCredentials(): Promise<CredentialsShape | null> {
  const p = getLegacyCredentialsPath()
  const data = await readJsonIfExists<CredentialsShape>(p)
  if (data) {
    await enforceCredentialsMode(p)
  }
  return data
}

/**
 * @deprecated Write to profile credentials via `writeProfileCredentials` in core/profile.ts.
 * Kept for the legacy migration read path and api-client auto-refresh; remove after full profile migration.
 */
export async function writeCredentials(cred: CredentialsShape): Promise<void> {
  const dir = getConfigDir()
  await fs.mkdir(dir, { recursive: true })
  const p = getLegacyCredentialsPath()
  await fs.writeFile(p, JSON.stringify(cred, null, 2), { mode: 0o600 })
  await fs.chmod(p, 0o600)
}

/**
 * @deprecated Use `deleteProfileCredentials` in core/profile.ts for profile-aware logout.
 * Kept only for Task 2 migration's read path; remove after full profile migration.
 */
export async function deleteCredentials(): Promise<void> {
  const p = getLegacyCredentialsPath()
  try {
    await fs.unlink(p)
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err
  }
}

export async function enforceCredentialsMode(
  p = getLegacyCredentialsPath(),
): Promise<boolean> {
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

export interface ParsedApiUrl {
  /** Bare origin (or origin+path) with any trailing `/api/v\d+` stripped. */
  baseUrl: string
  /** Version extracted from a stripped `/api/v\d+` suffix, if present. */
  apiVersion?: number
}

/**
 * Parse a user-supplied API URL into the bare base + optional API version.
 *
 * Older mxs versions wrote `${baseUrl}/api/v\d+` directly into `api_url`,
 * which doubles up when `resolveConfig` re-appends the prefix. Stripping
 * the suffix on read makes polluted configs self-heal: the bare URL falls
 * through to `apiUrl`, and `apiVersion` is back-filled from the path.
 */
export function parseApiUrl(input: string): ParsedApiUrl {
  let url = input.trim()
  if (!url) {
    throw new MxsError({
      code: MxsErrorCode.ConfigMissingApiUrl,
      message: 'API URL is empty',
    })
  }
  if (!/^https?:\/\//i.test(url)) {
    const isLocal = /^(?:localhost|127\.0\.0\.1|::1)(?::\d+)?$/i.test(url)
    url = isLocal ? `http://${url}` : `https://${url}`
  }
  url = url.replace(/\/+$/, '')
  const match = url.match(/^(.*)\/api\/v(\d+)$/)
  if (match) {
    return { baseUrl: match[1], apiVersion: Number(match[2]) }
  }
  return { baseUrl: url }
}

export function normalizeApiUrl(input: string): string {
  return parseApiUrl(input).baseUrl
}

export async function resolveConfig(
  overrides: StoreOverrides = {},
): Promise<ResolvedConfig> {
  const envApiUrl = process.env.MXS_API_URL?.trim()
  const envToken = process.env.MXS_TOKEN?.trim()
  const envApiKey = process.env.MXS_API_KEY?.trim()
  const envProfile = process.env.MXS_PROFILE?.trim()

  const urlOverridden = Boolean(overrides.apiUrl || envApiUrl)
  const profileExplicit = Boolean(overrides.profile || envProfile)
  const currentProfile = await getCurrentProfile()
  const useDevDefaultProfile = shouldUseDevDefaultProfile({
    profileOverride: overrides.profile,
    envProfile,
    apiUrlOverride: overrides.apiUrl,
    envApiUrl,
    currentProfile,
  })

  const profileName: string | null =
    overrides.profile?.trim() ||
    envProfile ||
    (useDevDefaultProfile ? DEV_DEFAULT_PROFILE_NAME : null) ||
    currentProfile ||
    null
  const useDevLocalEndpoint =
    isDevDefaultProfileEnabled() &&
    !urlOverridden &&
    profileName === DEV_DEFAULT_PROFILE_NAME

  if (profileName && !urlOverridden && !useDevDefaultProfile) {
    try {
      const stat = await fs.stat(getProfileDir(profileName))
      if (!stat.isDirectory()) {
        throw new MxsError({
          code: MxsErrorCode.ProfileNotFound,
          message: `profile '${profileName}' does not exist`,
          hint: 'run `mxs profile ls` to see configured profiles, or `mxs auth login --profile <name>` to create one',
        })
      }
    } catch (err: any) {
      if (err instanceof MxsError) throw err
      if (err?.code === 'ENOENT') {
        throw new MxsError({
          code: MxsErrorCode.ProfileNotFound,
          message: `profile '${profileName}' does not exist`,
          hint: 'run `mxs profile ls` to see configured profiles, or `mxs auth login --profile <name>` to create one',
        })
      }
      throw err
    }
  }

  let profileConfig: ConfigShape = {}
  if (useDevDefaultProfile) {
    profileConfig = buildDevDefaultProfileConfig()
  } else if (profileName) {
    profileConfig = await readProfileConfig(profileName)
  }

  const rawApiUrl = overrides.apiUrl || envApiUrl || profileConfig.api_url
  if (!rawApiUrl) {
    throw new MxsError({
      code: MxsErrorCode.ConfigMissingApiUrl,
      message: 'API URL is not configured',
      hint: 'set MXS_API_URL or pass --api-url <url>, or run `mxs auth login` in an interactive shell',
    })
  }
  const parsed = parseApiUrl(rawApiUrl)
  const apiUrl = parsed.baseUrl
  const apiVersion = profileConfig.api_version ?? parsed.apiVersion ?? 2
  const apiBase = useDevLocalEndpoint ? apiUrl : `${apiUrl}/api/v${apiVersion}`
  const authBase = useDevLocalEndpoint ? `${apiUrl}/auth` : `${apiBase}/auth`

  let token: string | undefined
  if (urlOverridden) {
    token = overrides.token || envToken || undefined
  } else {
    let profileCreds: Awaited<ReturnType<typeof readProfileCredentials>> = null
    if (profileName) {
      profileCreds = await readProfileCredentials(profileName)
    }
    token = overrides.token || envToken || profileCreds?.access_token
  }

  const apiKey = overrides.apiKey || envApiKey

  const isProduction = urlOverridden
    ? false
    : profileName
      ? Boolean(profileConfig.production)
      : false

  return {
    apiUrl,
    apiBase,
    authBase,
    apiVersion,
    clientId: DEFAULT_CLIENT_ID,
    token,
    apiKey,
    configPath: profileName
      ? getProfileConfigPath(profileName)
      : getLegacyConfigPath(),
    credentialsPath: profileName
      ? getProfileCredentialsPath(profileName)
      : getLegacyCredentialsPath(),
    profileName,
    isProduction,
    profileExplicit,
    urlOverridden,
  }
}
