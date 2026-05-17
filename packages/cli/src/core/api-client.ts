import {
  type AuthHttp,
  defaultHttp,
  ensureFreshToken,
  refreshAccessToken,
} from './auth'
import {
  type CredentialsShape,
  readCredentials,
  type ResolvedConfig,
  writeCredentials,
} from './config-store'
import { MxsError } from './errors'
import { decideWriteGate, type HttpMethod } from './gate'

export interface ApiClientContext {
  apiBase: string
  authBase: string
  clientId: string
  token?: string
  apiKey?: string
  autoRefresh?: boolean
  verbose?: boolean
  quiet?: boolean
  http?: AuthHttp
  /** When provided, enables the production banner and write gate. */
  resolved?: ResolvedConfig
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, unknown>
  headers?: Record<string, string>
  signal?: AbortSignal
}

export interface ApiResponse<T> {
  ok: boolean
  status: number
  data: T
}

export class ApiClient {
  private http: AuthHttp
  private token?: string
  private refreshed = false

  constructor(private ctx: ApiClientContext) {
    this.http = ctx.http ?? defaultHttp()
    this.token = ctx.token
    if (ctx.resolved?.isProduction && !ctx.quiet) {
      const r = ctx.resolved
      process.stderr.write(
        `mxs: profile=${r.profileName} (production) → ${r.apiUrl}\n`,
      )
    }
  }

  get apiBase(): string {
    return this.ctx.apiBase
  }

  async request<T = unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const method = (options.method ?? 'GET') as HttpMethod
    if (this.ctx.resolved) {
      const decision = decideWriteGate(this.ctx.resolved, method)
      if (!decision.allow) {
        throw new MxsError({
          code: 'profile.write_requires_explicit',
          message: decision.message!,
          hint: decision.hint,
          details: {
            profile: this.ctx.resolved.profileName,
            api_url: this.ctx.resolved.apiUrl,
          },
        })
      }
    }
    if (this.ctx.autoRefresh && this.token) {
      await this.tryRefresh()
    }
    const url = buildUrl(this.ctx.apiBase, path, options.query)
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...options.headers,
    }
    if (this.token) headers.authorization = `Bearer ${this.token}`
    if (this.ctx.apiKey) headers['x-api-key'] = this.ctx.apiKey
    if (options.body !== undefined && !(options.body instanceof FormData)) {
      headers['content-type'] ??= 'application/json'
    }
    const startedAt = Date.now()
    let res = await this.http.fetch(url, {
      method,
      headers,
      body:
        options.body === undefined
          ? undefined
          : options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body),
      signal: options.signal,
    })
    if (this.ctx.verbose) {
      process.stderr.write(
        `${method} ${url} → ${res.status} (${Date.now() - startedAt}ms)\n`,
      )
    }

    if (res.status === 401 && !this.refreshed && this.token) {
      const refreshed = await this.tryRefresh()
      if (refreshed) {
        this.refreshed = true
        headers.authorization = `Bearer ${refreshed.access_token}`
        this.token = refreshed.access_token
        res = await this.http.fetch(url, {
          method,
          headers,
          body:
            options.body === undefined
              ? undefined
              : options.body instanceof FormData
                ? options.body
                : JSON.stringify(options.body),
          signal: options.signal,
        })
      }
    }

    const data = await parseBody<T>(res)
    if (res.ok) return { ok: true, status: res.status, data }

    throw toMxsError(res.status, data)
  }

  private async tryRefresh(): Promise<CredentialsShape | null> {
    const current = await readCredentials()
    if (!current) return null
    if (this.token && current.access_token !== this.token) return null
    const refreshed = await refreshAccessToken(
      this.ctx.authBase,
      this.ctx.clientId,
      current,
      this.http,
    )
    if (!refreshed) return null
    await writeCredentials(refreshed)
    this.token = refreshed.access_token
    return refreshed
  }
}

export async function createApiClient(
  ctx: ApiClientContext,
): Promise<ApiClient> {
  if (!ctx.token) return new ApiClient(ctx)
  const fresh = await ensureFreshToken(
    ctx.authBase,
    ctx.clientId,
    ctx.http ?? defaultHttp(),
  ).catch(() => null)
  if (fresh) {
    return new ApiClient({ ...ctx, token: fresh.access_token })
  }
  return new ApiClient(ctx)
}

function buildUrl(
  base: string,
  path: string,
  query?: Record<string, unknown>,
): string {
  const url = new URL(
    path.startsWith('/') ? path.slice(1) : path,
    base.endsWith('/') ? base : `${base}/`,
  )
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

async function parseBody<T>(res: Response): Promise<T> {
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    try {
      return (await res.json()) as T
    } catch {
      return undefined as T
    }
  }
  return (await res.text()) as unknown as T
}

function toMxsError(status: number, body: unknown): MxsError {
  if (status === 401) {
    return new MxsError({
      code: 'auth.expired',
      message: 'authentication required',
      hint: 'run `mxs auth login`',
      details: body,
    })
  }
  if (status === 403) {
    return new MxsError({
      code: 'auth.denied',
      message: 'permission denied',
      details: body,
    })
  }
  if (status === 404) {
    return new MxsError({
      code: 'resource.not_found',
      message: 'resource not found',
      details: body,
    })
  }
  if (status === 422 || status === 400) {
    return new MxsError({
      code: 'validation.failed',
      message: extractMessage(body) ?? 'validation failed',
      details: body,
    })
  }
  if (status >= 500) {
    return new MxsError({
      code: 'server.error',
      message: extractMessage(body) ?? `server error (${status})`,
      details: body,
    })
  }
  return new MxsError({
    code: 'generic',
    message: extractMessage(body) ?? `request failed (${status})`,
    details: body,
  })
}

function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const msg = (body as Record<string, unknown>).message
  if (typeof msg === 'string') return msg
  if (Array.isArray(msg) && typeof msg[0] === 'string') return msg.join('; ')
  return null
}
