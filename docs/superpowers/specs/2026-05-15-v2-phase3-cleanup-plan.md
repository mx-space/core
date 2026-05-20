# V2 API — Phase 3 Cleanup Plan

Companion to `2026-05-15-v2-api-response-design.md` §11 and the migration
reference Tasks 3.1–3.4. Executable only AFTER all Phase 2 module batches are
merged and `pnpm -C apps/core run typecheck` + the full test suite are green on
master. Each task below is build-green-verifiable on its own.

## Pre-flight (before starting Phase 3)

Confirm zero remaining usages, module by module:

```
grep -rn "@TranslateFields\|HTTPDecorators.Bypass\|\\bBypass\\b" apps/core/src/modules
grep -rn "JSONTransformInterceptor\|snakecaseKeys\|case.util" apps/core/src
grep -rn "TranslationEntryInterceptor\|translation-entry" apps/core/src
```

Any hit = that module was not fully migrated in Phase 2; fix it before Phase 3.

## Task 3.1 — delete legacy interceptors + decorator, promote V2 interceptor

Delete:
- `apps/core/src/common/interceptors/json-transform.interceptor.ts`
- `apps/core/src/common/interceptors/response.interceptor.ts` (the LEGACY one)
- `apps/core/src/common/interceptors/translation-entry.interceptor.ts`
- `apps/core/src/common/decorators/translate-fields.decorator.ts`
- `apps/core/src/utils/case.util.ts`

Then make `ResponseInterceptorV2` the single, unconditional response interceptor:
- It currently lives at `apps/core/src/common/response/response.interceptor.ts`
  and is attached per-controller by `@ResponseV2()`. With every controller
  migrated, drop the per-controller gating: register `ResponseInterceptorV2`
  once as a global `APP_INTERCEPTOR` in `app.module.ts`, and remove the
  `UseInterceptors(ResponseInterceptorV2)` line from `v2-controller.decorator.ts`.
- Optionally move the file to `common/interceptors/response.interceptor.ts`
  (the legacy name is now free) and update imports.
- `app.module.ts`: remove the `JSONTransformInterceptor`, legacy
  `ResponseInterceptor`, and `TranslationEntryInterceptor` `APP_INTERCEPTOR`
  providers and their imports.

`@ResponseV2()` becomes either a no-op kept temporarily or is removed from all
controllers along with `RESPONSE_V2_METADATA`. Decide based on whether the
legacy filter still needs the marker — once `AllExceptionsFilter` is replaced
(Task 3.3 path) the marker can go.

## Task 3.2 — remove the `Bypass` alias

In `apps/core/src/common/decorators/http.decorator.ts`: remove the `Bypass`
export and the `HTTPDecorators.Bypass` entry; keep `RawResponse` as the only
non-JSON opt-out. Confirm zero importers of `Bypass` first.

## Task 3.3 — migrate generic exceptions to `AppException`

Rewrite to extend `AppException` with stable codes:
- `apps/core/src/common/exceptions/cant-find.exception.ts` → code `NOT_FOUND` (404)
- `apps/core/src/common/exceptions/ban-in-demo.exception.ts` → code `DEMO_FORBIDDEN` (403)
- `apps/core/src/common/exceptions/biz.exception.ts` → keep `BusinessException`
  but make it carry a stable code; map `ErrorCodeEnum` values to SCREAMING_SNAKE codes
- `apps/core/src/common/exceptions/no-content-canbe-modified.exception.ts` → code `NO_CONTENT_MODIFIABLE` (400)

Then `AppExceptionFilter` can be promoted to the global `APP_FILTER`, replacing
`AllExceptionsFilter` — but preserve `AllExceptionsFilter`'s side effects
(Bark push on throttle, `EventBusEvents.SystemException` broadcast,
`uncaughtException`/`unhandledRejection` hooks): fold them into
`AppExceptionFilter` or a thin wrapper before deleting `AllExceptionsFilter`.

## Task 3.4 — documentation

- `apps/core/CLAUDE.md` — rewrite the "API Response Rules" section to describe
  the `{ data, meta? }` / `{ error }` envelope, named views, `MetaObjectBuilder`,
  `AppException`, `@ResponseV2`, `@RawResponse`. Add a short "writing a new
  endpoint" guide.
- `2026-05-15-v2-api-response-design.md` — set `Status: Implemented`.
- Regenerate `packages/api-client` types and bump versions if applicable.

## Success criteria

`pnpm -C apps/core run typecheck` exits 0; `pnpm -C apps/core run lint` exits 0;
full vitest suite ends with 0 failed. Commit per task.
