import { Effect } from 'effect'
import open from 'open'

import { Api } from '../services/Api'
import { Renderer } from '../services/Renderer'

export type AdminEditKind = 'posts' | 'notes' | 'pages'

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
  // admin-vue3 uses hash-based vue-router; edit views live at
  // `${adminUrl}#/<kind>/edit?id=<id>`. No `/` between base and `#` so the
  // path stays canonical when the admin is mounted under a subpath.
  const base = adminUrl.replace(/\/+$/, '')
  return `${base}#/${kind}/edit?id=${encodeURIComponent(id)}`
}

/**
 * Resolve the server's admin URL from `/options/url`, build the admin
 * edit-page URL for the given resource, and open it in the user's browser.
 * Non-fatal: missing admin_url or browser-launch failures emit a warning
 * and the parent effect continues.
 */
export const openAdminEdit = (kind: AdminEditKind, id: string) =>
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
    const url = buildEditUrl(adminUrl, kind, id)
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
