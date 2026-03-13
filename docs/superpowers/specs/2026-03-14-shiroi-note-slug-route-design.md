# Shiroi Note Slug Route Refactor Design

## Context

`mx-core` has already added note slug support:

- `note.slug?: string`
- `GET /notes/:year/:month/:day/:slug`
- sitemap prefers slug route when available

`Shiroi` still treats note detail routes as `/notes/:nid` and consumes
`@mx-space/api-client@2.1.1`, so the new slug route is not used by the web app
yet.

The goal of this change is to make Shiroi prefer the SEO-friendly note route
when a note has a slug, while keeping `/notes/:nid` as a compatibility entry
that redirects to the canonical slug route.

## Goals

- Bump and publish `@mx-space/api-client` with the already-implemented note slug
  APIs.
- Upgrade Shiroi to the new API client version.
- Add a canonical note route in Shiroi:
  `/notes/:year/:month/:day/:slug`
- Redirect old `/notes/:nid` requests to the canonical slug route when the note
  has a slug.
- Centralize note URL generation so new links consistently prefer slug routes.
- Preserve fallback behavior for notes without a slug.

## Non-Goals

- Removing `/notes/:nid` support entirely.
- Refactoring unrelated content routes such as posts, pages, or note topics.
- Reworking note rendering behavior beyond what is required for route
  canonicalization.

## Approach Options

### Option A: Central helper + canonical slug page + nid redirect

- Add a dedicated note path helper in Shiroi.
- Add a slug-based note detail page.
- Keep the existing nid route as a compatibility layer that redirects when
  possible.
- Update common note link call sites to use the helper.

Pros:

- Clear canonical route behavior.
- Keeps fallback behavior explicit.
- Provides one place to evolve note URL logic.

Cons:

- Requires touching a moderate number of call sites in Shiroi.

### Option B: Only add slug page and keep most links unchanged

- Add slug page.
- Redirect old `/notes/:nid`.
- Keep most internal links unchanged for now.

Pros:

- Smaller immediate diff.

Cons:

- Internal links would continue emitting legacy paths.
- SEO benefit would be diluted because the app still prefers old links.

### Option C: Overload the existing route builder with a union note param shape

- Keep using `routeBuilder(Routes.Note, ...)` everywhere.
- Extend it to accept either `{ id }` or `{ year, month, day, slug }`.

Pros:

- Superficially low-friction migration.

Cons:

- Makes the route builder API less clear.
- Spreads note-specific route rules into a generic route abstraction.

## Decision

Use Option A.

This keeps the canonical route logic explicit, makes the migration easy to
reason about, and avoids encoding a note-specific URL policy into a generic
route-builder type union.

## Design

### 1. API Client release

In `mx-core/packages/api-client`:

- publish a new version containing:
  - `NoteModel.slug?: string`
  - `apiClient.note.getNoteBySlugDate(year, month, day, slug, options?)`

The published version will then be consumed by Shiroi.

### 2. Canonical note path builder in Shiroi

Add a dedicated helper for note URLs, for example:

- `buildNotePath(noteLike, options?)`

Accepted fields:

- `nid`
- `slug?`
- `created?`
- `password?`

Behavior:

- if `slug` and `created` both exist, build `/notes/:year/:month/:day/:slug`
- otherwise build `/notes/:nid`
- if `password` exists, preserve it as query string

This helper becomes the canonical note link builder for:

- page redirects
- note cards and timeline items
- search results
- dropdowns and footer shortcuts
- socket peek/open actions
- `urlBuilder.build(note)`

### 3. Shiroi route structure

Add a new page route:

- `/app/[locale]/notes/[year]/[month]/[day]/[slug]/page.tsx`

Its data loader should use the new SDK method:

- `apiClient.note.getNoteBySlugDate(...)`

The page should reuse the existing note rendering implementation rather than
forking two independent note page trees. Shared rendering logic should be
extracted into a reusable unit if needed.

### 4. Legacy nid route behavior

Keep:

- `/app/[locale]/notes/[id]/page.tsx`

Behavior:

- fetch by nid as it does today
- if the resolved note has `slug` and `created`, immediately server-redirect to
  the canonical slug route
- if no slug exists, continue rendering the note normally

This makes `/notes/:nid` a compatibility entry while preserving access to notes
without slug data.

### 5. Latest note redirect

Update `/app/[locale]/notes/page.tsx`:

- when the latest note has `slug` and `created`, redirect to the canonical slug
  route
- otherwise redirect to `/notes/:nid`

### 6. Link migration strategy

Refactor note links to route through the new helper in the highest-leverage
locations first:

- `urlBuilder.build(note)`
- direct uses of `routeBuilder(Routes.Note, ...)`
- hardcoded `/notes/${nid}` strings in app routes and components
- socket notification click handlers

The route builder itself may remain compatible with `{ id }` for legacy
callers, but the preferred API for note links should be the dedicated note path
helper.

### 7. Error handling and fallback rules

- Missing `slug` or `created`: fall back to `/notes/:nid`
- Slug-route fetch failure: preserve existing request error handling behavior
- Password-protected note links: preserve `password` query string across both
  route styles

## Testing

### mx-core

- package build for `@mx-space/api-client`
- client tests for the new note controller method if not already covered

### Shiroi

- add unit tests for the note path helper:
  - slug path preferred when `slug + created` exist
  - nid fallback when slug data is missing
  - password query preserved
- run page/app typecheck and targeted tests covering:
  - slug page fetch path
  - nid route redirect behavior
  - latest note redirect behavior

## Risks

- Shiroi has many scattered note link call sites; partial migration would leave
  inconsistent canonical links.
- Reusing note page rendering across both route trees may require a small local
  extraction to avoid duplicated server-page logic.
- SDK release and Shiroi upgrade are coupled; version skew must be avoided.

## Rollout

1. Publish bumped `@mx-space/api-client`
2. Upgrade Shiroi dependency
3. Add canonical slug route and nid redirect
4. Migrate note link builders
5. Verify typecheck/tests in both repos
