# Paid Articles via Membership Subscription — Design

Date: 2026-07-18
Status: Approved (brainstorming)

## Goal

Let the blog owner mark individual posts as premium. Non-members see a free
preview (the first N Lexical blocks); readers with an active membership
subscription see the full article. Membership is a single tier with monthly
and yearly billing, paid through a pluggable payment provider (Dodo Payments
first; Creem / Lemon Squeezy / Stripe as future adapters).

## Scope

- Content type: **posts only**. Notes and pages are out of scope.
- Format: **only `contentFormat === 'lexical'` posts can be premium.**
  Schema/service validation rejects `is_premium` on markdown posts.
- Identity: members are Better Auth `reader` accounts. Entitlement is bound
  to the reader, not to an email or magic link.
- One active payment provider at a time, selected in the configs module.
- No reconciliation cron in v1; state is webhook-driven. (Personal-blog
  volume; a manual re-sync can be added later if drift is observed.)

## Data model

### `posts` (existing table, expand-only migration)

- Add `is_premium boolean not null default false`.
- Per-post paywall tuning lives in the existing free-form `meta` JSONB bag:
  `meta.paywall = { previewBlocks?: number }` (default 3). No migration needed.

### `memberships` (new)

| column                   | type        | notes                                          |
| ------------------------ | ----------- | ---------------------------------------------- |
| id                       | bigint PK   | Snowflake                                      |
| reader_id                | bigint      | FK reader.id, unique                           |
| provider                 | text        | 'dodo' / 'creem' / 'lemonsqueezy' / 'stripe' / 'manual' |
| provider_customer_id     | text, null  | null for manual grants                         |
| provider_subscription_id | text, null  | unique; null for manual grants                 |
| plan                     | text        | 'monthly' / 'yearly'                           |
| status                   | text        | 'active' / 'on_hold' / 'cancelled' / 'expired' |
| current_period_end       | timestamptz | see entitlement rule below                     |
| created_at / updated_at  | timestamptz |                                                |

**Entitlement rule**: entitled when `status IN ('active', 'on_hold')` AND
`now < current_period_end`. `on_hold` (payment retry in progress at the
provider) is a grace period — access is retained until the provider settles
to `cancelled`.

### `billing_webhook_events` (new)

| column       | type        | notes                                   |
| ------------ | ----------- | --------------------------------------- |
| id           | bigint PK   | Snowflake                               |
| provider     | text        | unique together with event_id           |
| event_id     | text        | provider's event id, `(provider, event_id)` unique |
| type         | text        | raw provider event name                 |
| payload      | jsonb       | raw body, kept for audit/replay         |
| processed_at | timestamptz | null = not yet processed, retryable     |
| received_at  | timestamptz |                                         |

## Payment provider adapter layer

Location: `apps/core/src/modules/membership/providers/`.

```ts
interface PaymentProviderAdapter {
  createCheckout(input: { reader; plan: 'monthly' | 'yearly' }): Promise<{ checkoutUrl: string }>
  verifyAndParseWebhook(rawBody: Buffer | string, headers): Promise<NormalizedBillingEvent>
  getPortalUrl?(customerId: string): Promise<string>
}

interface NormalizedBillingEvent {
  eventId: string
  provider: string
  type: 'activated' | 'renewed' | 'on_hold' | 'cancelled' | 'plan_changed'
  customerId: string
  subscriptionId: string
  plan?: 'monthly' | 'yearly'
  currentPeriodEnd: Date
  readerId: string
}
```

- `readerId` round-trips through checkout metadata (supported by all four
  providers) so webhooks can be attributed to a reader.
- v1 implements `DodoProvider` only, using the `dodopayments` Node SDK
  (`checkoutSessions.create`) and `standardwebhooks` signature verification.
  Dodo events map: `subscription.active` → activated, `subscription.renewed`
  → renewed, `subscription.on_hold` → on_hold, `subscription.cancelled` /
  `subscription.expired` → cancelled, `subscription.plan_changed` →
  plan_changed (updates the `plan` column only).
- Provider SDKs are imported **only inside adapter files**. Core membership
  logic consumes `NormalizedBillingEvent` exclusively.
- Adding a provider = one new adapter file; core membership logic unchanged.

## Decoupling architecture

The paywall touches many surfaces; coupling is contained by four rules:

1. **Single entitlement entry point.** The membership module exports one
   method other modules may use: `EntitlementService.isActiveMember(readerId)`.
   The post side knows nothing about providers, tables, or billing state.
   Dependency direction is one-way: post → membership. Deleting the
   membership module leaves the post side with one call site and one gate
   function.
2. **Truncation is a pure function.** `truncateLexicalContent(json, nBlocks)`
   lives in the Lexical helper layer with no DI and no state. The teaser
   `text` is regenerated from the truncated Lexical state via `$toMarkdown()`
   (no separate markdown truncation path exists — premium is lexical-only).
   Independently unit-testable.
3. **One gate, guaranteed ordering.** Paywall application happens at exactly
   one place: the post detail controller boundary, via
   `applyPaywall(postData, entitled)`. **Invariant: the gate runs AFTER
   enrichment/translation attachment and BEFORE `withMeta`.** Translated
   content therefore passes through the same truncation automatically —
   translation leak-proofing needs no dedicated logic, only this ordering.
4. **Public surfaces read content through one accessor.** Anything that emits
   post content to a public surface — search indexing, gateway/websocket
   broadcasts, RSS/feed — must not read `post.text` directly; it calls
   `getPublicText(post)`, which returns the teaser for premium posts and the
   full text otherwise. The leakage surface collapses to one function; future
   consumers inherit the guard. Insights generation also goes through it (or
   omits excerpt fields). **Exception: AI summary intentionally reads the
   full text — summaries are free by design.**

## Configuration

- Configs module (admin-editable, `apps/core/src/modules/configs/`) gains a
  `membership` section: `enabled`, `provider` (single choice),
  `monthlyProductId`, `yearlyProductId`, `apiKey`, `webhookSigningKey`,
  `environment` (`test_mode` | `live_mode`, defaults to `live_mode`).
  Provider credentials live in this section and are editable at runtime from
  the admin settings UI rather than through provider-specific environment
  variables.
  `apiKey` and `webhookSigningKey` use the same `field.password` helper as
  other secret fields (SMTP password, AI provider API keys): encrypted at
  rest, masked to empty string on read, and rendered as password inputs in
  the schema-driven admin settings form.
- `DodoProvider` reads the section via `ConfigsService.get('membership')` on
  every call and rebuilds its cached `DodoPayments` client whenever the API
  key or environment differs from what it last built with, so changes made
  in the admin UI take effect without a restart.

## API (new `membership` module)

| route                            | auth        | behavior                                                    |
| -------------------------------- | ----------- | ----------------------------------------------------------- |
| `POST /membership/checkout`      | `@Auth` reader | body `{ plan }`; calls adapter.createCheckout; returns `{ checkoutUrl }` |
| `GET /membership/status`         | `@Auth` reader | current reader's membership (status, plan, period end)   |
| `POST /membership/webhook/:provider` | public, raw body | verify signature → insert into `billing_webhook_events` (skip if `(provider, event_id)` exists) → apply state change to `memberships` → mark `processed_at` |
| `GET /membership/members`        | owner       | paginated member list for admin                             |
| `PUT /membership/members/:readerId` | owner    | manually grant/extend membership: body `{ plan, expiresAt }`; upserts a `provider: 'manual'` row with `status: 'active'`, `current_period_end: expiresAt`. Rejected if the reader has a live provider-managed subscription (manage that in the provider portal instead) |
| `DELETE /membership/members/:readerId` | owner | revoke a manual grant (sets `cancelled`); provider-managed subscriptions cannot be revoked here |

The reader list endpoint (`GET /readers` in the reader module) is extended:
each row carries a membership summary (`status`, `plan`, `provider`,
`currentPeriodEnd`, left-joined from `memberships`), and the query schema
gains a `membershipStatus` filter (`active` / `on_hold` / `cancelled` /
`expired` / `none`).

- Webhook route uses raw-body handling as required by signature verification.
- Checkout and webhook mutation paths throw `BanInDemoExcpetion` in demo mode.

## Paywall enforcement (post serving)

In the post detail handlers (`getByCateAndSlug` / `getById` in
`post.controller.ts`), mirroring the existing note secret/password pattern:

- If `post.is_premium` and requester is not the owner and
  `!isActiveMember(readerId)`:
  - truncate Lexical `content` to the first N top-level blocks,
  - regenerate teaser `text` from the truncated state via `$toMarkdown()`,
  - set `meta.paywall = { locked: true, previewBlocks: N }` via a new
    `.paywall()` method on `PostMetaBuilder` (schema added to
    `PostResponseMetaSchema` in `meta.types.ts`).
- If entitled (owner or active member): full content,
  `meta.paywall = { locked: false }`.
- Card/summary views are unchanged (they never carry full content).
- RSS/feed, search index, and gateway broadcasts emit teaser only for
  premium posts (via `getPublicText`, see Decoupling rule 4).
- **Caching**: any Redis-cached post detail must key on the entitlement
  dimension (e.g. append `locked`/`unlocked` to the cache key for premium
  posts), so a truncated body is never served to a member or vice versa.

Truncation happens server-side; full content never leaves the server for
unentitled requests.

## Admin UI

### Membership settings

`apps/admin/src/features/settings/` renders the `membership` config section
with a dedicated guided editor rather than the generic schema field list. It
shows configuration readiness, explains the provider environment and recurring
product IDs, derives the public webhook endpoint from the admin's active API
base, lists the exact subscription events required by the selected adapter, and
links to the provider documentation. An owner-only status endpoint exposes only
whether encrypted credentials exist so the editor can distinguish an omitted
secret from an unconfigured secret without returning the credential value.

### Post editor

`apps/admin/src/features/write/components/WriteRouteViewsContent.tsx`:
add a premium toggle and a `previewBlocks` number input, shown for posts
only and enabled only when the editor is in Lexical mode. The owner always
sees full content (covered by the entitlement check).

### Readers page (`apps/admin/src/features/readers/`)

- **List** (`ReadersRouteViewContent` / `ReaderListRow`): show a membership
  status badge per reader (active / on_hold / cancelled / expired / none,
  with plan and provider). Toolbar (`ReadersToolbar`) gains a
  `membershipStatus` filter backed by the extended reader list query.
- **Detail** (`readers/[id]`): a membership block showing status, plan,
  provider, and period end, with owner actions:
  - **Grant / extend tier** — a modal (pattern of `BanReaderModal`) taking
    plan and expiry date, calling `PUT /membership/members/:readerId`.
    Available when the reader has no live provider-managed subscription.
  - **Revoke** — calls `DELETE /membership/members/:readerId`; shown only
    for manual grants. Provider-managed subscriptions display a link-out
    hint to manage them in the provider dashboard.

Future (not v1): a haklex "paywall divider" node letting the author place
the cut point manually instead of counting blocks.

## api-client

`packages/api-client` gains typed membership endpoints (`checkout`,
`status`) and the `meta.paywall` type on post responses.

## Errors

New `ErrorCodeEnum` entries following the existing `AppException` pattern:

- `MembershipRequired` — attempting a member-only action without entitlement.
- `WebhookVerifyFailed` — signature verification failure (400).
- `MembershipProviderNotConfigured` — checkout requested while the configs
  module has no provider set up.
- `PremiumRequiresLexical` — setting `is_premium` on a non-lexical post (400).

## Testing

- Webhook idempotency: same `(provider, event_id)` delivered twice applies
  state once.
- Truncation: Lexical cut to N blocks, teaser text matches `$toMarkdown()`
  of the truncated state; entitled readers and owner receive full content;
  `meta.paywall` correct in both states.
- Ordering invariant: paywall gate applies after translation attachment
  (translated premium content is truncated too).
- Entitlement matrix: anonymous / logged-in non-member / active member /
  expired member / on_hold member (grace: entitled) / cancelled member.
- `getPublicText`: teaser for premium, full for free posts.
- Validation: `is_premium` rejected on markdown posts.
- Checkout endpoint: returns provider URL; fails with
  `MembershipProviderNotConfigured` when unset; demo mode forbidden.
- Manual grant: upsert grants entitlement until expiry; revoke removes it;
  grant rejected when a provider-managed subscription exists; reader list
  filter by `membershipStatus` returns correct subsets.
- E2E via `createE2EApp` + `startPgTestContainer`, provider adapter mocked.

## Out of scope (v1)

- Multiple simultaneous providers, multiple tiers, single-article purchase.
- Reconciliation cron / provider polling.
- Refund/dispute automation (handle manually in provider dashboard;
  `cancelled` webhook covers access revocation).
- Paywall divider node in the editor (v1 uses block count).
