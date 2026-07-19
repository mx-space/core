# Paid Articles via Membership — Implementation Plan

Spec (single source of truth, read it first):
`docs/superpowers/specs/2026-07-18-paid-articles-membership-design.md`

## Global Constraints

- Follow the spec exactly. Its Decoupling architecture section (4 rules) is
  binding: single entitlement entry point `EntitlementService.isActiveMember`,
  truncation as pure functions, one paywall gate in the post detail
  controller running AFTER enrichment/translation attach and BEFORE
  `withMeta`, and all public surfaces reading content via `getPublicText`.
- Premium is lexical-only: `is_premium` must be rejected when
  `contentFormat !== 'lexical'` (`PremiumRequiresLexical`).
- Entitlement rule: `status IN ('active','on_hold') AND now < current_period_end`.
- API responses follow the repo envelope rules (CLAUDE.md): bare value or
  `withMeta`; errors via `AppException` subclasses with stable codes.
- Zero comments / zero JSDoc in new code (repo rule).
- Migrations are expand-only (rolling deploys). Use the `mx-migration-author`
  skill conventions; run `pnpm -C apps/core run lint:migrations`.
- IDs are Snowflake bigint, serialized as strings at API boundaries.
- Lint/typecheck only the files you touched, never the whole project.
- Provider SDKs (`dodopayments`, `standardwebhooks`) may be imported ONLY
  inside `modules/membership/providers/` adapter files.
- Tests: Vitest; e2e via `createE2EApp` (`test/helper/create-e2e-app.ts`)
  and `startPgTestContainer` where PG is needed.

## Task 1: Database schema, migration, repositories

Add to `apps/core/src/database/schema/`:

- `posts`: new column `is_premium boolean not null default false` (TS prop
  `isPremium`, explicit snake_case column name, matching existing style).
- New table `memberships` and new table `billing_webhook_events` exactly as
  specified in the spec's Data model section (columns, nullability, unique
  constraints: `memberships.reader_id` unique, `memberships.provider_subscription_id`
  unique, `billing_webhook_events (provider, event_id)` unique).

Generate/author the expand-only SQL migration in
`apps/core/src/database/migrations/` (next sequential number, follow
existing file naming). Run `pnpm -C apps/core run lint:migrations`.

Create `MembershipRepository` and `BillingWebhookEventRepository` extending
`BaseRepository`, registered via `repository.tokens.ts`, following the
existing repository pattern (see e.g. the post or reader repository).

Tests: repository CRUD smoke test with `startPgTestContainer` (follow an
existing repository spec as template), asserting unique constraints fire.

## Task 2: Lexical truncation pure helpers

In the Lexical helper layer (near `helper.lexical.service.ts`, e.g.
`apps/core/src/processors/helper/lexical/paywall-truncate.ts` or the
directory where lexical utils live — follow existing structure):

- `truncateLexicalContent(contentJson: string, nBlocks: number): string` —
  returns Lexical JSON containing only the first N top-level blocks of the
  root node. Pure function, no DI.
- `renderTeaserText(truncatedJson: string): Promise<string>` (or sync if the
  headless API allows) — regenerates teaser markdown from the truncated
  state via `createHeadlessEditor()` + `allHeadlessNodes` + `$toMarkdown()`,
  same pattern as `helper.lexical.service.ts`.

Unit tests (no PG, no app): truncation keeps exactly N top-level blocks,
handles N >= block count (returns unchanged), invalid JSON throws or returns
a safe empty state (pick one behavior and test it), teaser text equals
`$toMarkdown` of the truncated state.

## Task 3: Membership module core (services, adapter, Dodo provider, config, errors)

New module `apps/core/src/modules/membership/`:

- `providers/provider.interface.ts`: `PaymentProviderAdapter` and
  `NormalizedBillingEvent` exactly as in the spec (including
  `plan_changed`).
- `providers/dodo.provider.ts`: implements the interface with the
  `dodopayments` Node SDK (`checkoutSessions.create`, metadata carries
  `readerId`) and `standardwebhooks` verification. Event mapping per spec.
  Add both packages to `apps/core/package.json`.
- `membership.service.ts`: `applyEvent(event: NormalizedBillingEvent)` —
  insert into `billing_webhook_events` first (skip processing when
  `(provider, event_id)` already exists), upsert `memberships` state, set
  `processed_at`. Also `getByReaderId`, manual grant upsert
  (`provider: 'manual'`, rejected when a live provider-managed subscription
  exists), manual revoke (manual rows only → `cancelled`).
- `entitlement.service.ts`: `isActiveMember(readerId): Promise<boolean>`
  implementing the entitlement rule. This is the ONLY export other modules
  may consume.
- Configs module: add a `membership` section (`enabled`, `provider`,
  `monthlyProductId`, `yearlyProductId`) to `configs.schema.ts` following
  existing section patterns. Secrets `DODO_API_KEY` / `DODO_WEBHOOK_KEY`
  read from env via `app.config.ts` conventions.
- Error codes: add `MembershipRequired`, `WebhookVerifyFailed`,
  `MembershipProviderNotConfigured`, `PremiumRequiresLexical` to the error
  definitions (`app-error-definitions.ts` / `ErrorCodeEnum`), statuses per
  spec.

Unit tests with mocked repositories and mocked SDK: applyEvent idempotency,
state transitions (activated/renewed/on_hold/cancelled/plan_changed),
entitlement matrix (active / on_hold in grace / cancelled / expired
period / none), manual grant rejection when provider subscription live.

## Task 4: Membership HTTP API

Controller(s) in `apps/core/src/modules/membership/` per the spec API table:

- `POST /membership/checkout` — `@Auth` reader; body `{ plan }` (Zod);
  throws `MembershipProviderNotConfigured` when configs incomplete; returns
  `{ checkoutUrl }`.
- `GET /membership/status` — `@Auth` reader; current reader's membership
  (status, plan, provider, currentPeriodEnd) or a `none` shape.
- `POST /membership/webhook/:provider` — public; raw body for signature
  verification (find how the app exposes raw body with Fastify; if a raw
  body plugin/config is needed, add it narrowly for this route);
  `WebhookVerifyFailed` (400) on bad signature; then
  `membershipService.applyEvent`.
- `GET /membership/members` — owner (`@Auth` with admin/owner guard used by
  other admin endpoints); paginated member list.
- `PUT /membership/members/:readerId` — owner; body `{ plan, expiresAt }`;
  manual grant/extend per spec.
- `DELETE /membership/members/:readerId` — owner; manual revoke per spec.
- Checkout + webhook mutation paths throw `BanInDemoExcpetion` in demo mode
  (follow existing demo-guard usage).

E2E tests via `createE2EApp` + `startPgTestContainer` with the provider
adapter mocked: each endpoint's happy path, webhook idempotent double
delivery, signature failure 400, checkout without config →
`MembershipProviderNotConfigured`, manual grant/revoke flows, auth guards
(anonymous 401 on reader routes, reader 403 on owner routes).

## Task 5: Paywall enforcement in post serving

- Write-side validation: setting `isPremium: true` on a post whose
  `contentFormat !== 'lexical'` throws `PremiumRequiresLexical` (400) —
  enforce in post schema/service on create and update. Add `isPremium` to
  `post.schema.ts` write schema.
- `meta.types.ts`: add `paywall: z.object({ locked: z.boolean(), previewBlocks: z.number().optional() }).optional()`
  to `PostResponseMetaSchema`; add `.paywall()` to `PostMetaBuilder`.
- Post detail handlers (`getByCateAndSlug` / `getById` in
  `post.controller.ts`): after enrichment/translation attach and before
  `withMeta`, when `post.isPremium` and requester is not owner and
  `!entitlementService.isActiveMember(readerId)`: replace `content` with
  `truncateLexicalContent(content, N)` (N = `meta.paywall.previewBlocks`
  ?? 3), replace `text` with the regenerated teaser, set
  `metaBuilder.paywall({ locked: true, previewBlocks: N })`. Entitled or
  owner: `paywall({ locked: false })` only when the post is premium.
  Mirror the note secret pattern (`note.controller.ts:164-196`) for how the
  reader identity is resolved (`@HasAdminAccess()` etc.).
- Caching: if the post detail path is Redis-cached, add the entitlement
  dimension (`locked`/`unlocked`) to the cache key for premium posts. If
  detail responses are not cached today, state that in your report instead
  of adding caching.

E2E tests: entitlement matrix over a premium lexical post (anonymous /
non-member reader / active member / on_hold member / expired / owner),
truncation applied to both `content` and `text`, `meta.paywall` shape in
both states, non-premium post has no `paywall` meta, `isPremium` on a
markdown post → 400.

## Task 6: Public-surface accessor and wiring

- `getPublicText(post)` helper (location: post module or shared, wherever
  it avoids dependency cycles): premium → teaser (truncate + render, using
  Task 2 helpers with the post's `previewBlocks`), else full `text`.
- Wire it into every public emitter of post content: RSS/feed generation,
  search index (if the app indexes full text — check the search module),
  gateway/websocket broadcast of post create/update events. AI summary
  generation intentionally keeps reading full text — do not change it.
- Audit: grep for direct `\.text` consumers of posts feeding public
  surfaces; list in your report any you deliberately left unchanged and why.

Tests: unit test `getPublicText` (premium vs free); one test per wired
surface asserting a premium post emits teaser only (mock what is heavy).

## Task 7: Reader list membership summary and filter

- Reader list endpoint (`GET /readers`, reader module): left-join
  `memberships`; each row gains `membership: { status, plan, provider, currentPeriodEnd } | null`.
- `ReaderListQuerySchema` gains `membershipStatus` filter:
  `active | on_hold | cancelled | expired | none` (`expired` = has row but
  period end passed; `none` = no row). Filtering in SQL.
- Update reader views schema if the list passes through one.

Tests: e2e or repository-level with PG container — list carries membership
summary; each filter value returns the correct subset.

## Task 8: api-client types and endpoints

In `packages/api-client`: typed `membership` controller/endpoints
(`checkout(plan)`, `status()`) following the existing per-resource client
structure, and `meta.paywall` type on post detail responses. Follow the
package's existing patterns and tests (if the package has controller
tests, add matching ones). Build the package (its own build only) to verify
types compile.

## Task 9: Admin post editor paywall controls

`apps/admin/src/features/write/components/WriteRouteViewsContent.tsx` (and
whatever preset/store carries post form state): add a premium toggle and a
`previewBlocks` number input (default 3, min 1), visible for posts only,
enabled only when the editor is in Lexical mode. Persist to `isPremium` and
`meta.paywall.previewBlocks`. Follow the file's existing field patterns
(how `copyright`/`pin` are wired). Scope: minimal diff in this large file.

Verify: lint/typecheck touched files; if the admin app has component tests
for this area, add one; otherwise a manual reasoning note in the report.

## Task 10: Admin readers page membership UI

`apps/admin/src/features/readers/`:

- `ReaderListRow`: membership status badge (active / on_hold / cancelled /
  expired / none, with plan + provider).
- `ReadersToolbar`: `membershipStatus` filter wired to the extended list
  query (Task 7 param).
- Reader detail (`readers/[id]` route content): membership block (status,
  plan, provider, period end) with owner actions: grant/extend modal
  (pattern of `BanReaderModal`; fields plan + expiry date; calls
  `PUT /membership/members/:readerId`) shown when no live provider-managed
  subscription; revoke button (DELETE) for manual grants only;
  provider-managed rows show a hint to manage in the provider dashboard.
- Extend the admin's API layer for the new endpoints following its existing
  data-layer patterns.

Verify: lint/typecheck touched files; existing test conventions if any.
