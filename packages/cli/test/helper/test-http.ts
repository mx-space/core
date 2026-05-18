import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform'
import { Effect, Layer } from 'effect'

export interface CannedResponse {
  readonly status: number
  readonly body?: unknown
  readonly headers?: Record<string, string>
}

export interface RouteHandlerArgs {
  readonly request: HttpClientRequest.HttpClientRequest
  readonly url: string
  readonly method: string
  readonly call: number
}

export type RouteHandler =
  | CannedResponse
  | ((args: RouteHandlerArgs) => CannedResponse | Promise<CannedResponse>)

export interface TestHttpRoutes {
  /** Routes keyed as `"METHOD URL"`. */
  readonly [key: string]: RouteHandler
}

export interface TestHttpRecorder {
  readonly calls: Array<{
    readonly method: string
    readonly url: string
    readonly headers: Record<string, string>
    readonly body: unknown
  }>
}

export interface TestHttpLayerHandle {
  readonly layer: Layer.Layer<HttpClient.HttpClient>
  readonly recorder: TestHttpRecorder
}

const toWebResponse = (canned: CannedResponse): Response => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...canned.headers,
  }
  const body =
    canned.body === undefined
      ? null
      : typeof canned.body === 'string'
        ? canned.body
        : JSON.stringify(canned.body)
  return new Response(body, { status: canned.status, headers })
}

export const testHttpLayer = (
  routes: TestHttpRoutes,
): TestHttpLayerHandle => {
  const counts: Record<string, number> = {}
  const recorder: TestHttpRecorder = { calls: [] }

  const client = HttpClient.make((request) =>
    Effect.gen(function* () {
      const url = request.url
      const method = request.method
      const key = `${method} ${url}`
      counts[key] = (counts[key] ?? 0) + 1

      // Record the call (capture body before it's consumed).
      const bodySnapshot = yield* snapshotBody(request)
      recorder.calls.push({
        method,
        url,
        headers: { ...request.headers },
        body: bodySnapshot,
      })

      const handler = routes[key]
      if (!handler) {
        return HttpClientResponse.fromWeb(
          request,
          new Response('not found', { status: 404 }),
        )
      }
      const canned =
        typeof handler === 'function'
          ? yield* Effect.promise(async () =>
              handler({
                request,
                url,
                method,
                call: counts[key]!,
              }),
            )
          : handler
      return HttpClientResponse.fromWeb(request, toWebResponse(canned))
    }),
  )

  return {
    layer: Layer.succeed(HttpClient.HttpClient, client),
    recorder,
  }
}

const snapshotBody = (
  request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<unknown> =>
  Effect.gen(function* () {
    const body = request.body
    if (body._tag === 'Empty') return undefined
    if (body._tag === 'Uint8Array') {
      const text = new TextDecoder().decode(body.body)
      try {
        return JSON.parse(text) as unknown
      } catch {
        return text
      }
    }
    if (body._tag === 'Raw') return body.body
    return undefined
  })
