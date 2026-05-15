# Open Graph Browser-Mode Hardening

**Status:** Draft
**Date:** 2026-05-15
**Owner:** Innei
**Related:** `docs/superpowers/specs/2026-05-12-enrichment-screenshot-design.md`

## Problem

The Open Graph enrichment provider supports a `browser` fetch mode backed by the
`agent-browser` CLI. In production it still hits HTTP 403 and Cloudflare/Akamai
challenge pages with measurable frequency, polluting the enrichment cache with
"Just a moment" / "Access denied" HTML and capturing the challenge view as a
screenshot.

Five concrete failure modes drive this:

1. **Headless fingerprint exposed.** Default agent-browser launch leaves
   `navigator.webdriver === true` and other Chromium automation tells. Bot
   gates fire immediately.
2. **No UA or Accept-Language override.** Default Chromium UA on Linux + no
   `Accept-Language` is a strong "non-human" signal.
3. **Wait is too short.** `wait 1500` (1.5 s) never gives a Cloudflare JS
   challenge time to complete; the page DOM at extraction is the challenge,
   not the real site.
4. **HTTP status is invisible.** `agent-browser open` does not throw on 4xx /
   5xx; the service receives the challenge body as if it were normal HTML and
   caches it.
5. **Challenge HTML masquerades as success.** Even when status is 200 (CF
   serves its JS-challenge under 200 + `cf-mitigated` header), the body is a
   challenge, not the target page, so OG parsing returns garbage and the
   screenshot pipeline captures the challenge view.

## Goals

- Fail fast and cleanly when a target returns HTTP 4xx/5xx — no challenge body
  enters the cache.
- Detect Cloudflare/Akamai/Imperva challenge pages by signature and retry once
  before giving up.
- Reduce the rate of cold-start refusals by serving a realistic UA, a
  reasonable `Accept-Language`, and one chromium flag that removes the most
  obvious automation tell.
- Stay within the existing 25 s wall budget for browser-mode fetches — no new
  config keys.

## Non-Goals

- A full stealth fingerprint suite (`puppeteer-extra-plugin-stealth` parity).
  Out of scope for this iteration. We do exactly one chromium arg:
  `--disable-blink-features=AutomationControlled`.
- Host-level backoff / circuit breaking. The existing per-row
  `recordFailure` + SWR backoff is sufficient for now.
- Admin UI / settings surface for UA, Accept-Language, retry budget. All
  hardcoded constants.
- HTTP-mode (`fetchMode: 'fetch'`) hardening. Stays on `safeFetch` unchanged.
- Upstream agent-browser changes. We constrain ourselves to capabilities
  already shipped in 0.26.

## Design

### Constants

New file `apps/core/src/modules/enrichment/providers/open-graph/og-browser-constants.ts`:

```ts
// Real Chrome 138 (Linux x86_64) — kept in step with the chromium ship by
// agent-browser when its skill ref bumps.
export const OG_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const OG_ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'

// Single chromium arg: removes navigator.webdriver. Other "stealth" tricks
// (plugins, WebGL vendor, Permissions API) are deferred — they require a
// JS shim layer, which is out of scope for this iteration.
export const OG_LAUNCH_ARGS = '--disable-blink-features=AutomationControlled'

// Case-insensitive substring scan against (title + lowercase first 8KB of HTML).
export const OG_CHALLENGE_SIGNATURES = [
  'just a moment',
  'attention required',
  'access denied',
  'verify you are human',
  '403 forbidden',
  'pardon our interruption',
]

export const OG_CHALLENGE_RETRY_MAX = 1
export const OG_NETWORKIDLE_MS = 10_000
export const OG_HTML_SCAN_HEAD_BYTES = 8 * 1024
```

### New error type

In `apps/core/src/modules/enrichment/enrichment.types.ts`:

```ts
export class ChallengeBlockedError extends Error {
  readonly code = 'challenge_blocked' as const
  constructor(
    public readonly url: string,
    public readonly signature: string,
  ) {
    super(`challenge page detected for ${url} (signature: "${signature}")`)
    this.name = 'ChallengeBlockedError'
  }
}
```

Distinct from generic fetch errors so:
- `enrichment.service.ts` logs `info` instead of `warn` (challenge is
  expected, not an outage),
- a future admin filter can surface "blocked by anti-bot" separately,
- callers can match by `error.code === 'challenge_blocked'`.

### `runSession` flow (replacement)

`browser-fetch.service.ts` keeps its public surface (`fetchHtml`, `fetchPage`,
`attachScreenshotBytes`, `takeScreenshotBytes`). The internal `runSession`
private method is rebuilt around the agent-browser 0.26 batch + network
inspection capabilities.

**Sequence per request:**

1. `parseAndValidateUrl(rawUrl)` → `assertHostnameSafe(hostname)`.
2. Acquire pool slot. Compute `baseArgs = ['--session', slot.name,
   '--user-agent', OG_USER_AGENT, '--headers', JSON.stringify({
   'Accept-Language': OG_ACCEPT_LANGUAGE }), '--args', OG_LAUNCH_ARGS]`. These
   are passed on every `execFileAsync` against this slot. agent-browser
   applies them at chromium launch and ignores on already-running sessions —
   safe to send unconditionally.
3. Start wall clock `started = Date.now()`. Allocate AbortController with
   `opts.timeoutMs`.
4. **Navigation batch** (single `execFileAsync`, `batch --bail --json`):
   ```
   open <url>
   wait --load networkidle --timeout <OG_NETWORKIDLE_MS>
   eval -b <pageScript>
   ```
   `pageScript` returns `JSON.stringify({ href, html, title })`.
5. `markLive(slot)`.
6. `await assertBrowserFinalUrlSafe(parsed.href)`.
7. **Document status check**: separate `execFileAsync`:
   ```
   network requests --filter <hostGlob> --type document --status 400-599 --json
   ```
   `hostGlob` is `https://<hostname>/**` so the filter catches the URL and
   any same-host redirect target while excluding subresources. If the output
   array is non-empty, take the **last** entry (final navigation after any
   redirect chain) and throw
   `Error('agent-browser navigation returned HTTP <status> for <url>')`.
8. **Challenge detection** (`detectChallenge(html, title)`):
   - Lowercase `title` and `html.slice(0, OG_HTML_SCAN_HEAD_BYTES)`.
   - For each entry in `OG_CHALLENGE_SIGNATURES`, return the matching
     signature if found in either string.
   - Returns `null` on clean pages.
9. If signature found and `retriesSoFar < OG_CHALLENGE_RETRY_MAX`:
   ```
   batch:
     reload
     wait --load networkidle --timeout <OG_NETWORKIDLE_MS>
     eval -b <pageScript>
   ```
   Re-run steps 6–8 on the new payload. If detection still hits, throw
   `ChallengeBlockedError(url, signature)`.
10. Truncate `html` to `opts.maxBodyBytes`. Build `SafeFetchResult`.
11. Resolve `shouldCapture` (boolean or predicate against the safe result).
12. If capturing, run viewport + screenshot subcommands as today
    (`captureScreenshot` helper, unchanged), with `remaining = max(500,
    opts.timeoutMs - elapsed)`.
13. Release slot. Return `{ html, screenshotBytes }`.

**Error handling:**

| Where | Behavior |
|---|---|
| Step 2 — pool acquire | propagate |
| Step 4/9 — execFileAsync abort | pool.release(slot, no-discard) — slot may still be reusable; rethrow `agent-browser timed out` (existing behavior) |
| Step 4/9 — execFileAsync non-timeout failure | `pool.release(slot, { discard: true })` (existing behavior) |
| Step 7 — HTTP ≥ 400 | release slot (no-discard, chromium still healthy), throw `fetch_failed` style error |
| Step 9 retry exhausted | release slot (no-discard), throw `ChallengeBlockedError` |
| Step 12 — screenshot failure | swallow + debug log (existing behavior) |

### Method shape inside `browser-fetch.service.ts`

```ts
private buildBaseArgs(slot: PoolSlot): string[]
private async runNavigationBatch(
  executable: string,
  slot: PoolSlot,
  url: URL,
  ac: AbortController,
  opts: SafeFetchOptions,
): Promise<{ href: string; html: string; title: string }>
private async fetchDocumentStatus(
  executable: string,
  slot: PoolSlot,
  originUrl: string,
  ac: AbortController,
): Promise<{ status: number; url: string } | null>
private detectChallenge(html: string, title: string): string | null
private async reloadAndExtract(
  executable: string,
  slot: PoolSlot,
  ac: AbortController,
  opts: SafeFetchOptions,
): Promise<{ href: string; html: string; title: string }>
```

`runSession` becomes orchestration: acquire, navigate, status check, detect,
optional retry, screenshot, release.

### Wall-budget accounting (no new config)

Default `DEFAULT_BROWSER_TIMEOUT_MS = 25_000`. Worst-case path:

| Step | Budget |
|---|---|
| open + networkidle (capped 10 s) | ≤ 10 s |
| eval (combined href+html+title) | ≤ 1 s |
| network requests inspection | ≤ 1 s |
| reload + networkidle (one retry) | ≤ 10 s |
| screenshot (set viewport + capture) | ≤ 5 s, floored 500 ms |
| **total worst** | ≤ 27 s |

The 27 s worst case exceeds 25 s only when *every* step hits its individual
cap. In practice the absolute AbortController fires at 25 s, dropping the
screenshot step first (acceptable — screenshot is best-effort). No new
configuration is added; if real traffic shows the timeout is too tight we
revisit before adding a config knob.

### Failure flow into `enrichment.service.ts`

No new logic in the service for cold-miss path — `runSession` errors bubble
up `OpenGraphProvider.fetch` → `fetchAndPersist` → `resolve.catch` → existing
log + rethrow. Refresh-task path likewise reuses existing `recordFailure`
backoff.

Only change: lower log level to `info` when `error instanceof
ChallengeBlockedError`. HTTP-status errors stay at `warn` (an unexpected 4xx
on a previously-working URL is worth surfacing). The conditional lives in
the existing `catch` block in `resolve()` and in the `onModuleInit` task
handler. Rationale for the `info` downgrade: challenge pages are an
expected domain-level signal from anti-bot infrastructure, not an outage —
keeping them at `warn` floods on-call dashboards.

## Files changed

**New**
- `apps/core/src/modules/enrichment/providers/open-graph/og-browser-constants.ts`
- `apps/core/test/src/modules/enrichment/browser-fetch.spec.ts` (extend if
  exists)

**Modified**
- `apps/core/src/modules/enrichment/providers/open-graph/browser-fetch.service.ts`
  — `runSession` rewrite + 5 new private methods. Estimated final size
  ≤ 480 LOC (current 388).
- `apps/core/src/modules/enrichment/enrichment.types.ts` — add
  `ChallengeBlockedError`.
- `apps/core/src/modules/enrichment/enrichment.service.ts` — two log-level
  downgrades only.

**Unchanged**
- `browser-session-pool.ts`
- `open-graph.provider.ts`
- `screenshot-storage.service.ts`, `screenshot-pipeline.service.ts`
- HTTP-mode path (`safeFetch`)

## Testing

Vitest unit suite with `execFile` mocked. Each test asserts both the argv
passed to agent-browser and the return value / thrown error.

| Case | Asserts |
|---|---|
| clean page, no screenshot | argv contains `--user-agent`, `--headers`, `--args`; batch contains `wait --load networkidle --timeout <OG_NETWORKIDLE_MS>` |
| HTTP 403 main document | throws non-Challenge `Error` with message containing `403` |
| HTTP 500 main document | same shape as 403 |
| challenge first try, clean retry | one `reload` batch, returns clean `SafeFetchResult` |
| challenge twice | throws `ChallengeBlockedError`, `signature` matches first match |
| networkidle never fires | AbortController fires, throws timeout error |
| status query returns empty | no throw, normal path proceeds |
| screenshot decision predicate returns false | no `set viewport` / `screenshot` invocations |
| pool discard on non-timeout error | asserts `pool.release(slot, { discard: true })` was called |

E2E with a real chromium is not part of this spec — agent-browser CLI is the
contract surface, and the unit suite covers it. A staging smoke against a
known CF-protected URL is fine to run manually but is not gated.

## Rollout

1. Land the change behind no flag (it strictly improves the existing
   `browser` mode and degrades cleanly to "throws on protected sites" instead
   of "caches challenge HTML").
2. Watch enrichment failure metrics for one week. Expect:
   - Increase in `ChallengeBlockedError` and HTTP-status throws on the cold
     path (these were silently caching bad data before).
   - Decrease in "OG card renders a screenshot of a CF challenge" reports.
3. If `recordFailure` backoff over-suppresses legitimate sites that became
   reachable, revisit by extending the existing per-row `failureCount`
   reset behavior — not in this spec.

## Open questions

None remaining for this iteration. Future work (deferred):

- Full stealth shim layer (plugins/WebGL/Permissions/Notification spoof).
- Per-host backoff cache in Redis keyed by hostname.
- Admin UI surface for UA / Accept-Language / retry budget if hardcoded
  defaults prove inadequate.
- Upstream agent-browser feature request: native `--stealth` flag and
  `open --fail-on-http-error`.
