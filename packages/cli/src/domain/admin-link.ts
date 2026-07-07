import { Effect } from 'effect'
import open from 'open'

import { Api } from '../services/Api'
import { Renderer } from '../services/Renderer'

export type AdminEditKind = 'posts' | 'notes' | 'pages' | 'projects'

// `/options/url` returns `{ data: { admin_url, web_url, ws_url, server_url } }`
// — mx-core wraps single-object responses with an outer `data` key.
interface UrlOptionsResponse {
  readonly data?: {
    readonly admin_url?: string
  }
  readonly admin_url?: string
}

const buildEditUrl = (
  adminUrl: string,
  kind: AdminEditKind,
  id: string,
): string => {
  // Admin uses hash-based react-router. posts/notes/pages route at
  // `#/<kind>/edit?id=<id>`; projects route at `#/projects/<id>`.
  const base = adminUrl.replace(/\/+$/, '')
  if (kind === 'projects') {
    return `${base}#/projects/${encodeURIComponent(id)}`
  }
  return `${base}#/${kind}/edit?id=${encodeURIComponent(id)}`
}

const buildDraftEditUrl = (
  adminUrl: string,
  kind: AdminEditKind,
  draftId: string,
  refId?: string,
): string => {
  const base = adminUrl.replace(/\/+$/, '')
  const params = new URLSearchParams()
  params.set('draftId', draftId)
  if (refId) params.set('id', refId)
  return `${base}#/${kind}/edit?${params.toString()}`
}

const openAdminUrl = (buildUrl: (adminUrl: string) => string) =>
  Effect.gen(function* () {
    const renderer = yield* Renderer
    const api = yield* Api
    const opts = yield* api.request<UrlOptionsResponse>('/options/url')
    const adminUrl = opts.data?.admin_url ?? opts.admin_url
    if (!adminUrl) {
      yield* renderer.emitWarn(
        'admin_url is not configured on the server; skipping --open',
      )
      return
    }
    const url = buildUrl(adminUrl)
    yield* renderer.emitInfo(`opening admin: ${url}`)
    yield* Effect.tryPromise({
      try: () => open(url),
      catch: () => new Error('failed to launch browser'),
    }).pipe(
      Effect.catchAll((e) =>
        renderer.emitWarn(
          `could not launch browser: ${e instanceof Error ? e.message : String(e)}`,
        ),
      ),
    )
  })

/**
 * Resolve the server's admin URL from `/options/url`, build the admin
 * edit-page URL for the given resource, and open it in the user's browser.
 * Non-fatal: missing admin_url or browser-launch failures emit a warning
 * and the parent effect continues.
 */
export const openAdminEdit = (kind: AdminEditKind, id: string) =>
  openAdminUrl((adminUrl) => buildEditUrl(adminUrl, kind, id))

export const openAdminDraftEdit = (
  kind: AdminEditKind,
  draftId: string,
  refId?: string,
) =>
  openAdminUrl((adminUrl) => buildDraftEditUrl(adminUrl, kind, draftId, refId))
