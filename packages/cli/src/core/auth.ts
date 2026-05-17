import {
  type CredentialsShape,
  readCredentials,
  writeCredentials,
} from './config-store'
import { MxsError } from './errors'

export const SUPPORTED_API_VERSIONS = [2] as const

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval: number
}

export interface DeviceTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
  user?: {
    id?: string
    email?: string
    name?: string
  }
}

export interface ProbeResult {
  apiUrl: string
  apiBase: string
  authBase: string
  apiVersion: number
}

export interface AuthHttp {
  fetch: typeof fetch
}

export function defaultHttp(): AuthHttp {
  return { fetch: globalThis.fetch.bind(globalThis) }
}

export async function probeAuthEndpoint(
  apiUrl: string,
  http: AuthHttp = defaultHttp(),
): Promise<ProbeResult> {
  const candidates: { prefix: string; version: number | null }[] = [
    ...SUPPORTED_API_VERSIONS.map((v) => ({
      prefix: `/api/v${v}/auth`,
      version: v,
    })),
    { prefix: '/auth', version: null },
  ]
  for (const cand of candidates) {
    const probeUrl = `${apiUrl}${cand.prefix}/ok`
    let res: Response
    try {
      res = await http.fetch(probeUrl, { method: 'GET' })
    } catch {
      continue
    }
    if (res.ok) {
      const apiVersion = cand.version ?? SUPPORTED_API_VERSIONS[0]
      const apiBase =
        cand.prefix === '/auth' ? apiUrl : `${apiUrl}/api/v${apiVersion}`
      const authBase = `${apiUrl}${cand.prefix}`
      return { apiUrl, apiBase, authBase, apiVersion }
    }
  }
  throw new MxsError({
    code: 'auth.probe',
    message: 'cannot detect auth endpoint',
    hint: 'verify the URL points at a running mx-core server',
  })
}

export async function requestDeviceCode(
  authBase: string,
  clientId: string,
  scope = 'openid profile email',
  http: AuthHttp = defaultHttp(),
): Promise<DeviceCodeResponse> {
  const res = await http.fetch(`${authBase}/device/code`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope }),
  })
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = await res.text()
    }
    throw new MxsError({
      code: 'auth.denied',
      message: `device code request failed (${res.status})`,
      details: body,
    })
  }
  return (await res.json()) as DeviceCodeResponse
}

export interface PollOptions {
  intervalSec: number
  expiresInSec: number
  signal?: AbortSignal
  onTick?: (state: 'pending' | 'slow_down') => void
  http?: AuthHttp
}

export async function pollDeviceToken(
  authBase: string,
  clientId: string,
  deviceCode: string,
  opts: PollOptions,
): Promise<DeviceTokenResponse> {
  const http = opts.http ?? defaultHttp()
  const deadline = Date.now() + opts.expiresInSec * 1000
  let intervalMs = Math.max(1, opts.intervalSec) * 1000
  while (Date.now() < deadline) {
    if (opts.signal?.aborted) {
      throw new MxsError({ code: 'auth.denied', message: 'aborted by user' })
    }
    await sleep(intervalMs, opts.signal)
    const res = await http.fetch(`${authBase}/device/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
        client_id: clientId,
      }),
    })
    let body: any
    try {
      body = await res.json()
    } catch {
      body = null
    }
    if (res.ok && body?.access_token) {
      return body as DeviceTokenResponse
    }
    const err = body?.error as string | undefined
    if (err === 'authorization_pending') {
      opts.onTick?.('pending')
      continue
    }
    if (err === 'slow_down') {
      intervalMs += 5000
      opts.onTick?.('slow_down')
      continue
    }
    if (err === 'access_denied') {
      throw new MxsError({
        code: 'auth.denied',
        message: 'user denied the authorization request',
      })
    }
    if (err === 'expired_token') {
      throw new MxsError({
        code: 'auth.expired',
        message: 'device code expired before authorization completed',
        hint: 'run `mxs auth login` again',
      })
    }
    throw new MxsError({
      code: 'auth.denied',
      message: `device token request failed (${res.status})`,
      details: body,
    })
  }
  throw new MxsError({
    code: 'auth.expired',
    message: 'device authorization timed out',
    hint: 'run `mxs auth login` again',
  })
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'))
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function toCredentials(resp: DeviceTokenResponse): CredentialsShape {
  return {
    access_token: resp.access_token,
    refresh_token: resp.refresh_token,
    expires_at: Date.now() + resp.expires_in * 1000,
    user: resp.user,
  }
}

export function isExpiringSoon(
  cred: CredentialsShape,
  bufferMs = 60_000,
): boolean {
  return cred.expires_at < Date.now() + bufferMs
}

export async function refreshAccessToken(
  authBase: string,
  clientId: string,
  cred: CredentialsShape,
  http: AuthHttp = defaultHttp(),
): Promise<CredentialsShape | null> {
  if (!cred.refresh_token) {
    return refreshSessionToken(authBase, cred, http)
  }
  const res = await http.fetch(`${authBase}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: cred.refresh_token,
      client_id: clientId,
    }),
  })
  if (!res.ok) return null
  const body = (await res.json()) as DeviceTokenResponse
  if (!body?.access_token) return null
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? cred.refresh_token,
    expires_at: Date.now() + body.expires_in * 1000,
    user: body.user ?? cred.user,
  }
}

async function refreshSessionToken(
  authBase: string,
  cred: CredentialsShape,
  http: AuthHttp,
): Promise<CredentialsShape | null> {
  const res = await http.fetch(`${authBase}/get-session`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${cred.access_token}`,
    },
  })
  if (!res.ok) return null
  const body = (await res.json().catch(() => null)) as
    | {
        session?: { expiresAt?: string | Date | number }
        user?: CredentialsShape['user']
      }
    | null
  const expiresAt = normalizeExpiresAt(body?.session?.expiresAt)
  if (!expiresAt || expiresAt <= cred.expires_at) return null
  return {
    access_token: res.headers.get('set-auth-token') ?? cred.access_token,
    refresh_token: cred.refresh_token,
    expires_at: expiresAt,
    user: body?.user ?? cred.user,
  }
}

function normalizeExpiresAt(value: string | Date | number | undefined) {
  if (value === undefined) return null
  const time =
    value instanceof Date
      ? value.getTime()
      : typeof value === 'number'
        ? value
        : new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

export async function loadCredentialsOrThrow(): Promise<CredentialsShape> {
  const cred = await readCredentials()
  if (!cred) {
    throw new MxsError({
      code: 'auth.missing',
      message: 'not authenticated',
      hint: 'run `mxs auth login`',
    })
  }
  return cred
}

export async function ensureFreshToken(
  authBase: string,
  clientId: string,
  http: AuthHttp = defaultHttp(),
): Promise<CredentialsShape> {
  const cred = await loadCredentialsOrThrow()
  if (!isExpiringSoon(cred)) return cred
  const refreshed = await refreshAccessToken(authBase, clientId, cred, http)
  if (!refreshed) return cred
  await writeCredentials(refreshed)
  return refreshed
}
