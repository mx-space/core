# Enrichment `/resolve` Public-Endpoint Hardening

> 2026-05-12 · scope: `apps/core/src/modules/enrichment` · status: design

## Background

`EnrichmentController` exposes two public (no-auth) endpoints that can trigger an upstream third-party fetch on cache miss:

- `GET /enrichment/resolve?url=...` — URL → provider match → Redis/DB lookup → on miss, calls `fetchAndPersist` which invokes the matched provider's upstream client (TMDB API, GitHub API, OG scrape via `safe-fetch`, etc.) and writes a row to `enrichment_results`.
- `GET /enrichment/:provider/*` — `(provider, externalId)` → DB lookup → on miss, calls `fetchAndPersist`.

The admin endpoints (`/admin/list`, `/admin/refresh/...`, `/admin/cache/...`, `/admin/providers`) are gated by `@Auth()` and are out of scope.

SSRF, response-body size, redirect-loop, content-type, and per-URL DB de-dup protections already live inside `providers/open-graph/safe-fetch.ts` and the repository layer. Provider failure backoff (exponential, 60s → 86400s) limits repeated upstream calls for the same `(provider, externalId)` after errors.

Frontend-side, the Yohaku inline-link hover feature
(`Yohaku/docs/superpowers/specs/2026-05-11-inline-link-enrichment-design.md`)
relies on `/resolve` being able to trigger a synchronous upstream fetch on the first hover of an inline `<a>` whose URL is not yet in the SSR-hydrated `EnrichmentMap` (inline links are intentionally excluded from
`UrlExtractorService.extractFromLexical`). React Query is configured with
`staleTime: Infinity` and `retry: false`, so a `204` response will not be retried within a session.

## Threat Model

| Threat | Current state |
|---|---|
| Single-IP flood of arbitrary URLs → 8s timeout × N → CPU/network DoS | No throttle on the endpoint. Global `ExtendThrottlerGuard` is APP-wide but no `@Throttle` decorator is applied. |
| Distributed flood targeting URLs that match a configured provider (e.g. `themoviedb.org/movie/<N>`, `github.com/<u>/<r>`) → upstream API quota burn | No origin check; anyone can drive the provider chain. |
| Anonymous attacker fills `enrichment_results` with rows for arbitrary URLs they pick (one row per unique URL hash) | DB row growth is unbounded for any URL the provider chain matches. |
| Cross-site scripts on third-party pages calling `/resolve` (no-CORS or `<img>` tricks) | No origin/referer check. |

The DoS / quota-burn pair is the practical concern. The DB-row-growth concern is a side effect of the same primitive.

## Goals

1. Restrict anonymous traffic on `/resolve` and `/:provider/*` to requests originating from the site's own frontend (`url.webUrl`) or admin panel (`url.adminUrl`) as configured in the `url` config section.
2. Cap anonymous burst rate per IP on those two endpoints.
3. Preserve the existing Yohaku inline-link UX: a browser fetch from `webUrl` still triggers a synchronous upstream fetch on cold cache.
4. Preserve all admin-controlled flows (admin token, API key, OAuth session) without restriction.

## Non-Goals

- Changing `safe-fetch.ts`. Its SSRF / size / redirect protections are independent of this work.
- A per-URL allowlist (rejected: requires backfill, doc-write hook changes, and a stale-set rebuild policy; the `Origin` check covers the same threat with a fraction of the complexity for our threat model — browsers prevent forging `Origin` from a different site).
- Changing `extractFromLexical` or any doc-write prefetch path.
- Touching the admin endpoints. `@Auth()` already gates them.
- Per-URL rate limiting on the fetch (existing failure backoff is already adequate; per-URL CAS adds Redis state for marginal benefit).

## Design

### Layer 1 — `@Throttle` on the two public endpoints

Apply `@Throttle({ default: { limit: 30, ttl: 60_000 } })` to `resolve()` and `getOne()` only.

`ExtendThrottlerGuard` is already registered globally and:
- skips throttling for authenticated requests (`req.user` truthy)
- tracks anonymous clients by IP via `getIp(req.raw)`
- emits HTTP 429 via the existing `AnyExceptionFilter`

No guard registration change is required. The `enableThrottleGuard` config flag only controls the bark-notification side-channel, not the guard itself.

Rate budget rationale: a reader skimming a long article hovering inline links produces at most a handful of `/resolve` calls per second; 30/min/IP is well above natural traffic and well below what a script can produce. The number is a tuning knob — keep as a module-level constant for easy adjustment.

### Layer 2 — `EnrichmentOriginGuard`

New file: `apps/core/src/modules/enrichment/enrichment-origin.guard.ts`.

```ts
@Injectable()
export class EnrichmentOriginGuard implements CanActivate {
  constructor(private readonly configsService: ConfigsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = getNestExecutionContextRequest(context)
    if (req.user) return true // admin token / api-key / session

    const reqOrigin = pickRequestOrigin(req)
    if (!reqOrigin) throw new ForbiddenException('origin required')

    const allowed = await this.allowedOrigins()
    if (!allowed.has(reqOrigin)) {
      throw new ForbiddenException('origin not allowed')
    }
    return true
  }

  private async allowedOrigins(): Promise<Set<string>> {
    const url = await this.configsService.get('url')
    return new Set(
      [url.webUrl, url.adminUrl]
        .filter((u): u is string => typeof u === 'string' && u.length > 0)
        .map(toOriginOrNull)
        .filter((o): o is string => o !== null),
    )
  }
}

function pickRequestOrigin(req: FastifyBizRequest): string | null {
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin.length > 0) {
    return toOriginOrNull(origin)
  }
  const referer = req.headers.referer
  if (typeof referer === 'string' && referer.length > 0) {
    return toOriginOrNull(referer)
  }
  return null
}

function toOriginOrNull(raw: string): string | null {
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}
```

Behavior:
- If `req.user` is present (admin token, API key, or OAuth/session resolved upstream by the auth chain), skip the check.
- Otherwise require `Origin` (preferred — browsers set it on `fetch` and cannot be forged from a different site) or fall back to `Referer` (covers older browsers and `no-cors` paths).
- Allowed set is derived from `config.url.webUrl` and `config.url.adminUrl`, normalized to `URL.origin` (scheme + host + port; trailing slash and path stripped).
- Empty / unparsable config entries are filtered out. If both are empty, no anonymous origin matches and all anonymous traffic returns 403 — surfaces a config misconfiguration loudly.
- `ConfigsService.get('url')` is cached by the service; the lookup is cheap.

Applied at the method level on `resolve()` and `getOne()` via `@UseGuards(EnrichmentOriginGuard)`. Admin endpoints are unaffected.

### Error responses

- 403 — `ForbiddenException` with message `origin not allowed` or `origin required`. The existing `AnyExceptionFilter` serializes both into the project's standard error shape.
- 429 — emitted by `ExtendThrottlerGuard` → handled by the same filter (`请求过于频繁，请稍后再试`).

### Interaction with Yohaku inline-link hover

The frontend fetches `/enrichment/resolve?url=...` from the browser. Browsers attach `Origin: <webUrl-origin>` automatically on `fetch()`. The guard allows it, the existing SWR flow runs, and the response is the same shape as today.

Cross-site scripts (e.g., a malicious page calling `fetch('https://api.example.com/enrichment/resolve?url=...')`) will attach their own `Origin`. That origin will not match `webUrl` / `adminUrl` and is rejected with 403.

`curl` / scripted clients that omit `Origin` and `Referer` are rejected with 403.

mx-core's own server-side enrichment paths (`attachEnrichments`, `hydrateRefs`, `hydrateUrls`, `prefetchUrls`) all call `EnrichmentService` directly in-process — they never hit the HTTP layer, so the guard does not affect SSR or the doc-write prefetch hook.

## Files

**New:**
- `apps/core/src/modules/enrichment/enrichment-origin.guard.ts` — guard + helpers
- `apps/core/src/modules/enrichment/__tests__/enrichment-origin.guard.spec.ts` — unit tests

**Modified:**
- `apps/core/src/modules/enrichment/enrichment.controller.ts`
  - Import `@Throttle` from `@nestjs/throttler` and `EnrichmentOriginGuard`
  - Apply `@Throttle({ default: { limit: 30, ttl: 60_000 } })` + `@UseGuards(EnrichmentOriginGuard)` on `resolve()` and `getOne()` only
- `apps/core/src/modules/enrichment/enrichment.module.ts`
  - Add `EnrichmentOriginGuard` to `providers`
- `apps/core/test/src/modules/enrichment/enrichment.controller.e2e-spec.ts`
  - New file. No e2e for this controller exists today; add one covering the 403 / 429 / 200 branches for `/resolve` and `/:provider/*`.

No schema, migration, or frontend changes.

## Testing

**Unit (`enrichment-origin.guard.spec.ts`):**
- `req.user` present → pass regardless of headers
- Origin header matches `webUrl` → pass
- Origin header matches `adminUrl` → pass
- Origin header set but unparsable → 403
- Origin missing, Referer matches `webUrl` → pass
- Origin missing, Referer set but unparsable → 403
- Origin and Referer both missing → 403
- Origin from a non-allowed host → 403
- `webUrl` and `adminUrl` both empty/null → all anonymous → 403
- `webUrl` configured with trailing slash + path → normalized origin still matches a header without trailing slash

**E2E:**
- `GET /enrichment/resolve?url=...` with no Origin → 403
- `GET /enrichment/resolve?url=...` with `Origin: <webUrl>` → 200 / 204
- `GET /enrichment/resolve?url=...` with `Origin: https://attacker.example` → 403
- `GET /enrichment/resolve?url=...` with admin token → 200 (no Origin needed)
- 31st anonymous request within 60s → 429
- `GET /enrichment/:provider/*` follows the same matrix

The throttle test uses the same mechanism as existing throttle e2e tests in `apps/core/test/`; reuse that helper.

## Rollout

Single deploy. No flag, no migration. Before rollout, verify production `url.webUrl` and `url.adminUrl` are correctly populated (they are required for the dashboard to function anyway, but worth a sanity check — if either is misconfigured, anonymous `/resolve` will start returning 403).

Post-deploy verification:
- From a logged-out browser session on the production site, hover an inline link in a post → popover renders → backend log shows a 200 from `/enrichment/resolve`.
- From `curl` without headers → 403.

If a rollback is needed, revert the controller change (guard + throttle decorators are removed); the guard file can stay in tree harmlessly.

## Open Questions Resolved

- **Guard scope** — method-level on `resolve()` + `getOne()` only. Admin endpoints rely on existing `@Auth()`.
- **Allowlist vs Origin check** — Origin check. Allowlist is over-engineering for the actual threat model (browsers don't let cross-site scripts forge `Origin`).
- **Throttle limit** — 30/min/IP starting point. Tunable via module-level constant.
- **Auth bypass** — any `req.user` truthy bypasses both layers. Throttler already does this; the guard mirrors it.
