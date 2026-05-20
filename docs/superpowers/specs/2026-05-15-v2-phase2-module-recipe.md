# V2 API — Phase 2 Per-Module Migration Recipe

Companion to `2026-05-15-v2-api-response-design.md` and `...-migration-reference.md`.
This is the concrete, repeatable recipe for migrating one module's controller(s)
to the V2 response layer. Phases 0, 1 and Task 0.3 are already done and committed.

## What already exists (do NOT rebuild — import and use)

- `~/common/response/envelope.types.ts` — `SuccessEnvelope`, `ErrorEnvelope`.
- `~/common/response/meta.types.ts` — `ResponseMetaSchema` + sub-schemas + types.
- `~/common/response/meta-builder.ts` — `MetaObjectBuilder` (chainable; `.build()` validates).
- `~/common/response/error.types.ts` — `AppException` base class, `ErrorCodes`.
- `~/common/response/app-exception.filter.ts` — `AppExceptionFilter`.
- `~/common/response/raw-response.decorator.ts` — `RawResponse` (non-JSON opt-out).
- `~/common/response/v2-controller.decorator.ts` — **`ResponseV2()`** — apply on a
  migrated controller class. It makes legacy interceptors skip the route and
  attaches `ResponseInterceptorV2` + `AppExceptionFilter`. One decorator opts in.
- `~/common/views/view.types.ts` — `parseView`, `ViewMap`, `ViewOf`.
- `~/shared/dto/pager.dto.ts` — `createPagerSchema(sortKeys)` factory.

## Per-module steps

For module `<m>` (files under `apps/core/src/modules/<m>/`):

1. **`<m>.schema.ts`** — convert every Zod object key for resources/DTOs to
   `snake_case` (Phase 1 already made the Drizzle columns snake_case, but the
   repository `mapRow` still emits camelCase domain models — so also make the
   repository emit snake_case for this module, OR have the controller parse the
   raw snake_case row through the view; pick whichever is least invasive and
   keep it consistent within the module).

2. **`<m>.views.ts`** (NEW) — named views per design §3:
   ```ts
   export const <M>Views = {
     card: <M>Schema.pick({ ... }),
     summary: <M>Schema.pick({ ... }),
     detail: <M>Schema,
   } as const
   export type <M>View = keyof typeof <M>Views
   ```
   List endpoints default to `card`, detail endpoints to `detail`. A resource
   with few fields may have fewer views.

3. **`<m>.exceptions.ts`** (NEW) — typed exceptions extending `AppException`
   with stable `SCREAMING_SNAKE_CASE` codes, e.g.
   ```ts
   export class <M>NotFoundException extends AppException {
     constructor(id?: string) {
       super('<M>_NOT_FOUND', '<M> not found', 404, id ? { id } : undefined)
     }
   }
   ```
   Replace `CannotFindException` / `BusinessException` / `throw new HttpException`
   in this module's controller+service with these.

4. **`<m>.service.ts` / `<m>.repository.ts`** — the service returns plain rows
   (or `{ data, pagination }` for lists). It does not build envelopes or meta.

5. **`<m>.controller.ts`** — rewrite every endpoint:
   - Add `@ResponseV2()` to the controller class.
   - Success: return `{ data }` or `{ data, meta }`. A bare value also works
     (the interceptor wraps it) but prefer explicit `{ data }`.
   - Parse rows through a view: `parseView(view, <M>Views, row)` or
     `<M>Views[view].parse(row)`.
   - Build `meta` with `new MetaObjectBuilder().view(v).pagination(p)...build()`.
   - Lists: `?view=` query param (default `card`); pagination via
     `createPagerSchema([...])`. Per-item derived data (interaction, translation)
     goes in `meta` as `Record<itemId, ...>`, never spread onto items.
   - Detail: single `meta.interaction` / `meta.translation` etc.
   - Replace every `@TranslateFields` decorator with explicit translation calls
     in the handler, pushed into `meta.translation` (design §8): article body
     via `translateArticle()` flattened to `ArticleTranslationSchema` shape;
     referenced-entity fields (`category.name`) into `translation.fields`.
   - Remove `?select` handling and `applyContentPreference`.
   - Write methods (design §6): POST → 201 `{ data: detail }`, PATCH/PUT → 200
     `{ data: detail }`, DELETE → 200 `{ data: card }`, bulk → `{ data: { count, ids? } }`.
   - Throw the `<m>.exceptions.ts` classes.
   - Non-JSON routes (streams, HTML, redirects, XML/RSS): use `@RawResponse()`
     on the method instead of the legacy `@HTTPDecorators.Bypass`. `AppExceptionFilter`
     still applies, so thrown errors stay JSON-enveloped.

6. **Tests** — update this module's specs to assert `{ data, meta? }` /
   `{ error: { code, message } }`. Keep coverage; fix, don't delete.

## Bypass-only / non-JSON modules

For modules that exist only to serve non-JSON (feed RSS, pageproxy/render HTML,
sitemap XML, snippet user-defined types, serverless functions): just add
`@ResponseV2()` to the class and `@RawResponse()` to each non-JSON method, and
migrate exceptions to `AppException`. No views/meta needed.

## Do NOT

- Do not edit `~/common/response/*`, `~/common/views/*`, `pager.dto.ts`.
- Do not delete `JSONTransformInterceptor`, legacy `ResponseInterceptor`,
  `@TranslateFields`, `translation-entry.interceptor.ts`, `case.util.ts`,
  the `Bypass` alias — that is Phase 3.
- Do not touch modules outside your assigned batch beyond the MINIMAL change
  needed to keep them compiling.

## Success criteria (every batch, before returning)

- `pnpm -C apps/core run typecheck` exits 0.
- `pnpm -C apps/core run lint` exits 0.
- `cd apps/core && NODE_ENV=development pnpm exec vitest run` ends with 0 failed.
- Commit on the worktree branch: `refactor(api): Phase 2 — migrate <modules>`.
