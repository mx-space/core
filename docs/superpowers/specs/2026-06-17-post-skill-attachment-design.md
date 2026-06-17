# Post Skill Attachment Design

## Summary

Let blog posts attach one or more "AI skills" — Claude Code-style markdown bundles with YAML frontmatter — that readers can grab in one curl line and feed to their AI client. A reader who does not want to read the full article can pull the skill, hand it to their AI, and have the AI do the task described by the article.

Skills are stored as a new `Skill` variant of the existing `snippet` resource (zero new module). The post→skill link lives in `post.meta.skillIds` (zero schema change on `post`). Skills are exposed at a stable public path via the existing `snippet-route.controller`, so the reader's curl line works without any extra distribution infrastructure.

This is an MVP: no versioning, no signing, no multi-client adapters, no `/skills` index, no folder-shaped skills. All deferred until real demand emerges.

## Motivation

Long technical posts have low completion rates. A non-trivial fraction of readers would happily skip the prose if they could hand the work to an AI. The natural artifact for "AI doing the work" is the skill bundle — frontmatter plus markdown the AI loads on demand. If every how-to post ships with its own skill, readers self-select: read it, or run it.

Building this as a heavyweight standalone "skill marketplace" is out of scope. This is a personal blog, not a registry; the audience is small and trusted; complexity should match the surface.

## Design Decisions

1. **Reuse the `snippet` module** instead of creating a dedicated `skill` module. A skill is "a piece of text content with a name and a fetch endpoint" — the snippet model already provides that.
2. **Add `SnippetType.Skill`** rather than overloading `Text` + a `reference` convention. Type-discriminated branches (admin editor, validation, list filter, public view) stay clean; the cost is one enum value and one PG enum-add migration.
3. **Skill body is a single markdown string** containing the YAML frontmatter inline at the top. No folder, no `references/`, no `scripts/`. If a future skill needs that, it ships as a separate skill or as a link inside the body.
4. **Post→skill link lives in `post.meta.skillIds: string[]`**. The `post.meta` column is already a freeform jsonb bag (see `PartialPostSchema.meta`); piggybacking on it avoids both a new column and a join table. Order is array order.
5. **Distribute via the existing `snippet-route.controller`** at `customPath = 'sk/<name>'`, `method = 'GET'`. The route already serves snippet `raw` content at runtime; no new public controller is needed.
6. **Cache `description` on the snippet row** (in the existing `comment` field) at write time. This avoids re-parsing frontmatter on every list/detail read.
7. **No versioning, no hash, no signature, no trust card.** Defer until there is concrete evidence a reader was burned or a skill drifted in a way that mattered. Add later as additive fields.
8. **No public `/skills` index.** Skills are presented as an attachment to a post; discovery happens through posts. A standalone index can be added later without schema impact.

## Data Model

### `SnippetType` enum

Add one variant to `apps/core/src/modules/snippet/snippet.schema.ts`:

```ts
export enum SnippetType {
  JSON = 'json',
  JSON5 = 'json5',
  Function = 'function',
  Text = 'text',
  YAML = 'yaml',
  Skill = 'skill', // new
}
```

**No SQL migration is required.** `snippets.type` in `packages/db-schema/src/schema/ops.ts` is a plain `text('type')` column, not a PostgreSQL enum. The new variant lives only in the TypeScript/Zod source of truth, plus the matching enums in `@mx-space/api-client` and `apps/admin`. Existing rows are untouched; old code paths fall through the existing `default` branches when they see `'skill'`, returning the row unchanged — which is the correct rolling-deploy posture (old pods don't surface skills but never crash on them).

### `Skill`-typed snippet rows

When `type = 'skill'`:

- `raw` — full markdown text including YAML frontmatter at the top
- `name` — the skill identifier (snippet `name` regex `^[\w.-]{1,30}$` is reused; this becomes both the URL slug and the filename consumers download)
- `reference` — defaults to `'skill'` on insert if unspecified
- `comment` — populated by the service from the parsed frontmatter's `description` field (used for cheap list rendering without re-parsing)
- `customPath` — auto-set to `'sk/<name>'` on insert when empty
- `private` — gates public visibility (existing semantics)

**Not used by `Skill`:** `method`, `enable`, `secret`. `validateTypeAndCleanup` already deletes `method`, `enable`, and `secret` for any non-`Function` snippet (see `snippet.service.ts:313`); `Skill` falls under that rule. The snippet-route controller treats every data-type row as `GET`-only and already gates access through `private`, so the Skill contract has nothing to add here. The admin Skill editor MUST NOT surface `method` or `enable` controls.

### Frontmatter contract

The skill's `raw` must begin with a YAML frontmatter block delimited by `---`. The frontmatter must contain at least:

- `name: string` — must equal the snippet row's `name`
- `description: string` — short, one-line

Any additional frontmatter keys (`when-to-use`, `tools`, etc.) are accepted and preserved verbatim but not interpreted server-side. Validation happens at create/update time in `SnippetService`; mismatched `name` is rejected as a `VALIDATION_FAILED` `AppException`.

### Post association

`post.meta` already exists as a freeform jsonb column (`PartialPostSchema.meta: z.record(z.string(), z.any()).optional().nullable()`). The convention this spec introduces:

```ts
post.meta.skillIds?: string[]  // snowflake snippet IDs as strings, ordered
```

Empty array and absent key are both interpreted as "no skills attached." Stored as strings to match the API boundary convention (snowflake bigints serialize as strings).

`post.meta` is freeform jsonb and survives request-body case normalization verbatim (the top-level-only camelization preserves nested keys inside `meta`). The post detail controller does **not** currently use `@BypassCaseTransform`; for the outbound side we keep the wire snake_case convention and let `transformResponseCase` rewrite `meta.skillIds` → `meta.skill_ids` on the response, matching how every other field in `meta` is currently emitted. No bypass decorator is added by this spec — if the admin client needs the raw camelCase form preserved, that is a follow-up.

## Service Layer

### `SnippetService`

- Extend `validateTypeAndCleanup` with a `case SnippetType.Skill` that:
  - Parses the YAML frontmatter from `raw`. If parsing fails or frontmatter is missing, throws `VALIDATION_FAILED`.
  - Requires `frontmatter.name` to equal the row's `name`. Mismatch → `VALIDATION_FAILED`.
  - Requires `frontmatter.description` to be a non-empty string.
  - Sets `model.comment = frontmatter.description` (overwriting any client-supplied value for skills, to keep the cached preview honest).
  - If `model.customPath` is empty, sets it to `'sk/<name>'`.
- Extend `attachSnippet` with a `case SnippetType.Skill` that sets `data = raw` (identical to the existing `Text` branch). Without this branch, snippet-route returns `undefined` and the public fetch breaks (see `snippet.service.ts:380` switch — no default).
- A new helper `findSkillsByIds(ids: string[])` returns `Skill`-typed snippets matching the IDs and (for public callers) filtered to `private = false`. Preserves input order. No `enable` filter — see "Not used by Skill" above.
- Validation invariants are enforced **only** through this service. Repository-level updates (any direct `BaseRepository.update` call that touches a Skill row's `raw`, `name`, or `comment`) bypass these checks. The codebase does not currently expose such backdoors in admin paths, but new endpoints adjacent to snippets must route Skill mutations through `SnippetService` rather than the repository.

YAML parsing reuses `js-yaml`, which is already a direct dependency of `apps/core` and already imported by `snippet.service.ts` (for the existing `YAML`-typed snippet validation path). No new dependency.

### `PostService.getDetail`

When assembling a post's detail view:

- Read `post.meta?.skillIds: string[] | undefined`.
- If non-empty, call `SnippetService.findSkillsByIds(ids)` and project results through `PublicSkillView`.
- Attach as `post.skills` on the response payload (top-level on the view, not under `meta`).

For list endpoints (post list, category list), `skills` is **not** populated. Detail-view only, to keep list queries cheap.

`PostModule` must add `SnippetModule` to its `imports` so `SnippetService` is injectable from `PostService`. No circular dependency exists today; `SnippetModule` does not depend on `PostModule`.

### Public skill view

```ts
PublicSkillView = {
  id: string         // snowflake as string
  name: string
  description: string  // sourced from cached `comment`
  rawUrl: string     // absolute URL of the snippet-route endpoint (see "Public: skill fetch")
  raw: string        // full markdown body
}
```

`rawUrl` is computed at the view layer from the site base URL config plus the snippet-route prefix (`/api/v{version}/s/sk/<name>` in production; `/s/sk/<name>` in development), or from `siteConfig.skillPublicPrefix` if set. The wire form of the field is `raw_url` (case-transform converts on the way out).

`raw` carries the full markdown body, including the YAML frontmatter at the top, so the frontend can render "view source" without a second roundtrip.

## Controllers

### Admin: `/api/snippets`

No new endpoint. Existing CRUD handles `Skill` via the type discriminator. The admin client (`mx-admin`) opens a Skill-specific editor when the user selects `type = skill` — see Frontend section.

### Admin: `/api/posts`

No schema change. `PartialPostSchema.meta` already accepts arbitrary jsonb; the admin client writes `meta.skillIds: string[]` when the author picks skills via the new picker.

### Public: skill fetch

`snippet-route.controller` (`@ApiController('s')`) already serves any data-type snippet at its `customPath` and is `@HTTPDecorators.RawResponse`. A `Skill`-typed snippet with `customPath = 'sk/<name>'` is reachable at:

- Development: `GET /s/sk/<name>`
- Production: `GET /api/v3/s/sk/<name>` (the `@ApiController` decorator adds `/api/v{version}` in production; current version is 3 per `app.config.ts:222`).

`/sk/<name>` is **not** a real route — if the author wants the curl line to be `https://<site>/sk/<name>`, a reverse-proxy rewrite or a Yohaku rewrite rule is required. That is out of scope for this spec; the `PublicSkillView.rawUrl` field must reflect whichever URL the reader actually hits, so it MUST be built from the snippet-route URL (`/api/v3/s/sk/<name>` in prod) by default, with an optional config knob (`siteConfig.skillPublicPrefix`) to override when a proxy rewrite is in place.

Before `reply.send(attached.data)` for `type === Skill`, the controller sets:

- `Content-Type: text/markdown; charset=utf-8` (without this, Fastify defaults to `text/plain` for the raw string body)
- `Cache-Control: public, max-age=300, stale-while-revalidate=3600`

These overrides live in a new `type === Skill` branch in `snippet-route.controller` between the cache lookup and `reply.send`. The existing redis cache for data snippets is reused without change.

### Public: post detail

No new route. `GET /api/v2/posts/:category/:slug` (and ID variant) include the new `skills` field in their response when skills are attached.

## Frontend

### `mx-admin` (Skill management surface)

Three touchpoints, in order of build:

#### 1. Snippet list — Skill as a first-class type

File: `apps/admin/src/features/snippets/constants.ts`

Add `SnippetType.Skill` to the `snippetTypes` array. The existing snippet list page (`SnippetList.tsx`, route `/snippets`) gains the type automatically through its type-filter chip row. List rendering uses the same row template as `Text`-typed snippets — `name` in mono, cached `comment` (= frontmatter `description`) as the secondary line, the standard `private` / `enable`-style metadata pills are hidden for `Skill` because Skill does not use `enable`.

Sort order in the type chip row: place `Skill` immediately after `Text` (data-type cluster), before `Function`.

#### 2. Snippet detail — Skill editor branch

File: `apps/admin/src/features/snippets/components/SnippetEditor.tsx`

Add a `form.type === SnippetType.Skill` branch alongside the existing `isFunction` branch. The Skill editor layout:

- **Left pane (≈ 65% width)**: a CodeMirror editor for `raw`, `language="markdown"`. Reuse the existing snippet `CodeEditor` component, just pass markdown as the language hint. The editor's title strip reads `SKILL.md` instead of the language name.
- **Right pane (≈ 35% width)**: a "Frontmatter" preview panel that re-parses `raw` on each keystroke with `js-yaml`, and displays:
  - The parsed `name` field with a green check (✓) when it matches the `name` input above the editor, or a red x with the literal message "frontmatter `name` must equal `<rowName>`" when it doesn't. Server-side validation will reject the save with the same message; this is a quality-of-life mirror, not the source of truth.
  - The parsed `description` field as plain text (one line, truncated with ellipsis when overflowing).
  - Any unknown frontmatter keys listed as `<key>: <preview>` — purely informational so the author sees what they wrote.
  - When the YAML body fails to parse, the panel shows the literal `js-yaml` error message in `text-fg-muted` text-xs.
- **Below the editor**: a read-only `customPath` row showing the auto-assigned `sk/<name>` value with a "copy curl" affordance preview — useful so the author knows the URL their readers will hit. This is presentation only; do NOT expose `customPath`, `method`, `enable`, `secret`, or `metatype` as editable inputs on the Skill branch. `comment` is rendered read-only with a hint label `Auto-populated from frontmatter description`.
- **Save button**: same `Save` action as other types. Server returns `VALIDATION_FAILED` with `details.field = 'raw'` on bad frontmatter; surface the message in the existing toast/error-line treatment.

Visual treatment follows Design System v2 — `bg-surface-card` for the editor frame, `bg-surface-inset` for the frontmatter preview pane, `border-border` hairlines, `rounded-lg`, `shadow-sm`.

#### 3. Post write page — Skill attachment picker

File: `apps/admin/src/features/write/routes/WriteRouteViews.tsx` (and the form panel imported there — `PostMetaForm` or equivalent; locate it during implementation since the spec doesn't pin the file name beyond the route entry).

Add a "Attached Skills" field to the post meta panel (the right-side panel that already holds `category`, `tags`, `pin`, etc.). Sit it directly below `tags` and above `pin`. Specifically:

- A multi-select combobox built on the existing Base UI primitives the codebase uses elsewhere (the same pattern as the `tags` field). Items source: `GET /api/v3/snippets?type=skill` (paged), searchable by `name` substring. Selected items render as removable pills.
- Each pill: `name` in `font-mono text-xs`, surface `bg-accent-soft`, fg `text-accent`, `rounded-full`. Clicking the pill opens the snippet detail page in a new tab (a quick affordance for the author to inspect the skill).
- Persist as `meta.skillIds: string[]` on save. Order in the array follows pill order; admin can drag-reorder (reuse whatever sortable primitive the `tags` row uses, or skip reordering for v1 and rely on insertion order).
- Empty state when no skill is selected: the field collapses to a single "Attach a skill…" button styled as a ghost button (`bg-transparent`, `text-fg-muted`, `hover:bg-surface-inset`).
- A small inline help line under the field: `Readers will see these skills as cards above the article body, with a one-line curl to install.` Use `text-xs text-fg-muted`.

The field surfaces only for `type === 'post'` posts (the variant that already uses `PostDto`). Notes and pages don't get the field in v1 — out of scope.

Show the field as an unmounted disclosure (collapsed by default with a "Show advanced fields" chevron) only if the post-meta panel is already crowded; otherwise mount it inline. The spec defers the call to implementation review.

### `Yohaku` (reader-facing post detail page)

File: `apps/web/src/app/[locale]/posts/(post-detail)/[category]/[slug]/pageExtra.tsx` (or the sibling component that wraps `PostContent` with metadata strips). The new component lives in the same directory as `PostMarkdownRenderer` and `PostContent`.

#### Mount point

When `post.skills?.length > 0`, render `<SkillCardList skills={post.skills} />` **after the article header (title, date, reading-time strip) and before `<PostContent />`**. This is the same vertical slot where the existing TOC widget renders on wide screens; on phone, place the SkillCardList directly above the body.

Rationale: a reader skimming the article header must see the skill before scrolling into the body. Footer placement loses 80% of skim traffic.

#### `<SkillCardList>`

A vertical stack of `<SkillCard>`s separated by 12px gap. No outer card chrome — each `<SkillCard>` carries its own surface.

Above the list, a single muted strip:

> `# Skill attached — let your AI do the work instead of reading.`

(`text-xs text-fg-muted`, optional toggle to localize in `[locale]` builds.)

#### `<SkillCard>`

A `rounded-lg border-border bg-surface-card shadow-sm` block, ~ 16px padding. Contents top-to-bottom:

1. **Header row**:
   - `name` in `font-mono text-sm font-medium text-fg`
   - To the right (`ml-auto`): a "Skill" pill (`bg-accent-soft text-accent text-xs rounded-full px-2 py-0.5`). Single pill — no version, no hash, no signature.
2. **Description**: `description` rendered as one line, `text-sm text-fg-muted`, truncated with ellipsis at two lines max.
3. **Action row** (`mt-3 flex gap-2`):
   - **Primary button — "Copy install"**: clicking copies this payload to clipboard and fires a Sonner-style toast `Copied — paste it in your terminal.`
     ```
     mkdir -p ~/.claude/skills/<name> && curl -fsSL <rawUrl> -o ~/.claude/skills/<name>/SKILL.md
     ```
     `<rawUrl>` is the `raw_url` field from the API. The button is `bg-accent text-white hover:bg-accent-hover rounded-sm text-sm`.
   - **Secondary button — "View source"**: a ghost button (`bg-transparent border-border text-fg-muted hover:bg-surface-inset`). Clicking toggles a disclosure below the action row that renders the `raw` markdown body inline using Yohaku's existing markdown renderer (`PostMarkdownRenderer` or its lower-level shadcn-style equivalent). When expanded, the disclosure has `bg-surface-inset rounded-md` and reserves a max-height of `~32rem` with internal scroll so a long skill doesn't blow out the page.
   - **Tertiary affordance — raw URL link**: a tiny `text-xs text-fg-subtle font-mono` line below the action row showing the raw URL, with a click-to-copy icon. Useful for power-readers who want to wire it up themselves (e.g. into Codex / Gemini paths instead of Claude's).

4. **No** install-as-Claude-deeplink button, **no** "Add to my agent" button. The only contract is "here's the URL and a curl line — your AI tooling knows what to do."

Visual aim: a card that looks like a `code-block` peer of the article — feels native, not promotional.

#### Accessibility

- The `<SkillCardList>` strip uses `<aside aria-label="Attached AI skills">`.
- Each `<SkillCard>` uses `<article>` with `aria-labelledby` pointing at the name.
- "View source" is a native `<details>`/`<summary>` so keyboard users can expand without JS hooks.

#### Empty / error states

- Backend silently drops missing or private skills from the response. Yohaku doesn't render anything for them — no "skill unavailable" placeholder.
- Clipboard copy failure (Safari without a user gesture in some niche cases) falls back to selecting the text in a focusable `<code>` block and toasting `Press ⌘C to copy.`

## Error Handling

- Frontmatter parse failure on skill create/update → `VALIDATION_FAILED` with `details.field = 'raw'` and a human-readable message identifying the YAML line.
- `frontmatter.name` ≠ row `name` → `VALIDATION_FAILED` with `details.field = 'raw'`.
- Missing `frontmatter.description` → `VALIDATION_FAILED`.
- Post references skill IDs that no longer exist or are disabled → silently dropped from the response (the post still renders; the missing skills are not surfaced as cards). Admin UI should warn at edit time when a referenced skill is missing.

## Testing

- **Unit (`SnippetService`)**: frontmatter parse paths — happy, malformed YAML, missing `name`, mismatched `name`, missing `description`, valid frontmatter with extra unknown keys.
- **Unit (`SnippetService`)**: `customPath` and `method` auto-fill behavior on Skill creates.
- **Faux E2E (`snippet.controller`)**: create a skill, fetch it via `GET /sk/<name>`, assert body equals `raw` and `Content-Type` is `text/markdown`.
- **Faux E2E (`post.controller`)**: create two skills, create a post with `meta.skillIds = [id1, id2]`, fetch detail, assert `skills` array order matches and each entry has `rawUrl`.
- **Faux E2E (`post.controller`)**: post references a `private = true` skill — fetched anonymously, the skill is omitted; fetched as an admin, included.

No live E2E gating; this surface does not touch external providers.

## Migration

**No SQL migration.** `snippets.type` is a `text` column (`packages/db-schema/src/schema/ops.ts:129`), not a `pgEnum`. The new `'skill'` value lives only in:

- `apps/core/src/modules/snippet/snippet.schema.ts` — the TypeScript `SnippetType` enum and Zod schema.
- `packages/api-client` — generated client enums (if any) regenerate from the server schema.
- `apps/admin` — admin client constants for type selectors.

Rolling-deploy posture: old pods seeing rows with `type = 'skill'` fall through `validateTypeAndCleanup`'s `default: break` (no-op) and `attachSnippet`'s switch (returns row with `data` undefined). The snippet-route controller's `dataSnippet` branch calls `attachSnippet` and then `reply.send(attached.data)`; on an old pod this sends `undefined`, which Fastify serializes as an empty body (HTTP 200). That is degraded but not crashing — acceptable for a rolling window.

No `post` table change.

## Out of Scope

The following are intentionally NOT in this design and require a follow-up spec if pursued:

- Skill versioning (`skill_version_id` on the join, content hashing, `latest` redirect semantics).
- Multi-file / folder-shaped skills (`references/`, `scripts/`).
- Per-client install commands (Claude Code deeplink, `gemini skills install`, Codex install path).
- Public `/skills` index page and search.
- Skill licensing metadata, trust card, signature verification.
- Reader telemetry for skill copy / install events.
- A dedicated `skill` table or module separate from `snippet`.

## See Also

- `apps/core/src/modules/snippet/` — existing snippet module being extended.
- `apps/core/CLAUDE.md` — case normalization and response envelope rules apply to all new endpoints.
- `.claude/skills/mx-migration-author/` — used as the canonical authoring reference for the enum-add migration.
