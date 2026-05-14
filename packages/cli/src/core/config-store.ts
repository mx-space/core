import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { MxsError } from './errors'

export interface ConfigShape {
  api_url?: string
  api_base?: string
  auth_base?: string
  api_version?: number
  client_id?: string
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
  configPath: string
  credentialsPath: string
}

export interface StoreOverrides {
  apiUrl?: string
  token?: string
}

const DEFAULT_CLIENT_ID = 'mxs-cli'

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME
  const base = xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), '.config')
  return path.join(base, 'mxs')
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json')
}

export function getCredentialsPath(): string {
  return path.join(getConfigDir(), 'credentials.json')
}

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, 'utf8')
    return JSON.parse(raw) as T
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null
    if (err instanceof SyntaxError) {
      throw new MxsError({
        code: 'generic',
        message: `failed to parse ${p}: ${err.message}`,
      })
    }
    throw err
  }
}

export async function readConfig(): Promise<ConfigShape> {
  const data = await readJsonIfExists<ConfigShape>(getConfigPath())
  return data ?? {}
}

export async function writeConfig(cfg: ConfigShape): Promise<void> {
  const dir = getConfigDir()
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(getConfigPath(), JSON.stringify(cfg, null, 2), {
    mode: 0o644,
  })
  try {
    await fs.chmod(getConfigPath(), 0o644)
  } catch {}
}

export async function readCredentials(): Promise<CredentialsShape | null> {
  const p = getCredentialsPath()
  const data = await readJsonIfExists<CredentialsShape>(p)
  if (data) {
    await enforceCredentialsMode(p)
  }
  return data
}

export async function writeCredentials(cred: CredentialsShape): Promise<void> {
  const dir = getConfigDir()
  await fs.mkdir(dir, { recursive: true })
  const p = getCredentialsPath()
  await fs.writeFile(p, JSON.stringify(cred, null, 2), { mode: 0o600 })
  await fs.chmod(p, 0o600)
}

export async function deleteCredentials(): Promise<void> {
  const p = getCredentialsPath()
  try {
    await fs.unlink(p)
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err
  }
}

export async function enforceCredentialsMode(
  p = getCredentialsPath(),
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

export function normalizeApiUrl(input: string): string {
  let url = input.trim()
  if (!url) {
    throw new MxsError({
      code: 'config.missing.api_url',
      message: 'API URL is empty',
    })
  }
  if (!/^https?:\/\//i.test(url)) {
    const isLocal = /^(?:localhost|127\.0\.0\.1|::1)(?::\d+)?$/i.test(url)
    url = isLocal ? `http://${url}` : `https://${url}`
  }
  return url.replace(/\/+$/, '')
}

export async function resolveConfig(
  overrides: StoreOverrides = {},
): Promise<ResolvedConfig> {
  const envApiUrl = process.env.MXS_API_URL?.trim()
  const envToken = process.env.MXS_TOKEN?.trim()

  const file = await readConfig()
  const credentials = await readCredentials()

  const rawApiUrl = overrides.apiUrl || envApiUrl || file.api_url
  if (!rawApiUrl) {
    throw new MxsError({
      code: 'config.missing.api_url',
      message: 'API URL is not configured',
      hint: 'set MXS_API_URL or pass --api-url <url>, or run `mxs auth login` in an interactive shell',
    })
  }
  const apiUrl = normalizeApiUrl(rawApiUrl)
  const apiVersion = file.api_version ?? 2
  const apiBase =
    overrides.apiUrl || envApiUrl
      ? `${apiUrl}/api/v${apiVersion}`
      : file.api_base || `${apiUrl}/api/v${apiVersion}`
  const authBase =
    overrides.apiUrl || envApiUrl
      ? `${apiBase}/auth`
      : file.auth_base || `${apiBase}/auth`

  const token = overrides.token || envToken || credentials?.access_token

  return {
    apiUrl,
    apiBase,
    authBase,
    apiVersion,
    clientId: file.client_id || DEFAULT_CLIENT_ID,
    token,
    configPath: getConfigPath(),
    credentialsPath: getCredentialsPath(),
  }
}
