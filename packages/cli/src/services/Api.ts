import type { HttpClientResponse } from '@effect/platform'
import { HttpClient, HttpClientRequest } from '@effect/platform'
import type { Schema } from 'effect'
import { Context, Effect, Layer, Ref } from 'effect'

import {
  AuthDenied,
  AuthExpired,
  Generic,
  NetworkDns,
  NetworkRefused,
  NetworkTimeout,
  ResourceNotFound,
  ServerError,
  ValidationFailed,
  WriteRequiresExplicit,
} from '../domain/errors'
import {
  decideWriteGate,
  type HttpMethod,
  type ResolvedGateInput,
} from '../domain/gate'
import { extractServerMessage } from '../domain/schema/api-envelope'
import { Auth } from './Auth'
import { Config, type ResolvedConfig, type StoreOverrides } from './Config'

// ---------------------------------------------------------------------------
// Public models
// ---------------------------------------------------------------------------

export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface ApiRequestOptions<A = unknown, I = unknown> {
  readonly method?: ApiMethod
  readonly body?: unknown
  readonly query?: Readonly<Record<string, unknown>>
  readonly headers?: Readonly<Record<string, string>>
  readonly signal?: AbortSignal
  /**
   * Decoder for the response payload. When omitted, the raw parsed body is
   * returned (likely an object or string, never undefined for non-204
   * responses).
   */
  readonly schema?: Schema.Schema<A, I>
}

/**
 * Per-run overrides + UX flags that Wave 2 command code can supply when
 * instantiating the Api layer via `Api.layer(...)`.
 *
 * - `overrides`: passed straight to `Config.resolve` — supports the global
 *   flags `--api-url`, `--token`, `--api-key`, `--profile` and their env
 *   equivalents.
 * - `verbose` / `quiet`: control the production banner and `METHOD URL →
 *   STATUS (Xms)` verbose log lines; they match the today's CLI behavior.
 */
export interface ApiOptions {
  readonly overrides?: StoreOverrides
  readonly verbose?: boolean
  readonly quiet?: boolean
  /**
   * When true, short-circuit writes (POST / PATCH / PUT / DELETE) BEFORE any
   * network call. The body that would have been sent is surfaced via the
   * returned value (`{ ok: true, dryRun: true, ... }`); reads pass through
   * unchanged. Mirrors the v0.2.x `--dry-run` global flag.
   */
  readonly dryRun?: boolean
  /**
   * When set, append `?lang=<code>` to GET / read-only requests so the server
   * returns the localized variant. Writes are untouched. Mirrors the v0.2.x
   * `--lang <code>` flag.
   */
  readonly lang?: string
}

export type ApiError =
  | AuthExpired
  | AuthDenied
  | ValidationFailed
  | ResourceNotFound
  | ServerError
  | NetworkTimeout
  | NetworkDns
  | NetworkRefused
  | WriteRequiresExplicit
  | Generic

export interface ApiService {
  /** Issue a request against the active profile's `apiBase`. */
  readonly request: <A = unknown, I = unknown>(
    path: string,
    options?: ApiRequestOptions<A, I>,
  ) => Effect.Effect<A, ApiError>

  /** Lower-level helper returning the raw parsed body without schema decoding. */
  readonly raw: (
    path: string,
    options?: Omit<ApiRequestOptions, 'schema'>,
  ) => Effect.Effect<unknown, ApiError>
}

export class Api extends Context.Tag('Api')<Api, ApiService>() {
  /**
   * Default Layer: no overrides, banner + verbose enabled per env / config.
   * Wave 2 entry-point (`bin/mxs.ts`) should use `Api.layer({...})` to wire
   * flag-derived overrides through.
   */
  static Default: Layer.Layer<
    Api,
    never,
    Config | Auth | HttpClient.HttpClient
  > = Api.layer({})

  /** Build an Api Layer with command-specified overrides + UX flags. */
  static layer(
    opts: ApiOptions,
  ): Layer.Layer<Api, never, Config | Auth | HttpClient.HttpClient> {
    return Layer.effect(
      Api,
      Effect.gen(function* () {
        const http = yield* HttpClient.HttpClient
        const config = yield* Config
        const auth = yield* Auth
        return yield* makeApiService(http, config, auth, opts)
      }),
    )
  }
}

// ---------------------------------------------------------------------------
// Internal: construct an `ApiService` given resolved deps.
// ---------------------------------------------------------------------------

function makeApiService(
  http: HttpClient.HttpClient,
  config: Context.Tag.Service<Config>,
  auth: Context.Tag.Service<Auth>,
  opts: ApiOptions,
): Effect.Effect<ApiService> {
  return Effect.gen(function* () {
    const bannerEmitted = yield* Ref.make(false)

    /**
     * Resolved config is cached per `ApiService` instance. This matches
     * today's `ApiClient` which is constructed once per command run.
     */
    const resolvedEffect = config.resolve(opts.overrides).pipe(
      Effect.mapError(
        (err): ApiError =>
          err._tag === 'Generic'
            ? err
            : new Generic({
                message: 'failed to resolve config',
                cause: err,
              }),
      ),
    )

    const maybeEmitBanner = (resolved: ResolvedConfig): Effect.Effect<void> =>
      Effect.gen(function* () {
        if (!resolved.isProduction || opts.quiet) return
        const already = yield* Ref.get(bannerEmitted)
        if (already) return
        yield* Ref.set(bannerEmitted, true)
        yield* Effect.sync(() => {
          process.stderr.write(
            `mxs: profile=${resolved.profileName} (production) → ${resolved.apiUrl}\n`,
          )
        })
      })

    const request = <A = unknown, I = unknown>(
      path: string,
      options: ApiRequestOptions<A, I> = {},
    ): Effect.Effect<A, ApiError> =>
      Effect.gen(function* () {
        const resolved = yield* resolvedEffect
        yield* maybeEmitBanner(resolved)

        const method = (options.method ?? 'GET') as ApiMethod
        // ---- 1. write-gate (pure decision; runs BEFORE network) ---------
        const gateInput: ResolvedGateInput = {
          apiUrl: resolved.apiUrl,
          profileName: resolved.profileName,
          isProduction: resolved.isProduction,
          profileExplicit: resolved.profileExplicit,
          urlOverridden: resolved.urlOverridden,
        }
        const decision = decideWriteGate(gateInput, method as HttpMethod)
        if (!decision.allow) {
          return yield* Effect.fail(
            new WriteRequiresExplicit({
              message: decision.message,
              hint: decision.hint,
              profile: resolved.profileName ?? undefined,
              apiUrl: resolved.apiUrl,
              details: {
                profile: resolved.profileName,
                api_url: resolved.apiUrl,
              },
            }),
          )
        }

        // ---- 1b. --dry-run short-circuit (writes only; reads pass through)
        if (opts.dryRun && method !== 'GET') {
          if (opts.verbose && !opts.quiet) {
            process.stderr.write(
              `mxs: dry-run — would send ${method} ${buildUrl(resolved.apiBase, path)}\n`,
            )
          }
          // Return a synthetic envelope so command handlers stay uniform.
          // No schema decoding — handlers that emit via Renderer treat this
          // as a passthrough payload.
          return {
            ok: true,
            status: 200,
            data: {
              dryRun: true,
              method,
              path,
              query: options.query ?? null,
              body: options.body ?? null,
            },
          } as unknown as A
        }

        // ---- 2. auto-refresh near-expiry tokens -------------------------
        let token = resolved.token
        if (token && resolved.profileName) {
          const fresh = yield* auth
            .ensureFresh(resolved)
            .pipe(Effect.catchAll(() => Effect.succeed(null)))
          if (fresh) token = fresh.access_token
        }

        // ---- 3. send (with single 401-retry) ----------------------------
        // Inject `lang` into the query for read-only requests when the bin
        // has set a global `--lang` flag and the caller didn't already
        // specify one.
        const effectiveQuery =
          opts.lang && method === 'GET'
            ? { lang: opts.lang, ...options.query }
            : options.query
        const url = buildUrl(resolved.apiBase, path, effectiveQuery)
        const baseHeaders: Record<string, string> = {
          accept: 'application/json',
          'user-agent': USER_AGENT,
          ...options.headers,
        }
        if (token) baseHeaders.authorization = `Bearer ${token}`
        if (resolved.apiKey) baseHeaders['x-api-key'] = resolved.apiKey
        if (options.body !== undefined && !(options.body instanceof FormData)) {
          baseHeaders['content-type'] ??= 'application/json'
        }

        const send = (
          headers: Record<string, string>,
        ): Effect.Effect<
          HttpClientResponse.HttpClientResponse,
          NetworkTimeout | NetworkDns | NetworkRefused | Generic
        > =>
          Effect.gen(function* () {
            const startedAt = Date.now()
            let req = HttpClientRequest.make(method as HttpMethod)(url, {
              headers,
            })
            if (options.body instanceof FormData) {
              req = HttpClientRequest.bodyFormData(req, options.body)
            } else if (options.body !== undefined) {
              req = yield* HttpClientRequest.bodyJson(req, options.body).pipe(
                Effect.mapError(
                  (err) =>
                    new Generic({
                      message: 'failed to encode body',
                      cause: err,
                    }),
                ),
              )
            }
            const res = yield* http.execute(req).pipe(
              Effect.mapError(
                (
                  err,
                ): NetworkTimeout | NetworkDns | NetworkRefused | Generic => {
                  if (err._tag === 'ResponseError') {
                    // Non-2xx is not surfaced through here because we
                    // don't apply filterStatusOk; if a custom layer does
                    // raise ResponseError we fall through to Generic.
                    return new Generic({
                      message: 'unexpected response error',
                      cause: err,
                    })
                  }
                  return mapTransportError(err.cause ?? err, url)
                },
              ),
            )
            if (opts.verbose) {
              process.stderr.write(
                `${method} ${url} → ${res.status} (${Date.now() - startedAt}ms)\n`,
              )
            }
            return res
          })

        let headers = { ...baseHeaders }
        let res = yield* send(headers)

        if (res.status === 401 && token && resolved.profileName) {
          const refreshed = yield* refreshOnce(
            auth,
            config,
            resolved,
            token,
          ).pipe(Effect.catchAll(() => Effect.succeed(null)))
          if (refreshed) {
            token = refreshed.access_token
            headers = { ...headers, authorization: `Bearer ${token}` }
            res = yield* send(headers)
          }
        }

        // ---- 4. parse + status mapping ---------------------------------
        const body = yield* parseBody(res)
        if (res.status >= 200 && res.status < 300) {
          if (!options.schema) return body as A
          return yield* decodeWithSchema(options.schema, body)
        }
        return yield* Effect.fail(mapHttpStatusToError(res.status, body))
      })

    const raw: ApiService['raw'] = (path, options) =>
      request(path, options as ApiRequestOptions<unknown, unknown>)

    return {
      request,
      raw,
    }
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUrl(
  base: string,
  path: string,
  query?: Readonly<Record<string, unknown>>,
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

function parseBody(
  res: HttpClientResponse.HttpClientResponse,
): Effect.Effect<unknown, never> {
  const ct = res.headers['content-type'] ?? ''
  if (ct.includes('application/json')) {
    return res.json.pipe(Effect.catchAll(() => Effect.succeed(undefined)))
  }
  return res.text.pipe(Effect.catchAll(() => Effect.succeed('')))
}

function decodeWithSchema<A, I>(
  schema: Schema.Schema<A, I>,
  body: unknown,
): Effect.Effect<A, ServerError> {
  // We use the platform `Schema.decodeUnknown` to validate at runtime.
  // `effect/Schema` exposes the same API surface, so we import it lazily
  // to keep the static `Api.ts` dep graph minimal.
  return Effect.tryPromise({
    try: async () => {
      const { Schema: SchemaMod } = await import('effect')
      return SchemaMod.decodeUnknownPromise(schema)(body)
    },
    catch: (err: unknown) =>
      new ServerError({
        status: 200,
        message: 'response shape mismatch',
        details: serializeParseError(err),
      }),
  })
}

function serializeParseError(err: unknown): unknown {
  if (err && typeof err === 'object') {
    const message = (err as { message?: string }).message
    if (typeof message === 'string') return message
  }
  return err
}

function mapHttpStatusToError(status: number, body: unknown): ApiError {
  if (status === 401) {
    return new AuthExpired({
      message: 'authentication required',
      hint: 'run `mxs auth login`',
      details: body,
    })
  }
  if (status === 403) {
    return new AuthDenied({ message: 'permission denied', details: body })
  }
  if (status === 404) {
    return new ResourceNotFound({
      message: 'resource not found',
      details: body,
    })
  }
  if (status === 400 || status === 422) {
    return new ValidationFailed({
      message: extractServerMessage(body) ?? 'validation failed',
      details: body,
    })
  }
  if (status >= 500) {
    return new ServerError({
      status,
      message: extractServerMessage(body) ?? `server error (${status})`,
      details: body,
    })
  }
  return new Generic({
    message: extractServerMessage(body) ?? `request failed (${status})`,
    details: body,
  })
}

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

function refreshOnce(
  auth: Context.Tag.Service<Auth>,
  config: Context.Tag.Service<Config>,
  resolved: ResolvedConfig,
  currentToken: string,
): Effect.Effect<{ readonly access_token: string } | null, Generic> {
  return Effect.gen(function* () {
    if (!resolved.profileName) return null
    const cred = yield* config.readProfileCredentials(resolved.profileName)
    if (!cred) return null
    if (cred.access_token !== currentToken) return null
    const refreshed = yield* auth.refresh(
      resolved.authBase,
      resolved.clientId,
      cred,
    )
    if (!refreshed) return null
    yield* config.writeProfileCredentials(resolved.profileName, refreshed)
    return refreshed
  })
}
