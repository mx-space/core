import type { HttpClientResponse } from '@effect/platform'
import { HttpClient, HttpClientRequest } from '@effect/platform'
import { Context, Effect, Layer } from 'effect'

import {
  AuthDenied,
  AuthExpired,
  AuthMissing,
  AuthProbe,
  Generic,
  NetworkDns,
  NetworkRefused,
  NetworkTimeout,
} from '../domain/errors'
import { Config, type CredentialsShape, type ResolvedConfig } from './Config'

// ---------------------------------------------------------------------------
// Public models
// ---------------------------------------------------------------------------

export interface AuthProbeResult {
  readonly apiUrl: string
  readonly apiBase: string
  readonly authBase: string
  readonly apiVersion: number
}

export interface WhoamiInfo {
  readonly id?: string
  readonly email?: string
  readonly name?: string
  readonly expiresAt: number
}

export interface AuthStatusInfo {
  readonly authenticated: boolean
  readonly apiUrl: string
  readonly profile: string | null
  readonly expiresAt?: number
  readonly user?: WhoamiInfo
}

export interface LoginOptions {
  readonly profile?: string
  readonly apiUrl?: string
  readonly production?: boolean
  readonly signal?: AbortSignal
}

export interface DeviceCodeResponse {
  readonly device_code: string
  readonly user_code: string
  readonly verification_uri: string
  readonly verification_uri_complete?: string
  readonly expires_in: number
  readonly interval: number
}

export interface DeviceTokenResponse {
  readonly access_token: string
  readonly token_type: string
  readonly expires_in: number
  readonly refresh_token?: string
  readonly scope?: string
  readonly user?: {
    readonly id?: string
    readonly email?: string
    readonly name?: string
  }
}

export interface PollDeviceTokenOptions {
  readonly intervalSec: number
  readonly expiresInSec: number
  readonly signal?: AbortSignal
  readonly onTick?: (state: 'pending' | 'slow_down') => void
}

export const SUPPORTED_API_VERSIONS = [2] as const

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface AuthService {
  /** Probe the auth endpoint, walking `/api/v{n}/auth` then `/auth`. */
  readonly probe: (
    apiUrl: string,
  ) => Effect.Effect<
    AuthProbeResult,
    AuthProbe | NetworkTimeout | NetworkDns | NetworkRefused
  >

  /**
   * Request a device-code grant. Wave 2 commands drive the full UX flow
   * (info lines, `open()`, polling). Wave 1 exposes the primitives.
   */
  readonly requestDeviceCode: (
    authBase: string,
    clientId: string,
    scope?: string,
  ) => Effect.Effect<DeviceCodeResponse, AuthDenied | Generic>

  /** Poll the token endpoint until completion or expiry. */
  readonly pollDeviceToken: (
    authBase: string,
    clientId: string,
    deviceCode: string,
    opts: PollDeviceTokenOptions,
  ) => Effect.Effect<DeviceTokenResponse, AuthDenied | AuthExpired | Generic>

  /** Refresh `cred` via either `refresh_token` grant or `get-session`. */
  readonly refresh: (
    authBase: string,
    clientId: string,
    cred: CredentialsShape,
  ) => Effect.Effect<CredentialsShape | null, Generic>

  /**
   * High-level login (placeholder for Wave 2). The Wave 1 contract returns
   * `Generic` and is intentionally a thin wrapper so command code can
   * orchestrate UX (banners, `open`, prompts) explicitly.
   */
  readonly login: (
    opts: LoginOptions,
  ) => Effect.Effect<
    CredentialsShape,
    AuthDenied | AuthExpired | AuthProbe | Generic
  >

  /** Clear credentials for the named profile (or active profile when null). */
  readonly logout: (name: string | null) => Effect.Effect<void, Generic>

  /** Read the active credentials and return whoami summary. */
  readonly whoami: Effect.Effect<
    WhoamiInfo,
    AuthMissing | AuthExpired | Generic
  >

  /** Read auth status without throwing on missing credentials. */
  readonly status: Effect.Effect<AuthStatusInfo, Generic>

  /**
   * If the active credential is within 60s of expiry, refresh it and
   * write back via `Config.writeProfileCredentials`. Returns the freshest
   * credentials, or fails with `AuthMissing` when none are stored.
   */
  readonly ensureFresh: (
    resolved: ResolvedConfig,
  ) => Effect.Effect<CredentialsShape, AuthMissing | AuthExpired | Generic>

  /**
   * Fill in `cred.user` via `GET /get-session` when missing, persisting the
   * enriched credentials. Returns the input unchanged when the user is
   * already known or when the upstream call fails — never errors.
   */
  readonly enrichUser: (
    profileName: string,
    authBase: string,
    cred: CredentialsShape,
  ) => Effect.Effect<CredentialsShape, Generic>
}

export class Auth extends Context.Tag('Auth')<Auth, AuthService>() {
  /** Build the Auth Layer; depends on `Config` and `HttpClient`. */
  static Default: Layer.Layer<Auth, never, Config | HttpClient.HttpClient> =
    Layer.effect(
      Auth,
      Effect.gen(function* () {
        const http = yield* HttpClient.HttpClient
        const config = yield* Config
        return makeAuthService(http, config)
      }),
    )
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const TOKEN_EXPIRY_BUFFER_MS = 60_000

export const isExpiringSoon = (
  cred: CredentialsShape,
  bufferMs = TOKEN_EXPIRY_BUFFER_MS,
): boolean => cred.expires_at < Date.now() + bufferMs

export const toCredentials = (resp: DeviceTokenResponse): CredentialsShape => ({
  access_token: resp.access_token,
  refresh_token: resp.refresh_token,
  expires_at: Date.now() + resp.expires_in * 1000,
  user: resp.user,
})

function mapTransportError(
  err: unknown,
  url: string,
): NetworkTimeout | NetworkDns | NetworkRefused | Generic {
  const cause = err as {
    code?: string
    cause?: { code?: string }
    name?: string
    message?: string
  }
  const code = cause?.code ?? cause?.cause?.code
  if (cause?.name === 'AbortError' || code === 'ABORT_ERR') {
    return new Generic({ message: 'request aborted', details: { url } })
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    let host = url
    try {
      host = new URL(url).host
    } catch {}
    return new NetworkDns({
      host,
      message: 'dns lookup failed',
      details: { url },
    })
  }
  if (code === 'ECONNREFUSED') {
    return new NetworkRefused({ url, message: 'connection refused' })
  }
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return new NetworkTimeout({ url, message: 'network request timed out' })
  }
  return new Generic({
    message: cause?.message ?? `request failed: ${url}`,
    details: { url, cause: code },
  })
}

function jsonResponseBody(
  res: HttpClientResponse.HttpClientResponse,
): Effect.Effect<unknown> {
  return res.json.pipe(Effect.catchAll(() => Effect.succeed(null)))
}

function makeAuthService(
  http: HttpClient.HttpClient,
  config: Context.Tag.Service<Config>,
): AuthService {
  const sendJson = (
    url: string,
    method: 'GET' | 'POST',
    body: unknown,
    headers: Record<string, string>,
  ): Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    NetworkTimeout | NetworkDns | NetworkRefused | Generic
  > =>
    Effect.gen(function* () {
      let req = HttpClientRequest.make(method)(url, { headers })
      if (body !== undefined && method !== 'GET') {
        req = yield* HttpClientRequest.bodyJson(req, body).pipe(
          Effect.mapError(
            (err) =>
              new Generic({ message: 'failed to encode body', cause: err }),
          ),
        )
      }
      return yield* http.execute(req).pipe(
        // ResponseError is just a status filter — we don't apply filterStatusOk,
        // so transport-level failures (RequestError) are what we map here.
        Effect.catchTag('RequestError', (rerr) =>
          Effect.fail(mapTransportError(rerr.cause ?? rerr, url)),
        ),
        Effect.catchTag('ResponseError', (rerr) =>
          Effect.succeed(rerr.response),
        ),
      )
    })

  const probe: AuthService['probe'] = (apiUrl) =>
    Effect.gen(function* () {
      const candidates: ReadonlyArray<{
        readonly prefix: string
        readonly version: number | null
      }> = [
        ...SUPPORTED_API_VERSIONS.map((v) => ({
          prefix: `/api/v${v}/auth`,
          version: v as number | null,
        })),
        { prefix: '/auth', version: null },
      ]

      type Transport = NetworkTimeout | NetworkDns | NetworkRefused | Generic
      let lastTransport: Transport | null = null

      for (const cand of candidates) {
        const probeUrl = `${apiUrl}${cand.prefix}/ok`
        const result:
          | { _tag: 'Left'; left: Transport }
          | {
              _tag: 'Right'
              right: HttpClientResponse.HttpClientResponse
            } = yield* sendJson(probeUrl, 'GET', undefined, {
          accept: 'application/json',
        }).pipe(Effect.either)
        if (result._tag === 'Left') {
          lastTransport = result.left
          continue
        }
        const res = result.right
        if (res.status >= 200 && res.status < 300) {
          const apiVersion = cand.version ?? SUPPORTED_API_VERSIONS[0]
          const apiBase =
            cand.prefix === '/auth' ? apiUrl : `${apiUrl}/api/v${apiVersion}`
          const authBase = `${apiUrl}${cand.prefix}`
          return { apiUrl, apiBase, authBase, apiVersion }
        }
      }

      if (lastTransport && lastTransport._tag !== 'Generic') {
        return yield* Effect.fail(lastTransport)
      }
      return yield* Effect.fail(
        new AuthProbe({
          message: 'cannot detect auth endpoint',
          hint: 'verify the URL points at a running mx-core server',
        }),
      )
    })

  const requestDeviceCode: AuthService['requestDeviceCode'] = (
    authBase,
    clientId,
    scope = 'openid profile email',
  ) =>
    Effect.gen(function* () {
      const url = `${authBase}/device/code`
      const res = yield* sendJson(
        url,
        'POST',
        { client_id: clientId, scope },
        { 'content-type': 'application/json', accept: 'application/json' },
      ).pipe(
        Effect.mapError((err): AuthDenied | Generic => {
          if (err._tag === 'Generic') return err
          // transport errors collapse into AuthDenied — matches legacy where
          // network failure during device-code request surfaces as auth.denied.
          return new AuthDenied({
            message: 'device code request failed',
            details: err,
          })
        }),
      )
      const body = yield* jsonResponseBody(res)
      if (res.status >= 200 && res.status < 300) {
        return body as DeviceCodeResponse
      }
      return yield* Effect.fail(
        new AuthDenied({
          message: `device code request failed (${res.status})`,
          details: body,
        }),
      )
    })

  const pollDeviceToken: AuthService['pollDeviceToken'] = (
    authBase,
    clientId,
    deviceCode,
    opts,
  ) =>
    Effect.tryPromise({
      try: async () => {
        const url = `${authBase}/device/token`
        const deadline = Date.now() + opts.expiresInSec * 1000
        let intervalMs = Math.max(1, opts.intervalSec) * 1000
        while (Date.now() < deadline) {
          if (opts.signal?.aborted) {
            throw new AuthDenied({ message: 'aborted by user' })
          }
          await sleep(intervalMs, opts.signal)
          const res = await fetchJson(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              accept: 'application/json',
            },
            body: JSON.stringify({
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
              device_code: deviceCode,
              client_id: clientId,
            }),
            signal: opts.signal,
          })
          const body = res.body as
            | (DeviceTokenResponse & { error?: string })
            | null
          if (res.ok && body?.access_token) {
            return body as DeviceTokenResponse
          }
          const err = body?.error
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
            throw new AuthDenied({
              message: 'user denied the authorization request',
            })
          }
          if (err === 'expired_token') {
            throw new AuthExpired({
              message: 'device code expired before authorization completed',
              hint: 'run `mxs auth login` again',
            })
          }
          throw new AuthDenied({
            message: `device token request failed (${res.status})`,
            details: body,
          })
        }
        throw new AuthExpired({
          message: 'device authorization timed out',
          hint: 'run `mxs auth login` again',
        })
      },
      catch: (err) => {
        if (err instanceof AuthDenied) return err
        if (err instanceof AuthExpired) return err
        return new Generic({
          message: 'device token polling failed',
          cause: err,
        })
      },
    })

  const refresh: AuthService['refresh'] = (authBase, clientId, cred) =>
    Effect.tryPromise({
      try: async () => {
        if (!cred.refresh_token) {
          return refreshSessionToken(authBase, cred)
        }
        const res = await fetchJson(`${authBase}/token`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            refresh_token: cred.refresh_token,
            client_id: clientId,
          }),
        })
        if (!res.ok) return null
        const body = res.body as DeviceTokenResponse | null
        if (!body?.access_token) return null
        return {
          access_token: body.access_token,
          refresh_token: body.refresh_token ?? cred.refresh_token,
          expires_at: Date.now() + body.expires_in * 1000,
          user: body.user ?? cred.user,
        }
      },
      catch: (err) => new Generic({ message: 'refresh failed', cause: err }),
    })

  const ensureFresh: AuthService['ensureFresh'] = (resolved) =>
    Effect.gen(function* () {
      if (!resolved.profileName) {
        return yield* Effect.fail(
          new AuthMissing({
            message: 'not authenticated',
            hint: 'run `mxs auth login`',
          }),
        )
      }
      const cred = yield* config.readProfileCredentials(resolved.profileName)
      if (!cred) {
        return yield* Effect.fail(
          new AuthMissing({
            message: 'not authenticated',
            hint: 'run `mxs auth login`',
          }),
        )
      }
      if (!isExpiringSoon(cred)) return cred
      const refreshed = yield* refresh(
        resolved.authBase,
        resolved.clientId,
        cred,
      )
      if (!refreshed) return cred
      yield* config.writeProfileCredentials(resolved.profileName, refreshed)
      return refreshed
    })

  const login: AuthService['login'] = () =>
    Effect.fail(
      new Generic({
        message:
          'Auth.login is a Wave 2 surface; compose probe + requestDeviceCode + pollDeviceToken explicitly',
      }),
    )

  const logout: AuthService['logout'] = (name) =>
    Effect.gen(function* () {
      const target =
        name ??
        (yield* config.resolve().pipe(
          Effect.map((r) => r.profileName),
          Effect.catchAll(() => Effect.succeed(null)),
        ))
      if (!target) return
      yield* config.deleteProfileCredentials(target)
    })

  const whoami: AuthService['whoami'] = Effect.gen(function* () {
    const resolved = yield* config.resolve().pipe(
      Effect.mapError(
        (err) =>
          new Generic({
            message: 'failed to resolve config',
            cause: err,
          }),
      ),
    )
    const fresh = yield* ensureFresh(resolved)
    return {
      id: fresh.user?.id,
      email: fresh.user?.email,
      name: fresh.user?.name,
      expiresAt: fresh.expires_at,
    }
  })

  const status: AuthService['status'] = Effect.gen(function* () {
    const resolved = yield* config.resolve().pipe(
      Effect.mapError(
        (err) =>
          new Generic({
            message: 'failed to resolve config',
            cause: err,
          }),
      ),
    )
    if (!resolved.profileName) {
      return {
        authenticated: false,
        apiUrl: resolved.apiUrl,
        profile: null,
      }
    }
    const cred = yield* config.readProfileCredentials(resolved.profileName)
    if (!cred) {
      return {
        authenticated: false,
        apiUrl: resolved.apiUrl,
        profile: resolved.profileName,
      }
    }
    return {
      authenticated: true,
      apiUrl: resolved.apiUrl,
      profile: resolved.profileName,
      expiresAt: cred.expires_at,
      user: {
        id: cred.user?.id,
        email: cred.user?.email,
        name: cred.user?.name,
        expiresAt: cred.expires_at,
      },
    }
  })

  const enrichUser: AuthService['enrichUser'] = (profileName, authBase, cred) =>
    Effect.gen(function* () {
      if (cred.user?.id || cred.user?.email || cred.user?.name) return cred
      const fetched = yield* Effect.tryPromise({
        try: () => fetchSessionUser(authBase, cred),
        catch: () => null,
      }).pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (!fetched) return cred
      const updated: CredentialsShape = { ...cred, user: fetched }
      yield* config.writeProfileCredentials(profileName, updated)
      return updated
    })

  return {
    probe,
    requestDeviceCode,
    pollDeviceToken,
    refresh,
    login,
    logout,
    whoami,
    status,
    ensureFresh,
    enrichUser,
  }
}

// ---------------------------------------------------------------------------
// Low-level helpers — kept as Promise-based for the inner poll loop where
// the existing implementation already had Promise semantics. Migrating the
// poll loop to pure `Schedule` is a Wave 3 follow-up.
// ---------------------------------------------------------------------------

interface ParsedFetchResponse {
  readonly ok: boolean
  readonly status: number
  readonly headers: Headers
  readonly body: unknown
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<ParsedFetchResponse> {
  const res = await globalThis.fetch(url, init)
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { ok: res.ok, status: res.status, headers: res.headers, body }
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

async function fetchSessionUser(
  authBase: string,
  cred: CredentialsShape,
): Promise<CredentialsShape['user'] | null> {
  const res = await globalThis.fetch(`${authBase}/get-session`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${cred.access_token}`,
    },
  })
  if (!res.ok) return null
  const body = (await res.json().catch(() => null)) as {
    user?: CredentialsShape['user']
  } | null
  return body?.user ?? null
}

async function refreshSessionToken(
  authBase: string,
  cred: CredentialsShape,
): Promise<CredentialsShape | null> {
  const res = await globalThis.fetch(`${authBase}/get-session`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${cred.access_token}`,
    },
  })
  if (!res.ok) return null
  const body = (await res.json().catch(() => null)) as {
    session?: { expiresAt?: string | Date | number }
    user?: CredentialsShape['user']
  } | null
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
