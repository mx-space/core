# V2/V3 Envelope Compatibility Layer

**Status:** Draft
**Author:** CLI maintainer
**Date:** 2026-05-21
**Target:** `@mx-space/cli` ≥ 0.6.0
**Scope:** `packages/cli`

## 1. Context

`mx-core` shipped a wire-format change ("V3 envelope") that the CLI has not yet
adopted. Production servers run `API_VERSION = 3`
(`apps/core/src/app.config.ts:216`) and route under `/api/v3/*`. The CLI defaults
to `api_version = 2` (`src/services/Config.ts:599`) and parses responses
assuming the V2 shape.

The wire-format diff that matters to the CLI:

| Aspect      | V2 wire                                       | V3 wire                                                              |
| ----------- | --------------------------------------------- | -------------------------------------------------------------------- |
| Success     | `{ data, pagination? }` (root-level)          | `{ data, meta? }`; `pagination` lives at `meta.pagination`           |
| Error       | `{ message, code?, details? }` (root-level)   | `{ error: { code, message, details? } }`                             |
| Case        | mixed (resource-dependent)                    | snake_case at the wire boundary                                      |
| Error codes | free-form strings or HTTP-derived             | stable `SCREAMING_SNAKE` `AppErrorCode` enum                         |
| URL prefix  | `/api/v2/<resource>`                          | `/api/v3/<resource>`                                                 |

A user-deployed `mx-core` may be either V2 (older deployments) or V3 (current).
The CLI has to work against both for the duration of the migration window —
without forking the codebase. Once all known deployments are on V3, the
compatibility shim must come out cleanly, with no permanent V2 residue.

## 2. Goals

1. The same CLI binary works against a V2 or V3 server with no user-visible
   regression in `mxs <resource> list/get/create/update/delete` output.
2. `pagination`, `error.code`, and `error.message` reach the renderer
   regardless of which wire the server emits.
3. The compat code is **isolated to a single module** with a documented
   deletion checklist. After V2 support is dropped, removing the module is a
   mechanical, grep-driven change set.
4. Existing V2 integration tests keep passing; new V3 integration tests cover
   the same surface against V3 fixtures.

## 3. Non-goals

- Changing the URL routing strategy. `apiBase = ${apiUrl}/api/v${apiVersion}`
  stays as-is. The user (or profile config) is still authoritative for which
  prefix to hit. Auto-probing is described in §5.4 as optional follow-up.
- Migrating CLI commands to typed `@mx-space/api-client` calls. The Effect-TS
  `Api` service stays low-level; the adapter operates on the parsed body.
- Touching the renderer's view registry or output modes. The adapter normalizes
  to V3 shape; renderers see only one shape.
- Server-side changes.

## 4. Design summary

A single file — `packages/cli/src/domain/envelope-compat.ts` — exports two
pure functions and one type:

```ts
export type WireVersion = 'v2' | 'v3'

export const detectWireVersion: (body: unknown) => WireVersion | null
export const normalizeSuccessBody: (body: unknown) => unknown
export const normalizeErrorBody: (body: unknown) => {
  code?: string
  message?: string
  details?: unknown
}
```

The `Api` service (`src/services/Api.ts`) calls `normalizeSuccessBody` on the
parsed 2xx body before handing it to schema decoding or the caller, and calls
`normalizeErrorBody` on the parsed non-2xx body before mapping to
`TaggedError`s. Both calls are marked with a `// COMPAT:envelope` comment so
the deletion step is grep-driven.

`detectWireVersion` is exposed for the Api service to cache a best-effort
verdict per `ApiService` instance (`Ref<WireVersion | null>`), used only for
observability (verbose log line) — the normalizers themselves are shape-tolerant
and do not require the verdict to be correct.

The two views that read root-level `pagination` (`cli/post/view.ts:126` and
`cli/comment/view.ts:137`) drop their V2 fallback and read `meta.pagination`
only. After normalization, the V2 wire is indistinguishable from V3 to the
renderer.

## 5. Detailed design

### 5.1 File layout

```
packages/cli/src/domain/envelope-compat.ts        ← new
packages/cli/test/domain/envelope-compat.test.ts  ← new
packages/cli/test/integration/cli-post-list.test.ts  ← extend with V3 fixture
```

### 5.2 `envelope-compat.ts` contract

```ts
/**
 * @deprecated Compat shim for the V2 → V3 mx-core wire-format transition.
 *
 * Remove this file once all deployments referenced by the CLI's user base
 * are confirmed V3 (`API_VERSION = 3` in mx-core). Removal checklist:
 *
 *   1. Delete this file (`envelope-compat.ts`) and its test.
 *   2. In `src/services/Api.ts`, search for `// COMPAT:envelope` and delete
 *      the two normalizer calls + the `Ref<WireVersion>` field.
 *   3. In `src/cli/post/view.ts` and `src/cli/comment/view.ts`, the
 *      `meta.pagination` reads stay (they are V3 shape, not compat code).
 *   4. In `src/services/Config.ts`, change the `api_version` default from
 *      `2` to `3`.
 *   5. In `test/integration/cli-post-list.test.ts`, drop the V2 fixture
 *      branch; keep only the V3 mock.
 *   6. Run `pnpm typecheck && pnpm test` — no references should remain.
 */

export type WireVersion = 'v2' | 'v3'

/**
 * Sniff the wire version from a parsed response body. Returns `null` if the
 * body is too small (e.g. raw scalar, FormData echo, dry-run synthetic) to
 * decide. Callers must tolerate `null`.
 *
 * V3 markers (any one suffices):
 *   - body is an object with a `meta` key, OR
 *   - body is an object with `error.code` (string) or `error.message` (string),
 *
 * V2 markers (any one):
 *   - body is an object with a root-level `pagination` key, OR
 *   - body is an object with a root-level `message: string` and no `error` key.
 *
 * When both V2 and V3 markers are present (defensive), V3 wins.
 */
export declare const detectWireVersion: (body: unknown) => WireVersion | null

/**
 * Normalize a 2xx response body to the V3 shape `{ data, meta? }`.
 *
 *   - V3 body (`{ data, meta? }`)             → returned as-is
 *   - V2 paginated (`{ data, pagination }`)   → `{ data, meta: { pagination } }`
 *   - V2 bare (`{ data }`)                    → returned as-is
 *   - Anything else (arrays, scalars, non-objects, already-unwrapped) → returned as-is
 *
 * The function is **shape-tolerant**: if the body does not match a known
 * envelope shape, it is returned unchanged. This is important because callers
 * sometimes pass already-unwrapped documents (e.g. from `--dry-run` synthetic
 * envelopes) and the renderer's `unwrapDocument` re-runs further down.
 */
export declare const normalizeSuccessBody: (body: unknown) => unknown

/**
 * Normalize a non-2xx response body to a flat `{ code?, message?, details? }`
 * tuple.
 *
 *   - V3 body (`{ error: { code, message, details? } }`)  → unwrapped
 *   - V2 body (`{ message: string | string[], code?, details? }`) → flattened
 *     - `message: string[]` is joined with `'; '` (matches the legacy
 *       `extractMessage` helper in api-envelope.ts)
 *   - Non-object body → `{}`
 *
 * The function never throws and never mutates the input.
 */
export declare const normalizeErrorBody: (body: unknown) => {
  code?: string
  message?: string
  details?: unknown
}
```

### 5.3 `Api.ts` integration

Two surgical edits, both tagged for grep:

1. **Success path** (`src/services/Api.ts`, around line 326):

   ```ts
   const body = yield* parseBody(res)
   // COMPAT:envelope — drop with envelope-compat.ts when V2 support ends
   const normalized = normalizeSuccessBody(body)
   if (res.status >= 200 && res.status < 300) {
     if (!options.schema) return normalized as A
     return yield* decodeWithSchema(options.schema, normalized)
   }
   ```

2. **Error path** (`src/services/Api.ts`, around line 405 — `mapHttpStatusToError`):

   ```ts
   function mapHttpStatusToError(status: number, body: unknown): ApiError {
     // COMPAT:envelope — drop with envelope-compat.ts when V2 support ends
     const { code, message, details } = normalizeErrorBody(body)
     // ...existing status switch, but use `message` / `code` / `details` instead
     // of `body.message` etc. The status-derived fallbacks remain unchanged.
   }
   ```

   The status switch additionally prefers `code` over status-derived tags for
   `ResourceNotFound` / `ValidationFailed` mapping when the V3 code is one of
   the stable SCREAMING_SNAKE values (`NOT_FOUND`, `VALIDATION_FAILED`,
   `<RESOURCE>_NOT_FOUND`). Status-only mapping is the fallback.

3. **Optional verbose log enrichment** — add a `Ref<WireVersion | null>` to the
   `ApiService` closure, populate it via `detectWireVersion` on the first
   parsed body, and append `[wire=v2]` / `[wire=v3]` to the verbose
   `METHOD URL → STATUS (Xms)` line. This is purely diagnostic; the normalizers
   do not consume it.

### 5.4 URL prefix selection (out of scope, possible follow-up)

The `api_version` profile field decides the URL prefix. The compat layer does
**not** auto-probe `/api/v3/aggregate` vs `/api/v2/aggregate`. A user with a V3
server must set `api_version: 3` in their profile (or pass `--api-url
https://example.com/api/v3`).

If we later want auto-detection, the touch points are:

- `parseApiUrl` in `Config.ts` already extracts `apiVersion` from explicit URLs
  like `https://example.com/api/v3` — that path needs no change.
- Add a one-shot `HEAD /api/v3/aggregate` probe to `Config.resolve` when
  `api_version` is unset, with the result cached in the profile config file.
  This is intentionally **not** part of this spec; the compat layer is
  orthogonal to URL routing.

### 5.5 View cleanup

Two files lose their V2 fallback:

```ts
// cli/post/view.ts:126 (and analogous in cli/comment/view.ts:137)
// Before:
const pagination = asRecord(first(payload, 'pagination'))
// After:
const pagination = asRecord(first(asRecord(first(payload, 'meta')), 'pagination'))
```

Adapter normalizes V2 → V3 before reaching the renderer, so the V2 read path
becomes dead code. Removing it now (rather than at deletion time) keeps the
view layer ignorant of compat concerns.

## 6. Test plan

### 6.1 Unit (`test/domain/envelope-compat.test.ts`)

- `detectWireVersion`:
  - `{ data: [], meta: {} }` → `'v3'`
  - `{ error: { code: 'X', message: 'y' } }` → `'v3'`
  - `{ data: [], pagination: { page: 1, size: 10, total: 0 } }` → `'v2'`
  - `{ message: 'oops' }` → `'v2'`
  - `{ message: ['a', 'b'] }` → `'v2'`
  - `null` / `42` / `'plain text'` / `[1, 2, 3]` → `null`
  - Mixed: `{ data, pagination, meta }` → `'v3'`
- `normalizeSuccessBody`:
  - V3 paginated → unchanged
  - V2 paginated → `pagination` moved under `meta`
  - V2 bare `{ data }` → unchanged
  - Scalar `42` / `null` / array → unchanged
  - Already-unwrapped document (no `data` key) → unchanged
- `normalizeErrorBody`:
  - V3 → unwrapped
  - V2 string `message` → flat
  - V2 array `message` → joined with `'; '`
  - V2 with `code` → preserved
  - Empty / null → `{}`

### 6.2 Integration (`test/integration/cli-post-list.test.ts`)

Split the existing test into two `it()` blocks against the same `runMxs`
harness:

- "lists posts against a V2 server" — keep the existing fixture (`/api/v2`,
  root `pagination`).
- "lists posts against a V3 server" — new fixture mocking `/api/v3` with
  `{ data, meta: { pagination } }`. Assertions on stdout are identical.

Same split for `cli-error-envelope.test.ts`: add a V3 error fixture
(`{ error: { code, message } }`) and assert the same `--json` `{ ok: false }`
output as the V2 case.

### 6.3 Manual smoke (post-merge)

Against a real V3 deployment (or local dev):

```
pnpm -C packages/cli dev -- --api-url http://localhost:2333/api/v3 post list
pnpm -C packages/cli dev -- --api-url http://localhost:2333/api/v3 note list
pnpm -C packages/cli dev -- --api-url http://localhost:2333/api/v3 post get <id>
```

Verify `count` / `page` / `total` headers appear and the documents render.

## 7. Rollout

1. Land the compat layer + tests as **non-breaking**. Default
   `api_version` stays `2`. Users on V3 servers set `api_version: 3` (or
   `--api-url .../api/v3`).
2. Update `README.md` (`mxs auth login` section and "Configuration"
   reference) to note the V2/V3 split and how to choose.
3. Cut a `0.6.0-next.x` release for early validation against both wires.
4. Once consumers confirm V3 servers work, flip `Config.ts` default to
   `api_version = 3` in a follow-up release — still keeps the compat layer
   for the long-tail V2 deployments.
5. Eventually execute the deletion checklist in §5.2 and ship a major bump
   (`0.7.0` or `1.0.0`) with the V2 path gone.

## 8. Risks and mitigations

| Risk                                                                                | Mitigation                                                                                                                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adapter misclassifies a borderline body (e.g. a resource literally named `data`)    | Normalizers are shape-tolerant — unchanged-on-mismatch. Unit tests cover every documented shape.                                                                 |
| Schema decoding in `Api.request` sees a different shape pre/post adapter            | Adapter runs **before** `decodeWithSchema`. Existing schemas (`paginatedEnvelopeSchema` etc.) already accept both V2-aliased and V3 pagination keys (per §6.2). |
| Some endpoint emits a custom non-envelope payload (e.g. `/options/<key>` raw value) | `normalizeSuccessBody` returns scalars / arrays unchanged. The shape-tolerance is the contract.                                                                  |
| User confusion about which `api_version` to set                                     | README update in step 2 of rollout. CLI verbose log prints `[wire=v2]` / `[wire=v3]` for self-diagnosis.                                                          |
| Future divergence between V2 and V3 (e.g. server adds a new V3-only field)          | Out of scope — the adapter normalizes shape, not semantics. New fields propagate through `data`/`meta` unchanged.                                                |

## 9. Open questions

1. Should the verbose log line gain `[wire=v2|v3]` annotation (§5.3.3)? — Nice
   to have, but not required for the compat semantics. Default: **yes**, small
   diff, big diagnostic win.
2. Do we want a `mxs doctor` subcommand to print the detected wire version?
   — Not in this spec. If we add one, it consumes `detectWireVersion` and
   `Ref<WireVersion>` from the Api service.
3. Should the View cleanup (§5.5) be a separate PR? — No, same change set:
   the adapter is meaningless without the view also reading `meta.pagination`.

## 10. Deletion checklist (canonical)

When V2 support ends, in order:

- [ ] `rm packages/cli/src/domain/envelope-compat.ts`
- [ ] `rm packages/cli/test/domain/envelope-compat.test.ts`
- [ ] `grep -n 'COMPAT:envelope' packages/cli/src` → remove the two call sites
      in `Api.ts` (success path + error path)
- [ ] Remove the `Ref<WireVersion>` field and verbose log annotation in
      `Api.ts`
- [ ] `packages/cli/src/services/Config.ts:599` — change
      `parsed.apiVersion ?? 2` to `parsed.apiVersion ?? 3`
- [ ] `packages/cli/test/integration/cli-post-list.test.ts` — drop the V2 `it`
      block; rename the V3 block back to a single test
- [ ] `packages/cli/test/integration/cli-error-envelope.test.ts` — same
- [ ] `pnpm -C packages/cli typecheck && pnpm -C packages/cli test`
- [ ] Bump `packages/cli/package.json` major (or pre-1.0 minor) and ship
