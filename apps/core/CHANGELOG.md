# CHANGELOG


## <small>12.9.1 (2026-05-18)</small>

* release: v12.9.1 ([37af290](https://github.com/mx-space/core/commit/37af290))
* fix(note): add outer ORDER BY to default visible note list query ([11c22a0](https://github.com/mx-space/core/commit/11c22a0))
* chore(release): bump @mx-space/cli to v0.5.0 ([47bee47](https://github.com/mx-space/core/commit/47bee47))
* feat(cli): comment moderation module + readable datetime formatting ([298b1b4](https://github.com/mx-space/core/commit/298b1b4))
* ci: bump pnpm/action-setup to v6 (Node 24 runtime) ([5132862](https://github.com/mx-space/core/commit/5132862))

## 12.9.0 (2026-05-18)

* release: v12.9.0 ([006a919](https://github.com/mx-space/core/commit/006a919))
* chore(branding): round corners on logo-icon ([ade9d0a](https://github.com/mx-space/core/commit/ade9d0a))
* chore(cli): add .envrc to prefer local mxs bin via direnv ([27ddaf3](https://github.com/mx-space/core/commit/27ddaf3))
* chore(cli): apply lint-staged auto-fixes to tests ([0a2d052](https://github.com/mx-space/core/commit/0a2d052))
* chore(deps): update pnpm to v11.1.2 (#2717) ([0fa6a63](https://github.com/mx-space/core/commit/0fa6a63)), closes [#2717](https://github.com/mx-space/core/issues/2717)
* chore(release): bump @mx-space/cli to v0.2.0 ([935b461](https://github.com/mx-space/core/commit/935b461))
* chore(release): bump @mx-space/cli to v0.2.1 ([ec70c9f](https://github.com/mx-space/core/commit/ec70c9f))
* chore(release): bump @mx-space/cli to v0.2.2 ([1ccd2f4](https://github.com/mx-space/core/commit/1ccd2f4))
* chore(release): bump @mx-space/cli to v0.2.3 ([9aec976](https://github.com/mx-space/core/commit/9aec976))
* chore(release): bump @mx-space/cli to v0.4.0 ([668dd63](https://github.com/mx-space/core/commit/668dd63))
* chore(release): bump @mx-space/cli to v0.4.1 ([0eb8068](https://github.com/mx-space/core/commit/0eb8068))
* feat(cli)!: rewrite on Effect-TS — v0.3.0 ([00f3a1e](https://github.com/mx-space/core/commit/00f3a1e))
* feat(core,cli): spider guard fast-path + cli User-Agent ([28cb17d](https://github.com/mx-space/core/commit/28cb17d))
* fix(cli,core): allow authenticated requests through spider guard ([c4ab9c5](https://github.com/mx-space/core/commit/c4ab9c5))
* refactor(cli)!: rename output mode `envelope` to `xml` ([d8ade08](https://github.com/mx-space/core/commit/d8ade08))
* feat(cli): add --open and --silent flags for write commands ([15e7a6f](https://github.com/mx-space/core/commit/15e7a6f))
* feat(cli): add self-update workflow ([10780ec](https://github.com/mx-space/core/commit/10780ec))
* feat(cli): environment profile system (#2733) ([49d5d22](https://github.com/mx-space/core/commit/49d5d22)), closes [#2733](https://github.com/mx-space/core/issues/2733)
* feat(cli): render Lexical content as styled ANSI in readable mode ([f89db96](https://github.com/mx-space/core/commit/f89db96))
* feat(cli): slim profile config & auto local-dev source bin ([baa0833](https://github.com/mx-space/core/commit/baa0833))
* fix(ci): set explicit allowBuilds decisions for parcel-watcher and msgpackr-extract ([73d2db4](https://github.com/mx-space/core/commit/73d2db4))
* fix(ci): silence pnpm ignored-builds error for parcel-watcher and msgpackr-extract ([457398a](https://github.com/mx-space/core/commit/457398a))
* fix(ci): use pnpm.onlyBuiltDependencies whitelist to silence parcel-watcher/msgpackr-extract ([e31a5ab](https://github.com/mx-space/core/commit/e31a5ab))
* fix(cli): bare `mxs update` runs the handler, not group help — v0.3.1 ([92f68cb](https://github.com/mx-space/core/commit/92f68cb))
* fix(cli): track bin/mxs.cjs shim so workspace install succeeds in CI ([16434a9](https://github.com/mx-space/core/commit/16434a9))
* docs: refresh READMEs for v12 + monorepo packages ([62ae9d0](https://github.com/mx-space/core/commit/62ae9d0))
* docs(cli): design local source bin resolution ([af2e1f1](https://github.com/mx-space/core/commit/af2e1f1))
* docs(cli): document View<T> contract and add package-level CLAUDE.md ([76c1551](https://github.com/mx-space/core/commit/76c1551))
* refactor(cli): decouple Renderer from domain knowledge via View<T> contract ([c557135](https://github.com/mx-space/core/commit/c557135))
* test(cli): additional auth login + config set coverage ([4ffe272](https://github.com/mx-space/core/commit/4ffe272))
* test(cli): additional update command coverage ([8d6e8c5](https://github.com/mx-space/core/commit/8d6e8c5))
* test(cli): lint-staged auto-fixes (typed channel, etc.) ([a52f3d2](https://github.com/mx-space/core/commit/a52f3d2))

## 12.8.0 (2026-05-17)

* release: v12.8.0 ([318fe21](https://github.com/mx-space/core/commit/318fe21))
* chore(deps): bump patch/minor + open 11 + @clack/prompts 1.x ([dcd28e5](https://github.com/mx-space/core/commit/dcd28e5))
* fix(cli): use resolveNoteId in note edit non-editor path ([1e0dd1e](https://github.com/mx-space/core/commit/1e0dd1e))
* feat: @mx-space/cli (mxs) v1 — OIDC device auth + content/config commands (#2723) ([d103b26](https://github.com/mx-space/core/commit/d103b26)), closes [#2723](https://github.com/mx-space/core/issues/2723) [#2723](https://github.com/mx-space/core/issues/2723)
* perf(db): optimize hot content queries (#2732) ([c5fda4c](https://github.com/mx-space/core/commit/c5fda4c)), closes [#2732](https://github.com/mx-space/core/issues/2732)

### BREAKING CHANGE

* The apiKey plugin's customAPIKeyGetter and
AuthService.getApiKeyFromRequest no longer accept API keys via
`Authorization: Bearer <key>`. The Bearer header is now reserved for
Better Auth session/OIDC access tokens. Existing clients must migrate
to `x-api-key: <key>`.

Tests:
- auth-device.e2e-spec.ts (6) — device code, verify+approve happy path, deny, expired, unauthorized
- device-controller.e2e-spec.ts (8) — render, redirects, approve/deny/401 paths
- auth-bearer-narrowing.e2e-spec.ts (3) — Bearer rejected, x-api-key works

Note: requires the deviceCodes table from packages/db-schema (next commit)
and an assets/render/device.ejs template (separate PR in mx-space/assets).

* feat(db): add device_codes table for Better Auth device flow

The deviceAuthorization plugin persists pending device-code / user-code
pairs in a `deviceCode` model that did not exist in our schema. Without
this table, `mxs auth login` would fail at runtime with
`BetterAuthError: model "deviceCode" not found`.

Expand-only migration: CREATE TABLE + three indexes (device_code unique,
user_code unique, expires_at idx for cleanup), FK user_id → readers.id
ON DELETE CASCADE. Empty new table — safe for rolling deploy.

Migration file: 0012_device_codes_table.sql. lint:migrations ok.

* feat(cli): add @mx-space/cli (binary mxs) v1

A self-host-oriented CLI for mx-core. Authenticates via OIDC device flow
against the Better Auth deviceAuthorization plugin, then drives content,
config, and metadata operations through the server's REST API.

v1 scope:
- auth: login (device flow), logout, whoami, status
- post / note / page: list, get, create, edit, update, delete (+publish for post/note)
- category / topic: list, get, create, update, delete
- config: list, get, set, edit
- All write paths accept either a single .xml envelope (--file) or per-field
  flags, including --content=file=<path> for AI-driven authoring. LiteXML
  content is round-tripped through @haklex/rich-litexml.

v2/v3 items captured in packages/cli/ROADMAP.md.

Tests: 54/54 vitest passing, typecheck clean.

Spec: docs/superpowers/specs/2026-05-14-mx-core-cli-design.md

* fix(cli): repair authenticated content commands

* feat(cli): add readable document output

* feat(auth): enhance auth middleware and device controller with better bypass logic and verification

Signed-off-by: Innei <tukon479@gmail.com>

* chore: regenerate lockfile after merge with origin/master

* refactor(render): redesign device + download-admin pages with flat line style

- Add embed/render/device.ejs (1px stroke, radius 0, monochrome auto, mono DEVICE badge)
- Register device.ejs in embed/index.ts EMBED_FILES map
- Drop 60-line INLINE_DEVICE_TEMPLATE; loadTemplate now throws when missing
- Rewrite download-admin.ejs to match (drop Inter/Geist Mono, shadows, radius, colored badges); preserve i18n, theme toggle, ANSI log, progress, action DOM hooks

* fix(cli): resolve category/note ids correctly for slug-based commands

- Extract resolveCategoryId helper; unwrap the double envelope returned by
  GET /categories/:slug (was reading res.data?.id, always undefined) so
  category update/delete by slug stop throwing "category not found"
- Extract resolveNoteId helper; reject non-snowflake non-numeric input with
  a clear validation error instead of silently falling through to a 404 on
  GET /notes/:slug (no such server route)
- Cover both resolvers with unit tests

## <small>12.7.1 (2026-05-16)</small>

* release: v12.7.1 ([fd67360](https://github.com/mx-space/core/commit/fd67360))
* fix(comment): restore email type enum values to match template filenames ([a549765](https://github.com/mx-space/core/commit/a549765))
* fix(mongo-pg-cli): use canonical Mongo field names for comment parent/root ([3837ee3](https://github.com/mx-space/core/commit/3837ee3))
* refactor: remove mongoose compatibility leftovers ([f551b1e](https://github.com/mx-space/core/commit/f551b1e))
* refactor(core): inline template assets via Vite ?raw, drop external assets repo ([da4cdd4](https://github.com/mx-space/core/commit/da4cdd4))
* docs(spec): virtual embed assets design ([c532bbb](https://github.com/mx-space/core/commit/c532bbb))
* chore(deps): update dependency eslint to v10.4.0 (#2727) ([cb32ed4](https://github.com/mx-space/core/commit/cb32ed4)), closes [#2727](https://github.com/mx-space/core/issues/2727)
* chore(release): bump @mx-space/mongo-pg-cli to v0.1.1 ([d49e8f7](https://github.com/mx-space/core/commit/d49e8f7))
* test: drop obsolete mongoose-compat test cases ([d84ef3a](https://github.com/mx-space/core/commit/d84ef3a))

## 12.7.0 (2026-05-15)

* release: v12.7.0 ([3eb01dc](https://github.com/mx-space/core/commit/3eb01dc))
* feat(recently): URL-keyed enrichment map, drop typed entries (#2726) ([91b8a47](https://github.com/mx-space/core/commit/91b8a47)), closes [#2726](https://github.com/mx-space/core/issues/2726)

## 12.6.0 (2026-05-15)

* release: v12.6.0 ([911a7d7](https://github.com/mx-space/core/commit/911a7d7))
* feat(enrichment): harden Open Graph browser mode against anti-bot pages (#2724) ([383e0e4](https://github.com/mx-space/core/commit/383e0e4)), closes [#2724](https://github.com/mx-space/core/issues/2724)
* feat(enrichment): keep og-parser image OG-strict with dimensions ([8651e5c](https://github.com/mx-space/core/commit/8651e5c))
* docs(cli): add @mx-space/cli (mxs) v1 design spec ([8061c8d](https://github.com/mx-space/core/commit/8061c8d))
* docs(cli): add first-run onboarding for missing api_url ([935fb66](https://github.com/mx-space/core/commit/935fb66))
* docs(cli): narrow v1 to auth/content/config; defer maintenance/backup/export to v3 ([bbbc142](https://github.com/mx-space/core/commit/bbbc142))
* chore(deps): update dependency @types/node to v25.8.0 (#2714) ([96806ff](https://github.com/mx-space/core/commit/96806ff)), closes [#2714](https://github.com/mx-space/core/issues/2714)
* chore(deps): update dependency jsondiffpatch to v0.7.6 (#2725) ([98add8e](https://github.com/mx-space/core/commit/98add8e)), closes [#2725](https://github.com/mx-space/core/issues/2725)
* chore(deps): update dependency tsx to v4.21.1 (#2721) ([21d30ca](https://github.com/mx-space/core/commit/21d30ca)), closes [#2721](https://github.com/mx-space/core/issues/2721)

## <small>12.5.4 (2026-05-14)</small>

* release: v12.5.4 ([e0df291](https://github.com/mx-space/core/commit/e0df291))
* fix(deps): update dependency @anthropic-ai/sdk to ^0.96.0 (#2684) ([baeb77b](https://github.com/mx-space/core/commit/baeb77b)), closes [#2684](https://github.com/mx-space/core/issues/2684)
* fix(deps): update nest monorepo to v11.1.21 (#2712) ([daf9a9a](https://github.com/mx-space/core/commit/daf9a9a)), closes [#2712](https://github.com/mx-space/core/issues/2712)
* fix(translation): align TranslateFields path to data[] key ([65c73e7](https://github.com/mx-space/core/commit/65c73e7))
* chore(deps): bump @haklex/* to 0.12.0 ([529a32a](https://github.com/mx-space/core/commit/529a32a))
* chore(deps): bump @haklex/rich-headless to 0.11.0 ([ba40615](https://github.com/mx-space/core/commit/ba40615))
* chore(deps): bump @haklex/rich-headless to 0.13.0 ([a68741b](https://github.com/mx-space/core/commit/a68741b))
* feat(ai): preserve mermaid diagrams during translation ([849c435](https://github.com/mx-space/core/commit/849c435))

## <small>12.5.3 (2026-05-14)</small>

* release: v12.5.3 ([9974dd5](https://github.com/mx-space/core/commit/9974dd5))
* ci(release): drop user-review gate; release-core runs unattended ([5da09f6](https://github.com/mx-space/core/commit/5da09f6))
* ci(release): switch GitHub Release body to narrative RELEASE_NOTES.md ([3db5ebc](https://github.com/mx-space/core/commit/3db5ebc))
* docs(spec): release notes narrative design ([b5c0ae5](https://github.com/mx-space/core/commit/b5c0ae5))
* chore(deps): update dependency axios to v1.16.1 (#2719) ([700fbee](https://github.com/mx-space/core/commit/700fbee)), closes [#2719](https://github.com/mx-space/core/issues/2719)
* chore(deps): update dependency rolldown to v1.0.1 (#2718) ([324fa96](https://github.com/mx-space/core/commit/324fa96)), closes [#2718](https://github.com/mx-space/core/issues/2718)

## <small>12.5.2 (2026-05-13)</small>

* release: v12.5.2 ([08ba4d1](https://github.com/mx-space/core/commit/08ba4d1))
* feat(enrichment): screenshot only as og:image fallback in browser mode ([9ca84a5](https://github.com/mx-space/core/commit/9ca84a5))

## <small>12.5.1 (2026-05-13)</small>

* release: v12.5.1 ([9533a1d](https://github.com/mx-space/core/commit/9533a1d))
* chore(deps): bump @haklex/* to 0.10.0 ([cb66a5f](https://github.com/mx-space/core/commit/cb66a5f))

## 12.5.0 (2026-05-13)

* release: v12.5.0 ([a159600](https://github.com/mx-space/core/commit/a159600))
* feat(enrichment): admin endpoints for cache detail, screenshots, and probe ([f61203c](https://github.com/mx-space/core/commit/f61203c))

## <small>12.4.1 (2026-05-13)</small>

* release: v12.4.1 ([46d5708](https://github.com/mx-space/core/commit/46d5708))
* fix(enrichment): parse nested agent-browser eval result shape ([2d3f693](https://github.com/mx-space/core/commit/2d3f693))
* fix(enrichment): query GitHub Discussions via GraphQL ([7606ab5](https://github.com/mx-space/core/commit/7606ab5))
* fix(gateway): remove spurious forwardRef breaking @WebSocketServer injection ([9831804](https://github.com/mx-space/core/commit/9831804))

## 12.4.0 (2026-05-13)

* release: v12.4.0 ([eec703f](https://github.com/mx-space/core/commit/eec703f))
* chore(deps): batch update dependencies (#2713) ([c2f6861](https://github.com/mx-space/core/commit/c2f6861)), closes [#2713](https://github.com/mx-space/core/issues/2713) [#2700](https://github.com/mx-space/core/issues/2700) [#2699](https://github.com/mx-space/core/issues/2699) [#2696](https://github.com/mx-space/core/issues/2696) [#2706](https://github.com/mx-space/core/issues/2706) [#2703](https://github.com/mx-space/core/issues/2703) [#2707](https://github.com/mx-space/core/issues/2707) [#2683](https://github.com/mx-space/core/issues/2683)
* chore(deps): batch update dependencies (round 2) (#2715) ([f6abb79](https://github.com/mx-space/core/commit/f6abb79)), closes [#2715](https://github.com/mx-space/core/issues/2715) [#2714](https://github.com/mx-space/core/issues/2714)
* chore(deps): update softprops/action-gh-release action to v3 (#2681) ([d79eb2f](https://github.com/mx-space/core/commit/d79eb2f)), closes [softprops/action-#release](https://github.com/softprops/action-/issues/release) [#2681](https://github.com/mx-space/core/issues/2681)
* chore(release): bump @mx-space/api-client to v4.1.0 ([100b5c2](https://github.com/mx-space/core/commit/100b5c2))
* feat(enrichment): add screenshot pipeline with browser fetch and storage (#2708) ([417a153](https://github.com/mx-space/core/commit/417a153)), closes [#2708](https://github.com/mx-space/core/issues/2708)

## <small>12.3.5 (2026-05-13)</small>

* release: v12.3.5 ([412e5c7](https://github.com/mx-space/core/commit/412e5c7))
* fix(activity): resolve presence readerId from HTTP session cookie ([181da63](https://github.com/mx-space/core/commit/181da63))
* chore(deps): bump @haklex/* to 0.9.2 ([239446f](https://github.com/mx-space/core/commit/239446f))
* chore(deps): update better-auth monorepo to v1.6.11 (#2710) ([4ee3244](https://github.com/mx-space/core/commit/4ee3244)), closes [#2710](https://github.com/mx-space/core/issues/2710)

## <small>12.3.4 (2026-05-12)</small>

* release: v12.3.4 ([de43f59](https://github.com/mx-space/core/commit/de43f59))
* fix(activity): bind reader to socket at ws handshake ([c2a709c](https://github.com/mx-space/core/commit/c2a709c))
* fix(enrichment): preserve open graph refresh url context ([fb87132](https://github.com/mx-space/core/commit/fb87132))
* chore(build): add __DEV__/__TEST__ vite define macros ([1783b79](https://github.com/mx-space/core/commit/1783b79))
* chore(deps): bump @haklex/rich-headless from 0.8.0 to 0.9.1 ([768e377](https://github.com/mx-space/core/commit/768e377))
* feat(ai-translation): translate Lexical Poll node (#2709) ([9e5cdf6](https://github.com/mx-space/core/commit/9e5cdf6)), closes [#2709](https://github.com/mx-space/core/issues/2709)
* feat(enrichment): origin guard + throttle on public endpoints ([40f7514](https://github.com/mx-space/core/commit/40f7514))

## <small>12.3.3 (2026-05-11)</small>

* release: v12.3.3 ([663f9e6](https://github.com/mx-space/core/commit/663f9e6))
* fix(auth): accept Better Auth keys without txo prefix in x-api-key ([a5be497](https://github.com/mx-space/core/commit/a5be497)), closes [#2705](https://github.com/mx-space/core/issues/2705)
* fix(auth): add missing isCustomToken method and fix test deadlock ([176bb6f](https://github.com/mx-space/core/commit/176bb6f))
* fix(auth): remove stale isCustomToken test case ([e476439](https://github.com/mx-space/core/commit/e476439))
* fix(data-jobs): change run method to a property for DataJob interface ([4ef68ed](https://github.com/mx-space/core/commit/4ef68ed))
* chore(deps): bump @haklex/rich-headless to 0.8.0 ([82bcc67](https://github.com/mx-space/core/commit/82bcc67))

## <small>12.3.2 (2026-05-11)</small>

* release: v12.3.2 ([1ac7ee1](https://github.com/mx-space/core/commit/1ac7ee1))
* chore(deps): update dependency @better-auth/api-key to v1.6.10 (#2692) ([70ab1c2](https://github.com/mx-space/core/commit/70ab1c2)), closes [#2692](https://github.com/mx-space/core/issues/2692)
* chore(deps): update dependency better-auth to v1.6.10 (#2694) ([82599ee](https://github.com/mx-space/core/commit/82599ee)), closes [#2694](https://github.com/mx-space/core/issues/2694)
* chore(deps): update dependency lint-staged to v17.0.4 (#2695) ([b9b7b3b](https://github.com/mx-space/core/commit/b9b7b3b)), closes [#2695](https://github.com/mx-space/core/issues/2695)
* fix(poll): bypass response key transform to preserve option ids ([728d797](https://github.com/mx-space/core/commit/728d797))
* fix(poll): restrict vote definitions to lexical nodes ([0a12537](https://github.com/mx-space/core/commit/0a12537))
* fix(poll): validate public vote eligibility ([a386b21](https://github.com/mx-space/core/commit/a386b21))

## <small>12.3.1 (2026-05-10)</small>

* release: v12.3.1 ([980cba5](https://github.com/mx-space/core/commit/980cba5))
* test(pg): avoid forced database drops ([676a106](https://github.com/mx-space/core/commit/676a106))
* fix(note): use database-generated nid ([c3fefe2](https://github.com/mx-space/core/commit/c3fefe2))
* refactor(migrate): decouple app-migrate from AppModule via slim MigrationsAppModule ([cda3434](https://github.com/mx-space/core/commit/cda3434))

## 12.3.0 (2026-05-10)

* release: v12.3.0 ([7887dec](https://github.com/mx-space/core/commit/7887dec))
* fix(ai-summary): scope findByHash by lang to return correct locale ([25d7768](https://github.com/mx-space/core/commit/25d7768))
* feat(note): add excludeId option to filter notes by created window ([ddc586a](https://github.com/mx-space/core/commit/ddc586a))
* feat(search): multilingual BM25 with translation + fallback (#2698) ([bb77cde](https://github.com/mx-space/core/commit/bb77cde)), closes [#2698](https://github.com/mx-space/core/issues/2698)
* refactor(core): consolidate dev entry, replace tsdown with vite build ([1fe0008](https://github.com/mx-space/core/commit/1fe0008))
* chore(deps): update dependency @better-auth/passkey to v1.6.10 (#2693) ([477cda3](https://github.com/mx-space/core/commit/477cda3)), closes [#2693](https://github.com/mx-space/core/issues/2693)
* chore(deps): update pnpm to v11.0.9 (#2697) ([dd47bb8](https://github.com/mx-space/core/commit/dd47bb8)), closes [#2697](https://github.com/mx-space/core/issues/2697)

## <small>12.2.6 (2026-05-09)</small>

* release: v12.2.6 ([df6626c](https://github.com/mx-space/core/commit/df6626c))
* chore(deps): bump @anthropic-ai/sdk, openai, @types/node, wrangler, workers-types ([de5f1b1](https://github.com/mx-space/core/commit/de5f1b1))
* fix(enrichment): synthesize merged state for github pr ([c1065af](https://github.com/mx-space/core/commit/c1065af))
* feat(enrichment): hydrate recently by ref, share batch primitive ([c5dde29](https://github.com/mx-space/core/commit/c5dde29))
* feat(enrichment): skip og SSRF guards in development ([36ac82a](https://github.com/mx-space/core/commit/36ac82a))

## <small>12.2.5 (2026-05-08)</small>

* release: v12.2.5 ([4738821](https://github.com/mx-space/core/commit/4738821))
* test(enrichment): align resolve specs with new fetch ctx arg ([82b7f0c](https://github.com/mx-space/core/commit/82b7f0c))
* feat(enrichment): add open-graph fallback provider ([fa76daa](https://github.com/mx-space/core/commit/fa76daa))
* fix(comment): auto mark parent as read when owner replies ([d29c509](https://github.com/mx-space/core/commit/d29c509))

## <small>12.2.4 (2026-05-08)</small>

* release: v12.2.4 ([096ce37](https://github.com/mx-space/core/commit/096ce37))
* chore(ci): capture bundled server log on test failure ([f382cbd](https://github.com/mx-space/core/commit/f382cbd))
* chore(ci): improve bundle test diagnostics ([0d753e2](https://github.com/mx-space/core/commit/0d753e2))
* chore(deps): update all dependencies to latest ([38a2d1f](https://github.com/mx-space/core/commit/38a2d1f))
* fix(deps): sync rolldown override in pnpm-workspace.yaml ([e50b0f3](https://github.com/mx-space/core/commit/e50b0f3))
* fix(deps): sync rolldown resolution to 1.0.0 ([a9b1567](https://github.com/mx-space/core/commit/a9b1567))
* test: align lang-context and mx-space provider specs with current behavior ([5caaa8d](https://github.com/mx-space/core/commit/5caaa8d))

## <small>12.2.3 (2026-05-08)</small>

* release: v12.2.3 ([d4eb25c](https://github.com/mx-space/core/commit/d4eb25c))
* feat(enrichment): enhance language handling and AI integration in MxSpaceProvider ([dfcaee6](https://github.com/mx-space/core/commit/dfcaee6))
* chore(deps): bump @haklex/* to 0.4.1 ([fd149ab](https://github.com/mx-space/core/commit/fd149ab))

## <small>12.2.2 (2026-05-07)</small>

* release: v12.2.2 ([3ae4d74](https://github.com/mx-space/core/commit/3ae4d74))
* release(api-client): publish 4.0.0 ([2cb558c](https://github.com/mx-space/core/commit/2cb558c))
* feat: add new database constants and methods for post and note retrieval ([509de8f](https://github.com/mx-space/core/commit/509de8f))
* feat(enrichment): localize MxSpaceProvider, fix lexical link extraction ([f4e6b18](https://github.com/mx-space/core/commit/f4e6b18))
* chore: update script ([eb64c37](https://github.com/mx-space/core/commit/eb64c37))

## <small>12.2.1 (2026-05-07)</small>

* release: v12.2.1 ([f5bad2e](https://github.com/mx-space/core/commit/f5bad2e))
* feat(enrichment): add per-locale cache with TMDB en-US backfill ([5c68e81](https://github.com/mx-space/core/commit/5c68e81))

## 12.2.0 (2026-05-07)

* release: v12.2.0 ([fe3135d](https://github.com/mx-space/core/commit/fe3135d))
* fix(build): produce real dist for db-schema and stop emitting through tsconfig ([a62208c](https://github.com/mx-space/core/commit/a62208c))
* fix(deps): update dependency isbot to v5.1.40 (#2687) ([5786b62](https://github.com/mx-space/core/commit/5786b62)), closes [#2687](https://github.com/mx-space/core/issues/2687)
* fix(migrate): force process.exit after success to unblock mx-migrate ([680944a](https://github.com/mx-space/core/commit/680944a))
* fix(test): provide EnrichmentService in contract test fixtures ([b5ead1b](https://github.com/mx-space/core/commit/b5ead1b))
* feat: enrichment integration with recently module + graceful shutdown ([c5c371a](https://github.com/mx-space/core/commit/c5c371a))
* feat: enrichment module — third-party URL resolver (#2689) ([6a8cb8e](https://github.com/mx-space/core/commit/6a8cb8e)), closes [#2689](https://github.com/mx-space/core/issues/2689)
* feat(enrichment): app migration framework + provider readiness + tmdb v4 ([b9b657d](https://github.com/mx-space/core/commit/b9b657d))
* feat(enrichment): implement enrichment refresh task handling and image metadata enrichment ([debbd2b](https://github.com/mx-space/core/commit/debbd2b))
* feat(enrichment): integrate URL extraction and hydration in enrichment module ([b40e50d](https://github.com/mx-space/core/commit/b40e50d))
* feat(enrichment): prefetch on doc write, preserve url keys in hydrated map ([91ccf82](https://github.com/mx-space/core/commit/91ccf82))
* feat(mongo-pg-cli): make package npm-publishable ([b9d50f5](https://github.com/mx-space/core/commit/b9d50f5))
* ci: shard vitest into 3 parallel jobs and bump timeout to 20min ([5b3cc01](https://github.com/mx-space/core/commit/5b3cc01))
* refactor: code quality and lint fixes across codebase (#2685) ([6058fae](https://github.com/mx-space/core/commit/6058fae)), closes [#2685](https://github.com/mx-space/core/issues/2685)
* refactor: streamline docker-compose environment variables and enhance migration service ([7064d83](https://github.com/mx-space/core/commit/7064d83))
* docs(migrate): point v12 upgrade guides at @mx-space/mongo-pg-cli ([28e00ee](https://github.com/mx-space/core/commit/28e00ee))
* docs(spec): link-card unification design (post/note/page) ([835ad60](https://github.com/mx-space/core/commit/835ad60))
* docs(spec): thinking enrichment unification + app migration framework ([9bb9484](https://github.com/mx-space/core/commit/9bb9484))
* chore(deps): update pnpm to v11.0.6 (#2686) ([4126355](https://github.com/mx-space/core/commit/4126355)), closes [#2686](https://github.com/mx-space/core/issues/2686)
* chore(docker): drop bundled mongo-pg-cli and mongodb-tools from image ([8e9b030](https://github.com/mx-space/core/commit/8e9b030))
* test(mongo-pg-cli): own package now owns its spec, dts emit re-enabled ([93b9279](https://github.com/mx-space/core/commit/93b9279))

## <small>12.1.1 (2026-05-05)</small>

* release: v12.1.1 ([95d609d](https://github.com/mx-space/core/commit/95d609d))
* fix(build): produce real dist for db-schema and stop emitting through tsconfig ([aa5db1e](https://github.com/mx-space/core/commit/aa5db1e))
* refactor: extract db schema and mongo→pg cli into workspace packages ([c56f39d](https://github.com/mx-space/core/commit/c56f39d))

## 12.1.0 (2026-05-05)

* release: v12.1.0 ([afeffde](https://github.com/mx-space/core/commit/afeffde))
* fix(auth): store passkey transports as text not array ([271bbb3](https://github.com/mx-space/core/commit/271bbb3))
* fix(migrate): read PG env directly to avoid app.config snowflake check ([cca3a97](https://github.com/mx-space/core/commit/cca3a97))
* fix(snippet): allow null for metatype, schema, path, secret fields ([64297c2](https://github.com/mx-space/core/commit/64297c2))
* fix(snippet): allow null for method field, default to GET ([6a7ecdc](https://github.com/mx-space/core/commit/6a7ecdc))
* fix(snippet): allow null value for comment field in schema ([f3e6c0e](https://github.com/mx-space/core/commit/f3e6c0e))
* fix(snippet): allow null values for all nullable fields in schema ([f85400c](https://github.com/mx-space/core/commit/f85400c))
* feat(db): run schema migrations as a release-phase step ([b74d182](https://github.com/mx-space/core/commit/b74d182))
* docs(spec): add release-phase database migration design ([03f440b](https://github.com/mx-space/core/commit/03f440b))
* chore(deps): update docker/setup-buildx-action action to v4 (#2675) ([850c0f8](https://github.com/mx-space/core/commit/850c0f8)), closes [#2675](https://github.com/mx-space/core/issues/2675)
* chore(deps): update docker/setup-qemu-action action to v4 (#2676) ([fbecb76](https://github.com/mx-space/core/commit/fbecb76)), closes [#2676](https://github.com/mx-space/core/issues/2676)
* chore(deps): update node.js to v24 (#2678) ([4e1507d](https://github.com/mx-space/core/commit/4e1507d)), closes [#2678](https://github.com/mx-space/core/issues/2678)
* chore(deps): update redis docker tag to v8 (#2680) ([4004c50](https://github.com/mx-space/core/commit/4004c50)), closes [#2680](https://github.com/mx-space/core/issues/2680)
* chore(deps): update testcontainers-node monorepo to v11 (#2682) ([440178c](https://github.com/mx-space/core/commit/440178c)), closes [#2682](https://github.com/mx-space/core/issues/2682)

## <small>12.0.3 (2026-05-05)</small>

* release: v12.0.3 ([f01b9b4](https://github.com/mx-space/core/commit/f01b9b4))

## <small>12.0.2 (2026-05-05)</small>

* release: v12.0.2 ([89e02fd](https://github.com/mx-space/core/commit/89e02fd))
* fix(core): derive snowflake worker offset from swarm task slot ([6663c55](https://github.com/mx-space/core/commit/6663c55))
* fix(deps): update dependency @anthropic-ai/sdk to ^0.93.0 (#2670) ([5a56908](https://github.com/mx-space/core/commit/5a56908)), closes [#2670](https://github.com/mx-space/core/issues/2670)
* fix(deps): update dependency drizzle-orm to ^0.45.0 [security] (#2663) ([d02df4c](https://github.com/mx-space/core/commit/d02df4c)), closes [#2663](https://github.com/mx-space/core/issues/2663)
* fix(deps): update dependency openai to v6.36.0 (#2671) ([614419c](https://github.com/mx-space/core/commit/614419c)), closes [#2671](https://github.com/mx-space/core/issues/2671)
* fix(deps): update dependency zod to v4.4.3 (#2672) ([14e7496](https://github.com/mx-space/core/commit/14e7496)), closes [#2672](https://github.com/mx-space/core/issues/2672)
* fix(pageproxy): prefer bundled admin when newer than local download ([951752a](https://github.com/mx-space/core/commit/951752a))
* chore: add bench script ([48e4d12](https://github.com/mx-space/core/commit/48e4d12))
* chore: add Telegram community link to README ([f0cf07e](https://github.com/mx-space/core/commit/f0cf07e))
* chore: refresh brand logo ([42f678f](https://github.com/mx-space/core/commit/42f678f))
* chore(deps): update dependency @cloudflare/workers-types to v4.20260504.1 (#2652) ([e50e059](https://github.com/mx-space/core/commit/e50e059)), closes [#2652](https://github.com/mx-space/core/issues/2652)
* chore(deps): update dependency @cloudflare/workers-types to v4.20260504.1 (#2667) ([374809b](https://github.com/mx-space/core/commit/374809b)), closes [#2667](https://github.com/mx-space/core/issues/2667)
* chore(deps): update dependency mongodb to ~7.2.0 (#2554) ([e37ec25](https://github.com/mx-space/core/commit/e37ec25)), closes [#2554](https://github.com/mx-space/core/issues/2554)
* chore(deps): update dependency whatwg-url to v16 (#2614) ([cd0c9db](https://github.com/mx-space/core/commit/cd0c9db)), closes [#2614](https://github.com/mx-space/core/issues/2614)
* chore(deps): update dependency wrangler to v4.87.0 (#2668) ([695df0e](https://github.com/mx-space/core/commit/695df0e)), closes [#2668](https://github.com/mx-space/core/issues/2668)
* chore(deps): update docker/build-push-action action to v7 (#2636) ([fcea9a1](https://github.com/mx-space/core/commit/fcea9a1)), closes [#2636](https://github.com/mx-space/core/issues/2636)
* chore(deps): update docker/login-action action to v4 (#2637) ([d7e795f](https://github.com/mx-space/core/commit/d7e795f)), closes [#2637](https://github.com/mx-space/core/issues/2637)
* chore(deps): update docker/metadata-action action to v6 (#2638) ([b037eb3](https://github.com/mx-space/core/commit/b037eb3)), closes [#2638](https://github.com/mx-space/core/issues/2638)
* chore(deps): update github artifact actions (major) (#2615) ([2a38ead](https://github.com/mx-space/core/commit/2a38ead)), closes [#2615](https://github.com/mx-space/core/issues/2615)
* chore(deps): update pnpm to v11.0.5 (#2669) ([87569c9](https://github.com/mx-space/core/commit/87569c9)), closes [#2669](https://github.com/mx-space/core/issues/2669)
* test(category): match wrapped DrizzleQueryError cause for FK assertion ([d83e566](https://github.com/mx-space/core/commit/d83e566))
* feat: update build script to include model extraction (#2666) ([f7dbf34](https://github.com/mx-space/core/commit/f7dbf34)), closes [#2666](https://github.com/mx-space/core/issues/2666)

## <small>12.0.1 (2026-05-04)</small>

* release: v12.0.1 ([657451e](https://github.com/mx-space/core/commit/657451e))
* fix(ci): align release smoke test with PG cutover ([82a9db2](https://github.com/mx-space/core/commit/82a9db2))

## 12.0.0 (2026-05-04)

* release: v12.0.0 ([d17d9a2](https://github.com/mx-space/core/commit/d17d9a2))
* fix(deps): update dependency lru-cache to v11.3.6 (#2664) ([05ff63f](https://github.com/mx-space/core/commit/05ff63f)), closes [#2664](https://github.com/mx-space/core/issues/2664)
* fix(migration): skip transient collections (analyzes, webhook_events, serverless_logs) ([b3286c9](https://github.com/mx-space/core/commit/b3286c9))
* refactor: remove unused paginator decorator and related code ([f06222b](https://github.com/mx-space/core/commit/f06222b))
* feat(v12): migrate backend from MongoDB to PostgreSQL + Snowflake IDs (#2659) ([3dd35b0](https://github.com/mx-space/core/commit/3dd35b0)), closes [#2659](https://github.com/mx-space/core/issues/2659)
* chore(deps): update dependency @swc/core to v1.15.33 (#2657) ([e5c2011](https://github.com/mx-space/core/commit/e5c2011)), closes [#2657](https://github.com/mx-space/core/issues/2657)
* chore(deps): update dependency axios to v1.16.0 (#2658) ([f834dc2](https://github.com/mx-space/core/commit/f834dc2)), closes [#2658](https://github.com/mx-space/core/issues/2658)
* chore(deps): update dependency eslint to v10.3.0 (#2655) ([3f4c86b](https://github.com/mx-space/core/commit/3f4c86b)), closes [#2655](https://github.com/mx-space/core/issues/2655)
* chore(deps): update pnpm to v11.0.4 (#2662) ([7c34ce6](https://github.com/mx-space/core/commit/7c34ce6)), closes [#2662](https://github.com/mx-space/core/issues/2662)

## <small>11.5.1 (2026-05-02)</small>

* release: v11.5.1 ([6bb2a11](https://github.com/mx-space/core/commit/6bb2a11))
* refactor: comment module and related services (#2656) ([58983ae](https://github.com/mx-space/core/commit/58983ae)), closes [#2656](https://github.com/mx-space/core/issues/2656)
* chore: update lock ([10e2763](https://github.com/mx-space/core/commit/10e2763))
* chore(deps): update dependency eslint-plugin-react-compiler>zod to v3.25.76 (#2653) ([5f1294b](https://github.com/mx-space/core/commit/5f1294b)), closes [#2653](https://github.com/mx-space/core/issues/2653)
* fix(deps): update dependency marked to v18.0.3 (#2654) ([3c86d7e](https://github.com/mx-space/core/commit/3c86d7e)), closes [#2654](https://github.com/mx-space/core/issues/2654)

## 11.5.0 (2026-05-01)

* release: v11.5.0 ([172919a](https://github.com/mx-space/core/commit/172919a))
* chore: update lock ([bc2b543](https://github.com/mx-space/core/commit/bc2b543))
* chore(deps): update dependency es-toolkit to v1.46.1 (#2647) ([e7b522c](https://github.com/mx-space/core/commit/e7b522c)), closes [#2647](https://github.com/mx-space/core/issues/2647)
* chore(deps): update dependency es-toolkit to v1.46.1 (#2648) ([3a55fe7](https://github.com/mx-space/core/commit/3a55fe7)), closes [#2648](https://github.com/mx-space/core/issues/2648)
* chore(deps): update dependency rolldown to v1.0.0-rc.18 (#2649) ([d3a8a83](https://github.com/mx-space/core/commit/d3a8a83)), closes [#2649](https://github.com/mx-space/core/issues/2649)
* chore(deps): update pnpm to v11.0.3 (#2650) ([c36af71](https://github.com/mx-space/core/commit/c36af71)), closes [#2650](https://github.com/mx-space/core/issues/2650)
* feat(comment): reader image upload, quotas, ttl cleanup, admin mgmt ([bce602f](https://github.com/mx-space/core/commit/bce602f))
* fix(deps): update dependency nanoid to v5.1.11 (#2651) ([02fd3ec](https://github.com/mx-space/core/commit/02fd3ec)), closes [#2651](https://github.com/mx-space/core/issues/2651)
* docs(skills): correct release-core hook ordering and cwd note ([01ca868](https://github.com/mx-space/core/commit/01ca868))
* docs(skills): rewrite release-core for agent-native operation ([a185c84](https://github.com/mx-space/core/commit/a185c84))

## <small>11.4.8 (2026-04-30)</small>

* release: v11.4.8 ([d35ec07](https://github.com/mx-space/core/commit/d35ec07))
* docs(skills): add release-core skill ([429fb15](https://github.com/mx-space/core/commit/429fb15))
* fix(post): surface hasInsightsInLocale on detail response ([78d142c](https://github.com/mx-space/core/commit/78d142c))

## <small>11.4.7 (2026-04-30)</small>

* release: v11.4.7 ([89d56c0](https://github.com/mx-space/core/commit/89d56c0))
* chore(deps): bump @haklex/rich-headless to 0.4.0 ([b449ee1](https://github.com/mx-space/core/commit/b449ee1))
* chore(deps): update dependency eslint-plugin-react-compiler>zod to v3.24.4 (#2645) ([bb383ea](https://github.com/mx-space/core/commit/bb383ea)), closes [#2645](https://github.com/mx-space/core/issues/2645)
* chore(release): bump @mx-space/api-client to v3.7.0 ([277f5e8](https://github.com/mx-space/core/commit/277f5e8))
* chore(release): bump @mx-space/api-client to v3.7.1 ([6a80424](https://github.com/mx-space/core/commit/6a80424))
* fix(category): include category total post count in detail response ([82e4aa9](https://github.com/mx-space/core/commit/82e4aa9))
* feat(category): enrich detail responses with summary/tags/pin/count and tagsSum ([ff7d9cd](https://github.com/mx-space/core/commit/ff7d9cd))

## <small>11.4.6 (2026-04-29)</small>

* release: v11.4.6 ([80d22dd](https://github.com/mx-space/core/commit/80d22dd))
* chore: add rename spec ([c556272](https://github.com/mx-space/core/commit/c556272))
* chore(deps): bump @haklex/* to 0.3.1 ([3ee50fd](https://github.com/mx-space/core/commit/3ee50fd))
* chore(deps): bump @haklex/* to 0.3.3 ([e87028e](https://github.com/mx-space/core/commit/e87028e))
* chore(deps): bump @haklex/* to 0.3.4 ([165dc86](https://github.com/mx-space/core/commit/165dc86))
* chore(deps): bump @haklex/rich-headless to 0.3.0 ([79eea7f](https://github.com/mx-space/core/commit/79eea7f))
* fix(post,slug-tracker): correct ObjectId vs string comparisons ([e86be85](https://github.com/mx-space/core/commit/e86be85))
* feat(ai-translation): add topic.description as translatable field ([27734a9](https://github.com/mx-space/core/commit/27734a9))
* feat(poll): add poll vote module backing @haklex poll node ([3aa1848](https://github.com/mx-space/core/commit/3aa1848))
* test(topic): cover topic.description in translation e2e ([33abdb0](https://github.com/mx-space/core/commit/33abdb0))

## <small>11.4.5 (2026-04-29)</small>

* release: v11.4.5 ([20a0a06](https://github.com/mx-space/core/commit/20a0a06))
* chore(deps): bump @haklex/* to 0.2.0 and lexical to 0.44 ([a6c3c0a](https://github.com/mx-space/core/commit/a6c3c0a))
* chore(deps): bump dependencies and pin mongodb override ([6857b7a](https://github.com/mx-space/core/commit/6857b7a))
* chore(release): bump @mx-space/api-client to v3.6.0 ([9de3ace](https://github.com/mx-space/core/commit/9de3ace))
* feat(note): add topic recent-update endpoint and api-client method ([d72cb29](https://github.com/mx-space/core/commit/d72cb29))

## <small>11.4.4 (2026-04-29)</small>

* release: v11.4.4 ([2b84665](https://github.com/mx-space/core/commit/2b84665))
* refactor(ai): tighten insights prompt and expand component library ([09dbb4d](https://github.com/mx-space/core/commit/09dbb4d))
* chore: bump pnpm to 11.0.0 and migrate config ([a780ed4](https://github.com/mx-space/core/commit/a780ed4))
* chore(deps): bump @haklex/* to 0.1.1 ([720642f](https://github.com/mx-space/core/commit/720642f))

## <small>11.4.3 (2026-04-28)</small>

* release: v11.4.3 ([1e12eef](https://github.com/mx-space/core/commit/1e12eef))
* feat(ai): add min text length threshold for auto summary/insights ([b2444ad](https://github.com/mx-space/core/commit/b2444ad))

## <small>11.4.2 (2026-04-26)</small>

* release: v11.4.2 ([7c44207](https://github.com/mx-space/core/commit/7c44207))
* feat(translation): expose sourceLang in article responses regardless of translation match ([54ae846](https://github.com/mx-space/core/commit/54ae846))

## <small>11.4.1 (2026-04-25)</small>

* release: v11.4.1 ([4458766](https://github.com/mx-space/core/commit/4458766))
* chore(deps): bump @haklex/* to 0.0.110 ([1b8917a](https://github.com/mx-space/core/commit/1b8917a))
* chore(deps): bump @haklex/rich-headless to 0.1.0 ([05fb110](https://github.com/mx-space/core/commit/05fb110))

## 11.4.0 (2026-04-21)

* release: v11.4.0 ([ee7931e](https://github.com/mx-space/core/commit/ee7931e))
* feat(ai-summary): split auto-generate flag into create/update ([097d27d](https://github.com/mx-space/core/commit/097d27d))
* chore(deps): upgrade all deps to latest ([2bb24e9](https://github.com/mx-space/core/commit/2bb24e9))

## <small>11.3.1 (2026-04-21)</small>

* release: v11.3.1 ([6eebc3d](https://github.com/mx-space/core/commit/6eebc3d))
* fix(ai-insights): use plain markdown output for translation ([2da0060](https://github.com/mx-space/core/commit/2da0060))

## 11.3.0 (2026-04-21)

* release: v11.3.0 ([fd9877d](https://github.com/mx-space/core/commit/fd9877d))
* fix(ai-insights): upsert source row and reject same-lang translation ([2c7b2b1](https://github.com/mx-space/core/commit/2c7b2b1))
* fix(test): add AiInsightsService mock to note e2e tests ([9f30506](https://github.com/mx-space/core/commit/9f30506))
* fix(test): mock findOneAndUpdate instead of create in ai-insights spec ([7bfbe85](https://github.com/mx-space/core/commit/7bfbe85))
* chore(api-client): bump minor version for insights ([ed57010](https://github.com/mx-space/core/commit/ed57010))
* chore(deps): bump @haklex/rich-headless to 0.0.109 ([c81d201](https://github.com/mx-space/core/commit/c81d201))
* chore(release): bump @mx-space/api-client to v3.5.0 ([3959bfa](https://github.com/mx-space/core/commit/3959bfa))
* chore(release): bump @mx-space/api-client to v3.5.1 ([21e2ab6](https://github.com/mx-space/core/commit/21e2ab6))
* feat(ai-insights): add AIInsightsModel with indexes ([6d7df91](https://github.com/mx-space/core/commit/6d7df91))
* feat(ai-insights): add collection constant and business events ([c04f437](https://github.com/mx-space/core/commit/c04f437))
* feat(ai-insights): add config fields and defaults ([a907d06](https://github.com/mx-space/core/commit/a907d06))
* feat(ai-insights): add insights DTOs ([039c551](https://github.com/mx-space/core/commit/039c551))
* feat(ai-insights): add insights system prompt and builders ([c2497bc](https://github.com/mx-space/core/commit/c2497bc))
* feat(ai-insights): add insights task types and service helpers ([2a832af](https://github.com/mx-space/core/commit/2a832af))
* feat(ai-insights): add service skeleton with cache lookup ([a2f6681](https://github.com/mx-space/core/commit/a2f6681))
* feat(ai-insights): admin listing, CRUD, and event hooks ([5627da9](https://github.com/mx-space/core/commit/5627da9))
* feat(ai-insights): HTTP and SSE controller ([3686cf4](https://github.com/mx-space/core/commit/3686cf4))
* feat(ai-insights): implement streaming generation and public getters ([cf954f8](https://github.com/mx-space/core/commit/cf954f8))
* feat(ai-insights): register services and controller in AiModule ([58a1b8a](https://github.com/mx-space/core/commit/58a1b8a))
* feat(ai-insights): translation service with auto-dispatch ([19e4d5c](https://github.com/mx-space/core/commit/19e4d5c))
* feat(ai-insights): wire AiService model getters ([39a7053](https://github.com/mx-space/core/commit/39a7053))
* feat(api-client): add AIInsightsModel and stream event types ([12226e5](https://github.com/mx-space/core/commit/12226e5))
* feat(api-client): add getInsights + SSE helpers ([a2e9c1e](https://github.com/mx-space/core/commit/a2e9c1e))
* feat(email): add in-memory send queue with configurable rate limit (#2640) ([f77ae20](https://github.com/mx-space/core/commit/f77ae20)), closes [#2640](https://github.com/mx-space/core/issues/2640)
* feat(note): expose hasInsightsInLocale on public note responses ([c279c31](https://github.com/mx-space/core/commit/c279c31))
* update ([670ee46](https://github.com/mx-space/core/commit/670ee46))
* update ([d1b85b0](https://github.com/mx-space/core/commit/d1b85b0))
* docs: add AI Insights design spec ([f7a20dd](https://github.com/mx-space/core/commit/f7a20dd))
* docs: add AI Insights implementation plan ([1bc8999](https://github.com/mx-space/core/commit/1bc8999))

## <small>11.2.1 (2026-04-19)</small>

* release: v11.2.1 ([a717d94](https://github.com/mx-space/core/commit/a717d94))
* test: mock translation title cache in post specs ([272e8a1](https://github.com/mx-space/core/commit/272e8a1))

## 11.2.0 (2026-04-18)

* release: v11.2.0 ([ca70079](https://github.com/mx-space/core/commit/ca70079))
* chore(release): bump @mx-space/api-client to v3.3.0 ([246333d](https://github.com/mx-space/core/commit/246333d))
* feat: add comment sort ([9726f45](https://github.com/mx-space/core/commit/9726f45))

## <small>11.1.4 (2026-04-17)</small>

* release: v11.1.4 ([12e054a](https://github.com/mx-space/core/commit/12e054a))
* fix: related post transltion ([0094dda](https://github.com/mx-space/core/commit/0094dda))
* fix(ai-summary): allow on-demand generation when auto-generate is disabled (#2639) ([db53f0f](https://github.com/mx-space/core/commit/db53f0f)), closes [#2639](https://github.com/mx-space/core/issues/2639) [#2627](https://github.com/mx-space/core/issues/2627)
* chore(deps): bump @haklex/* to 0.0.107 ([774eacc](https://github.com/mx-space/core/commit/774eacc))
* chore(deps): bump @haklex/* to 0.0.108 ([176de3c](https://github.com/mx-space/core/commit/176de3c))

## <small>11.1.3 (2026-04-17)</small>

* release: v11.1.3 ([39e79c0](https://github.com/mx-space/core/commit/39e79c0))
* chore: update deps ([e497dec](https://github.com/mx-space/core/commit/e497dec))
* chore(deps): align @lexical packages to 0.43.0 ([bd9302b](https://github.com/mx-space/core/commit/bd9302b))
* chore(deps): align lexical to 0.43.0 ([79a439b](https://github.com/mx-space/core/commit/79a439b))
* chore(deps): bump @haklex/* to 0.0.105 ([e30382b](https://github.com/mx-space/core/commit/e30382b))
* chore(deps): bump @haklex/* to 0.0.106 ([598b481](https://github.com/mx-space/core/commit/598b481))
* chore(deps): sync lockfile for @haklex 0.0.105 ([133cc32](https://github.com/mx-space/core/commit/133cc32))
* chore(deps): update dependency @better-auth/api-key to v1.5.6 (#2629) ([073d3f7](https://github.com/mx-space/core/commit/073d3f7)), closes [#2629](https://github.com/mx-space/core/issues/2629)
* chore(deps): update dependency @better-auth/passkey to v1.5.6 (#2630) ([dcb5f27](https://github.com/mx-space/core/commit/dcb5f27)), closes [#2630](https://github.com/mx-space/core/issues/2630)
* chore(deps): update dependency @swc/core to v1.15.26 (#2631) ([beff21c](https://github.com/mx-space/core/commit/beff21c)), closes [#2631](https://github.com/mx-space/core/issues/2631)
* chore(deps): update dependency @types/node to v25.3.5 (#2632) ([48e2f12](https://github.com/mx-space/core/commit/48e2f12)), closes [#2632](https://github.com/mx-space/core/issues/2632)
* chore(deps): upgrade monorepo packages ([2eef5c8](https://github.com/mx-space/core/commit/2eef5c8))
* fix(deps): update dependency @fastify/static to v9.1.1 [security] (#2633) ([0a4027a](https://github.com/mx-space/core/commit/0a4027a)), closes [#2633](https://github.com/mx-space/core/issues/2633)
* fix(note): translate adjacent note titles via cached translations ([a53a2b6](https://github.com/mx-space/core/commit/a53a2b6))

## <small>11.1.2 (2026-04-07)</small>

* release: v11.1.2 ([a7689e6](https://github.com/mx-space/core/commit/a7689e6))
* chore: remove ai-image files from master ([25fe233](https://github.com/mx-space/core/commit/25fe233))
* fix(comment): only mark owner comments as read on creation ([eaea177](https://github.com/mx-space/core/commit/eaea177))
* feat: add AI image generation service and controller ([fd3c0b0](https://github.com/mx-space/core/commit/fd3c0b0))

## <small>11.1.1 (2026-04-07)</small>

* release: v11.1.1 ([94c0cd8](https://github.com/mx-space/core/commit/94c0cd8))
* feat(aggregate): support i18n for theme config via lang suffix snippets ([7e89b46](https://github.com/mx-space/core/commit/7e89b46))
* refactor(ai): centralize Lexical translatable property extraction ([7e25b66](https://github.com/mx-space/core/commit/7e25b66))
* fix: bug ([9976922](https://github.com/mx-space/core/commit/9976922))

## 11.1.0 (2026-04-05)

* release: v11.1.0 ([625de30](https://github.com/mx-space/core/commit/625de30))
* test(ai-translation): spy schedule in stale-path cases to silence mock chain errors ([6848c02](https://github.com/mx-space/core/commit/6848c02))
* refactor: replace deprecated `new: true` with `returnDocument: 'after'` ([3261ac4](https://github.com/mx-space/core/commit/3261ac4))
* feat(ai-agent): add multi-session support with metadata fields and endpoints ([6dbee13](https://github.com/mx-space/core/commit/6dbee13))
* feat(ai): add agent chat proxy service with format transformation ([645a534](https://github.com/mx-space/core/commit/645a534))
* feat(ai): add agent controller and register in AI module ([96d314f](https://github.com/mx-space/core/commit/96d314f))
* feat(ai): add agent conversation and chat proxy DTOs ([902be67](https://github.com/mx-space/core/commit/902be67))
* feat(ai): add agent conversation CRUD service ([31c8756](https://github.com/mx-space/core/commit/31c8756))
* feat(ai): add agent conversation model and collection constant ([60a4374](https://github.com/mx-space/core/commit/60a4374))
* chore(deps): bump @haklex/* to 0.0.100 ([45d7d09](https://github.com/mx-space/core/commit/45d7d09))
* chore(deps): bump @haklex/* to 0.0.101 ([1435b4a](https://github.com/mx-space/core/commit/1435b4a))
* chore(deps): bump @haklex/* to 0.0.97 ([c678225](https://github.com/mx-space/core/commit/c678225))
* chore(deps): bump @haklex/* to 0.0.98 ([55701a7](https://github.com/mx-space/core/commit/55701a7))
* fix: MongooseModel is global type, z.record needs key+value args for Zod v4 ([4efc0e2](https://github.com/mx-space/core/commit/4efc0e2))

## <small>11.0.14 (2026-04-02)</small>

* release: v11.0.14 ([c35785c](https://github.com/mx-space/core/commit/c35785c))
* fix(page): translate page titles even when text field is not selected ([2182452](https://github.com/mx-space/core/commit/2182452))

## <small>11.0.13 (2026-04-02)</small>

* release: v11.0.13 ([36818a7](https://github.com/mx-space/core/commit/36818a7))
* fix: key verfiy ([1a34088](https://github.com/mx-space/core/commit/1a34088))

## <small>11.0.12 (2026-04-02)</small>

* release: v11.0.12 ([d9c2b80](https://github.com/mx-space/core/commit/d9c2b80))
* feat(auth): implement createAccessToken method and enhance API key handling ([34c1f0d](https://github.com/mx-space/core/commit/34c1f0d))
* fix(comment): dedupe bark notifications ([9bf08e8](https://github.com/mx-space/core/commit/9bf08e8)), closes [#2624](https://github.com/mx-space/core/issues/2624)
* Fix batch translation fallback for timeline lists ([6053496](https://github.com/mx-space/core/commit/6053496))

## <small>11.0.11 (2026-04-01)</small>

* release: v11.0.11 ([1781f05](https://github.com/mx-space/core/commit/1781f05))
* fix(activity): filter null refs in getRecentComment ([f6ed0c8](https://github.com/mx-space/core/commit/f6ed0c8))

## <small>11.0.10 (2026-04-01)</small>

* release: v11.0.10 ([faa7273](https://github.com/mx-space/core/commit/faa7273))
* feat: add owner-reply endpoint for comment replies with API key auth ([f2ef0cb](https://github.com/mx-space/core/commit/f2ef0cb))

## <small>11.0.9 (2026-04-01)</small>

* release: v11.0.9 ([cb6d30f](https://github.com/mx-space/core/commit/cb6d30f))
* fix(test): update translation interceptor test to match plain object conversion behavior ([990d83b](https://github.com/mx-space/core/commit/990d83b))

## <small>11.0.8 (2026-04-01)</small>

* release: v11.0.8 ([d6c504d](https://github.com/mx-space/core/commit/d6c504d))
* refactor(auth): split admin access from reader identity ([89e31d8](https://github.com/mx-space/core/commit/89e31d8))
* refactor(interceptors): simplify translation entry handling and ensure plain object conversion ([d04e0f5](https://github.com/mx-space/core/commit/d04e0f5))

## <small>11.0.7 (2026-03-31)</small>

* release: v11.0.7 ([d8845ae](https://github.com/mx-space/core/commit/d8845ae))
* fix: comment api ([2153077](https://github.com/mx-space/core/commit/2153077))
* fix: update scripe ([25fdde6](https://github.com/mx-space/core/commit/25fdde6))
* chore(deps): bump @haklex/* to 0.0.91 ([062ebc3](https://github.com/mx-space/core/commit/062ebc3))
* chore(deps): bump @haklex/* to 0.0.93 ([6beadb4](https://github.com/mx-space/core/commit/6beadb4))
* chore(deps): bump @haklex/* to 0.0.94 ([ec357e1](https://github.com/mx-space/core/commit/ec357e1))

## <small>11.0.6 (2026-03-28)</small>

* release: v11.0.6 ([ba50ef3](https://github.com/mx-space/core/commit/ba50ef3))
* chore(deps): bump @haklex/* to 0.0.90 ([3421060](https://github.com/mx-space/core/commit/3421060))
* fix(deps): update dependency nodemailer to v8.0.4 [security] (#2622) ([29bf581](https://github.com/mx-space/core/commit/29bf581)), closes [#2622](https://github.com/mx-space/core/issues/2622)
* fix(file): fallback image upload to local storage when S3 is disabled ([32ce773](https://github.com/mx-space/core/commit/32ce773))

## <small>11.0.5 (2026-03-26)</small>

* release: v11.0.5 ([3cbb7bb](https://github.com/mx-space/core/commit/3cbb7bb))
* chore(release): bump @mx-space/webhook to v0.8.1 ([df347cb](https://github.com/mx-space/core/commit/df347cb))
* feat(event): add AGGREGATE_UPDATE event and enhance config update notifications ([26896fe](https://github.com/mx-space/core/commit/26896fe))

## <small>11.0.4 (2026-03-24)</small>

* release: v11.0.4 ([1d7e836](https://github.com/mx-space/core/commit/1d7e836))
* fix(activity): add strictPopulate false for polymorphic ref category populate ([bf20aa5](https://github.com/mx-space/core/commit/bf20aa5))
* fix(activity): enrich recent posts with category in getRecentPublish ([e60169a](https://github.com/mx-space/core/commit/e60169a))
* fix(activity): manually look up category for post refs in getRecentComment ([2961214](https://github.com/mx-space/core/commit/2961214))

## <small>11.0.3 (2026-03-24)</small>

* release: v11.0.3 ([408f292](https://github.com/mx-space/core/commit/408f292))
* fix(activity): populate category in getRecentComment and expose in response ([7dadc81](https://github.com/mx-space/core/commit/7dadc81))
* feat(ai): harden lexical translation structured output ([25ca95d](https://github.com/mx-space/core/commit/25ca95d))
* feat(ai): implement Vercel AI Gateway prompt caching in OpenAICompatibleRuntime ([8c2afef](https://github.com/mx-space/core/commit/8c2afef))
* chore(deps): bump @haklex/* to 0.0.88 ([15e9b29](https://github.com/mx-space/core/commit/15e9b29))
* fix redis test mock readiness interface ([89fa7d4](https://github.com/mx-space/core/commit/89fa7d4))

## <small>11.0.2 (2026-03-23)</small>

* release: v11.0.2 ([b43adb0](https://github.com/mx-space/core/commit/b43adb0))
* refactor redis config sync and api client transforms ([a7933b8](https://github.com/mx-space/core/commit/a7933b8))
* fix(webhook): enrich comment payload author and avatar ([2833c38](https://github.com/mx-space/core/commit/2833c38))

## <small>11.0.1 (2026-03-22)</small>

* release: v11.0.1 ([4267473](https://github.com/mx-space/core/commit/4267473))
* Add emoji preservation rule ([7c6d75a](https://github.com/mx-space/core/commit/7c6d75a))
* fix(file): orphan cleanup idempotency; remove orphan cleanup cron ([2b4e946](https://github.com/mx-space/core/commit/2b4e946))
* chore(deps): bump @haklex/* to 0.0.87 ([96805c9](https://github.com/mx-space/core/commit/96805c9))

## 11.0.0 (2026-03-22)

* release: v11.0.0 ([28b6f46](https://github.com/mx-space/core/commit/28b6f46))
* fix(category): handle null category in category service ([71f4f91](https://github.com/mx-space/core/commit/71f4f91))
* fix(deps): update dependency @nestjs/platform-fastify to v11.1.16 [security] (#2620) ([1d3da45](https://github.com/mx-space/core/commit/1d3da45)), closes [#2620](https://github.com/mx-space/core/issues/2620)
* fix(post): add Types import from mongoose ([9cdb244](https://github.com/mx-space/core/commit/9cdb244))
* chore(deps): bump @haklex/* to 0.0.86 ([7d23e74](https://github.com/mx-space/core/commit/7d23e74))
* chore(deps): update dependencies and remove patch for @lexical/code ([e7c068c](https://github.com/mx-space/core/commit/e7c068c))
* chore(release): bump @mx-space/api-client to v3.1.0 ([1969808](https://github.com/mx-space/core/commit/1969808))
* feat: replace Algolia with local CJK search (#2621) ([2095087](https://github.com/mx-space/core/commit/2095087)), closes [#2621](https://github.com/mx-space/core/issues/2621)

## 11.0.0-alpha.1 (2026-03-16)

* release: v11.0.0-alpha.1 ([109952d](https://github.com/mx-space/core/commit/109952d))
* fix(gateway): send online count directly to connecting socket ([386b8c3](https://github.com/mx-space/core/commit/386b8c3))
* chore(release): bump @mx-space/api-client to v3.0.0 ([7fba2fd](https://github.com/mx-space/core/commit/7fba2fd))

## 11.0.0-alpha.0 (2026-03-15)

* release: v11.0.0-alpha.0 ([087844f](https://github.com/mx-space/core/commit/087844f))
* feat(aggregate)!: refactor Aggregate API and add site metadata endpoint ([e20a006](https://github.com/mx-space/core/commit/e20a006))

## <small>10.5.3 (2026-03-15)</small>

* release: v10.5.3 ([f2ce6f6](https://github.com/mx-space/core/commit/f2ce6f6))
* fix(ai-translation): translate page subtitles ([c20bf6e](https://github.com/mx-space/core/commit/c20bf6e))
* fix(core): prevent slugged notes from breaking url builder ([6731c88](https://github.com/mx-space/core/commit/6731c88))

## <small>10.5.2 (2026-03-15)</small>

* release: v10.5.2 ([f1601f4](https://github.com/mx-space/core/commit/f1601f4))
* feat(aggregate): add comment options to aggregate response ([a31db1f](https://github.com/mx-space/core/commit/a31db1f))
* feat(aggregate): add public /aggregate/site_info endpoint ([88bd758](https://github.com/mx-space/core/commit/88bd758))
* feat(aggregate): update aggregate service and models to include summary and mood/weather fields ([ab426b1](https://github.com/mx-space/core/commit/ab426b1))
* feat(comment): add disableComment option to CommentOptionsModel ([cc31bbd](https://github.com/mx-space/core/commit/cc31bbd))
* feat(comment): use authProvider for comment auth channel ([0b9da3b](https://github.com/mx-space/core/commit/0b9da3b))
* chore(release): bump @mx-space/api-client to v2.4.1 ([d18f58e](https://github.com/mx-space/core/commit/d18f58e))
* chore(release): bump @mx-space/api-client to v2.4.2 ([b6475fc](https://github.com/mx-space/core/commit/b6475fc))

## <small>10.5.1 (2026-03-14)</small>

* release: v10.5.1 ([750f9d8](https://github.com/mx-space/core/commit/750f9d8))
* chore(release): bump @mx-space/api-client to v2.3.0 ([4dd838a](https://github.com/mx-space/core/commit/4dd838a))
* chore(release): bump @mx-space/api-client to v2.4.0 ([7079cef](https://github.com/mx-space/core/commit/7079cef))
* chore(release): bump @mx-space/webhook to v0.8.0 ([509172a](https://github.com/mx-space/core/commit/509172a))
* feat(api-client): add RecentlyTypeEnum and metadata interfaces ([4339332](https://github.com/mx-space/core/commit/4339332))
* feat(comment): add reader ref support and migration ([135868b](https://github.com/mx-space/core/commit/135868b))
* feat(recently): add typed metadata schema and model fields ([46a8ae5](https://github.com/mx-space/core/commit/46a8ae5))
* feat(recently): pass type/metadata in service create/update ([c6c8b2b](https://github.com/mx-space/core/commit/c6c8b2b))
* test(note): stub ai slug backfill in e2e ([479ee8f](https://github.com/mx-space/core/commit/479ee8f))
* test(recently): add E2E tests for typed metadata CRUD ([e4532c1](https://github.com/mx-space/core/commit/e4532c1))
* fix(ai-translation): normalize tags in translation events ([61d9fb5](https://github.com/mx-space/core/commit/61d9fb5))
* fix(recently): resolve type compatibility issue in RecentlyDto ([3566ac6](https://github.com/mx-space/core/commit/3566ac6))
* refactor(note): enqueue ai slug backfill tasks ([8c119bb](https://github.com/mx-space/core/commit/8c119bb))
* docs: add comment reader ref design ([c49b5f1](https://github.com/mx-space/core/commit/c49b5f1))
* docs: update comment route design ([a251608](https://github.com/mx-space/core/commit/a251608))

## 10.5.0 (2026-03-14)

* release: v10.5.0 ([c001c21](https://github.com/mx-space/core/commit/c001c21))
* feat: flatten comment threads ([70385d9](https://github.com/mx-space/core/commit/70385d9))
* feat(ai): add slug backfill task for notes without slug ([0835863](https://github.com/mx-space/core/commit/0835863))
* feat(note): add withSummary option to note list API ([6e56df9](https://github.com/mx-space/core/commit/6e56df9))
* feat(note): enhance note pagination with summary retrieval ([855ef99](https://github.com/mx-space/core/commit/855ef99))
* chore(release): bump @mx-space/api-client to v2.2.0 ([c24d637](https://github.com/mx-space/core/commit/c24d637))
* fix translation field handling for paginated responses ([fc24fee](https://github.com/mx-space/core/commit/fc24fee))
* fix(note): translate list results by request locale ([5c44178](https://github.com/mx-space/core/commit/5c44178))

## 10.4.0 (2026-03-13)

* release: v10.4.0 ([0325476](https://github.com/mx-space/core/commit/0325476))
* fix(note): expose slug in note timeline list ([5b2f7b5](https://github.com/mx-space/core/commit/5b2f7b5))
* fix(topic): validate slug params with zod ([2de6b2b](https://github.com/mx-space/core/commit/2de6b2b))
* chore: update ([524544a](https://github.com/mx-space/core/commit/524544a))
* docs: add note seo slug design spec ([354b915](https://github.com/mx-space/core/commit/354b915))
* docs: add shiroi note slug route design spec ([f3be3b3](https://github.com/mx-space/core/commit/f3be3b3))
* feat(note): add seo slug route and sdk updates ([0203692](https://github.com/mx-space/core/commit/0203692))

## <small>10.3.3 (2026-03-13)</small>

* release: v10.3.3 ([70c789e](https://github.com/mx-space/core/commit/70c789e))
* chore(deps): bump @haklex/* to 0.0.77 ([9fc30a8](https://github.com/mx-space/core/commit/9fc30a8))
* chore(deps): bump @haklex/* to 0.0.78 ([810a939](https://github.com/mx-space/core/commit/810a939))
* chore(deps): bump @haklex/* to 0.0.79 ([872ccc6](https://github.com/mx-space/core/commit/872ccc6))
* chore(deps): bump @haklex/* to 0.0.80 ([666ef97](https://github.com/mx-space/core/commit/666ef97))
* chore(deps): bump @haklex/* to 0.0.81 ([fbf9256](https://github.com/mx-space/core/commit/fbf9256))
* chore(deps): bump @haklex/* to 0.0.82 ([174e9f2](https://github.com/mx-space/core/commit/174e9f2))
* chore(deps): bump @haklex/* to 0.0.83 ([52a8ffc](https://github.com/mx-space/core/commit/52a8ffc))
* chore(deps): bump @haklex/* to 0.0.84 ([ed2e947](https://github.com/mx-space/core/commit/ed2e947))
* chore(deps): bump @haklex/* to 0.0.85 ([ea85d92](https://github.com/mx-space/core/commit/ea85d92))
* fix(core): degrade redis bootstrap paths ([976b6cb](https://github.com/mx-space/core/commit/976b6cb))

## <small>10.3.2 (2026-03-10)</small>

* release: v10.3.2 ([e981f70](https://github.com/mx-space/core/commit/e981f70))
* feat: enhance admin asset update process and introduce event broadcasting ([e2868c2](https://github.com/mx-space/core/commit/e2868c2))
* feat: enhance feed content rendering with lexical format support ([a6bbd75](https://github.com/mx-space/core/commit/a6bbd75))
* feat: refactor webhook package structure and add model extraction script ([1f189d7](https://github.com/mx-space/core/commit/1f189d7))
* feat: translate text within excalidraw nodes during AI translation ([4b2c938](https://github.com/mx-space/core/commit/4b2c938))
* fix: add Redis timeout and error handling to prevent request hanging ([46206e8](https://github.com/mx-space/core/commit/46206e8))
* chore(deps): bump @haklex/* to 0.0.75 ([f8c30a0](https://github.com/mx-space/core/commit/f8c30a0))
* chore(deps): bump @haklex/* to 0.0.76 ([0c9a1cb](https://github.com/mx-space/core/commit/0c9a1cb))
* chore(release): bump @mx-space/webhook to v0.7.1 ([10f3542](https://github.com/mx-space/core/commit/10f3542))

## <small>10.3.1 (2026-03-09)</small>

* release: v10.3.1 ([7d6f453](https://github.com/mx-space/core/commit/7d6f453))
* fix: include lang in cache key and support NEXT_LOCALE cookie for request context ([bcef061](https://github.com/mx-space/core/commit/bcef061))
* fix: translation entry interceptor ([ac8009d](https://github.com/mx-space/core/commit/ac8009d))
* chore(deps): bump @haklex/* to 0.0.71 ([769c0c1](https://github.com/mx-space/core/commit/769c0c1))
* chore(deps): bump @haklex/* to 0.0.72 ([6e4ce0a](https://github.com/mx-space/core/commit/6e4ce0a))
* chore(deps): bump @haklex/* to 0.0.73 ([8a6c581](https://github.com/mx-space/core/commit/8a6c581))
* chore(deps): bump @haklex/* to 0.0.74 ([173760a](https://github.com/mx-space/core/commit/173760a))
* feat: translation entry interceptor, topic controller e2e, object-scan types, image/tool utils ([c33157c](https://github.com/mx-space/core/commit/c33157c))

## 10.3.0 (2026-03-08)

* release: v10.3.0 ([75a1a0e](https://github.com/mx-space/core/commit/75a1a0e))
* feat: 更新文件上传前缀支持模板占位符，增强灵活性 (#2584) ([2b5354a](https://github.com/mx-space/core/commit/2b5354a)), closes [#2584](https://github.com/mx-space/core/issues/2584)
* feat(ai): add auto-generation of translation entries for categories, topics, and notes ([65711aa](https://github.com/mx-space/core/commit/65711aa))
* feat(ai): translation entry model, service, controller and translate-fields interceptor ([a55fc7a](https://github.com/mx-space/core/commit/a55fc7a))
* feat(schema): enhance partial schemas for notes, pages, and posts with new fields ([f66c9ed](https://github.com/mx-space/core/commit/f66c9ed))
* fix(ai-summary): normalize lang query param with parseLanguageCode ([3dc7492](https://github.com/mx-space/core/commit/3dc7492))
* refactor(docs): update README and package readmes for clarity and consistency ([f9026ef](https://github.com/mx-space/core/commit/f9026ef))

## 10.2.0 (2026-03-08)

* release: v10.2.0 ([51248e0](https://github.com/mx-space/core/commit/51248e0))
* refactor(ai-summary): unify summary settings with translation multi-language pattern ([6e1f350](https://github.com/mx-space/core/commit/6e1f350))
* refactor(comment): extract lifecycle and spam filter into dedicated services ([8813db1](https://github.com/mx-space/core/commit/8813db1))
* enhance(ai.prompts): add targeted-person rule for harassment detection ([1f62df9](https://github.com/mx-space/core/commit/1f62df9))
* docs: enhance README.md with updated project overview, key features, and quick start guide ([3c2d326](https://github.com/mx-space/core/commit/3c2d326))

## 0.7.0 (2026-03-08)

* chore: release v0.7.0 ([3f479be](https://github.com/mx-space/core/commit/3f479be))
* fix(webhook): correct dist output paths for tsdown esm/cjs ([5fc8a03](https://github.com/mx-space/core/commit/5fc8a03))

## 0.6.0 (2026-03-08)

* chore: release v0.6.0 ([2c38da2](https://github.com/mx-space/core/commit/2c38da2))
* feat(webhook): add X-Webhook-Source header to indicate event origin ([899a5f1](https://github.com/mx-space/core/commit/899a5f1))

## <small>10.1.10 (2026-03-07)</small>

* release: v10.1.10 ([0d52052](https://github.com/mx-space/core/commit/0d52052))
* chore(deps): bump @haklex packages to 0.0.64 ([11969cb](https://github.com/mx-space/core/commit/11969cb))
* chore(deps): bump @haklex/* to 0.0.65 ([a357534](https://github.com/mx-space/core/commit/a357534))
* chore(deps): bump @haklex/* to 0.0.66 ([ae47ae9](https://github.com/mx-space/core/commit/ae47ae9))
* chore(deps): bump @haklex/* to 0.0.67 ([772eb64](https://github.com/mx-space/core/commit/772eb64))
* chore(deps): bump @haklex/* to 0.0.68 ([c9c7327](https://github.com/mx-space/core/commit/c9c7327))
* chore(deps): bump @haklex/* to 0.0.70 ([80fd5dc](https://github.com/mx-space/core/commit/80fd5dc))
* chore(deps): bump @haklex/rich-headless to 0.0.62 ([53fd99d](https://github.com/mx-space/core/commit/53fd99d))
* chore(deps): bump @haklex/rich-headless to 0.0.63 ([06d3a7c](https://github.com/mx-space/core/commit/06d3a7c))
* docs: Revise README to position repository as AI-powered CMS for blogs and creators ([93c0648](https://github.com/mx-space/core/commit/93c0648))
* docs: update CLAUDE.md ([326e304](https://github.com/mx-space/core/commit/326e304))

## <small>10.1.9 (2026-03-03)</small>

* release: v10.1.9 ([9634eac](https://github.com/mx-space/core/commit/9634eac))
* refactor(ai-translation): enhance translation retrieval and consistency checks ([c3d2456](https://github.com/mx-space/core/commit/c3d2456))
* fix(telemetry): harden telemetry module robustness and security ([515c0e7](https://github.com/mx-space/core/commit/515c0e7))

## <small>10.1.8 (2026-03-03)</small>

* release: v10.1.8 ([7a5ed06](https://github.com/mx-space/core/commit/7a5ed06))
* fix(deps): update dependency @haklex/rich-headless to v0.0.50 (#2608) ([4258242](https://github.com/mx-space/core/commit/4258242)), closes [#2608](https://github.com/mx-space/core/issues/2608)
* fix(deps): update dependency @haklex/rich-headless to v0.0.54 (#2610) ([027f62f](https://github.com/mx-space/core/commit/027f62f)), closes [#2610](https://github.com/mx-space/core/issues/2610)
* fix(deps): update dependency @nestjs/schedule to v6.1.1 (#2604) ([45a297a](https://github.com/mx-space/core/commit/45a297a)), closes [#2604](https://github.com/mx-space/core/issues/2604)
* chore(deps): update @haklex/rich-headless to v0.0.53 and add file update functionality ([6a831e0](https://github.com/mx-space/core/commit/6a831e0))
* chore(deps): update dependencies and refactor auth logic ([ce38de1](https://github.com/mx-space/core/commit/ce38de1))
* chore(deps): update dependency @better-auth/passkey to v1.4.21 (#2607) ([80cb44b](https://github.com/mx-space/core/commit/80cb44b)), closes [#2607](https://github.com/mx-space/core/issues/2607)
* chore(deps): update dependency semver to v7.7.4 (#2612) ([def251f](https://github.com/mx-space/core/commit/def251f)), closes [#2612](https://github.com/mx-space/core/issues/2612)

## <small>10.1.7 (2026-03-02)</small>

* release: v10.1.7 ([aa1055b](https://github.com/mx-space/core/commit/aa1055b))
* feat(gateway): implement broadcast method for admin events ([ff3cf68](https://github.com/mx-space/core/commit/ff3cf68))

## <small>10.1.6 (2026-03-02)</small>

* release: v10.1.6 ([091f373](https://github.com/mx-space/core/commit/091f373))
* feat(webhook): introduce EventPayloadEnricherService for payload enrichment ([a5a2b79](https://github.com/mx-space/core/commit/a5a2b79))

## <small>10.1.5 (2026-03-02)</small>

* release: v10.1.5 ([fb7efac](https://github.com/mx-space/core/commit/fb7efac))
* fix(webhook): update pagination logic in getEventsByHookId method ([2450f9d](https://github.com/mx-space/core/commit/2450f9d))
* chore(deps): update dependency @swc/core to v1.15.18 (#2605) ([cb33039](https://github.com/mx-space/core/commit/cb33039)), closes [#2605](https://github.com/mx-space/core/issues/2605)
* refactor: improve webhook and backup service structure ([d05b097](https://github.com/mx-space/core/commit/d05b097))

## <small>10.1.4 (2026-03-01)</small>

* release: v10.1.4 ([4020daa](https://github.com/mx-space/core/commit/4020daa))
* feat(translation): introduce TranslationConsistencyService for improved translation validation ([341cfd2](https://github.com/mx-space/core/commit/341cfd2))
* refactor: extract SERVERLESS_EVENT_PREFIX constant ([f0821d7](https://github.com/mx-space/core/commit/f0821d7)), closes [#2606](https://github.com/mx-space/core/issues/2606)

## <small>10.1.3 (2026-03-01)</small>

* release: v10.1.3 ([739daae](https://github.com/mx-space/core/commit/739daae))
* feat(socket): optimize socket fetching and configuration ([13eb074](https://github.com/mx-space/core/commit/13eb074))
* feat(translation): add content fields to translation and controller services ([6526893](https://github.com/mx-space/core/commit/6526893))

## <small>10.1.2 (2026-03-01)</small>

* release: v10.1.2 ([6794b49](https://github.com/mx-space/core/commit/6794b49))
* feat(content): enhance content hashing for Lexical format ([3b5e177](https://github.com/mx-space/core/commit/3b5e177))

## <small>10.1.1 (2026-03-01)</small>

* release: v10.1.1 ([dd54717](https://github.com/mx-space/core/commit/dd54717))
* feat(ai-task): add smart retry for partial-failed translation tasks ([ecdbf50](https://github.com/mx-space/core/commit/ecdbf50))
* feat(ai): enhance JSON extraction utilities and update translation strategy ([f673630](https://github.com/mx-space/core/commit/f673630))
* feat(visitor-event): enhance visitor event dispatch with additional content fields ([74d9398](https://github.com/mx-space/core/commit/74d9398))
* refactor(ai-translation): streamline translation service and enhance event handler ([3bb943f](https://github.com/mx-space/core/commit/3bb943f))
* chore: remove deploy job from GitHub Actions workflow ([b15f309](https://github.com/mx-space/core/commit/b15f309))
* chore(deps): update dependency resend to v6.9.3 (#2602) ([b964f73](https://github.com/mx-space/core/commit/b964f73)), closes [#2602](https://github.com/mx-space/core/issues/2602)
* chore(deps): update dependency tsdown to v0.20.3 (#2603) ([07382ea](https://github.com/mx-space/core/commit/07382ea)), closes [#2603](https://github.com/mx-space/core/issues/2603)
* fix(ai): improve error handling and cleanup in AiInFlightService ([2267810](https://github.com/mx-space/core/commit/2267810))

## 10.1.0 (2026-02-28)

* release: v10.1.0 ([575cfc2](https://github.com/mx-space/core/commit/575cfc2))
* feat: add patch for @lexical/code@0.41.0 and remove outdated patch ([e2c1492](https://github.com/mx-space/core/commit/e2c1492))
* feat: add v10.0.5 migration for Lexical root block ID backfill ([66c3650](https://github.com/mx-space/core/commit/66c3650))
* feat(aggregate): add /latest endpoint for top content per type ([563a716](https://github.com/mx-space/core/commit/563a716))
* feat(ai): enhance translation service with new lexical features and dependencies ([534b0f7](https://github.com/mx-space/core/commit/534b0f7))
* feat(ai): enhance translation strategies and introduce new event handler ([426dc07](https://github.com/mx-space/core/commit/426dc07))
* feat(ai): improve lexical translation and update utilities ([7475a8d](https://github.com/mx-space/core/commit/7475a8d))
* feat(ai): refine AI translation, runtime, and add json util ([481beeb](https://github.com/mx-space/core/commit/481beeb))
* feat(ai): update translation prompts with enhanced safety and structure rules ([4f035f2](https://github.com/mx-space/core/commit/4f035f2))
* feat(comment): add language support for comment anchors and enhance anchor resolution ([2218ae2](https://github.com/mx-space/core/commit/2218ae2))
* feat(content): introduce content preference handling for notes and pages ([14ed55b](https://github.com/mx-space/core/commit/14ed55b))
* feat(draft): implement draft history service with diff strategies ([5171707](https://github.com/mx-space/core/commit/5171707))
* feat(patch): add patch for @lexical/code@0.40.0 and update workspace configuration ([066171f](https://github.com/mx-space/core/commit/066171f))
* fix: update @lexical/code patch to improve syntax highlighting support ([3bf4873](https://github.com/mx-space/core/commit/3bf4873))
* fix(release): update Dokploy webhook handling in release workflow ([328013a](https://github.com/mx-space/core/commit/328013a))
* fix(test): add missing scheduleRegenerationForStaleTranslations mock in translation service spec ([4e701a2](https://github.com/mx-space/core/commit/4e701a2))
* fix(test): remove unnecessary whitespace in lexical-translation-e2e.spec.ts ([c623a20](https://github.com/mx-space/core/commit/c623a20))
* test(ai): fix lexical-translation-e2e to use strategy tokens and lexicalStrategy ([871aa96](https://github.com/mx-space/core/commit/871aa96))
* test(ai): update lexical-translation-e2e and helper.lexical.service tests ([d1162c0](https://github.com/mx-space/core/commit/d1162c0))
* chore: remove outdated patch for @lexical/code@0.41.0 and update pnpm workspace configuration ([bbce13a](https://github.com/mx-space/core/commit/bbce13a))
* chore: update patch hash for @lexical/code@0.41.0 in pnpm-lock.yaml ([2e936d9](https://github.com/mx-space/core/commit/2e936d9))
* chore(deps): update dependency @better-auth/passkey to v1.4.19 (#2594) ([4c0e80e](https://github.com/mx-space/core/commit/4c0e80e)), closes [#2594](https://github.com/mx-space/core/issues/2594)
* chore(deps): update dependency @better-auth/passkey to v1.4.20 (#2601) ([4a929bc](https://github.com/mx-space/core/commit/4a929bc)), closes [#2601](https://github.com/mx-space/core/issues/2601)
* chore(deps): update dependency @swc/core to v1.15.13 (#2595) ([590513c](https://github.com/mx-space/core/commit/590513c)), closes [#2595](https://github.com/mx-space/core/issues/2595)
* chore(deps): update dependency @swc/core to v1.15.17 (#2598) ([9ae2461](https://github.com/mx-space/core/commit/9ae2461)), closes [#2598](https://github.com/mx-space/core/issues/2598)
* chore(deps): update dependency axios to v1.13.6 (#2600) ([f646150](https://github.com/mx-space/core/commit/f646150)), closes [#2600](https://github.com/mx-space/core/issues/2600)
* chore(deps): update dependency eslint to v10.0.2 (#2596) ([59b3ebb](https://github.com/mx-space/core/commit/59b3ebb)), closes [#2596](https://github.com/mx-space/core/issues/2596)
* chore(deps): update dependency inquirer to v13.2.5 (#2591) ([1181bc5](https://github.com/mx-space/core/commit/1181bc5)), closes [#2591](https://github.com/mx-space/core/issues/2591)
* chore(deps): update dependency rimraf to v6.1.3 (#2597) ([b830c55](https://github.com/mx-space/core/commit/b830c55)), closes [#2597](https://github.com/mx-space/core/issues/2597)
* chore(deps): update dependency rolldown to v1.0.0-rc.6 (#2599) ([fe50035](https://github.com/mx-space/core/commit/fe50035)), closes [#2599](https://github.com/mx-space/core/issues/2599)
* chore(release): bump @mx-space/api-client to v2.1.0 ([c512656](https://github.com/mx-space/core/commit/c512656))
* chore(release): bump @mx-space/api-client to v2.1.1 ([27d305a](https://github.com/mx-space/core/commit/27d305a))
* refactor: isolate image update and cleanup logic ([70e05f3](https://github.com/mx-space/core/commit/70e05f3))
* refactor: update block ID generation to use 8-character IDs ([e2bd5a4](https://github.com/mx-space/core/commit/e2bd5a4))

## <small>10.0.4 (2026-02-18)</small>

* release: v10.0.4 ([c072ec7](https://github.com/mx-space/core/commit/c072ec7))
* refactor(comment): remove redundant state assignment from body ([7032029](https://github.com/mx-space/core/commit/7032029))
* feat(comment): auto-approve owner comments and enhance spam check ([63b62dc](https://github.com/mx-space/core/commit/63b62dc))
* feat(dokploy): add workflow step to trigger Dokploy redeploy on release ([2e071ba](https://github.com/mx-space/core/commit/2e071ba))
* feat(update): add Redis-based multi-instance sync and split into modules ([a742698](https://github.com/mx-space/core/commit/a742698))
* feat(visitor-events): implement visitor event dispatch service and related decorators ([165b74d](https://github.com/mx-space/core/commit/165b74d))
* chore: lint ([539e7d1](https://github.com/mx-space/core/commit/539e7d1))
* chore: remove unused lint dependency and clean up pnpm-lock.yaml ([d1f279d](https://github.com/mx-space/core/commit/d1f279d))
* chore(deps): update dependency @ianvs/prettier-plugin-sort-imports to v4.7.1 (#2582) ([755a642](https://github.com/mx-space/core/commit/755a642)), closes [#2582](https://github.com/mx-space/core/issues/2582)
* chore(deps): update dependency @typegoose/auto-increment to v5.0.1 (#2583) ([5afca7e](https://github.com/mx-space/core/commit/5afca7e)), closes [#2583](https://github.com/mx-space/core/issues/2583)
* chore(deps): update dependency dotenv to v17.2.4 (#2585) ([6a7c26b](https://github.com/mx-space/core/commit/6a7c26b)), closes [#2585](https://github.com/mx-space/core/issues/2585)
* chore(deps): update dependency inquirer to v13.2.4 (#2586) ([b36935e](https://github.com/mx-space/core/commit/b36935e)), closes [#2586](https://github.com/mx-space/core/issues/2586)
* chore(deps): update dependency ioredis to v5.9.3 (#2587) ([81faec7](https://github.com/mx-space/core/commit/81faec7)), closes [#2587](https://github.com/mx-space/core/issues/2587)
* chore(deps): update dependency mongoose to v9.1.6 (#2588) ([12cc336](https://github.com/mx-space/core/commit/12cc336)), closes [#2588](https://github.com/mx-space/core/issues/2588)
* chore(deps): update dependency resend to v6.9.2 (#2589) ([473e0f8](https://github.com/mx-space/core/commit/473e0f8)), closes [#2589](https://github.com/mx-space/core/issues/2589)
* fix(auth): allow hyphen in better-auth username validation ([6ae65a8](https://github.com/mx-space/core/commit/6ae65a8))

## <small>10.0.3 (2026-02-15)</small>

* release: v10.0.3 ([86c817f](https://github.com/mx-space/core/commit/86c817f))
* refactor(task-queue): add scope isolation and abstract base task controller ([cb6ba74](https://github.com/mx-space/core/commit/cb6ba74))

## <small>10.0.2 (2026-02-14)</small>

* release: v10.0.2 ([d9fc9e2](https://github.com/mx-space/core/commit/d9fc9e2))
* fix(zod): zLang should convert 'original' to undefined instead of passing through ([2b58461](https://github.com/mx-space/core/commit/2b58461))
* refactor(zod): extract reusable zLang validator supporting 'original' keyword ([83339c1](https://github.com/mx-space/core/commit/83339c1))

## <small>10.0.1 (2026-02-14)</small>

* release: v10.0.1 ([0a8930d](https://github.com/mx-space/core/commit/0a8930d))
* fix(deps): update dependency qs to v6.14.2 [security] (#2581) ([868f0eb](https://github.com/mx-space/core/commit/868f0eb)), closes [#2581](https://github.com/mx-space/core/issues/2581)
* fix(lang.decorator): handle 'original' language query parameter ([91be732](https://github.com/mx-space/core/commit/91be732))
* refactor(ai): route event-driven AI tasks through task queue ([b85f4d0](https://github.com/mx-space/core/commit/b85f4d0))
* chore(deps): update dependency axios to v1.13.5 [security] (#2578) ([f0c1498](https://github.com/mx-space/core/commit/f0c1498)), closes [#2578](https://github.com/mx-space/core/issues/2578)
* feat(translation): implement lexical content translation support ([dd8bdde](https://github.com/mx-space/core/commit/dd8bdde))

## 10.0.0 (2026-02-08)

* release: v10.0.0 ([2c02a0c](https://github.com/mx-space/core/commit/2c02a0c))
* chore(release): bump @mx-space/api-client to v2.0.0 ([69b3057](https://github.com/mx-space/core/commit/69b3057))
* refactor!: sdk v2 ([f45f117](https://github.com/mx-space/core/commit/f45f117))

## 10.0.0-alpha.3 (2026-02-08)

* release: v10.0.0-alpha.3 ([2b41f94](https://github.com/mx-space/core/commit/2b41f94))
* feat: add Lexical block editor content format support ([8fe2508](https://github.com/mx-space/core/commit/8fe2508))
* feat(cron): add syncPublishedImagesToS3 functionality and scheduling ([5be2dfa](https://github.com/mx-space/core/commit/5be2dfa))
* feat(snippet): add custom path support for snippets ([04a1bfc](https://github.com/mx-space/core/commit/04a1bfc))
* fix: add missing imports for HeadingNode, QuoteNode, TRANSFORMERS in LexicalService ([5072036](https://github.com/mx-space/core/commit/5072036))
* fix: remove CodeHighlightNode to eliminate PrismJS dependency in server bundle ([d3289f6](https://github.com/mx-space/core/commit/d3289f6))
* fix: replace @lexical/code and @lexical/markdown with custom nodes to eliminate PrismJS ([3e791d6](https://github.com/mx-space/core/commit/3e791d6))
* refactor: remove TextMacroService and textOptions config ([36bd3dd](https://github.com/mx-space/core/commit/36bd3dd))
* refactor(cron): define MigrationDoc and MigrationSource types for clarity ([73b79ef](https://github.com/mx-space/core/commit/73b79ef))
* refactor(serverless): simplify getCodeDefined method and remove unused asset service ([1e8fdb6](https://github.com/mx-space/core/commit/1e8fdb6))

## 10.0.0-alpha.2 (2026-02-07)

* release: v10.0.0-alpha.2 ([cf80bd8](https://github.com/mx-space/core/commit/cf80bd8))
* feat(serverless): implement logging for serverless function invocations ([59e9d4d](https://github.com/mx-space/core/commit/59e9d4d))
* fix(auth): add role validation in CreateAuth middleware ([1aa9549](https://github.com/mx-space/core/commit/1aa9549))

## 10.0.0-alpha.1 (2026-02-06)

* release: v10.0.0-alpha.1 ([bc830ee](https://github.com/mx-space/core/commit/bc830ee))
* feat(i18n): add translation support to activity, aggregate, and category controllers ([e33d214](https://github.com/mx-space/core/commit/e33d214))

## 10.0.0-alpha.0 (2026-02-06)

* release: v10.0.0-alpha.0 ([b759ef6](https://github.com/mx-space/core/commit/b759ef6))
* refactor: remove authn module ([5c3f3ab](https://github.com/mx-space/core/commit/5c3f3ab))
* refactor: simplify and fix bugs across core modules ([e4726b9](https://github.com/mx-space/core/commit/e4726b9))
* refactor: use @HttpCache with force option instead of manual cache ([8253442](https://github.com/mx-space/core/commit/8253442))
* refactor(db): centralize collection name constants and fix snake_case naming ([a0bb407](https://github.com/mx-space/core/commit/a0bb407))
* test(auth): update test suite for better-auth migration ([fa812c9](https://github.com/mx-space/core/commit/fa812c9))
* fix(ip-query): update IP API endpoint and response handling ([fa641a5](https://github.com/mx-space/core/commit/fa641a5))
* fix(migration): skip v9.7.5 migration when readers collection does not exist ([db4de1f](https://github.com/mx-space/core/commit/db4de1f))
* feat: add lightweight /reading/top endpoint and optimize /reading/rank ([50fb01d](https://github.com/mx-space/core/commit/50fb01d))
* refactor(auth)!: replace legacy auth system with better auth ([fa82f2c](https://github.com/mx-space/core/commit/fa82f2c))

## 9.7.0 (2026-02-04)

* release: v9.7.0 ([583ea80](https://github.com/mx-space/core/commit/583ea80))
* refactor(ai): update JSON escaping rules and simplify text serialization ([24215e8](https://github.com/mx-space/core/commit/24215e8))
* feat(cron-task): implement cron task module with business logic and scheduling ([6926e77](https://github.com/mx-space/core/commit/6926e77))

## <small>9.6.3 (2026-02-03)</small>

* release: v9.6.3 ([772a082](https://github.com/mx-space/core/commit/772a082))
* feat(ai-translation): extend article handling to include PageModel ([e8166b6](https://github.com/mx-space/core/commit/e8166b6))
* feat(ai): add comment review endpoint and enhance AI configuration options ([6101bc9](https://github.com/mx-space/core/commit/6101bc9))
* feat(migration): add v9.6.3 migration and enhance SMTP options handling ([a1a0b30](https://github.com/mx-space/core/commit/a1a0b30))
* feat(page): enhance language handling and translation integration in PageController ([5a749ba](https://github.com/mx-space/core/commit/5a749ba))
* fix(ai): use Tool Calling instead of response_format for structured output ([3c09a82](https://github.com/mx-space/core/commit/3c09a82)), closes [#2575](https://github.com/mx-space/core/issues/2575)

## <small>9.6.2 (2026-02-02)</small>

* release: v9.6.2 ([b991f3e](https://github.com/mx-space/core/commit/b991f3e))
* feat(mongo): enhance custom MongoDB connection string handling ([e0e4f24](https://github.com/mx-space/core/commit/e0e4f24))
* fix(entrypoint): improve Redis connection string handling and logging ([23abde6](https://github.com/mx-space/core/commit/23abde6))

## <small>9.6.1 (2026-02-02)</small>

* release: v9.6.1 ([729924d](https://github.com/mx-space/core/commit/729924d))
* refactor(entrypoint): streamline environment variable handling and enhance logging ([102180e](https://github.com/mx-space/core/commit/102180e))

## 9.6.0 (2026-02-02)

* release: v9.6.0 ([7e90df0](https://github.com/mx-space/core/commit/7e90df0))
* feat(ai): update translation prompts to enforce strict JSON output requirements ([810aaac](https://github.com/mx-space/core/commit/810aaac))
* feat(redis): enhance Redis configuration and email service integration ([634297c](https://github.com/mx-space/core/commit/634297c))

## 9.5.0 (2026-02-01)

* release: v9.5.0 ([413df16](https://github.com/mx-space/core/commit/413df16))
* fix(tests): update snapshots for NoteController e2e tests to reflect published status ([49d08e6](https://github.com/mx-space/core/commit/49d08e6))
* feat(ai): add retry functionality for AI tasks and enhance error handling ([5770839](https://github.com/mx-space/core/commit/5770839))
* feat(ai): add task cancellation and deletion endpoints in AiTaskController ([1975b58](https://github.com/mx-space/core/commit/1975b58))
* feat(lang): implement language handling in request context and enhance translation capabilities ([9ca8291](https://github.com/mx-space/core/commit/9ca8291))

## 9.4.0 (2026-01-31)

* release: v9.4.0 ([d21af7e](https://github.com/mx-space/core/commit/d21af7e))
* feat(ai): implement language utilities for AI processing ([82ed676](https://github.com/mx-space/core/commit/82ed676))
* feat(ai): introduce task queue for AI operations and enhance streaming capabilities ([2005c3d](https://github.com/mx-space/core/commit/2005c3d))
* test(ai): enhance AiInFlightService tests with Redis lock handling ([921c933](https://github.com/mx-space/core/commit/921c933))
* refactor(ai): update AI provider integration and enhance runtime structure ([25694f3](https://github.com/mx-space/core/commit/25694f3))

## <small>9.3.4 (2026-01-30)</small>

* release: v9.3.4 ([fc2d527](https://github.com/mx-space/core/commit/fc2d527))
* refactor(ai.prompts): simplify prompt structure and enhance readability ([26bde5a](https://github.com/mx-space/core/commit/26bde5a))

## <small>9.3.3 (2026-01-30)</small>

* release: v9.3.3 ([5e74d47](https://github.com/mx-space/core/commit/5e74d47))
* feat(note): enhance note retrieval with translation support ([a378cd3](https://github.com/mx-space/core/commit/a378cd3))

## <small>9.3.2 (2026-01-30)</small>

* release: v9.3.2 ([f4efc48](https://github.com/mx-space/core/commit/f4efc48))
* feat(translation): enhance translation capabilities for articles ([038d728](https://github.com/mx-space/core/commit/038d728))
* fix(deps): update dependency ai to v6.0.62 (#2569) ([1cdac56](https://github.com/mx-space/core/commit/1cdac56)), closes [#2569](https://github.com/mx-space/core/issues/2569)
* fix(deps): update dependency better-auth to v1.4.18 (#2570) ([ea0070a](https://github.com/mx-space/core/commit/ea0070a)), closes [#2570](https://github.com/mx-space/core/issues/2570)
* chore(deps): update dependency @ai-sdk/anthropic to v3.0.31 (#2571) ([620d69e](https://github.com/mx-space/core/commit/620d69e)), closes [#2571](https://github.com/mx-space/core/issues/2571)

## <small>9.3.1 (2026-01-29)</small>

* release: v9.3.1 ([41aaf38](https://github.com/mx-space/core/commit/41aaf38))
* fix(deps): update dependency @ai-sdk/openai to v3.0.21 (#2566) ([2be3e07](https://github.com/mx-space/core/commit/2be3e07)), closes [#2566](https://github.com/mx-space/core/issues/2566)
* fix(migration): better auth login issue ([f19a49b](https://github.com/mx-space/core/commit/f19a49b))
* chore(deps): update dependency @ai-sdk/anthropic to v3.0.29 (#2567) ([1770ae6](https://github.com/mx-space/core/commit/1770ae6)), closes [#2567](https://github.com/mx-space/core/issues/2567)
* chore(deps): update dependency inquirer to v13.2.2 (#2568) ([17c37c1](https://github.com/mx-space/core/commit/17c37c1)), closes [#2568](https://github.com/mx-space/core/issues/2568)
* chore(deps): update dependency rolldown to v1.0.0-rc.2 (#2565) ([05c02b6](https://github.com/mx-space/core/commit/05c02b6)), closes [#2565](https://github.com/mx-space/core/issues/2565)
* chore(deps): update dependency zod to v4.3.6 (#2564) ([f06efd7](https://github.com/mx-space/core/commit/f06efd7)), closes [#2564](https://github.com/mx-space/core/issues/2564)

## 9.3.0 (2026-01-28)

* release: v9.3.0 ([afda670](https://github.com/mx-space/core/commit/afda670))
* feat(ai-summary, ai-translation): enhance summary and translation functionalities ([c15cc55](https://github.com/mx-space/core/commit/c15cc55))
* feat(deps, ai): update dependencies and enhance AI functionalities ([f32f744](https://github.com/mx-space/core/commit/f32f744))
* chore(deps): update dependency axios to v1.13.4 (#2561) ([6a2c69e](https://github.com/mx-space/core/commit/6a2c69e)), closes [#2561](https://github.com/mx-space/core/issues/2561)

## 9.2.0 (2026-01-28)

* release: v9.2.0 ([8053978](https://github.com/mx-space/core/commit/8053978))
* chore(api-client): bump version to 1.20.0 ([c057735](https://github.com/mx-space/core/commit/c057735))
* chore(deps): update dependency @ai-sdk/anthropic to v3.0.28 (#2560) ([c9e6dbc](https://github.com/mx-space/core/commit/c9e6dbc)), closes [#2560](https://github.com/mx-space/core/issues/2560)
* chore(deps): update dependency @swc/core to v1.15.11 (#2562) ([b294c40](https://github.com/mx-space/core/commit/b294c40)), closes [#2562](https://github.com/mx-space/core/issues/2562)
* chore(deps): update dependency rolldown to v1.0.0-rc.1 (#2558) ([d7a1379](https://github.com/mx-space/core/commit/d7a1379)), closes [#2558](https://github.com/mx-space/core/issues/2558)
* feat(ai-translation): implement AI translation module with controller, service, model, and schema; a ([19652ae](https://github.com/mx-space/core/commit/19652ae))
* feat(draft): enhance draft history management with refVersion and baseVersion properties; implement  ([924dd3b](https://github.com/mx-space/core/commit/924dd3b))
* feat(draft): improve draft history trimming logic and add canTrimHistory method for better snapshot  ([3a1487d](https://github.com/mx-space/core/commit/3a1487d))
* feat(translation): add translation event handling and enhance note/post retrieval with translation s ([ab78738](https://github.com/mx-space/core/commit/ab78738))

## <small>9.1.1 (2026-01-27)</small>

* release: v9.1.1 ([8941d71](https://github.com/mx-space/core/commit/8941d71))
* chore: update client version ([6ff5e8e](https://github.com/mx-space/core/commit/6ff5e8e))
* chore: update corepack ([fe30ec9](https://github.com/mx-space/core/commit/fe30ec9))
* chore: update packages ([a02bad8](https://github.com/mx-space/core/commit/a02bad8))
* fix: api build ([410bf69](https://github.com/mx-space/core/commit/410bf69))
* feat: add ai config in aggregation ([f814267](https://github.com/mx-space/core/commit/f814267))

## 9.1.0 (2026-01-27)

* release: v9.1.0 ([f421d3d](https://github.com/mx-space/core/commit/f421d3d))
* chore: fix lockfile ([8cf33da](https://github.com/mx-space/core/commit/8cf33da))
* fix: tsdown config ([e95962e](https://github.com/mx-space/core/commit/e95962e))
* fix(draft): migrate and simplify full snapshot handling ([c8c226f](https://github.com/mx-space/core/commit/c8c226f))
* refactor(telemetry): remove authentication checks for telemetry endpoints ([beaaff6](https://github.com/mx-space/core/commit/beaaff6))
* feat(analyze): implement caching for analysis endpoints and enhance data aggregation ([74e910b](https://github.com/mx-space/core/commit/74e910b))
* feat(telemetry): implement telemetry data collection and dashboard ([871705f](https://github.com/mx-space/core/commit/871705f))

## <small>9.0.7 (2026-01-26)</small>

* release: v9.0.7 ([ea97def](https://github.com/mx-space/core/commit/ea97def))
* chore: update dependencies across multiple packages ([e9ac681](https://github.com/mx-space/core/commit/e9ac681))

## <small>9.0.6 (2026-01-25)</small>

* release: v9.0.6 ([f6852af](https://github.com/mx-space/core/commit/f6852af))

## <small>9.0.5 (2026-01-25)</small>

* release: v9.0.5 ([a6df075](https://github.com/mx-space/core/commit/a6df075))
* chore: rework some scripts (#2557) ([69ded2f](https://github.com/mx-space/core/commit/69ded2f)), closes [#2557](https://github.com/mx-space/core/issues/2557)
* fix(config): restore encryption logic for sensitive config fields ([043d7aa](https://github.com/mx-space/core/commit/043d7aa)), closes [#2556](https://github.com/mx-space/core/issues/2556)

## <small>9.0.4 (2026-01-25)</small>

* release: v9.0.4 ([4048ecc](https://github.com/mx-space/core/commit/4048ecc))
* feat(config): enhance encryption utilities and schema integration ([817ec74](https://github.com/mx-space/core/commit/817ec74))

## <small>9.0.3 (2026-01-25)</small>

* release: v9.0.3 ([28005dd](https://github.com/mx-space/core/commit/28005dd))
* chore: update dependencies and improve logging ([73c299d](https://github.com/mx-space/core/commit/73c299d))
* feat(comment): add batch update and delete functionality for comments ([deeb057](https://github.com/mx-space/core/commit/deeb057))
* feat(file): add batch delete and S3 upload functionality ([9e6cfe5](https://github.com/mx-space/core/commit/9e6cfe5))
* refactor: biz excpetion ([d3656a7](https://github.com/mx-space/core/commit/d3656a7))
* refactor(config): update configuration structure and remove unused fields ([faf8e3f](https://github.com/mx-space/core/commit/faf8e3f))

## <small>9.0.2 (2026-01-24)</small>

* release: v9.0.2 ([9543f3d](https://github.com/mx-space/core/commit/9543f3d))
* fix(file.type): update FileTypeEnum to replace 'photo' with 'image' ([9d1be6c](https://github.com/mx-space/core/commit/9d1be6c))
* fix(file): add type: String for enum props in FileReferenceModel ([35cdbdd](https://github.com/mx-space/core/commit/35cdbdd))
* fix(file): remove duplicate index on fileUrl field ([bd6eec6](https://github.com/mx-space/core/commit/bd6eec6))
* feat(file): implement file reference management and image migration service ([7b22129](https://github.com/mx-space/core/commit/7b22129))

## <small>9.0.1 (2026-01-23)</small>

* release: v9.0.1 ([015cc88](https://github.com/mx-space/core/commit/015cc88))
* fix(aggregate): rename wordCount field from length to count ([9c883c9](https://github.com/mx-space/core/commit/9c883c9))
* fix(note.schema): allow nullable fields and set default for images ([74f0aed](https://github.com/mx-space/core/commit/74f0aed))
* refactor: remove LOG_DIR setup from test configuration ([5a79d26](https://github.com/mx-space/core/commit/5a79d26))
* refactor!: remove logging functionality and related constants ([5e4f062](https://github.com/mx-space/core/commit/5e4f062))

## 9.0.0 (2026-01-22)

* release: v9.0.0 ([b3c8137](https://github.com/mx-space/core/commit/b3c8137))
* feat: add analyze apis ([3f51a95](https://github.com/mx-space/core/commit/3f51a95))
* chore: update deployment workflow to copy environment file ([dfeb65c](https://github.com/mx-space/core/commit/dfeb65c))

## 9.0.0-alpha.9 (2026-01-22)

* release: v9.0.0-alpha.9 ([00425d6](https://github.com/mx-space/core/commit/00425d6))
* chore: update deployment scripts and workflow configuration ([b2a6bb0](https://github.com/mx-space/core/commit/b2a6bb0))

## 9.0.0-alpha.8 (2026-01-22)

* release: v9.0.0-alpha.8 ([c05c133](https://github.com/mx-space/core/commit/c05c133))
* chore: remove zx dependency and refactor scripts to use native Node.js modules ([d4bc710](https://github.com/mx-space/core/commit/d4bc710))

## 9.0.0-alpha.7 (2026-01-22)

* release: v9.0.0-alpha.7 ([3254734](https://github.com/mx-space/core/commit/3254734))
* chore: update deployment script and workflow configuration ([0494325](https://github.com/mx-space/core/commit/0494325))

## 9.0.0-alpha.6 (2026-01-22)

* release: v9.0.0-alpha.6 ([b2216bc](https://github.com/mx-space/core/commit/b2216bc))
* chore: enhance deployment process and configuration management ([39bdecd](https://github.com/mx-space/core/commit/39bdecd))
* chore: remove Cloudflared integration from Docker entrypoint and Dockerfile ([bdaedd3](https://github.com/mx-space/core/commit/bdaedd3))

## 9.0.0-alpha.5 (2026-01-22)

* release: v9.0.0-alpha.5 ([1203091](https://github.com/mx-space/core/commit/1203091))
* chore: update GitHub Actions workflow for release process ([e231f36](https://github.com/mx-space/core/commit/e231f36))

## 9.0.0-alpha.4 (2026-01-22)

* release: v9.0.0-alpha.4 ([040f4b3](https://github.com/mx-space/core/commit/040f4b3))
* chore: refine Docker stack and GitHub Actions configurations ([97b7cef](https://github.com/mx-space/core/commit/97b7cef))

## 9.0.0-alpha.3 (2026-01-21)

* release: v9.0.0-alpha.3 ([10baaae](https://github.com/mx-space/core/commit/10baaae))
* chore: simplify environment variable definitions in Docker configurations ([e7c2e24](https://github.com/mx-space/core/commit/e7c2e24))

## 9.0.0-alpha.2 (2026-01-21)

* release: v9.0.0-alpha.2 ([87f02e0](https://github.com/mx-space/core/commit/87f02e0))
* chore: update Docker configurations for MongoDB integration ([0690882](https://github.com/mx-space/core/commit/0690882))
* chore: update Docker stack configuration for service names and networking ([de1fc11](https://github.com/mx-space/core/commit/de1fc11))
* fix: enhance OpenAI-compatible provider handling ([fab4d9d](https://github.com/mx-space/core/commit/fab4d9d))

## 9.0.0-alpha.1 (2026-01-21)

* release: v9.0.0-alpha.1 ([278b7ea](https://github.com/mx-space/core/commit/278b7ea))
* feat: add Docker Compose and Docker Stack configurations for mx-core and Redis services ([f83ab46](https://github.com/mx-space/core/commit/f83ab46))

## 9.0.0-alpha.0 (2026-01-21)

* release: v9.0.0-alpha.0 ([481f483](https://github.com/mx-space/core/commit/481f483))
* chore: update dependencies and refactor Algolia integration ([76147d6](https://github.com/mx-space/core/commit/76147d6))
* chore: update dependencies in package.json and pnpm-lock.yaml ([eb5b9d6](https://github.com/mx-space/core/commit/eb5b9d6))
* chore: update Node.js engine requirements and enhance documentation ([7381843](https://github.com/mx-space/core/commit/7381843))
* chore(deps): update dependencies and refactor code ([1e4dce6](https://github.com/mx-space/core/commit/1e4dce6))
* chore(deps): update dependency @ai-sdk/anthropic to v3.0.17 (#2545) ([c82ac4f](https://github.com/mx-space/core/commit/c82ac4f)), closes [#2545](https://github.com/mx-space/core/issues/2545)
* chore(deps): update dependency prettier to v3.8.0 (#2543) ([2705efc](https://github.com/mx-space/core/commit/2705efc)), closes [#2543](https://github.com/mx-space/core/issues/2543)
* chore(deps): update package dependencies ([f4b1e89](https://github.com/mx-space/core/commit/f4b1e89))
* chore(deps): upgrade mongoose and typegoose dependencies ([8d029ae](https://github.com/mx-space/core/commit/8d029ae))
* fix: replace zx with native Node.js APIs in download script ([b93d6d9](https://github.com/mx-space/core/commit/b93d6d9))
* fix(comment): 邮件通知速记跳转前端路由 (#2541) ([3c12235](https://github.com/mx-space/core/commit/3c12235)), closes [#2541](https://github.com/mx-space/core/issues/2541)
* fix(deps): update dependency @ai-sdk/openai to v3.0.13 (#2546) ([7213840](https://github.com/mx-space/core/commit/7213840)), closes [#2546](https://github.com/mx-space/core/issues/2546)
* fix(deps): update dependency @keyv/redis to v5.1.6 (#2547) ([5a00a9b](https://github.com/mx-space/core/commit/5a00a9b)), closes [#2547](https://github.com/mx-space/core/issues/2547)
* refactor: serverless functionality with sandbox service ([867014c](https://github.com/mx-space/core/commit/867014c))
* refactor: to esm ([9abe071](https://github.com/mx-space/core/commit/9abe071))

## 8.8.0 (2026-01-20)

* release: v8.8.0 ([91b163a](https://github.com/mx-space/core/commit/91b163a))
* refactor: migrate DTOs from class-validator to Zod (#2542) ([8d87b53](https://github.com/mx-space/core/commit/8d87b53)), closes [#2542](https://github.com/mx-space/core/issues/2542)
* feat(meta-preset): add MetaPreset module with CRUD operations and built-in presets ([d03a881](https://github.com/mx-space/core/commit/d03a881))

## <small>8.7.1 (2026-01-19)</small>

* release: v8.7.1 ([7285929](https://github.com/mx-space/core/commit/7285929))
* chore(auth): disable telemetry in CreateAuth function ([59b9f26](https://github.com/mx-space/core/commit/59b9f26))
* refactor(draft): remove redundant index annotation in DraftHistoryModel ([53db46d](https://github.com/mx-space/core/commit/53db46d))

## 8.7.0 (2026-01-18)

* release: v8.7.0 ([9658b4b](https://github.com/mx-space/core/commit/9658b4b))
* docs: add API response rules and transformation details to CLAUDE.md ([3e93699](https://github.com/mx-space/core/commit/3e93699))
* feat(aggregate): add new statistical endpoints for category distribution, tag cloud, publication tre ([1eb5dd7](https://github.com/mx-space/core/commit/1eb5dd7))
* feat(draft): implement draft module with CRUD operations and history management ([8adf43e](https://github.com/mx-space/core/commit/8adf43e))
* fix(deps): update babel monorepo to v7.28.6 (#2527) ([7711eb9](https://github.com/mx-space/core/commit/7711eb9)), closes [#2527](https://github.com/mx-space/core/issues/2527)
* fix(deps): update dependency @ai-sdk/openai to v3.0.12 (#2532) ([d3e1a32](https://github.com/mx-space/core/commit/d3e1a32)), closes [#2532](https://github.com/mx-space/core/issues/2532)
* fix(deps): update dependency ai to v6.0.39 (#2534) ([6a2db5f](https://github.com/mx-space/core/commit/6a2db5f)), closes [#2534](https://github.com/mx-space/core/issues/2534)
* fix(deps): update dependency cache-manager to v7.2.8 (#2535) ([cb8c287](https://github.com/mx-space/core/commit/cb8c287)), closes [#2535](https://github.com/mx-space/core/issues/2535)
* fix(deps): update dependency remove-markdown to v0.6.3 (#2536) ([222d8f2](https://github.com/mx-space/core/commit/222d8f2)), closes [#2536](https://github.com/mx-space/core/issues/2536)
* fix(deps): update nest monorepo (#2538) ([8ceae42](https://github.com/mx-space/core/commit/8ceae42)), closes [#2538](https://github.com/mx-space/core/issues/2538)
* chore(deps): update dependency @ai-sdk/anthropic to v3.0.14 (#2529) ([2daf995](https://github.com/mx-space/core/commit/2daf995)), closes [#2529](https://github.com/mx-space/core/issues/2529)
* chore(deps): update dependency @ai-sdk/anthropic to v3.0.15 (#2533) ([a5e2e01](https://github.com/mx-space/core/commit/a5e2e01)), closes [#2533](https://github.com/mx-space/core/issues/2533)
* chore(deps): update dependency @types/node to v25.0.9 (#2530) ([c211787](https://github.com/mx-space/core/commit/c211787)), closes [#2530](https://github.com/mx-space/core/issues/2530)
* chore(deps): update dependency ioredis to v5.9.2 (#2531) ([48c95a0](https://github.com/mx-space/core/commit/48c95a0)), closes [#2531](https://github.com/mx-space/core/issues/2531)
* chore(deps): update dependency rolldown to v1.0.0-beta.60 (#2526) ([b12a990](https://github.com/mx-space/core/commit/b12a990)), closes [#2526](https://github.com/mx-space/core/issues/2526)
* chore(deps): update dependency tsdown to v0.18.4 (#2505) ([453d300](https://github.com/mx-space/core/commit/453d300)), closes [#2505](https://github.com/mx-space/core/issues/2505)

## 8.6.0 (2026-01-15)

* release: v8.6.0 ([a104539](https://github.com/mx-space/core/commit/a104539))
* fix: update mongo image to version 7 in docker-compose.yml (#2474) ([03b5105](https://github.com/mx-space/core/commit/03b5105)), closes [#2474](https://github.com/mx-space/core/issues/2474)
* fix(backup): 修复 S3 备份上传错误 (#2524) ([43cbdc8](https://github.com/mx-space/core/commit/43cbdc8)), closes [#2524](https://github.com/mx-space/core/issues/2524)
* fix(render): 修复渲染预览类型路由匹配 (#2523) ([d82f8ff](https://github.com/mx-space/core/commit/d82f8ff)), closes [#2523](https://github.com/mx-space/core/issues/2523)
* refactor(core): remove download-admin.ejs and streamline download logic in PageProxyController ([74c51a6](https://github.com/mx-space/core/commit/74c51a6))
* Delete .trae/documents directory ([25ba732](https://github.com/mx-space/core/commit/25ba732))
* feat(core): refactor admin asset download logic with multi-mirror support and improved reliability ([d77a152](https://github.com/mx-space/core/commit/d77a152))
* chore: update test case ([0d4942e](https://github.com/mx-space/core/commit/0d4942e))
* chore(deps): update dependency @ai-sdk/anthropic to v3.0.13 (#2525) ([715b5bf](https://github.com/mx-space/core/commit/715b5bf)), closes [#2525](https://github.com/mx-space/core/issues/2525)
* chore(deps): update dependency @types/lodash to v4.17.23 (#2519) ([7d8f48d](https://github.com/mx-space/core/commit/7d8f48d)), closes [#2519](https://github.com/mx-space/core/issues/2519)
* chore(deps): update dependency @types/node to v25.0.8 (#2520) ([24d13d9](https://github.com/mx-space/core/commit/24d13d9)), closes [#2520](https://github.com/mx-space/core/issues/2520)

## <small>8.5.1 (2026-01-14)</small>

* release: v8.5.1 ([eb04540](https://github.com/mx-space/core/commit/eb04540))
* feat(auth): add profile mapping function to GitHub authentication ([f7d96c3](https://github.com/mx-space/core/commit/f7d96c3))
* feat(recently): 新增速记编辑功能 (#2521) ([99043bd](https://github.com/mx-space/core/commit/99043bd)), closes [#2521](https://github.com/mx-space/core/issues/2521)
* chore: fix build ([c2cb943](https://github.com/mx-space/core/commit/c2cb943))
* chore: update ([142569a](https://github.com/mx-space/core/commit/142569a))
* chore(api-client): bump version to 1.18.1 ([e3d034b](https://github.com/mx-space/core/commit/e3d034b))
* chore(api-client): update module exports to use .mjs and .mts extensions ([5a10573](https://github.com/mx-space/core/commit/5a10573))
* fix: build mod script ([800c0cb](https://github.com/mx-space/core/commit/800c0cb))
* fix(deps): update dependency ua-parser-js to v2.0.7 (#2509) ([d021823](https://github.com/mx-space/core/commit/d021823)), closes [#2509](https://github.com/mx-space/core/issues/2509)

## 8.5.0 (2026-01-12)

* release: v8.5.0 ([0510137](https://github.com/mx-space/core/commit/0510137))
* feat(ai): implement multi-provider support and migration for AI configuration ([b55916d](https://github.com/mx-space/core/commit/b55916d))
* chore(deps): update dependency @types/node to v25.0.5 (#2518) ([49fd5cf](https://github.com/mx-space/core/commit/49fd5cf)), closes [#2518](https://github.com/mx-space/core/issues/2518)
* chore(deps): update dependency ioredis to v5.9.1 (#2516) ([baa76e1](https://github.com/mx-space/core/commit/baa76e1)), closes [#2516](https://github.com/mx-space/core/issues/2516)
* chore(deps): update dependency vite-tsconfig-paths to v6.0.4 (#2517) ([b716201](https://github.com/mx-space/core/commit/b716201)), closes [#2517](https://github.com/mx-space/core/issues/2517)
* chore(workflow): update (#2513) ([ff44b9c](https://github.com/mx-space/core/commit/ff44b9c)), closes [#2513](https://github.com/mx-space/core/issues/2513)
* fix(deps): update dependency ai to v5.0.118 (#2511) ([2b4f31e](https://github.com/mx-space/core/commit/2b4f31e)), closes [#2511](https://github.com/mx-space/core/issues/2511)

## <small>8.4.5 (2026-01-08)</small>

* release: v8.4.5 ([f4d8e73](https://github.com/mx-space/core/commit/f4d8e73))
* fix: ignore eslint rule ([bac4736](https://github.com/mx-space/core/commit/bac4736))

## <small>8.4.4 (2026-01-08)</small>

* release: v8.4.4 ([bf2039d](https://github.com/mx-space/core/commit/bf2039d))
* fix(deps): update dependency @ai-sdk/openai to v2.0.89 (#2506) ([d71bd54](https://github.com/mx-space/core/commit/d71bd54)), closes [#2506](https://github.com/mx-space/core/issues/2506)
* fix(deps): update dependency @typegoose/typegoose to v12.20.1 (#2500) ([d84a71f](https://github.com/mx-space/core/commit/d84a71f)), closes [#2500](https://github.com/mx-space/core/issues/2500)
* fix(deps): update dependency ai to v5.0.117 (#2501) ([b47a482](https://github.com/mx-space/core/commit/b47a482)), closes [#2501](https://github.com/mx-space/core/issues/2501)
* fix(deps): update dependency mongoose to v8.19.4 (#2507) ([7f56be4](https://github.com/mx-space/core/commit/7f56be4)), closes [#2507](https://github.com/mx-space/core/issues/2507)
* fix(deps): update dependency openai to v5.23.2 (#2508) ([d2ae37d](https://github.com/mx-space/core/commit/d2ae37d)), closes [#2508](https://github.com/mx-space/core/issues/2508)
* fix(deps): update dependency qs to v6.14.1 [security] (#2504) ([6cb3d36](https://github.com/mx-space/core/commit/6cb3d36)), closes [#2504](https://github.com/mx-space/core/issues/2504)
* fix(markdown): export markdown permalink ([3bc74e7](https://github.com/mx-space/core/commit/3bc74e7))
* chore(deps): update dependency @swc/core to v1.15.8 (#2503) ([dc9dfb2](https://github.com/mx-space/core/commit/dc9dfb2)), closes [#2503](https://github.com/mx-space/core/issues/2503)
* chore(deps): update dependency rolldown to v1.0.0-beta.59 (#2496) ([8bb068b](https://github.com/mx-space/core/commit/8bb068b)), closes [#2496](https://github.com/mx-space/core/issues/2496)

## <small>8.4.3 (2025-12-27)</small>

* release: v8.4.3 ([09baaf9](https://github.com/mx-space/core/commit/09baaf9))
* fix(aggregate): update post query to only retrieve published posts ([c65eead](https://github.com/mx-space/core/commit/c65eead))
* fix(deps): update dependency @ai-sdk/openai to v2.0.88 (#2498) ([378f68b](https://github.com/mx-space/core/commit/378f68b)), closes [#2498](https://github.com/mx-space/core/issues/2498)
* fix(deps): update dependency @typegoose/auto-increment to v4.13.2 (#2499) ([9e6872a](https://github.com/mx-space/core/commit/9e6872a)), closes [#2499](https://github.com/mx-space/core/issues/2499)
* fix(deps): update dependency nodemailer to v7.0.11 [security] (#2487) ([9329cbd](https://github.com/mx-space/core/commit/9329cbd)), closes [#2487](https://github.com/mx-space/core/issues/2487)
* chore(deps): update dependencies across multiple packages including @nestjs, dayjs, jsonwebtoken, an ([1527405](https://github.com/mx-space/core/commit/1527405))
* chore(deps): update dependency @types/node to v24.10.4 (#2494) ([1fd32c3](https://github.com/mx-space/core/commit/1fd32c3)), closes [#2494](https://github.com/mx-space/core/issues/2494)
* chore(deps): update dependency eslint to v9.39.2 (#2495) ([4b036e5](https://github.com/mx-space/core/commit/4b036e5)), closes [#2495](https://github.com/mx-space/core/issues/2495)
* chore(deps): update dependency prettier-plugin-ember-template-tag to v2.1.2 (#2489) ([3481fa9](https://github.com/mx-space/core/commit/3481fa9)), closes [#2489](https://github.com/mx-space/core/issues/2489)
* chore(deps): update dependency typescript to v5.9.3 (#2490) ([4fe87f6](https://github.com/mx-space/core/commit/4fe87f6)), closes [#2490](https://github.com/mx-space/core/issues/2490)
* chore(deps): update dependency unplugin-swc to v1.5.9 (#2491) ([b9ad484](https://github.com/mx-space/core/commit/b9ad484)), closes [#2491](https://github.com/mx-space/core/issues/2491)
* chore(deps): update dependency zod to v3.25.76 (#2450) ([9d748e1](https://github.com/mx-space/core/commit/9d748e1)), closes [#2450](https://github.com/mx-space/core/issues/2450)
* chore(deps): update rolldown to version 1.0.0-beta.53 in package.json and pnpm-lock.yaml ([748f03c](https://github.com/mx-space/core/commit/748f03c))
* chore(deps): update supercharge/mongodb-github-action action to v1.12.1 (#2492) ([5ad4547](https://github.com/mx-space/core/commit/5ad4547)), closes [#2492](https://github.com/mx-space/core/issues/2492)
* feat(markdown): 为Markdown 导入导出添加标签字段 ([5ca66b6](https://github.com/mx-space/core/commit/5ca66b6))
* feat(note): add validation for note updates to check for existing documents and track field changes ([70fb1b2](https://github.com/mx-space/core/commit/70fb1b2))
* refactor(hash): split variable initialization for clarity ([690ed5e](https://github.com/mx-space/core/commit/690ed5e))

## <small>8.4.2 (2025-11-30)</small>

* release: v8.4.2 ([d839edb](https://github.com/mx-space/core/commit/d839edb))
* fix(ai-summary): log error details in AI summary service ([049e6a5](https://github.com/mx-space/core/commit/049e6a5))

## <small>8.4.1 (2025-11-24)</small>

* release: v8.4.1 ([c1a1f5c](https://github.com/mx-space/core/commit/c1a1f5c))
* feat(link): convert external friend avatar links to internal links (#2480) ([ca1e328](https://github.com/mx-space/core/commit/ca1e328)), closes [#2480](https://github.com/mx-space/core/issues/2480)
* chore: move to tsdown ([9979ebc](https://github.com/mx-space/core/commit/9979ebc))
* chore: update deps ([ec77c38](https://github.com/mx-space/core/commit/ec77c38))
* chore: update deps ([1825b5d](https://github.com/mx-space/core/commit/1825b5d))
* chore(deps): update dependencies and add Git LFS hooks ([27588ea](https://github.com/mx-space/core/commit/27588ea))
* chore(deps): update dependencies for improved functionality and compatibility ([a78325c](https://github.com/mx-space/core/commit/a78325c))
* chore(deps): update dependency @swc/core to v1.13.21 (#2472) ([2b07a1f](https://github.com/mx-space/core/commit/2b07a1f)), closes [#2472](https://github.com/mx-space/core/issues/2472)
* chore(deps): update dependency @sxzz/eslint-config to v7.1.4 (#2462) ([d2840a5](https://github.com/mx-space/core/commit/d2840a5)), closes [#2462](https://github.com/mx-space/core/issues/2462)
* chore(deps): update dependency @types/nodemailer to v6.4.19 (#2457) ([e7f858d](https://github.com/mx-space/core/commit/e7f858d)), closes [#2457](https://github.com/mx-space/core/issues/2457)
* chore(deps): update dependency @types/nodemailer to v6.4.20 (#2463) ([8142d7e](https://github.com/mx-space/core/commit/8142d7e)), closes [#2463](https://github.com/mx-space/core/issues/2463)
* chore(deps): update dependency @types/nodemailer to v6.4.21 (#2475) ([b67ec98](https://github.com/mx-space/core/commit/b67ec98)), closes [#2475](https://github.com/mx-space/core/issues/2475)
* chore(deps): update dependency @types/validator to v13.15.10 (#2476) ([efac88d](https://github.com/mx-space/core/commit/efac88d)), closes [#2476](https://github.com/mx-space/core/issues/2476)
* chore(deps): update dependency ioredis to v5.8.2 (#2477) ([d31efb2](https://github.com/mx-space/core/commit/d31efb2)), closes [#2477](https://github.com/mx-space/core/issues/2477)
* chore(deps): update dependency lint-staged to v16.2.7 (#2478) ([f9ff7f8](https://github.com/mx-space/core/commit/f9ff7f8)), closes [#2478](https://github.com/mx-space/core/issues/2478)
* chore(deps): update dependency mime-types to v3.0.2 (#2479) ([b4e605e](https://github.com/mx-space/core/commit/b4e605e)), closes [#2479](https://github.com/mx-space/core/issues/2479)
* chore(deps): update dependency mongodb-memory-server to v10.2.3 (#2481) ([478120b](https://github.com/mx-space/core/commit/478120b)), closes [#2481](https://github.com/mx-space/core/issues/2481)
* chore(deps): update dependency semver to v7.7.3 (#2482) ([bc1380e](https://github.com/mx-space/core/commit/bc1380e)), closes [#2482](https://github.com/mx-space/core/issues/2482)
* chore(deps): update dependency semver to v7.7.3 (#2483) ([3c65069](https://github.com/mx-space/core/commit/3c65069)), closes [#2483](https://github.com/mx-space/core/issues/2483)
* chore(deps): update eslint-config and remove unused dependencies ([04ffe7d](https://github.com/mx-space/core/commit/04ffe7d))
* fix(deps): downgrade semver from v7.7.3 to v7.7.2 in pnpm-lock.yaml ([ba0501e](https://github.com/mx-space/core/commit/ba0501e))
* fix(deps): update dependency @ai-sdk/openai to v2.0.42 (#2464) ([9c0ac35](https://github.com/mx-space/core/commit/9c0ac35)), closes [#2464](https://github.com/mx-space/core/issues/2464)
* fix(deps): update dependency ai to v5.0.52 [security] (#2470) ([5cdc4f6](https://github.com/mx-space/core/commit/5cdc4f6)), closes [#2470](https://github.com/mx-space/core/issues/2470)
* fix(deps): update dependency dayjs to v1.11.18 (#2459) ([2afa730](https://github.com/mx-space/core/commit/2afa730)), closes [#2459](https://github.com/mx-space/core/issues/2459)
* fix(deps): update dependency form-data to v4.0.4 [security] (#2454) ([81b875d](https://github.com/mx-space/core/commit/81b875d)), closes [#2454](https://github.com/mx-space/core/issues/2454)
* fix(deps): update dependency nodemailer to v7.0.7 [security] (#2467) ([2d10df6](https://github.com/mx-space/core/commit/2d10df6)), closes [#2467](https://github.com/mx-space/core/issues/2467)
* refactor(ai): update AI module and dependencies ([3f5f9f5](https://github.com/mx-space/core/commit/3f5f9f5))
* refactor(auth): enhance OAuth provider configuration with redirect URIs ([3d733c2](https://github.com/mx-space/core/commit/3d733c2))

## 8.4.0 (2025-07-10)

* release: v8.4.0 ([02ffa8f](https://github.com/mx-space/core/commit/02ffa8f))
* chore(ci): skip postinstall scripts for some testing-only dependencies (#2442) ([97cd8d4](https://github.com/mx-space/core/commit/97cd8d4)), closes [#2442](https://github.com/mx-space/core/issues/2442)
* chore(deps): update dependencies across multiple packages ([0bae393](https://github.com/mx-space/core/commit/0bae393))
* chore(deps): update dependencies for improved compatibility and functionality ([9978184](https://github.com/mx-space/core/commit/9978184))
* chore(deps): update package dependencies for improved stability ([f369e9c](https://github.com/mx-space/core/commit/f369e9c))
* chore(deps): update semver to version 7.7.2 in package.json and pnpm-lock.yaml ([3e57805](https://github.com/mx-space/core/commit/3e57805))
* chore(pnpm): remove patched dependency for tinyexec ([0a8ab1e](https://github.com/mx-space/core/commit/0a8ab1e))
* feat(ai): integrate new AI SDK and refactor AI services ([3e12044](https://github.com/mx-space/core/commit/3e12044))
* feat(core): 实现文章的发布/取消发布功能 (#2443) ([00b66be](https://github.com/mx-space/core/commit/00b66be)), closes [#2443](https://github.com/mx-space/core/issues/2443)
* feat(server-time): enhance middleware configuration and import context ([a463551](https://github.com/mx-space/core/commit/a463551))
* fix: remove patch ([14fe84c](https://github.com/mx-space/core/commit/14fe84c))

## <small>8.3.2 (2025-05-26)</small>

* release: v8.3.2 ([74b58f0](https://github.com/mx-space/core/commit/74b58f0))
* fix(auth): enhance CORS support in CreateAuth handler ([bf6021a](https://github.com/mx-space/core/commit/bf6021a))

## <small>8.3.1 (2025-05-20)</small>

* release: v8.3.1 ([bf49873](https://github.com/mx-space/core/commit/bf49873))
* refactor: ai agent to langgraph ([7229ccf](https://github.com/mx-space/core/commit/7229ccf))
* refactor(image): optimize image processing with AsyncQueue ([7047b76](https://github.com/mx-space/core/commit/7047b76))
* refactor(markdown): optimize article extraction with Promise.all ([f054fe5](https://github.com/mx-space/core/commit/f054fe5))
* refactor(vitest): remove unused module resolutions ([40deef5](https://github.com/mx-space/core/commit/40deef5))
* fix: bundle ([7e616ee](https://github.com/mx-space/core/commit/7e616ee))
* fix(ai): ensure proper task cleanup in AiDeepReadingService ([f7cd8c7](https://github.com/mx-space/core/commit/f7cd8c7))
* fix(deps): complie `@antfu/install-pkg` ([89013ed](https://github.com/mx-space/core/commit/89013ed))
* fix(markdown): refine tokenizer and code handling in markdown utility ([e80b776](https://github.com/mx-space/core/commit/e80b776))
* fix(tinyexec): replace require statements to support cjs ([75e153c](https://github.com/mx-space/core/commit/75e153c))
* feat(ai): enhance OpenAI configuration with additional headers ([9b46a60](https://github.com/mx-space/core/commit/9b46a60))
* feat(s3): implement S3Uploader for file uploads ([c527591](https://github.com/mx-space/core/commit/c527591))
* chore(deps): update @sxzz/eslint-config and related dependencies ([e64acfa](https://github.com/mx-space/core/commit/e64acfa))
* chore(deps): update dependencies and ESLint configuration ([441bc8a](https://github.com/mx-space/core/commit/441bc8a))
* chore(deps): update dependencies for improved compatibility ([4336e0f](https://github.com/mx-space/core/commit/4336e0f))
* chore(release): bump @mx-space/api-client to v1.17.0 ([f2873a5](https://github.com/mx-space/core/commit/f2873a5))

## 8.3.0 (2025-05-06)

* release: v8.3.0 ([991cb0a](https://github.com/mx-space/core/commit/991cb0a))
* refactor(tests): remove zx globals import from global.d.ts and lifecycle.ts ([574f02b](https://github.com/mx-space/core/commit/574f02b))
* chore(deps): add mongodb-memory-server and redis-memory-server to pnpm-lock.yaml ([d75dcd7](https://github.com/mx-space/core/commit/d75dcd7))
* chore(deps): update package dependencies to use catalog references ([423cc7d](https://github.com/mx-space/core/commit/423cc7d))
* feat(ai): add deep reading model and controller method ([8a5048f](https://github.com/mx-space/core/commit/8a5048f))
* feat(ai): introduce deep reading functionality and refactor AI module ([c385c58](https://github.com/mx-space/core/commit/c385c58))
* feat(ci): add custom action for MongoDB and Redis setup ([c657e9a](https://github.com/mx-space/core/commit/c657e9a))
* feat(ci): add custom Node.js and pnpm setup action ([5077535](https://github.com/mx-space/core/commit/5077535))

## 8.2.0 (2025-05-05)

* release: v8.2.0 ([17f3feb](https://github.com/mx-space/core/commit/17f3feb))
* fix(comment): refine AI evaluation method and update comment options ([f855521](https://github.com/mx-space/core/commit/f855521))
* refactor(core): 再次延长获取配置等待时间以避免极端情况发生 ([86fdb9e](https://github.com/mx-space/core/commit/86fdb9e))
* feat: implement AI-based comment evaluation in CommentService ([d2956f3](https://github.com/mx-space/core/commit/d2956f3))
* feat: update ai integration (#2422) ([46704d2](https://github.com/mx-space/core/commit/46704d2)), closes [#2422](https://github.com/mx-space/core/issues/2422)
* chore(deps): update robinraju/release-downloader action to v1.12 (#2417) ([bb7e9a3](https://github.com/mx-space/core/commit/bb7e9a3)), closes [#2417](https://github.com/mx-space/core/issues/2417)

## <small>8.1.2 (2025-05-05)</small>

* release: v8.1.2 ([9214609](https://github.com/mx-space/core/commit/9214609))
* chore: enhance CORS configuration in bootstrap and auth implementation ([af67ca1](https://github.com/mx-space/core/commit/af67ca1))
* chore: update dependencies and improve health controller ([e055f5c](https://github.com/mx-space/core/commit/e055f5c))
* chore: update ESLint configuration ([d2e945f](https://github.com/mx-space/core/commit/d2e945f))

## <small>8.1.1 (2025-04-06)</small>

* release: v8.1.1 ([7a4ee66](https://github.com/mx-space/core/commit/7a4ee66))
* chore: remove unused imports and update TypeScript version ([c26e9ef](https://github.com/mx-space/core/commit/c26e9ef))
* chore: update dependencies and improve auth implementation ([5bf9397](https://github.com/mx-space/core/commit/5bf9397))
* fix: deploy script (#2409) ([577d5c5](https://github.com/mx-space/core/commit/577d5c5)), closes [#2409](https://github.com/mx-space/core/issues/2409)
* fix: lint and fix cache service ([9626378](https://github.com/mx-space/core/commit/9626378))
* fix: mask custom connection string passwords (CLI & env) (#2410) ([e0f5116](https://github.com/mx-space/core/commit/e0f5116)), closes [#2410](https://github.com/mx-space/core/issues/2410)
* fix(gateway/auth): broadcast failure (#2413) ([128b92c](https://github.com/mx-space/core/commit/128b92c)), closes [#2413](https://github.com/mx-space/core/issues/2413)

## 8.1.0 (2025-03-25)

* release: v8.1.0 ([f70faa2](https://github.com/mx-space/core/commit/f70faa2))
* chore: update script ([ef2fa7b](https://github.com/mx-space/core/commit/ef2fa7b))
* chore(ci): remove useless input (#2404) ([a0ad1a2](https://github.com/mx-space/core/commit/a0ad1a2)), closes [#2404](https://github.com/mx-space/core/issues/2404)
* Init (#2405) ([5396014](https://github.com/mx-space/core/commit/5396014)), closes [#2405](https://github.com/mx-space/core/issues/2405)
* feat: AI antispam (#2406) ([4ec4814](https://github.com/mx-space/core/commit/4ec4814)), closes [#2406](https://github.com/mx-space/core/issues/2406)

## <small>8.0.3 (2025-03-23)</small>

* release: v8.0.3 ([2f4600b](https://github.com/mx-space/core/commit/2f4600b))
* fix: ai summary prompt ([5b9952c](https://github.com/mx-space/core/commit/5b9952c))
* fix(deps): update dependency @langchain/openai to v0.4.5 (#2395) ([fc028a4](https://github.com/mx-space/core/commit/fc028a4)), closes [#2395](https://github.com/mx-space/core/issues/2395)
* fix(deps): update dependency axios to v1.8.4 (#2399) ([ad41ec4](https://github.com/mx-space/core/commit/ad41ec4)), closes [#2399](https://github.com/mx-space/core/issues/2399)
* fix(deps): update dependency openai to v4.87.4 (#2396) ([f6d7f0b](https://github.com/mx-space/core/commit/f6d7f0b)), closes [#2396](https://github.com/mx-space/core/issues/2396)
* fix(deps): update nest monorepo to v11.0.12 (#2397) ([511587a](https://github.com/mx-space/core/commit/511587a)), closes [#2397](https://github.com/mx-space/core/issues/2397)
* chore(deps): update dependency @swc/core to v1.11.11 (#2388) ([424dd2b](https://github.com/mx-space/core/commit/424dd2b)), closes [#2388](https://github.com/mx-space/core/issues/2388)
* chore(deps): update dependency @types/express to v5.0.1 (#2398) ([3cb3100](https://github.com/mx-space/core/commit/3cb3100)), closes [#2398](https://github.com/mx-space/core/issues/2398)
* chore(deps): update dependency @types/node to v22.13.10 (#2389) ([789b26f](https://github.com/mx-space/core/commit/789b26f)), closes [#2389](https://github.com/mx-space/core/issues/2389)
* chore(deps): update dependency axios to v1.8.3 (#2390) ([c4e9785](https://github.com/mx-space/core/commit/c4e9785)), closes [#2390](https://github.com/mx-space/core/issues/2390)
* chore(deps): update dependency eslint to v9.22.0 (#2401) ([a2b8e23](https://github.com/mx-space/core/commit/a2b8e23)), closes [#2401](https://github.com/mx-space/core/issues/2401)
* chore(deps): update dependency mongodb-memory-server to v10.1.4 (#2391) ([1f25eb9](https://github.com/mx-space/core/commit/1f25eb9)), closes [#2391](https://github.com/mx-space/core/issues/2391)
* chore(deps): update dependency nanoid to v5.1.4 (#2372) ([a313c24](https://github.com/mx-space/core/commit/a313c24)), closes [#2372](https://github.com/mx-space/core/issues/2372)
* chore(deps): update dependency nanoid to v5.1.5 (#2392) ([0bfd90f](https://github.com/mx-space/core/commit/0bfd90f)), closes [#2392](https://github.com/mx-space/core/issues/2392)
* chore(deps): update dependency prettier to v3.5.3 (#2393) ([7913d20](https://github.com/mx-space/core/commit/7913d20)), closes [#2393](https://github.com/mx-space/core/issues/2393)
* chore(deps): update docker/setup-qemu-action action to v3.6.0 (#2373) ([4822c9d](https://github.com/mx-space/core/commit/4822c9d)), closes [#2373](https://github.com/mx-space/core/issues/2373)
* chore(deps): update pnpm to v9.15.9 (#2394) ([11ea69c](https://github.com/mx-space/core/commit/11ea69c)), closes [#2394](https://github.com/mx-space/core/issues/2394)
* chore(deps): update pnpm/action-setup action to v4.1.0 (#2356) ([af77b70](https://github.com/mx-space/core/commit/af77b70)), closes [#2356](https://github.com/mx-space/core/issues/2356)

## <small>8.0.2 (2025-03-17)</small>

* release: v8.0.2 ([84286ff](https://github.com/mx-space/core/commit/84286ff))
* chore: remove server-deplpy.js deployment script ([91301a9](https://github.com/mx-space/core/commit/91301a9))
* chore: update deps ([1d51378](https://github.com/mx-space/core/commit/1d51378))
* chore: update deps ([7a0055d](https://github.com/mx-space/core/commit/7a0055d))
* chore(deps): update dependency axios to v1.8.2 [security] (#2384) ([3e71774](https://github.com/mx-space/core/commit/3e71774)), closes [#2384](https://github.com/mx-space/core/issues/2384)
* chore(deps): update dependency better-auth to v1.1.21 [security] (#2380) ([31d8341](https://github.com/mx-space/core/commit/31d8341)), closes [#2380](https://github.com/mx-space/core/issues/2380)
* feat: 添加推送到Bing支持 (#2379) ([400d217](https://github.com/mx-space/core/commit/400d217)), closes [#2379](https://github.com/mx-space/core/issues/2379)
* fix: cravatar frontend cannot be displayed (#2385) ([490320e](https://github.com/mx-space/core/commit/490320e)), closes [#2385](https://github.com/mx-space/core/issues/2385)
* build(dockerfile): 更新 cloudflared 下载链接并支持多架构 (#2378) ([3061ac0](https://github.com/mx-space/core/commit/3061ac0)), closes [#2378](https://github.com/mx-space/core/issues/2378)

## <small>8.0.1 (2025-02-19)</small>

* release: v8.0.1 ([f12eb56](https://github.com/mx-space/core/commit/f12eb56))
* chore(deps): bump dependencies to latest versions ([91e566f](https://github.com/mx-space/core/commit/91e566f))
* chore(deps): update dependency @langchain/core to v0.3.39 (#2338) ([bb471df](https://github.com/mx-space/core/commit/bb471df)), closes [#2338](https://github.com/mx-space/core/issues/2338)
* chore(deps): update dependency @langchain/core to v0.3.40 (#2355) ([7531c69](https://github.com/mx-space/core/commit/7531c69)), closes [#2355](https://github.com/mx-space/core/issues/2355)
* chore(deps): update dependency @swc/core to v1.10.15 (#2339) ([f239432](https://github.com/mx-space/core/commit/f239432)), closes [#2339](https://github.com/mx-space/core/issues/2339)
* chore(deps): update dependency @swc/core to v1.10.16 (#2357) ([8768ed7](https://github.com/mx-space/core/commit/8768ed7)), closes [#2357](https://github.com/mx-space/core/issues/2357)
* chore(deps): update dependency @swc/core to v1.10.17 (#2363) ([2b1ef82](https://github.com/mx-space/core/commit/2b1ef82)), closes [#2363](https://github.com/mx-space/core/issues/2363)
* chore(deps): update dependency @swc/core to v1.10.18 (#2369) ([26a6036](https://github.com/mx-space/core/commit/26a6036)), closes [#2369](https://github.com/mx-space/core/issues/2369)
* chore(deps): update dependency @types/lodash to v4.17.15 (#2331) ([4d28950](https://github.com/mx-space/core/commit/4d28950)), closes [#2331](https://github.com/mx-space/core/issues/2331)
* chore(deps): update dependency @types/node to v22.10.10 (#2332) ([a675b35](https://github.com/mx-space/core/commit/a675b35)), closes [#2332](https://github.com/mx-space/core/issues/2332)
* chore(deps): update dependency @types/node to v22.13.1 (#2336) ([c241f36](https://github.com/mx-space/core/commit/c241f36)), closes [#2336](https://github.com/mx-space/core/issues/2336)
* chore(deps): update dependency @types/node to v22.13.4 (#2358) ([fb3155b](https://github.com/mx-space/core/commit/fb3155b)), closes [#2358](https://github.com/mx-space/core/issues/2358)
* chore(deps): update dependency better-auth to v1.1.16 [security] (#2337) ([32fb561](https://github.com/mx-space/core/commit/32fb561)), closes [#2337](https://github.com/mx-space/core/issues/2337)
* chore(deps): update dependency better-auth to v1.1.17 (#2333) ([073f993](https://github.com/mx-space/core/commit/073f993)), closes [#2333](https://github.com/mx-space/core/issues/2333)
* chore(deps): update dependency better-auth to v1.1.18 (#2360) ([628bdc8](https://github.com/mx-space/core/commit/628bdc8)), closes [#2360](https://github.com/mx-space/core/issues/2360)
* chore(deps): update dependency eslint to v9.20.1 (#2345) ([1d7f1d4](https://github.com/mx-space/core/commit/1d7f1d4)), closes [#2345](https://github.com/mx-space/core/issues/2345)
* chore(deps): update dependency ioredis to v5.5.0 (#2351) ([f349511](https://github.com/mx-space/core/commit/f349511)), closes [#2351](https://github.com/mx-space/core/issues/2351)
* chore(deps): update dependency prettier to v3.5.0 (#2353) ([68f8e23](https://github.com/mx-space/core/commit/68f8e23)), closes [#2353](https://github.com/mx-space/core/issues/2353)
* chore(deps): update dependency prettier to v3.5.1 (#2361) ([69e321c](https://github.com/mx-space/core/commit/69e321c)), closes [#2361](https://github.com/mx-space/core/issues/2361)
* chore(deps): update dependency semver to v7.7.1 (#2354) ([c861821](https://github.com/mx-space/core/commit/c861821)), closes [#2354](https://github.com/mx-space/core/issues/2354)
* chore(deps): update dependency tsup to v8.3.6 (#2334) ([288a03f](https://github.com/mx-space/core/commit/288a03f)), closes [#2334](https://github.com/mx-space/core/issues/2334)
* chore(deps): update dependency whatwg-url to v14.1.1 (#2348) ([0529c69](https://github.com/mx-space/core/commit/0529c69)), closes [#2348](https://github.com/mx-space/core/issues/2348)
* chore(deps): update pnpm to v9.15.5 (#2335) ([896c7ac](https://github.com/mx-space/core/commit/896c7ac)), closes [#2335](https://github.com/mx-space/core/issues/2335)
* fix(deps): update babel monorepo to v7.26.8 (#2340) ([3b64af7](https://github.com/mx-space/core/commit/3b64af7)), closes [#2340](https://github.com/mx-space/core/issues/2340)
* fix(deps): update babel monorepo to v7.26.9 (#2362) ([feacfaf](https://github.com/mx-space/core/commit/feacfaf)), closes [#2362](https://github.com/mx-space/core/issues/2362)
* fix(deps): update dependency @fastify/static to v8.1.1 (#2364) ([28cc927](https://github.com/mx-space/core/commit/28cc927)), closes [#2364](https://github.com/mx-space/core/issues/2364)
* fix(deps): update dependency @langchain/openai to v0.4.3 (#2341) ([0d6eda2](https://github.com/mx-space/core/commit/0d6eda2)), closes [#2341](https://github.com/mx-space/core/issues/2341)
* fix(deps): update dependency @langchain/openai to v0.4.4 (#2349) ([38d1a31](https://github.com/mx-space/core/commit/38d1a31)), closes [#2349](https://github.com/mx-space/core/issues/2349)
* fix(deps): update dependency @typegoose/auto-increment to v4.9.1 (#2342) ([71c3ef8](https://github.com/mx-space/core/commit/71c3ef8)), closes [#2342](https://github.com/mx-space/core/issues/2342)
* fix(deps): update dependency form-data to v4.0.2 (#2365) ([f4e9fad](https://github.com/mx-space/core/commit/f4e9fad)), closes [#2365](https://github.com/mx-space/core/issues/2365)
* fix(deps): update dependency langchain to v0.3.18 (#2366) ([72b1488](https://github.com/mx-space/core/commit/72b1488)), closes [#2366](https://github.com/mx-space/core/issues/2366)
* fix(deps): update dependency linkedom to v0.18.9 (#2343) ([46b6b8e](https://github.com/mx-space/core/commit/46b6b8e)), closes [#2343](https://github.com/mx-space/core/issues/2343)
* fix(deps): update dependency marked to v15.0.7 (#2350) ([347ea08](https://github.com/mx-space/core/commit/347ea08)), closes [#2350](https://github.com/mx-space/core/issues/2350)
* fix(deps): update dependency mongoose-aggregate-paginate-v2 to v1.1.4 (#2367) ([b2b4233](https://github.com/mx-space/core/commit/b2b4233)), closes [#2367](https://github.com/mx-space/core/issues/2367)
* fix(deps): update dependency ua-parser-js to v2.0.2 (#2346) ([3203b4a](https://github.com/mx-space/core/commit/3203b4a)), closes [#2346](https://github.com/mx-space/core/issues/2346)
* fix(deps): update nest monorepo to v11.0.9 (#2344) ([58947c0](https://github.com/mx-space/core/commit/58947c0)), closes [#2344](https://github.com/mx-space/core/issues/2344)
* ci: 修复镜像build错误 (#2320) ([b44c539](https://github.com/mx-space/core/commit/b44c539)), closes [#2320](https://github.com/mx-space/core/issues/2320)

## 8.0.0 (2025-02-08)

* release: v8.0.0 ([65574c6](https://github.com/mx-space/core/commit/65574c6))
* chore: optimize dockerfile pnpm installation ([0b95576](https://github.com/mx-space/core/commit/0b95576))
* chore: try fix docker ([a9cdd7b](https://github.com/mx-space/core/commit/a9cdd7b))
* chore: update deps and update ai models ([4d0d85e](https://github.com/mx-space/core/commit/4d0d85e))
* chore(deps): update dependency @langchain/core to v0.3.31 (#2312) ([4dc7b1d](https://github.com/mx-space/core/commit/4dc7b1d)), closes [#2312](https://github.com/mx-space/core/issues/2312)
* chore(deps): update dependency @langchain/core to v0.3.32 (#2321) ([4d79012](https://github.com/mx-space/core/commit/4d79012)), closes [#2321](https://github.com/mx-space/core/issues/2321)
* chore(deps): update dependency @swc/core to v1.10.8 (#2313) ([3df1210](https://github.com/mx-space/core/commit/3df1210)), closes [#2313](https://github.com/mx-space/core/issues/2313)
* chore(deps): update dependency @types/node to v22.10.7 (#2314) ([854d0d5](https://github.com/mx-space/core/commit/854d0d5)), closes [#2314](https://github.com/mx-space/core/issues/2314)
* chore(deps): update dependency @types/qs to v6.9.18 (#2315) ([82069e4](https://github.com/mx-space/core/commit/82069e4)), closes [#2315](https://github.com/mx-space/core/issues/2315)
* chore(deps): update dependency better-auth to v1.1.14 (#2316) ([34ba324](https://github.com/mx-space/core/commit/34ba324)), closes [#2316](https://github.com/mx-space/core/issues/2316)
* chore(deps): update dependency eslint to v9.18.0 (#2323) ([23734da](https://github.com/mx-space/core/commit/23734da)), closes [#2323](https://github.com/mx-space/core/issues/2323)
* chore(deps): update pnpm to v9.15.4 (#2317) ([6c4d982](https://github.com/mx-space/core/commit/6c4d982)), closes [#2317](https://github.com/mx-space/core/issues/2317)
* feat!: upgrade nest to v11 ([b1f69c7](https://github.com/mx-space/core/commit/b1f69c7))
* fix(deps): update dependency @fastify/static to v8.0.4 (#2318) ([02c98e1](https://github.com/mx-space/core/commit/02c98e1)), closes [#2318](https://github.com/mx-space/core/issues/2318)
* fix(deps): update dependency @langchain/openai to v0.3.17 (#2319) ([d846a6c](https://github.com/mx-space/core/commit/d846a6c)), closes [#2319](https://github.com/mx-space/core/issues/2319)
* fix(deps): update dependency langchain to v0.3.12 (#2322) ([bba535c](https://github.com/mx-space/core/commit/bba535c)), closes [#2322](https://github.com/mx-space/core/issues/2322)

## <small>7.2.8 (2025-01-19)</small>

* release: v7.2.8 ([d0c7075](https://github.com/mx-space/core/commit/d0c7075))
* chore(deps): update dependency @langchain/core to v0.3.28 (#2309) ([f4f2d01](https://github.com/mx-space/core/commit/f4f2d01)), closes [#2309](https://github.com/mx-space/core/issues/2309)
* chore(deps): update dependency @swc/core to v1.10.7 (#2305) ([a61609c](https://github.com/mx-space/core/commit/a61609c)), closes [#2305](https://github.com/mx-space/core/issues/2305)
* chore(deps): update dependency @sxzz/eslint-config to v4.6.0 (#2311) ([e4da2d6](https://github.com/mx-space/core/commit/e4da2d6)), closes [#2311](https://github.com/mx-space/core/issues/2311)
* chore(deps): update dependency @types/node to v22.10.5 (#2294) ([8145edf](https://github.com/mx-space/core/commit/8145edf)), closes [#2294](https://github.com/mx-space/core/issues/2294)
* chore(deps): update dependency better-auth to v1.1.10 (#2295) ([cb696c5](https://github.com/mx-space/core/commit/cb696c5)), closes [#2295](https://github.com/mx-space/core/issues/2295)
* chore(deps): update dependency typescript to v5.7.3 (#2296) ([31817be](https://github.com/mx-space/core/commit/31817be)), closes [#2296](https://github.com/mx-space/core/issues/2296)
* chore(deps): update pnpm to v9.15.3 (#2297) ([b9e3125](https://github.com/mx-space/core/commit/b9e3125)), closes [#2297](https://github.com/mx-space/core/issues/2297)
* chore(deps): update supercharge/mongodb-github-action action to v1.12.0 (#2302) ([1908d5b](https://github.com/mx-space/core/commit/1908d5b)), closes [#2302](https://github.com/mx-space/core/issues/2302)
* fix(deps): update babel monorepo to v7.26.5 (#2307) ([ac3f16b](https://github.com/mx-space/core/commit/ac3f16b)), closes [#2307](https://github.com/mx-space/core/issues/2307)
* fix(deps): update dependency @aws-sdk/client-s3 to v3.731.1 (#2303) ([f5abb1a](https://github.com/mx-space/core/commit/f5abb1a)), closes [#2303](https://github.com/mx-space/core/issues/2303)
* fix(deps): update dependency isbot to v5.1.21 (#2298) ([b1ea871](https://github.com/mx-space/core/commit/b1ea871)), closes [#2298](https://github.com/mx-space/core/issues/2298)
* fix(deps): update dependency langchain to v0.3.10 (#2299) ([7182cb2](https://github.com/mx-space/core/commit/7182cb2)), closes [#2299](https://github.com/mx-space/core/issues/2299)
* fix(deps): update dependency langchain to v0.3.11 (#2310) ([a542807](https://github.com/mx-space/core/commit/a542807)), closes [#2310](https://github.com/mx-space/core/issues/2310)
* fix(deps): update dependency mongoose-paginate-v2 to v1.9.0 (#2306) ([7834acb](https://github.com/mx-space/core/commit/7834acb)), closes [#2306](https://github.com/mx-space/core/issues/2306)
* fix(deps): update dependency openai to v4.77.4 (#2300) ([eb3a568](https://github.com/mx-space/core/commit/eb3a568)), closes [#2300](https://github.com/mx-space/core/issues/2300)
* fix(deps): update dependency openai to v4.79.1 (#2308) ([69481df](https://github.com/mx-space/core/commit/69481df)), closes [#2308](https://github.com/mx-space/core/issues/2308)
* ci: 尝试增加更多系统支持 (#2289) ([fa1f947](https://github.com/mx-space/core/commit/fa1f947)), closes [#2289](https://github.com/mx-space/core/issues/2289)

## <small>7.2.7 (2025-01-09)</small>

* release: v7.2.7 ([0ae3002](https://github.com/mx-space/core/commit/0ae3002))
* chore(deps): update dependency @langchain/core to v0.3.26 (#2267) ([340e0e5](https://github.com/mx-space/core/commit/340e0e5)), closes [#2267](https://github.com/mx-space/core/issues/2267)
* chore(deps): update dependency @langchain/core to v0.3.27 (#2291) ([b63fe93](https://github.com/mx-space/core/commit/b63fe93)), closes [#2291](https://github.com/mx-space/core/issues/2291)
* chore(deps): update dependency @swc/core to v1.10.4 (#2281) ([34b193e](https://github.com/mx-space/core/commit/34b193e)), closes [#2281](https://github.com/mx-space/core/issues/2281)
* chore(deps): update dependency @swc/core to v1.10.6 (#2292) ([f733c81](https://github.com/mx-space/core/commit/f733c81)), closes [#2292](https://github.com/mx-space/core/issues/2292)
* chore(deps): update dependency @types/lodash to v4.17.14 (#2293) ([358cfe3](https://github.com/mx-space/core/commit/358cfe3)), closes [#2293](https://github.com/mx-space/core/issues/2293)
* chore(deps): update dependency better-auth to v1.1.3 (#2275) ([ae339f2](https://github.com/mx-space/core/commit/ae339f2)), closes [#2275](https://github.com/mx-space/core/issues/2275)
* chore(deps): update dependency better-auth to v1.1.6 [security] (#2280) ([cb9c668](https://github.com/mx-space/core/commit/cb9c668)), closes [#2280](https://github.com/mx-space/core/issues/2280)
* chore(deps): update dependency better-auth to v1.1.7 (#2282) ([ad0261c](https://github.com/mx-space/core/commit/ad0261c)), closes [#2282](https://github.com/mx-space/core/issues/2282)
* chore(deps): update dependency cron to v3.3.2 (#2283) ([4a15a12](https://github.com/mx-space/core/commit/4a15a12)), closes [#2283](https://github.com/mx-space/core/issues/2283)
* chore(deps): update dependency ioredis to v5.4.2 (#2272) ([d9886f3](https://github.com/mx-space/core/commit/d9886f3)), closes [#2272](https://github.com/mx-space/core/issues/2272)
* chore(deps): update dependency lint-staged to v15.3.0 (#2288) ([9ad251d](https://github.com/mx-space/core/commit/9ad251d)), closes [#2288](https://github.com/mx-space/core/issues/2288)
* chore(deps): update dependency mongodb to v6.12.0 (#2270) ([08af311](https://github.com/mx-space/core/commit/08af311)), closes [#2270](https://github.com/mx-space/core/issues/2270)
* chore(deps): update dependency mongodb-memory-server to v10.1.3 (#2284) ([195e83f](https://github.com/mx-space/core/commit/195e83f)), closes [#2284](https://github.com/mx-space/core/issues/2284)
* chore(deps): update dependency mongodb-memory-server to v10.1.3 (#2287) ([b682cc0](https://github.com/mx-space/core/commit/b682cc0)), closes [#2287](https://github.com/mx-space/core/issues/2287)
* chore(deps): update dependency typescript to v5.7.2 (#2246) ([21872e1](https://github.com/mx-space/core/commit/21872e1)), closes [#2246](https://github.com/mx-space/core/issues/2246)
* chore(deps): update dependency whatwg-url to v14.1.0 (#2276) ([b5d499c](https://github.com/mx-space/core/commit/b5d499c)), closes [#2276](https://github.com/mx-space/core/issues/2276)
* chore(deps): update node.js to v22 (#2253) ([aa4daff](https://github.com/mx-space/core/commit/aa4daff)), closes [#2253](https://github.com/mx-space/core/issues/2253)
* chore(deps): update pnpm to v9.15.1 (#2273) ([a27ea4c](https://github.com/mx-space/core/commit/a27ea4c)), closes [#2273](https://github.com/mx-space/core/issues/2273)
* chore(deps): update pnpm to v9.15.2 (#2285) ([34f161f](https://github.com/mx-space/core/commit/34f161f)), closes [#2285](https://github.com/mx-space/core/issues/2285)
* fix(deps): update dependency @aws-sdk/client-s3 to v3.723.0 (#2258) ([d0e7832](https://github.com/mx-space/core/commit/d0e7832)), closes [#2258](https://github.com/mx-space/core/issues/2258)
* fix(deps): update dependency @langchain/openai to v0.3.16 (#2269) ([5342665](https://github.com/mx-space/core/commit/5342665)), closes [#2269](https://github.com/mx-space/core/issues/2269)
* fix(deps): update dependency @typegoose/auto-increment to v4.9.0 (#2250) ([a278685](https://github.com/mx-space/core/commit/a278685)), closes [#2250](https://github.com/mx-space/core/issues/2250)
* fix(deps): update dependency isbot to v5.1.19 (#2286) ([c4e871d](https://github.com/mx-space/core/commit/c4e871d)), closes [#2286](https://github.com/mx-space/core/issues/2286)
* fix(deps): update dependency langchain to v0.3.8 (#2277) ([793dee2](https://github.com/mx-space/core/commit/793dee2)), closes [#2277](https://github.com/mx-space/core/issues/2277)
* fix(deps): update dependency remove-markdown to v0.6.0 (#2278) ([b3f2d50](https://github.com/mx-space/core/commit/b3f2d50)), closes [#2278](https://github.com/mx-space/core/issues/2278)
* fix(deps): update dependency ua-parser-js to v1.0.40 (#2274) ([85cccd2](https://github.com/mx-space/core/commit/85cccd2)), closes [#2274](https://github.com/mx-space/core/issues/2274)

## <small>7.2.6 (2024-12-21)</small>

* release: v7.2.6 ([9c9032d](https://github.com/mx-space/core/commit/9c9032d))
* chore: open ai model ([e51adca](https://github.com/mx-space/core/commit/e51adca))
* fix: init project ([58acb5a](https://github.com/mx-space/core/commit/58acb5a))

## <small>7.2.5 (2024-12-20)</small>

* release: v7.2.5 ([77703e4](https://github.com/mx-space/core/commit/77703e4))
* feat: support algolia search custom truncate size, closed #2271 ([6da1c13](https://github.com/mx-space/core/commit/6da1c13)), closes [#2271](https://github.com/mx-space/core/issues/2271)
* fix: dockerfile ([838b5b3](https://github.com/mx-space/core/commit/838b5b3))
* chore: fix sharp ([e9e7699](https://github.com/mx-space/core/commit/e9e7699))
* chore: fix typo #2266 ([f60c1c2](https://github.com/mx-space/core/commit/f60c1c2)), closes [#2266](https://github.com/mx-space/core/issues/2266)
* chore: remove husky ([398c5dc](https://github.com/mx-space/core/commit/398c5dc))
* chore: update deps ([9b6b2d5](https://github.com/mx-space/core/commit/9b6b2d5))
* chore(deps): replace husky with simple-git-hooks ([431e57f](https://github.com/mx-space/core/commit/431e57f))
* chore(deps): update dependency @langchain/core to v0.3.20 (#2256) ([1ac0b0b](https://github.com/mx-space/core/commit/1ac0b0b)), closes [#2256](https://github.com/mx-space/core/issues/2256)
* chore(deps): update dependency axios to v1.7.9 (#2261) ([20a1eef](https://github.com/mx-space/core/commit/20a1eef)), closes [#2261](https://github.com/mx-space/core/issues/2261)
* chore(deps): update dependency better-auth to v1.0.10 (#2257) ([b2edf60](https://github.com/mx-space/core/commit/b2edf60)), closes [#2257](https://github.com/mx-space/core/issues/2257)

## <small>7.2.4 (2024-12-03)</small>

* release: v7.2.4 ([4ef5af4](https://github.com/mx-space/core/commit/4ef5af4))
* fix: add auth baseURL ([635e27d](https://github.com/mx-space/core/commit/635e27d))
* fix: complied better auth typing export ([49cc5b6](https://github.com/mx-space/core/commit/49cc5b6))
* fix: lockfile ([584af40](https://github.com/mx-space/core/commit/584af40))
* fix: remove baseURL ([b3e10d4](https://github.com/mx-space/core/commit/b3e10d4))
* fix: reset oauth instance when app url changed ([54d9021](https://github.com/mx-space/core/commit/54d9021))
* chore: update deps ([3db591f](https://github.com/mx-space/core/commit/3db591f))
* chore(deps): update dependency better-auth to v1.0.7 (#2249) ([8603f21](https://github.com/mx-space/core/commit/8603f21)), closes [#2249](https://github.com/mx-space/core/issues/2249)
* feat: Add cloudflared service to the docker image (#2252) ([1bcb434](https://github.com/mx-space/core/commit/1bcb434)), closes [#2252](https://github.com/mx-space/core/issues/2252)

## <small>7.2.3 (2024-11-29)</small>

* release: v7.2.3 ([fca4936](https://github.com/mx-space/core/commit/fca4936))
* chore: update deps ([9ffb3ea](https://github.com/mx-space/core/commit/9ffb3ea))
* fix: get sessionId ([ca18882](https://github.com/mx-space/core/commit/ca18882))

## <small>7.2.2 (2024-11-28)</small>

* release: v7.2.2 ([293608d](https://github.com/mx-space/core/commit/293608d))
* fix: table migration ([84ddd7c](https://github.com/mx-space/core/commit/84ddd7c))
* fix: update migration ([ec43ff2](https://github.com/mx-space/core/commit/ec43ff2))
* feat: add accountId to session ([1e674bd](https://github.com/mx-space/core/commit/1e674bd))
* feat: add provider on session ([a031c32](https://github.com/mx-space/core/commit/a031c32))
* chore(deps): update dependency better-auth to v1.0.5 (#2241) ([1168a36](https://github.com/mx-space/core/commit/1168a36)), closes [#2241](https://github.com/mx-space/core/issues/2241)
* chore(deps): update dependency eslint to v9.15.0 (#2242) ([69a2985](https://github.com/mx-space/core/commit/69a2985)), closes [#2242](https://github.com/mx-space/core/issues/2242)
* chore(deps): update dependency nanoid to v5.0.9 (#2244) ([52104d2](https://github.com/mx-space/core/commit/52104d2)), closes [#2244](https://github.com/mx-space/core/issues/2244)
* chore(deps): update dependency prettier to v3.4.1 (#2245) ([571888f](https://github.com/mx-space/core/commit/571888f)), closes [#2245](https://github.com/mx-space/core/issues/2245)

## <small>7.2.1 (2024-11-26)</small>

* release: v7.2.1 ([a2739ac](https://github.com/mx-space/core/commit/a2739ac))
* fix: userId ([2143a8c](https://github.com/mx-space/core/commit/2143a8c))

## 7.2.0 (2024-11-26)

* release: v7.2.0 ([5c936b5](https://github.com/mx-space/core/commit/5c936b5))
* refactor(oauth): to better auth (#2239) ([b9fc2d5](https://github.com/mx-space/core/commit/b9fc2d5)), closes [#2239](https://github.com/mx-space/core/issues/2239)
* fix(deps): update dependency @aws-sdk/client-s3 to v3.685.0 (#2157) ([fad4464](https://github.com/mx-space/core/commit/fad4464)), closes [#2157](https://github.com/mx-space/core/issues/2157)
* fix(deps): update dependency @fastify/static to v8.0.3 (#2228) ([bb11879](https://github.com/mx-space/core/commit/bb11879)), closes [#2228](https://github.com/mx-space/core/issues/2228)
* fix(deps): update dependency @langchain/openai to v0.3.11 ([835ba5a](https://github.com/mx-space/core/commit/835ba5a))
* fix(deps): update dependency @langchain/openai to v0.3.12 ([c7056d6](https://github.com/mx-space/core/commit/c7056d6))
* fix(deps): update dependency @langchain/openai to v0.3.14 (#2229) ([3692c40](https://github.com/mx-space/core/commit/3692c40)), closes [#2229](https://github.com/mx-space/core/issues/2229)
* fix(deps): update dependency @nestjs/event-emitter to v2.1.1 (#2203) ([abe3a95](https://github.com/mx-space/core/commit/abe3a95)), closes [#2203](https://github.com/mx-space/core/issues/2203)
* fix(deps): update dependency @nestjs/mapped-types to v2.0.6 (#2230) ([e0d8927](https://github.com/mx-space/core/commit/e0d8927)), closes [#2230](https://github.com/mx-space/core/issues/2230)
* fix(deps): update dependency langchain to v0.3.5 (#2215) ([e6ef191](https://github.com/mx-space/core/commit/e6ef191)), closes [#2215](https://github.com/mx-space/core/issues/2215)
* fix(deps): update dependency langchain to v0.3.6 (#2231) ([17ce3e8](https://github.com/mx-space/core/commit/17ce3e8)), closes [#2231](https://github.com/mx-space/core/issues/2231)
* fix(deps): update dependency marked to v14.1.4 (#2232) ([c3ab2ce](https://github.com/mx-space/core/commit/c3ab2ce)), closes [#2232](https://github.com/mx-space/core/issues/2232)
* fix(deps): update dependency openai to v4.68.1 ([7d96211](https://github.com/mx-space/core/commit/7d96211))
* fix(deps): update dependency qs to v6.13.1 (#2234) ([69403ca](https://github.com/mx-space/core/commit/69403ca)), closes [#2234](https://github.com/mx-space/core/issues/2234)
* fix(deps): update nest monorepo to v10.4.9 (#2237) ([43a4488](https://github.com/mx-space/core/commit/43a4488)), closes [#2237](https://github.com/mx-space/core/issues/2237)
* chore: update deps ([2fbdea6](https://github.com/mx-space/core/commit/2fbdea6))
* chore(deps): update dependency @langchain/core to v0.3.15 ([ce77dda](https://github.com/mx-space/core/commit/ce77dda))
* chore(deps): update dependency @langchain/core to v0.3.18 (#2218) ([c363a6e](https://github.com/mx-space/core/commit/c363a6e)), closes [#2218](https://github.com/mx-space/core/issues/2218)
* chore(deps): update dependency @langchain/core to v0.3.19 (#2233) ([f7b04b1](https://github.com/mx-space/core/commit/f7b04b1)), closes [#2233](https://github.com/mx-space/core/issues/2233)
* chore(deps): update dependency @swc/core to v1.9.3 (#2220) ([b2c6d26](https://github.com/mx-space/core/commit/b2c6d26)), closes [#2220](https://github.com/mx-space/core/issues/2220)
* chore(deps): update dependency @sxzz/eslint-config to v4.4.1 (#2221) ([6141094](https://github.com/mx-space/core/commit/6141094)), closes [#2221](https://github.com/mx-space/core/issues/2221)
* chore(deps): update dependency @types/lodash to v4.17.12 ([0c71620](https://github.com/mx-space/core/commit/0c71620))
* chore(deps): update dependency @types/lodash to v4.17.13 ([bc6b7db](https://github.com/mx-space/core/commit/bc6b7db))
* chore(deps): update dependency @types/node to v22.7.7 ([7f51b76](https://github.com/mx-space/core/commit/7f51b76))
* chore(deps): update dependency @types/node to v22.7.9 ([0d0fb21](https://github.com/mx-space/core/commit/0d0fb21))
* chore(deps): update dependency @types/node to v22.9.3 (#2222) ([8ed3c20](https://github.com/mx-space/core/commit/8ed3c20)), closes [#2222](https://github.com/mx-space/core/issues/2222)
* chore(deps): update dependency @types/node to v22.9.4 (#2235) ([227561d](https://github.com/mx-space/core/commit/227561d)), closes [#2235](https://github.com/mx-space/core/issues/2235)
* chore(deps): update dependency @types/nodemailer to v6.4.17 (#2223) ([dd69e90](https://github.com/mx-space/core/commit/dd69e90)), closes [#2223](https://github.com/mx-space/core/issues/2223)
* chore(deps): update dependency @vercel/ncc to v0.38.3 (#2224) ([26d8f97](https://github.com/mx-space/core/commit/26d8f97)), closes [#2224](https://github.com/mx-space/core/issues/2224)
* chore(deps): update dependency axios to v1.7.8 (#2236) ([ccd3b38](https://github.com/mx-space/core/commit/ccd3b38)), closes [#2236](https://github.com/mx-space/core/issues/2236)
* chore(deps): update dependency eslint to v9.13.0 ([4943365](https://github.com/mx-space/core/commit/4943365))
* chore(deps): update dependency husky to v9.1.7 (#2225) ([186d230](https://github.com/mx-space/core/commit/186d230)), closes [#2225](https://github.com/mx-space/core/issues/2225)
* chore(deps): update dependency mongodb to v6.11.0 (#2216) ([64e232f](https://github.com/mx-space/core/commit/64e232f)), closes [#2216](https://github.com/mx-space/core/issues/2216)
* chore(deps): update dependency nanoid to v5.0.8 ([233ce4f](https://github.com/mx-space/core/commit/233ce4f))
* chore(deps): update dependency tsup to v8.3.5 ([e37a885](https://github.com/mx-space/core/commit/e37a885))
* chore(deps): update dependency typescript to v5.6.3 ([dcb65ef](https://github.com/mx-space/core/commit/dcb65ef))
* chore(deps): update dependency vite-tsconfig-paths to v5.1.3 (#2226) ([b88586c](https://github.com/mx-space/core/commit/b88586c)), closes [#2226](https://github.com/mx-space/core/issues/2226)
* chore(deps): update nest monorepo to v10.4.8 (#2227) ([26aeaf3](https://github.com/mx-space/core/commit/26aeaf3)), closes [#2227](https://github.com/mx-space/core/issues/2227)
* chore(deps): update pnpm to v9.12.2 ([c089380](https://github.com/mx-space/core/commit/c089380))
* chore(deps): update pnpm to v9.12.3 ([5268670](https://github.com/mx-space/core/commit/5268670))

## <small>7.1.9 (2024-10-18)</small>

* release: v7.1.9 ([00fbe62](https://github.com/mx-space/core/commit/00fbe62))
* fix: downgrade mongoose ([70301af](https://github.com/mx-space/core/commit/70301af))
* fix: lockfile ([d7cbd80](https://github.com/mx-space/core/commit/d7cbd80))
* chore: update deps ([1716c4d](https://github.com/mx-space/core/commit/1716c4d))
* chore(deps): update dependency eslint to v9.12.0 ([7289f05](https://github.com/mx-space/core/commit/7289f05))
* chore(deps): update dependency vite-tsconfig-paths to v5 (#1978) ([d59819c](https://github.com/mx-space/core/commit/d59819c)), closes [#1978](https://github.com/mx-space/core/issues/1978)
* chore(deps): update pnpm to v9.12.1 (#2185) ([5147c79](https://github.com/mx-space/core/commit/5147c79)), closes [#2185](https://github.com/mx-space/core/issues/2185)

## <small>7.1.8 (2024-10-07)</small>

* release: v7.1.8 ([2bc1474](https://github.com/mx-space/core/commit/2bc1474))
* fix: allow cors interceptor ([fa207ea](https://github.com/mx-space/core/commit/fa207ea))
* fix(deps): update babel monorepo to v7.25.7 ([9249adb](https://github.com/mx-space/core/commit/9249adb))
* fix(deps): update dependency @aws-sdk/client-s3 to v3.657.0 (#2154) ([e29b356](https://github.com/mx-space/core/commit/e29b356)), closes [#2154](https://github.com/mx-space/core/issues/2154)
* fix(deps): update dependency @fastify/static to v8 (#2142) ([e2c8bdc](https://github.com/mx-space/core/commit/e2c8bdc)), closes [#2142](https://github.com/mx-space/core/issues/2142)
* fix(deps): update dependency @langchain/openai to v0.3.1 ([57b8200](https://github.com/mx-space/core/commit/57b8200))
* fix(deps): update dependency @langchain/openai to v0.3.2 ([6bf8aa5](https://github.com/mx-space/core/commit/6bf8aa5))
* fix(deps): update dependency @langchain/openai to v0.3.4 ([5fd7f14](https://github.com/mx-space/core/commit/5fd7f14))
* fix(deps): update dependency @langchain/openai to v0.3.5 (#2181) ([5487e2c](https://github.com/mx-space/core/commit/5487e2c)), closes [#2181](https://github.com/mx-space/core/issues/2181)
* fix(deps): update dependency @typegoose/auto-increment to v4.7.0 (#2172) ([384e2e2](https://github.com/mx-space/core/commit/384e2e2)), closes [#2172](https://github.com/mx-space/core/issues/2172)
* fix(deps): update dependency cache-manager-ioredis-yet to v2.1.2 ([8bb15c3](https://github.com/mx-space/core/commit/8bb15c3))
* fix(deps): update dependency mongoose to v8.6.4 ([e70d70b](https://github.com/mx-space/core/commit/e70d70b))
* fix(deps): update dependency mongoose to v8.7.0 (#2171) ([c1bb5e6](https://github.com/mx-space/core/commit/c1bb5e6)), closes [#2171](https://github.com/mx-space/core/issues/2171)
* fix(deps): update dependency mongoose-paginate-v2 to v1.8.4 ([a659ed2](https://github.com/mx-space/core/commit/a659ed2))
* fix(deps): update dependency mongoose-paginate-v2 to v1.8.5 ([1ac42ef](https://github.com/mx-space/core/commit/1ac42ef))
* fix(deps): update dependency openai to v4.63.0 (#2097) ([a1f84dc](https://github.com/mx-space/core/commit/a1f84dc)), closes [#2097](https://github.com/mx-space/core/issues/2097)
* fix(deps): update dependency openai to v4.65.0 (#2163) ([e450946](https://github.com/mx-space/core/commit/e450946)), closes [#2163](https://github.com/mx-space/core/issues/2163)
* fix(deps): update nest monorepo to v10.4.4 ([bbdef0c](https://github.com/mx-space/core/commit/bbdef0c))
* chore: code style ([61fa3a1](https://github.com/mx-space/core/commit/61fa3a1))
* chore: update deps ([3846410](https://github.com/mx-space/core/commit/3846410))
* chore(deps): update dependency @langchain/core to v0.3.5 ([75b5a18](https://github.com/mx-space/core/commit/75b5a18))
* chore(deps): update dependency @langchain/core to v0.3.7 ([71db1f9](https://github.com/mx-space/core/commit/71db1f9))
* chore(deps): update dependency @swc/core to v1.7.28 ([a0ba2b9](https://github.com/mx-space/core/commit/a0ba2b9))
* chore(deps): update dependency @sxzz/eslint-config to v4.2.1 ([f088eb1](https://github.com/mx-space/core/commit/f088eb1))
* chore(deps): update dependency @sxzz/eslint-config to v4.4.0 (#2177) ([e64ab33](https://github.com/mx-space/core/commit/e64ab33)), closes [#2177](https://github.com/mx-space/core/issues/2177)
* chore(deps): update dependency @types/express to v5 ([0a34e1d](https://github.com/mx-space/core/commit/0a34e1d))
* chore(deps): update dependency @types/lodash to v4.17.10 ([6cf64d4](https://github.com/mx-space/core/commit/6cf64d4))
* chore(deps): update dependency @types/lodash to v4.17.9 ([24101d0](https://github.com/mx-space/core/commit/24101d0))
* chore(deps): update dependency @types/node to v22.6.1 (#2153) ([0ca1282](https://github.com/mx-space/core/commit/0ca1282)), closes [#2153](https://github.com/mx-space/core/issues/2153)
* chore(deps): update dependency @types/node to v22.6.2 ([867a739](https://github.com/mx-space/core/commit/867a739))
* chore(deps): update dependency @types/node to v22.7.0 ([3ea0589](https://github.com/mx-space/core/commit/3ea0589))
* chore(deps): update dependency @types/node to v22.7.2 ([25aba83](https://github.com/mx-space/core/commit/25aba83))
* chore(deps): update dependency @types/node to v22.7.3 ([3887233](https://github.com/mx-space/core/commit/3887233))
* chore(deps): update dependency @types/node to v22.7.4 ([e025ecb](https://github.com/mx-space/core/commit/e025ecb))
* chore(deps): update dependency @vercel/ncc to v0.38.2 ([1dc5177](https://github.com/mx-space/core/commit/1dc5177))
* chore(deps): update dependency eslint to v9.11.1 ([3b45b10](https://github.com/mx-space/core/commit/3b45b10))
* chore(deps): update dependency ubuntu to v24 (#2169) ([ae46f5a](https://github.com/mx-space/core/commit/ae46f5a)), closes [#2169](https://github.com/mx-space/core/issues/2169)
* chore(deps): update pnpm to v9.11.0 (#2145) ([bebb3af](https://github.com/mx-space/core/commit/bebb3af)), closes [#2145](https://github.com/mx-space/core/issues/2145)

## <small>7.1.7 (2024-09-19)</small>

* release: v7.1.7 ([f8c45e4](https://github.com/mx-space/core/commit/f8c45e4))
* chore(deps): update dependency @langchain/core to v0.2.33 ([93fd1c7](https://github.com/mx-space/core/commit/93fd1c7))
* chore(deps): update dependency @langchain/core to v0.2.34 ([f49fa2a](https://github.com/mx-space/core/commit/f49fa2a))
* chore(deps): update dependency @langchain/core to v0.3.3 (#2121) ([b28d674](https://github.com/mx-space/core/commit/b28d674)), closes [#2121](https://github.com/mx-space/core/issues/2121)
* chore(deps): update dependency @sxzz/eslint-config to v4 (#2071) ([e78e602](https://github.com/mx-space/core/commit/e78e602)), closes [#2071](https://github.com/mx-space/core/issues/2071)
* chore(deps): update dependency @types/nodemailer to v6.4.16 ([450d5be](https://github.com/mx-space/core/commit/450d5be))
* chore(deps): update dependency @types/validator to v13.12.2 ([99d5f16](https://github.com/mx-space/core/commit/99d5f16))
* chore(deps): update dependency express to v4.21.0 (#2106) ([99df94b](https://github.com/mx-space/core/commit/99df94b)), closes [#2106](https://github.com/mx-space/core/issues/2106)
* chore(deps): update pnpm to v9.10.0 (#2105) ([6dd0672](https://github.com/mx-space/core/commit/6dd0672)), closes [#2105](https://github.com/mx-space/core/issues/2105)
* fix: add `sharp` globally in docker image ([519ba0b](https://github.com/mx-space/core/commit/519ba0b))
* fix(deps): update dependency @aws-sdk/client-s3 to v3.654.0 (#2109) ([f5dfe67](https://github.com/mx-space/core/commit/f5dfe67)), closes [#2109](https://github.com/mx-space/core/issues/2109)
* fix(deps): update dependency @types/jsonwebtoken to v9.0.7 ([171491e](https://github.com/mx-space/core/commit/171491e))
* fix(deps): update dependency langchain to v0.2.20 ([b7aaa91](https://github.com/mx-space/core/commit/b7aaa91))
* fix(deps): update dependency linkedom to v0.18.5 ([fa4138f](https://github.com/mx-space/core/commit/fa4138f))
* fix(deps): update dependency mongoose to v8.6.3 ([25f2905](https://github.com/mx-space/core/commit/25f2905))
* fix(deps): update nest monorepo to v10.4.3 ([3187b98](https://github.com/mx-space/core/commit/3187b98))

## <small>7.1.6 (2024-09-17)</small>

* release: v7.1.6 ([bd2896a](https://github.com/mx-space/core/commit/bd2896a))
* chore(release): bump @mx-space/api-client to v1.16.1 ([f693486](https://github.com/mx-space/core/commit/f693486))
* feat: add comment `editedAt` ([2f1a973](https://github.com/mx-space/core/commit/2f1a973))

## <small>7.1.5 (2024-09-17)</small>

* release: v7.1.5 ([8fac75c](https://github.com/mx-space/core/commit/8fac75c))
* chore(release): bump @mx-space/webhook to v0.5.0 ([e4cf598](https://github.com/mx-space/core/commit/e4cf598))
* feat: edit comment ([ed7b33e](https://github.com/mx-space/core/commit/ed7b33e))
* fix: reader assgin ([a0e37aa](https://github.com/mx-space/core/commit/a0e37aa))

## <small>7.1.4 (2024-09-16)</small>

* release: v7.1.4 ([36b4491](https://github.com/mx-space/core/commit/36b4491))
* fix(reader): assign to comment dto ([764e30f](https://github.com/mx-space/core/commit/764e30f))

## <small>7.1.3 (2024-09-16)</small>

* release: v7.1.3 ([e49f80e](https://github.com/mx-space/core/commit/e49f80e))
* fix: reader handle projection ([c8b2eab](https://github.com/mx-space/core/commit/c8b2eab))

## <small>7.1.2 (2024-09-16)</small>

* release: v7.1.2 ([2de308b](https://github.com/mx-space/core/commit/2de308b))
* chore: downgrade vite ([dc9f085](https://github.com/mx-space/core/commit/dc9f085))
* chore: update deps ([b190629](https://github.com/mx-space/core/commit/b190629))
* chore(deps): update dependency @types/node to v22.5.5 ([185d088](https://github.com/mx-space/core/commit/185d088))
* chore(deps): update dependency @types/qs to v6.9.16 ([31f3306](https://github.com/mx-space/core/commit/31f3306))
* fix: disable cache for auth session ([6a7a7c8](https://github.com/mx-space/core/commit/6a7a7c8))
* fix(deps): update dependency ua-parser-js to v1.0.39 ([f54f721](https://github.com/mx-space/core/commit/f54f721))

## <small>7.1.1 (2024-09-14)</small>

* release: v7.1.1 ([3d40678](https://github.com/mx-space/core/commit/3d40678))
* fix: add `handle` to query ([85d4a14](https://github.com/mx-space/core/commit/85d4a14))

## 7.1.0 (2024-09-14)

* release: v7.1.0 ([90de3d8](https://github.com/mx-space/core/commit/90de3d8))
* chore: sort asc controller ([13f4a0c](https://github.com/mx-space/core/commit/13f4a0c))
* chore: update webhook sdk types ([b28d6c0](https://github.com/mx-space/core/commit/b28d6c0))
* chore(deps): update dependency @langchain/core to v0.2.32 ([327a340](https://github.com/mx-space/core/commit/327a340))
* chore(deps): update dependency @swc/core to v1.7.24 ([051bb69](https://github.com/mx-space/core/commit/051bb69))
* chore(deps): update dependency @swc/core to v1.7.25 ([a630acb](https://github.com/mx-space/core/commit/a630acb))
* chore(deps): update dependency @swc/core to v1.7.26 ([9ce7308](https://github.com/mx-space/core/commit/9ce7308))
* chore(deps): update dependency eslint-plugin-unused-imports to v4.1.4 ([ced1a20](https://github.com/mx-space/core/commit/ced1a20))
* chore(deps): update dependency express to v4.20.0 [security] (#2111) ([7b7c053](https://github.com/mx-space/core/commit/7b7c053)), closes [#2111](https://github.com/mx-space/core/issues/2111)
* chore(deps): update dependency husky to v9.1.6 ([7894ef4](https://github.com/mx-space/core/commit/7894ef4))
* chore(deps): update dependency mongodb to v6.8.2 ([757e6d1](https://github.com/mx-space/core/commit/757e6d1))
* chore(deps): update dependency mongodb to v6.9.0 (#2117) ([8fa83d7](https://github.com/mx-space/core/commit/8fa83d7)), closes [#2117](https://github.com/mx-space/core/issues/2117)
* chore(deps): update dependency typescript to v5.6.2 (#2104) ([8c45a2d](https://github.com/mx-space/core/commit/8c45a2d)), closes [#2104](https://github.com/mx-space/core/issues/2104)
* chore(release): bump @mx-space/api-client to v1.16.0 ([fa3e140](https://github.com/mx-space/core/commit/fa3e140))
* chore(release): bump @mx-space/webhook to v0.4.0 ([54ecbc4](https://github.com/mx-space/core/commit/54ecbc4))
* feat: reader for comment and like action (#2122) ([26b2b4f](https://github.com/mx-space/core/commit/26b2b4f)), closes [#2122](https://github.com/mx-space/core/issues/2122)
* fix(deps): update dependency @langchain/openai to v0.2.11 ([3e9e36a](https://github.com/mx-space/core/commit/3e9e36a))
* fix(deps): update dependency langchain to v0.2.19 ([0285b93](https://github.com/mx-space/core/commit/0285b93))
* fix(deps): update dependency marked to v14.1.2 ([77af705](https://github.com/mx-space/core/commit/77af705))
* fix(deps): update dependency mongoose to v8.6.2 ([25b16cf](https://github.com/mx-space/core/commit/25b16cf))

## <small>7.0.7 (2024-09-07)</small>

* release: v7.0.7 ([2c9682f](https://github.com/mx-space/core/commit/2c9682f))
* fix(deps): update dependency @aws-sdk/client-s3 to v3.645.0 (#2091) ([aec8694](https://github.com/mx-space/core/commit/aec8694)), closes [#2091](https://github.com/mx-space/core/issues/2091)
* fix(deps): update dependency @langchain/openai to v0.2.10 ([6f038e1](https://github.com/mx-space/core/commit/6f038e1))
* fix(deps): update dependency langchain to v0.2.18 ([fbd7436](https://github.com/mx-space/core/commit/fbd7436))
* fix(deps): update dependency lru-cache to v11.0.1 ([26d3fd3](https://github.com/mx-space/core/commit/26d3fd3))
* fix(deps): update dependency mongoose-lean-virtuals to v1 (#2085) ([26e2385](https://github.com/mx-space/core/commit/26e2385)), closes [#2085](https://github.com/mx-space/core/issues/2085)
* fix(deps): update dependency openai to v4.57.3 ([7984436](https://github.com/mx-space/core/commit/7984436))
* fix(oauth): can not disable oauth ([8fc72f1](https://github.com/mx-space/core/commit/8fc72f1))
* chore(deps): update dependency @types/node to v22.5.4 ([aef340c](https://github.com/mx-space/core/commit/aef340c))
* chore(deps): update dependency eslint to v9.10.0 ([db21f1c](https://github.com/mx-space/core/commit/db21f1c))
* chore(deps): update dependency mongodb to v6.8.1 ([cdb4619](https://github.com/mx-space/core/commit/cdb4619))

## <small>7.0.6 (2024-09-05)</small>

* release: v7.0.6 ([19eab60](https://github.com/mx-space/core/commit/19eab60))
* fix: bark service push ([daa499e](https://github.com/mx-space/core/commit/daa499e))
* fix: ip query function ([06a1963](https://github.com/mx-space/core/commit/06a1963))
* fix(deps): update dependency openai to v4.57.2 ([ebeed58](https://github.com/mx-space/core/commit/ebeed58))
* chore(deps): update dependency @types/node to v20.16.4 ([485d71e](https://github.com/mx-space/core/commit/485d71e))
* chore(deps): update dependency @types/node to v20.16.5 ([617deb6](https://github.com/mx-space/core/commit/617deb6))
* chore(deps): update dependency @types/node to v22.5.3 ([07ad9ed](https://github.com/mx-space/core/commit/07ad9ed))

## <small>7.0.5 (2024-09-04)</small>

* release: v7.0.5 ([04dd406](https://github.com/mx-space/core/commit/04dd406))
* fix(auth): append user id for session ([b41a35f](https://github.com/mx-space/core/commit/b41a35f))

## <small>7.0.4 (2024-09-04)</small>

* release: v7.0.4 ([92fed33](https://github.com/mx-space/core/commit/92fed33))
* chore(release): bump @mx-space/api-client to v1.15.0 ([31b7750](https://github.com/mx-space/core/commit/31b7750))
* fix: auth jwt ([bba36c2](https://github.com/mx-space/core/commit/bba36c2))

## <small>7.0.3 (2024-09-04)</small>

* release: v7.0.3 ([0327ab7](https://github.com/mx-space/core/commit/0327ab7))
* fix: auth ([311f2de](https://github.com/mx-space/core/commit/311f2de))

## <small>7.0.2 (2024-09-04)</small>

* release: v7.0.2 ([682908d](https://github.com/mx-space/core/commit/682908d))
* fix: 0day auth ([3451d2f](https://github.com/mx-space/core/commit/3451d2f))
* fix(deps): update dependency marked to v14.1.1 ([54307a0](https://github.com/mx-space/core/commit/54307a0))
* fix(deps): update dependency mongoose to v8.6.1 ([cd391a4](https://github.com/mx-space/core/commit/cd391a4))
* fix(deps): update dependency nodemailer to v6.9.15 ([2a7fa37](https://github.com/mx-space/core/commit/2a7fa37))
* fix(deps): update dependency openai to v4.57.1 ([74d2cd8](https://github.com/mx-space/core/commit/74d2cd8))

## <small>7.0.2-alpha.0 (2024-09-03)</small>

* release: v7.0.2-alpha.0 ([5ea76f4](https://github.com/mx-space/core/commit/5ea76f4))
* fix: try debug fn error ([df9a164](https://github.com/mx-space/core/commit/df9a164))

## <small>7.0.1 (2024-09-03)</small>

* release: v7.0.1 ([2b477ba](https://github.com/mx-space/core/commit/2b477ba))
* fix: merge oauth and google support ([23f6acb](https://github.com/mx-space/core/commit/23f6acb))
* fix: server time cors ([ca63592](https://github.com/mx-space/core/commit/ca63592))
* chore(deps): update dependency @swc/core to v1.7.23 ([2205f98](https://github.com/mx-space/core/commit/2205f98))

## 7.0.0 (2024-09-02)

* release: v7.0.0 ([c988d10](https://github.com/mx-space/core/commit/c988d10))
* chore: fix type error ([1e1cfce](https://github.com/mx-space/core/commit/1e1cfce))
* chore(deps): update pnpm to v9.9.0 (#2039) ([f855921](https://github.com/mx-space/core/commit/f855921)), closes [#2039](https://github.com/mx-space/core/issues/2039)
* fix(deps): update dependency @typegoose/auto-increment to v4.6.0 (#2073) ([504f9eb](https://github.com/mx-space/core/commit/504f9eb)), closes [#2073](https://github.com/mx-space/core/issues/2073)
* fix(deps): update dependency @typegoose/typegoose to v12.7.0 (#2074) ([d900c52](https://github.com/mx-space/core/commit/d900c52)), closes [#2074](https://github.com/mx-space/core/issues/2074)
* fix(deps): update dependency marked to v14.1.0 (#2048) ([159ee56](https://github.com/mx-space/core/commit/159ee56)), closes [#2048](https://github.com/mx-space/core/issues/2048)
* fix(deps): update dependency mongoose to v8.6.0 (#2064) ([778b706](https://github.com/mx-space/core/commit/778b706)), closes [#2064](https://github.com/mx-space/core/issues/2064)
* fix(deps): update dependency openai to v4.57.0 (#2067) ([b4930db](https://github.com/mx-space/core/commit/b4930db)), closes [#2067](https://github.com/mx-space/core/issues/2067)
* fix(deps): update dependency remove-markdown to v0.5.5 (#2079) ([7726449](https://github.com/mx-space/core/commit/7726449)), closes [#2079](https://github.com/mx-space/core/issues/2079)
* ci: fix key ([9c175cc](https://github.com/mx-space/core/commit/9c175cc))

## 7.0.0-alpha.3 (2024-09-02)

* release: v7.0.0-alpha.3 ([a167c42](https://github.com/mx-space/core/commit/a167c42))
* chore: update ([ca199dd](https://github.com/mx-space/core/commit/ca199dd))
* fix: server time cors ([34613e5](https://github.com/mx-space/core/commit/34613e5))

## 7.0.0-alpha.2 (2024-09-02)

* release: v7.0.0-alpha.2 ([ea877eb](https://github.com/mx-space/core/commit/ea877eb))
* fix: trust host for auth ([d4c4337](https://github.com/mx-space/core/commit/d4c4337))

## 7.0.0-alpha.1 (2024-09-02)

* release: v7.0.0-alpha.1 ([de0f2aa](https://github.com/mx-space/core/commit/de0f2aa))
* chore: encrypt ([a906ee6](https://github.com/mx-space/core/commit/a906ee6))

## 7.0.0-alpha.0 (2024-09-02)

* release: v7.0.0-alpha.0 ([b48b764](https://github.com/mx-space/core/commit/b48b764))
* fix: `localhost` for dev ([4b756f2](https://github.com/mx-space/core/commit/4b756f2))
* fix: add handle for reader query ([02c213a](https://github.com/mx-space/core/commit/02c213a))
* fix: add missing field ([58917f6](https://github.com/mx-space/core/commit/58917f6))
* fix: camcasekey ([5038c4d](https://github.com/mx-space/core/commit/5038c4d))
* fix: mongo agg query ([da283b4](https://github.com/mx-space/core/commit/da283b4))
* fix: oauth profile for github ([19d1030](https://github.com/mx-space/core/commit/19d1030))
* fix: transform case and export client type ([f7bce02](https://github.com/mx-space/core/commit/f7bce02))
* fix(auth): add account for session ([29661e7](https://github.com/mx-space/core/commit/29661e7))
* fix(deps): update dependency @babel/types to v7.25.6 ([519f573](https://github.com/mx-space/core/commit/519f573))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.32 ([9dd3999](https://github.com/mx-space/core/commit/9dd3999))
* fix(deps): update dependency mongoose to v8.5.5 ([46c04e8](https://github.com/mx-space/core/commit/46c04e8))
* fix(deps): update dependency openai to v4.56.2 ([c4df9c5](https://github.com/mx-space/core/commit/c4df9c5))
* fix(deps): update dependency remove-markdown to v0.5.3 ([e27e27b](https://github.com/mx-space/core/commit/e27e27b))
* chore(deps): update dependency @langchain/core to v0.2.31 ([704ca81](https://github.com/mx-space/core/commit/704ca81))
* chore(deps): update dependency @nestjs/cli to v10.4.5 ([dd3fb60](https://github.com/mx-space/core/commit/dd3fb60))
* chore(deps): update dependency @swc/core to v1.7.21 ([d2077be](https://github.com/mx-space/core/commit/d2077be))
* chore(deps): update dependency @swc/core to v1.7.22 ([22a7c94](https://github.com/mx-space/core/commit/22a7c94))
* chore(deps): update dependency @types/node to v20.16.3 ([7c39d9a](https://github.com/mx-space/core/commit/7c39d9a))
* chore(deps): update dependency @types/node to v22.5.2 ([cfdee3d](https://github.com/mx-space/core/commit/cfdee3d))
* chore(deps): update dependency axios to v1.7.6 ([9b908a2](https://github.com/mx-space/core/commit/9b908a2))
* chore(deps): update dependency axios to v1.7.7 ([b1f6837](https://github.com/mx-space/core/commit/b1f6837))
* chore(deps): update dependency lint-staged to v15.2.10 ([d169d51](https://github.com/mx-space/core/commit/d169d51))
* chore(release): bump @mx-space/api-client to v1.14.0 ([50101bb](https://github.com/mx-space/core/commit/50101bb))
* chore(release): bump @mx-space/api-client to v1.14.1 ([2e5e0b3](https://github.com/mx-space/core/commit/2e5e0b3))
* chore(release): bump @mx-space/api-client to v1.14.2 ([c7fdb43](https://github.com/mx-space/core/commit/c7fdb43))
* chore(release): bump @mx-space/api-client to v1.14.3 ([9e80c37](https://github.com/mx-space/core/commit/9e80c37))
* feat: add reader id for presence ([33c48f7](https://github.com/mx-space/core/commit/33c48f7))
* feat: Auth.js integration (#2054) ([6e50bee](https://github.com/mx-space/core/commit/6e50bee)), closes [#2054](https://github.com/mx-space/core/issues/2054)

## <small>6.1.5 (2024-08-28)</small>

* release: v6.1.5 ([278ecf0](https://github.com/mx-space/core/commit/278ecf0))
* chore: add images on rss builder ([621a66a](https://github.com/mx-space/core/commit/621a66a))
* chore: rename complied package ([e3b72d4](https://github.com/mx-space/core/commit/e3b72d4))
* chore(deps): update dependency @langchain/core to v0.2.30 ([f4fad0d](https://github.com/mx-space/core/commit/f4fad0d))
* chore(deps): update dependency @swc/core to v1.7.18 ([1beb28c](https://github.com/mx-space/core/commit/1beb28c))
* chore(deps): update dependency @swc/core to v1.7.19 ([38aca6c](https://github.com/mx-space/core/commit/38aca6c))
* chore(deps): update dependency @sxzz/eslint-config to v3.17.4 ([dcdb06f](https://github.com/mx-space/core/commit/dcdb06f))
* chore(deps): update dependency @types/node to v20.16.2 ([d499153](https://github.com/mx-space/core/commit/d499153))
* chore(deps): update dependency @types/node to v22.5.1 ([e807c77](https://github.com/mx-space/core/commit/e807c77))
* chore(deps): update dependency @types/validator to v13.12.1 ([ce60045](https://github.com/mx-space/core/commit/ce60045))
* chore(deps): update dependency axios to v1.7.5 ([74bdbe2](https://github.com/mx-space/core/commit/74bdbe2))
* chore(deps): update dependency eslint to v9.9.1 ([5c96954](https://github.com/mx-space/core/commit/5c96954))
* fix(deps): update dependency @antfu/install-pkg to v0.4.1 ([fc9eef9](https://github.com/mx-space/core/commit/fc9eef9))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.30 ([79b9c84](https://github.com/mx-space/core/commit/79b9c84))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.31 ([0f8ae33](https://github.com/mx-space/core/commit/0f8ae33))
* fix(deps): update dependency @langchain/openai to v0.2.8 ([f2d247b](https://github.com/mx-space/core/commit/f2d247b))
* fix(deps): update dependency mongoose to v8.5.4 ([3b19040](https://github.com/mx-space/core/commit/3b19040))
* fix(deps): update dependency openai to v4.56.1 ([b935ee5](https://github.com/mx-space/core/commit/b935ee5))
* feat: add ai target language ([638deb3](https://github.com/mx-space/core/commit/638deb3))

## <small>6.1.4 (2024-08-23)</small>

* release: v6.1.4 ([1e4af96](https://github.com/mx-space/core/commit/1e4af96))
* fix: deps pin ([443e085](https://github.com/mx-space/core/commit/443e085))
* fix(deps): update dependency @babel/types to v7.25.4 ([f2787fb](https://github.com/mx-space/core/commit/f2787fb))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.28 ([6bfe818](https://github.com/mx-space/core/commit/6bfe818))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.29 ([845fea5](https://github.com/mx-space/core/commit/845fea5))
* fix(deps): update dependency @langchain/openai to v0.2.7 ([34383a9](https://github.com/mx-space/core/commit/34383a9))
* fix(deps): update dependency dayjs to v1.11.13 ([5c6fef3](https://github.com/mx-space/core/commit/5c6fef3))
* fix(deps): update dependency isbot to v5.1.17 ([4d86f4c](https://github.com/mx-space/core/commit/4d86f4c))
* fix(deps): update dependency langchain to v0.2.17 ([cddd3d9](https://github.com/mx-space/core/commit/cddd3d9))
* fix(deps): update dependency openai to v4.56.0 (#2013) ([4cc5d07](https://github.com/mx-space/core/commit/4cc5d07)), closes [#2013](https://github.com/mx-space/core/issues/2013)
* chore: update deps ([78ad95c](https://github.com/mx-space/core/commit/78ad95c))
* chore(deps): update dependency @langchain/core to v0.2.25 ([7377429](https://github.com/mx-space/core/commit/7377429))
* chore(deps): update dependency @langchain/core to v0.2.27 ([ea9d631](https://github.com/mx-space/core/commit/ea9d631))
* chore(deps): update dependency @langchain/core to v0.2.28 ([bc5943e](https://github.com/mx-space/core/commit/bc5943e))
* chore(deps): update dependency @nestjs/schematics to v10.1.4 ([a49fb00](https://github.com/mx-space/core/commit/a49fb00))
* chore(deps): update dependency @swc/core to v1.7.12 ([dcb0beb](https://github.com/mx-space/core/commit/dcb0beb))
* chore(deps): update dependency @swc/core to v1.7.14 ([5d6c275](https://github.com/mx-space/core/commit/5d6c275))
* chore(deps): update dependency @sxzz/eslint-config to v3.17.1 ([3d6111a](https://github.com/mx-space/core/commit/3d6111a))
* chore(deps): update dependency @sxzz/eslint-config to v3.17.2 ([f6970d8](https://github.com/mx-space/core/commit/f6970d8))
* chore(deps): update dependency @sxzz/eslint-config to v3.17.3 ([e70147a](https://github.com/mx-space/core/commit/e70147a))
* chore(deps): update dependency @types/node to v20.15.0 ([02a120b](https://github.com/mx-space/core/commit/02a120b))
* chore(deps): update dependency @types/node to v20.16.0 ([e3f7fab](https://github.com/mx-space/core/commit/e3f7fab))
* chore(deps): update dependency @types/node to v20.16.1 ([5f24ee9](https://github.com/mx-space/core/commit/5f24ee9))
* chore(deps): update dependency @types/node to v22.4.0 ([8b0fd18](https://github.com/mx-space/core/commit/8b0fd18))
* chore(deps): update dependency @types/node to v22.4.1 ([844371c](https://github.com/mx-space/core/commit/844371c))
* chore(deps): update dependency @types/node to v22.4.2 ([bf33505](https://github.com/mx-space/core/commit/bf33505))
* chore(deps): update dependency @types/node to v22.5.0 ([91ce5a4](https://github.com/mx-space/core/commit/91ce5a4))
* chore(deps): update dependency husky to v9.1.5 ([7755e3b](https://github.com/mx-space/core/commit/7755e3b))
* chore(deps): update dependency sharp to v0.33.5 ([eb11b21](https://github.com/mx-space/core/commit/eb11b21))

## <small>6.1.3 (2024-08-16)</small>

* release: v6.1.3 ([129a522](https://github.com/mx-space/core/commit/129a522))
* fix: cloned object ([9a585a1](https://github.com/mx-space/core/commit/9a585a1))
* chore: add note ([940db3f](https://github.com/mx-space/core/commit/940db3f))

## <small>6.1.2 (2024-08-16)</small>

* release: v6.1.2 ([a5922e0](https://github.com/mx-space/core/commit/a5922e0))
* fix: create module json first ([d466036](https://github.com/mx-space/core/commit/d466036))

## <small>6.1.1 (2024-08-16)</small>

* release: v6.1.1 ([3f5fcd8](https://github.com/mx-space/core/commit/3f5fcd8))
* fix: import type of sharp ([32954a7](https://github.com/mx-space/core/commit/32954a7))

## 6.1.0 (2024-08-16)

* release: v6.1.0 ([8a08072](https://github.com/mx-space/core/commit/8a08072))
* chore: downgrade deps ([fbf0ff8](https://github.com/mx-space/core/commit/fbf0ff8))
* chore: format ([817b81a](https://github.com/mx-space/core/commit/817b81a))
* chore: lint ([f187fc4](https://github.com/mx-space/core/commit/f187fc4))
* chore: remove pty module ([1bb4f6a](https://github.com/mx-space/core/commit/1bb4f6a))
* chore: update deps ([4e63cf1](https://github.com/mx-space/core/commit/4e63cf1))
* chore: update script ([df81a67](https://github.com/mx-space/core/commit/df81a67))
* chore(deps): update dependency @innei/prettier to v0.15.0 (#1981) ([3bb1c52](https://github.com/mx-space/core/commit/3bb1c52)), closes [#1981](https://github.com/mx-space/core/issues/1981)
* chore(deps): update dependency @langchain/core to v0.2.22 ([36dcd45](https://github.com/mx-space/core/commit/36dcd45))
* chore(deps): update dependency @langchain/core to v0.2.23 ([e180354](https://github.com/mx-space/core/commit/e180354))
* chore(deps): update dependency @langchain/core to v0.2.24 ([c1ba459](https://github.com/mx-space/core/commit/c1ba459))
* chore(deps): update dependency @nestjs/cli to v10.4.4 ([02925dd](https://github.com/mx-space/core/commit/02925dd))
* chore(deps): update dependency @swc/core to v1.7.10 ([cd0b334](https://github.com/mx-space/core/commit/cd0b334))
* chore(deps): update dependency @swc/core to v1.7.11 ([addcb92](https://github.com/mx-space/core/commit/addcb92))
* chore(deps): update dependency @swc/core to v1.7.9 ([cabce7b](https://github.com/mx-space/core/commit/cabce7b))
* chore(deps): update dependency @sxzz/eslint-config to v3.17.0 (#1976) ([81f91f4](https://github.com/mx-space/core/commit/81f91f4)), closes [#1976](https://github.com/mx-space/core/issues/1976)
* chore(deps): update dependency @types/node to v20.14.15 ([ea5eaa9](https://github.com/mx-space/core/commit/ea5eaa9))
* chore(deps): update dependency axios to v1.7.4 ([259969c](https://github.com/mx-space/core/commit/259969c))
* chore(deps): update dependency eslint to v9.9.0 ([906601f](https://github.com/mx-space/core/commit/906601f))
* chore(deps): update dependency eslint-plugin-unused-imports to v4.1.2 ([4488b81](https://github.com/mx-space/core/commit/4488b81))
* chore(deps): update dependency eslint-plugin-unused-imports to v4.1.3 ([01e7617](https://github.com/mx-space/core/commit/01e7617))
* chore(deps): update dependency lint-staged to v15.2.9 ([85fafa3](https://github.com/mx-space/core/commit/85fafa3))
* chore(deps): update dependency whatwg-url to v14 (#2008) ([75fe7d6](https://github.com/mx-space/core/commit/75fe7d6)), closes [#2008](https://github.com/mx-space/core/issues/2008)
* chore(deps): update pnpm to v9.7.0 (#1973) ([7ddbe0b](https://github.com/mx-space/core/commit/7ddbe0b)), closes [#1973](https://github.com/mx-space/core/issues/1973)
* chore(deps): update pnpm to v9.7.1 ([23b8c64](https://github.com/mx-space/core/commit/23b8c64))
* chore(release): bump @mx-space/api-client to v1.13.2 ([34373f9](https://github.com/mx-space/core/commit/34373f9))
* feat: image blur hash (#2010) ([c27ee8c](https://github.com/mx-space/core/commit/c27ee8c)), closes [#2010](https://github.com/mx-space/core/issues/2010)
* fix: import circular ([a8a21d9](https://github.com/mx-space/core/commit/a8a21d9))
* fix: migrate db first ([b923c7f](https://github.com/mx-space/core/commit/b923c7f))
* fix(deps): update dependency @aws-sdk/client-s3 to v3.632.0 (#1977) ([81c6af6](https://github.com/mx-space/core/commit/81c6af6)), closes [#1977](https://github.com/mx-space/core/issues/1977)
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.26 ([2d78a04](https://github.com/mx-space/core/commit/2d78a04))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.27 ([4392ad3](https://github.com/mx-space/core/commit/4392ad3))
* fix(deps): update dependency isbot to v5.1.15 ([08e8f2f](https://github.com/mx-space/core/commit/08e8f2f))
* fix(deps): update dependency isbot to v5.1.16 ([423a2ab](https://github.com/mx-space/core/commit/423a2ab))
* fix(deps): update dependency langchain to v0.2.14 ([b1f6a3d](https://github.com/mx-space/core/commit/b1f6a3d))
* fix(deps): update dependency langchain to v0.2.15 ([819727c](https://github.com/mx-space/core/commit/819727c))
* fix(deps): update dependency langchain to v0.2.16 ([41d6974](https://github.com/mx-space/core/commit/41d6974))
* fix(deps): update dependency openai to v4.55.7 (#1968) ([831d87c](https://github.com/mx-space/core/commit/831d87c)), closes [#1968](https://github.com/mx-space/core/issues/1968)
* fix(deps): update dependency openai to v4.55.9 ([5d335fc](https://github.com/mx-space/core/commit/5d335fc))
* fix(deps): update nest monorepo to v10.4.1 (minor) (#1994) ([3ee55a7](https://github.com/mx-space/core/commit/3ee55a7)), closes [#1994](https://github.com/mx-space/core/issues/1994)

## <small>6.0.3 (2024-08-08)</small>

* release: v6.0.3 ([8db194b](https://github.com/mx-space/core/commit/8db194b))
* feat: link allow subpath option ([327d30d](https://github.com/mx-space/core/commit/327d30d))
* Update FUNDING.yml ([1d806fb](https://github.com/mx-space/core/commit/1d806fb))
* chore(deps): update dependency @langchain/core to v0.2.19 (#1947) ([67cff39](https://github.com/mx-space/core/commit/67cff39)), closes [#1947](https://github.com/mx-space/core/issues/1947)
* chore(deps): update dependency @langchain/core to v0.2.20 ([20fbf46](https://github.com/mx-space/core/commit/20fbf46))
* chore(deps): update dependency @langchain/core to v0.2.21 ([37ab1d4](https://github.com/mx-space/core/commit/37ab1d4))
* chore(deps): update dependency @swc/core to v1.7.5 ([38ac5ed](https://github.com/mx-space/core/commit/38ac5ed))
* chore(deps): update dependency @swc/core to v1.7.6 ([07430c0](https://github.com/mx-space/core/commit/07430c0))
* chore(deps): update dependency @sxzz/eslint-config to v3.16.1 (#1923) ([2451553](https://github.com/mx-space/core/commit/2451553)), closes [#1923](https://github.com/mx-space/core/issues/1923)
* chore(deps): update dependency @sxzz/eslint-config to v3.16.2 (#1958) ([68691ed](https://github.com/mx-space/core/commit/68691ed)), closes [#1958](https://github.com/mx-space/core/issues/1958)
* chore(deps): update dependency @sxzz/eslint-config to v3.16.3 ([59b12f1](https://github.com/mx-space/core/commit/59b12f1))
* chore(deps): update dependency @sxzz/eslint-config to v3.16.4 ([b5a7221](https://github.com/mx-space/core/commit/b5a7221))
* chore(deps): update dependency @types/node to v20.14.14 ([a547303](https://github.com/mx-space/core/commit/a547303))
* chore(deps): update dependency axios to v1.7.3 ([67ec703](https://github.com/mx-space/core/commit/67ec703))
* chore(deps): update dependency lint-staged to v15.2.8 ([4b72046](https://github.com/mx-space/core/commit/4b72046))
* chore(deps): update dependency tsup to v8.2.4 ([36eccda](https://github.com/mx-space/core/commit/36eccda))
* fix: lint ([ccdf213](https://github.com/mx-space/core/commit/ccdf213))
* fix: lint ([c46ce87](https://github.com/mx-space/core/commit/c46ce87))
* fix(deps): update babel monorepo to v7.25.2 (minor) (#1928) ([075365b](https://github.com/mx-space/core/commit/075365b)), closes [#1928](https://github.com/mx-space/core/issues/1928)
* fix(deps): update dependency @aws-sdk/client-s3 to v3.624.0 (#1921) ([b8bc581](https://github.com/mx-space/core/commit/b8bc581)), closes [#1921](https://github.com/mx-space/core/issues/1921)
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.23 ([0523626](https://github.com/mx-space/core/commit/0523626))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.24 ([b6e7a54](https://github.com/mx-space/core/commit/b6e7a54))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.25 ([d61b5be](https://github.com/mx-space/core/commit/d61b5be))
* fix(deps): update dependency @langchain/openai to v0.2.6 ([9afa15d](https://github.com/mx-space/core/commit/9afa15d))
* fix(deps): update dependency axios-retry to v4.5.0 (#1954) ([7fc6768](https://github.com/mx-space/core/commit/7fc6768)), closes [#1954](https://github.com/mx-space/core/issues/1954)
* fix(deps): update dependency cache-manager to v5.7.5 ([ccbf2ea](https://github.com/mx-space/core/commit/ccbf2ea))
* fix(deps): update dependency cache-manager to v5.7.6 ([45bd1cc](https://github.com/mx-space/core/commit/45bd1cc))
* fix(deps): update dependency inquirer to v10.1.7 ([cb62db5](https://github.com/mx-space/core/commit/cb62db5))
* fix(deps): update dependency inquirer to v10.1.8 ([1a13a7b](https://github.com/mx-space/core/commit/1a13a7b))
* fix(deps): update dependency isbot to v5.1.14 ([313fe80](https://github.com/mx-space/core/commit/313fe80))
* fix(deps): update dependency langchain to v0.2.13 ([32a65cf](https://github.com/mx-space/core/commit/32a65cf))
* fix(deps): update dependency mongoose-lean-getters to v2.1.1 ([492381d](https://github.com/mx-space/core/commit/492381d))
* fix(deps): update dependency openai to v4.54.0 (#1949) ([4647155](https://github.com/mx-space/core/commit/4647155)), closes [#1949](https://github.com/mx-space/core/issues/1949)
* fix(deps): update dependency qs to v6.13.0 (#1946) ([967d2e2](https://github.com/mx-space/core/commit/967d2e2)), closes [#1946](https://github.com/mx-space/core/issues/1946)
* fix(deps): update dependency remove-markdown to v0.5.2 (#1948) ([8ff229f](https://github.com/mx-space/core/commit/8ff229f)), closes [#1948](https://github.com/mx-space/core/issues/1948)

## <small>6.0.2 (2024-08-01)</small>

* release: v6.0.2 ([f3b15bb](https://github.com/mx-space/core/commit/f3b15bb))
* chore: update deps ([7367934](https://github.com/mx-space/core/commit/7367934))
* chore: update docker compose ([e56d215](https://github.com/mx-space/core/commit/e56d215))
* chore(deps): update dependency @innei/prettier to v0.13.3 ([05acfa0](https://github.com/mx-space/core/commit/05acfa0))
* chore(deps): update dependency @innei/prettier to v0.14.0 (#1907) ([951cc25](https://github.com/mx-space/core/commit/951cc25)), closes [#1907](https://github.com/mx-space/core/issues/1907)
* chore(deps): update dependency @innei/prettier to v0.14.2 ([22637cf](https://github.com/mx-space/core/commit/22637cf))
* chore(deps): update dependency @langchain/core to v0.2.15 ([fa2b257](https://github.com/mx-space/core/commit/fa2b257))
* chore(deps): update dependency @langchain/core to v0.2.17 ([a313b87](https://github.com/mx-space/core/commit/a313b87))
* chore(deps): update dependency @langchain/core to v0.2.18 ([829a133](https://github.com/mx-space/core/commit/829a133))
* chore(deps): update dependency @nestjs/cli to v10.4.2 (#1846) ([ece5b83](https://github.com/mx-space/core/commit/ece5b83)), closes [#1846](https://github.com/mx-space/core/issues/1846)
* chore(deps): update dependency @nestjs/schematics to v10.1.3 ([53f893a](https://github.com/mx-space/core/commit/53f893a))
* chore(deps): update dependency @swc/core to v1.7.0 (#1893) ([f17f1d9](https://github.com/mx-space/core/commit/f17f1d9)), closes [#1893](https://github.com/mx-space/core/issues/1893)
* chore(deps): update dependency @swc/core to v1.7.1 ([a0b5bc0](https://github.com/mx-space/core/commit/a0b5bc0))
* chore(deps): update dependency @swc/core to v1.7.2 ([522015d](https://github.com/mx-space/core/commit/522015d))
* chore(deps): update dependency @swc/core to v1.7.3 ([5b4b8ce](https://github.com/mx-space/core/commit/5b4b8ce))
* chore(deps): update dependency @swc/core to v1.7.4 ([9bf7f69](https://github.com/mx-space/core/commit/9bf7f69))
* chore(deps): update dependency @sxzz/eslint-config to v3.15.1 (#1894) ([ddd55c3](https://github.com/mx-space/core/commit/ddd55c3)), closes [#1894](https://github.com/mx-space/core/issues/1894)
* chore(deps): update dependency @types/lodash to v4.17.7 ([f01cc28](https://github.com/mx-space/core/commit/f01cc28))
* chore(deps): update dependency @types/node to v20.14.11 ([446f359](https://github.com/mx-space/core/commit/446f359))
* chore(deps): update dependency @types/node to v20.14.12 ([ac066d8](https://github.com/mx-space/core/commit/ac066d8))
* chore(deps): update dependency @types/node to v20.14.13 ([e7f19a4](https://github.com/mx-space/core/commit/e7f19a4))
* chore(deps): update dependency eslint to v9.6.0 ([b34a9b2](https://github.com/mx-space/core/commit/b34a9b2))
* chore(deps): update dependency eslint to v9.7.0 ([e7f9fde](https://github.com/mx-space/core/commit/e7f9fde))
* chore(deps): update dependency eslint to v9.8.0 ([aefc3f0](https://github.com/mx-space/core/commit/aefc3f0))
* chore(deps): update dependency eslint-plugin-unused-imports to v4.0.1 ([c053ff5](https://github.com/mx-space/core/commit/c053ff5))
* chore(deps): update dependency husky to v9.1.1 (#1895) ([fc876b6](https://github.com/mx-space/core/commit/fc876b6)), closes [#1895](https://github.com/mx-space/core/issues/1895)
* chore(deps): update dependency husky to v9.1.2 ([8382f36](https://github.com/mx-space/core/commit/8382f36))
* chore(deps): update dependency husky to v9.1.3 ([42c160d](https://github.com/mx-space/core/commit/42c160d))
* chore(deps): update dependency husky to v9.1.4 ([0dbe023](https://github.com/mx-space/core/commit/0dbe023))
* chore(deps): update dependency mongodb-memory-server to v10 (#1913) ([38cf97a](https://github.com/mx-space/core/commit/38cf97a)), closes [#1913](https://github.com/mx-space/core/issues/1913)
* chore(deps): update dependency mongodb-memory-server to v9.4.1 ([a3cf591](https://github.com/mx-space/core/commit/a3cf591))
* chore(deps): update dependency mongodb-memory-server to v9.4.1 (#1833) ([113ab72](https://github.com/mx-space/core/commit/113ab72)), closes [#1833](https://github.com/mx-space/core/issues/1833)
* chore(deps): update dependency prettier to v3.3.3 ([c97f119](https://github.com/mx-space/core/commit/c97f119))
* chore(deps): update dependency rimraf to v5.0.9 ([b4debf6](https://github.com/mx-space/core/commit/b4debf6))
* chore(deps): update dependency rimraf to v6 (#1880) ([c0284a1](https://github.com/mx-space/core/commit/c0284a1)), closes [#1880](https://github.com/mx-space/core/issues/1880)
* chore(deps): update dependency semver to v7.6.3 ([99142c0](https://github.com/mx-space/core/commit/99142c0))
* chore(deps): update dependency tsup to v8.1.2 ([ea41c2c](https://github.com/mx-space/core/commit/ea41c2c))
* chore(deps): update dependency tsup to v8.2.2 (#1896) ([eba5614](https://github.com/mx-space/core/commit/eba5614)), closes [#1896](https://github.com/mx-space/core/issues/1896)
* chore(deps): update dependency tsup to v8.2.3 ([da98e89](https://github.com/mx-space/core/commit/da98e89))
* chore(deps): update dependency typescript to v5.5.4 ([9df5217](https://github.com/mx-space/core/commit/9df5217))
* chore(deps): update pnpm to v9.5.0 (#1860) ([e624e28](https://github.com/mx-space/core/commit/e624e28)), closes [#1860](https://github.com/mx-space/core/issues/1860)
* chore(deps): update pnpm to v9.6.0 (#1908) ([80e4249](https://github.com/mx-space/core/commit/80e4249)), closes [#1908](https://github.com/mx-space/core/issues/1908)
* fix: update clerk auth ([2fd444d](https://github.com/mx-space/core/commit/2fd444d))
* fix(db): use process.env as the default value of command option (#1941) ([b19493a](https://github.com/mx-space/core/commit/b19493a)), closes [#1941](https://github.com/mx-space/core/issues/1941)
* fix(deps): update babel monorepo to v7.24.8 ([d8ee22f](https://github.com/mx-space/core/commit/d8ee22f))
* fix(deps): update babel monorepo to v7.24.9 ([a49e3b9](https://github.com/mx-space/core/commit/a49e3b9))
* fix(deps): update dependency @aws-sdk/client-s3 to v3.614.0 (#1874) ([2039a3d](https://github.com/mx-space/core/commit/2039a3d)), closes [#1874](https://github.com/mx-space/core/issues/1874)
* fix(deps): update dependency @aws-sdk/client-s3 to v3.617.0 (#1909) ([3d409e8](https://github.com/mx-space/core/commit/3d409e8)), closes [#1909](https://github.com/mx-space/core/issues/1909)
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.15 ([43fdd8e](https://github.com/mx-space/core/commit/43fdd8e))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.16 ([cdbc517](https://github.com/mx-space/core/commit/cdbc517))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.18 ([abcae1f](https://github.com/mx-space/core/commit/abcae1f))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.20 ([e7dbd6c](https://github.com/mx-space/core/commit/e7dbd6c))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.21 ([ede03ed](https://github.com/mx-space/core/commit/ede03ed))
* fix(deps): update dependency @innei/pretty-logger-nestjs to v0.3.3 ([ad67cb1](https://github.com/mx-space/core/commit/ad67cb1))
* fix(deps): update dependency @langchain/openai to v0.2.4 (#1829) ([72c4120](https://github.com/mx-space/core/commit/72c4120)), closes [#1829](https://github.com/mx-space/core/issues/1829)
* fix(deps): update dependency @langchain/openai to v0.2.5 ([10ae0c5](https://github.com/mx-space/core/commit/10ae0c5))
* fix(deps): update dependency @nestjs/schedule to v4.1.0 (#1855) ([b0603b9](https://github.com/mx-space/core/commit/b0603b9)), closes [#1855](https://github.com/mx-space/core/issues/1855)
* fix(deps): update dependency @nestjs/throttler to v6 (#1914) ([e2f0e57](https://github.com/mx-space/core/commit/e2f0e57)), closes [#1914](https://github.com/mx-space/core/issues/1914)
* fix(deps): update dependency @simplewebauthn/server to v10.0.1 (#1902) ([84dce71](https://github.com/mx-space/core/commit/84dce71)), closes [#1902](https://github.com/mx-space/core/issues/1902)
* fix(deps): update dependency @typegoose/auto-increment to v4.5.0 (#1877) ([d486ab8](https://github.com/mx-space/core/commit/d486ab8)), closes [#1877](https://github.com/mx-space/core/issues/1877)
* fix(deps): update dependency @typegoose/typegoose to v12.6.0 (#1878) ([06592df](https://github.com/mx-space/core/commit/06592df)), closes [#1878](https://github.com/mx-space/core/issues/1878)
* fix(deps): update dependency axios-retry to v4.4.2 (#1903) ([8ca0d0f](https://github.com/mx-space/core/commit/8ca0d0f)), closes [#1903](https://github.com/mx-space/core/issues/1903)
* fix(deps): update dependency cache-manager to v5.7.2 (#1856) ([3d1be30](https://github.com/mx-space/core/commit/3d1be30)), closes [#1856](https://github.com/mx-space/core/issues/1856)
* fix(deps): update dependency cache-manager to v5.7.3 ([bdfe9c6](https://github.com/mx-space/core/commit/bdfe9c6))
* fix(deps): update dependency cache-manager to v5.7.4 ([5790182](https://github.com/mx-space/core/commit/5790182))
* fix(deps): update dependency dayjs to v1.11.12 ([99bf0a9](https://github.com/mx-space/core/commit/99bf0a9))
* fix(deps): update dependency inquirer to v10 (#1861) ([1e7ab05](https://github.com/mx-space/core/commit/1e7ab05)), closes [#1861](https://github.com/mx-space/core/issues/1861)
* fix(deps): update dependency inquirer to v10.0.1 ([ac35b26](https://github.com/mx-space/core/commit/ac35b26))
* fix(deps): update dependency inquirer to v10.0.4 ([0628932](https://github.com/mx-space/core/commit/0628932))
* fix(deps): update dependency inquirer to v10.1.2 (#1904) ([0c163c9](https://github.com/mx-space/core/commit/0c163c9)), closes [#1904](https://github.com/mx-space/core/issues/1904)
* fix(deps): update dependency inquirer to v10.1.4 ([519f5c0](https://github.com/mx-space/core/commit/519f5c0))
* fix(deps): update dependency inquirer to v10.1.5 ([933aa17](https://github.com/mx-space/core/commit/933aa17))
* fix(deps): update dependency inquirer to v10.1.6 ([5e39aa1](https://github.com/mx-space/core/commit/5e39aa1))
* fix(deps): update dependency isbot to v5.1.12 ([b72b9d3](https://github.com/mx-space/core/commit/b72b9d3))
* fix(deps): update dependency isbot to v5.1.13 ([68bbdfa](https://github.com/mx-space/core/commit/68bbdfa))
* fix(deps): update dependency langchain to v0.2.10 ([9855e24](https://github.com/mx-space/core/commit/9855e24))
* fix(deps): update dependency langchain to v0.2.11 ([d0bc8cf](https://github.com/mx-space/core/commit/d0bc8cf))
* fix(deps): update dependency langchain to v0.2.12 ([36200bf](https://github.com/mx-space/core/commit/36200bf))
* fix(deps): update dependency langchain to v0.2.9 ([84f5985](https://github.com/mx-space/core/commit/84f5985))
* fix(deps): update dependency lru-cache to v10.4.3 (#1858) ([14a6a5c](https://github.com/mx-space/core/commit/14a6a5c)), closes [#1858](https://github.com/mx-space/core/issues/1858)
* fix(deps): update dependency lru-cache to v11 (#1915) ([d5dbd1a](https://github.com/mx-space/core/commit/d5dbd1a)), closes [#1915](https://github.com/mx-space/core/issues/1915)
* fix(deps): update dependency marked to v13.0.3 ([edd2b0c](https://github.com/mx-space/core/commit/edd2b0c))
* fix(deps): update dependency mongoose to v8.5.1 (#1879) ([31ec980](https://github.com/mx-space/core/commit/31ec980)), closes [#1879](https://github.com/mx-space/core/issues/1879)
* fix(deps): update dependency mongoose to v8.5.2 ([9347595](https://github.com/mx-space/core/commit/9347595))
* fix(deps): update dependency mongoose-aggregate-paginate-v2 to v1.1.1 (#1859) ([0321bcd](https://github.com/mx-space/core/commit/0321bcd)), closes [#1859](https://github.com/mx-space/core/issues/1859)
* fix(deps): update dependency mongoose-aggregate-paginate-v2 to v1.1.2 (#1905) ([ee4a6e3](https://github.com/mx-space/core/commit/ee4a6e3)), closes [#1905](https://github.com/mx-space/core/issues/1905)
* fix(deps): update dependency mongoose-paginate-v2 to v1.8.3 (#1906) ([8bfd5c8](https://github.com/mx-space/core/commit/8bfd5c8)), closes [#1906](https://github.com/mx-space/core/issues/1906)
* fix(deps): update dependency openai to v4.52.7 ([4e42bee](https://github.com/mx-space/core/commit/4e42bee))
* fix(deps): update dependency openai to v4.53.1 (#1911) ([07061b8](https://github.com/mx-space/core/commit/07061b8)), closes [#1911](https://github.com/mx-space/core/issues/1911)
* fix(deps): update dependency openai to v4.53.2 ([ae47390](https://github.com/mx-space/core/commit/ae47390))
* fix(deps): update dependency qs to v6.12.3 ([b66726d](https://github.com/mx-space/core/commit/b66726d))

## <small>6.0.1 (2024-07-07)</small>

* release: v6.0.1 ([0077ac1](https://github.com/mx-space/core/commit/0077ac1))
* chore(deps): update dependency @langchain/core to v0.2.14 ([00b6381](https://github.com/mx-space/core/commit/00b6381))
* chore(deps): update dependency @swc/core to v1.6.13 ([aeaf8f4](https://github.com/mx-space/core/commit/aeaf8f4))
* chore(deps): update dependency @swc/core to v1.6.7 ([3fbd805](https://github.com/mx-space/core/commit/3fbd805))
* chore(deps): update dependency @types/lodash to v4.17.6 ([edd16f5](https://github.com/mx-space/core/commit/edd16f5))
* chore(deps): update dependency @types/node to v20.14.10 ([80e8c8f](https://github.com/mx-space/core/commit/80e8c8f))
* chore(deps): update dependency @types/node to v20.14.9 ([a0ffeff](https://github.com/mx-space/core/commit/a0ffeff))
* chore(deps): update dependency mongodb-memory-server to v9.4.0 (#1748) ([eda3305](https://github.com/mx-space/core/commit/eda3305)), closes [#1748](https://github.com/mx-space/core/issues/1748)
* chore(deps): update dependency redis-memory-server to v0.11.0 (#1850) ([02ae407](https://github.com/mx-space/core/commit/02ae407)), closes [#1850](https://github.com/mx-space/core/issues/1850)
* chore(deps): update dependency rimraf to v5.0.8 ([d09af24](https://github.com/mx-space/core/commit/d09af24))
* chore(deps): update dependency typescript to v5.5.3 ([9d688ad](https://github.com/mx-space/core/commit/9d688ad))
* chore(deps): update dependency unplugin-swc to v1.5.1 (#1851) ([2a7777b](https://github.com/mx-space/core/commit/2a7777b)), closes [#1851](https://github.com/mx-space/core/issues/1851)
* chore(deps): update robinraju/release-downloader action to v1.11 (#1852) ([072e4d6](https://github.com/mx-space/core/commit/072e4d6)), closes [#1852](https://github.com/mx-space/core/issues/1852)
* fix(deps): update algoliasearch-client-javascript monorepo to v4.24.0 (#1853) ([7478e9d](https://github.com/mx-space/core/commit/7478e9d)), closes [#1853](https://github.com/mx-space/core/issues/1853)
* fix(deps): update dependency @aws-sdk/client-s3 to v3.609.0 (#1854) ([204f855](https://github.com/mx-space/core/commit/204f855)), closes [#1854](https://github.com/mx-space/core/issues/1854)
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.14 ([a383dc2](https://github.com/mx-space/core/commit/a383dc2))
* fix(deps): update dependency isbot to v5.1.11 ([0fca0d3](https://github.com/mx-space/core/commit/0fca0d3))
* fix(deps): update dependency langchain to v0.2.8 ([cc155ab](https://github.com/mx-space/core/commit/cc155ab))
* fix(deps): update dependency linkedom to v0.18.4 ([d7bf117](https://github.com/mx-space/core/commit/d7bf117))
* fix(deps): update dependency marked to v13.0.2 (#1832) ([efd3cc5](https://github.com/mx-space/core/commit/efd3cc5)), closes [#1832](https://github.com/mx-space/core/issues/1832)
* fix(deps): update dependency mongoose to v8.4.5 ([61e1f06](https://github.com/mx-space/core/commit/61e1f06))
* fix(deps): update dependency mongoose-aggregate-paginate-v2 to v1.0.42 ([6a4e502](https://github.com/mx-space/core/commit/6a4e502))
* fix(deps): update dependency openai to v4.52.3 ([1febace](https://github.com/mx-space/core/commit/1febace))
* fix(deps): update dependency qs to v6.12.2 ([4f737a9](https://github.com/mx-space/core/commit/4f737a9))
* fix(deps): update nest monorepo ([c30b6c1](https://github.com/mx-space/core/commit/c30b6c1))
* fix(update): bad credentials when requesting with empty github token (#1847) ([63f4551](https://github.com/mx-space/core/commit/63f4551)), closes [#1847](https://github.com/mx-space/core/issues/1847)

## 6.0.0 (2024-06-22)

* release: v6.0.0 ([f20b07a](https://github.com/mx-space/core/commit/f20b07a))
* fix: cleanTempDirectory not remake trash directory (#1824) ([4877459](https://github.com/mx-space/core/commit/4877459)), closes [#1824](https://github.com/mx-space/core/issues/1824)
* fix: crypto compatible ([503f079](https://github.com/mx-space/core/commit/503f079))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.12 ([772f6f7](https://github.com/mx-space/core/commit/772f6f7))
* fix(deps): update dependency @nestjs/throttler to v5.2.0 (#1806) ([bfa25c0](https://github.com/mx-space/core/commit/bfa25c0)), closes [#1806](https://github.com/mx-space/core/issues/1806)
* fix(deps): update dependency axios-retry to v4.4.1 (#1825) ([0585033](https://github.com/mx-space/core/commit/0585033)), closes [#1825](https://github.com/mx-space/core/issues/1825)
* fix(deps): update dependency mongoose to v8.4.3 ([79c7585](https://github.com/mx-space/core/commit/79c7585))
* fix(deps): update dependency nodemailer to v6.9.14 ([416f933](https://github.com/mx-space/core/commit/416f933))
* chore: downgrade deps ([703ba11](https://github.com/mx-space/core/commit/703ba11))
* chore: node v20 (#1648) ([f020c1f](https://github.com/mx-space/core/commit/f020c1f)), closes [#1648](https://github.com/mx-space/core/issues/1648)
* chore: update deps, node v20 ([f5ee230](https://github.com/mx-space/core/commit/f5ee230))
* chore(deps): update dependency @langchain/core to v0.2.7 ([a6d04a8](https://github.com/mx-space/core/commit/a6d04a8))
* chore(deps): update dependency @langchain/core to v0.2.8 ([60c0af1](https://github.com/mx-space/core/commit/60c0af1))
* chore(deps): update dependency @swc/core to v1.6.1 (#1808) ([f549c79](https://github.com/mx-space/core/commit/f549c79)), closes [#1808](https://github.com/mx-space/core/issues/1808)
* chore(deps): update dependency @swc/core to v1.6.3 ([6ac4ffb](https://github.com/mx-space/core/commit/6ac4ffb))
* chore(deps): update dependency @sxzz/eslint-config to v3.13.0 (#1805) ([047f13d](https://github.com/mx-space/core/commit/047f13d)), closes [#1805](https://github.com/mx-space/core/issues/1805)
* chore(deps): update dependency @types/node to v20.14.4 ([547c004](https://github.com/mx-space/core/commit/547c004))
* chore(deps): update dependency @types/node to v20.14.5 ([c6a6271](https://github.com/mx-space/core/commit/c6a6271))
* chore(deps): update dependency @types/node to v20.14.6 ([a4bc734](https://github.com/mx-space/core/commit/a4bc734))
* chore(deps): update dependency @types/node to v20.14.7 ([5e2c607](https://github.com/mx-space/core/commit/5e2c607))
* chore(deps): update dependency @types/validator to v13.12.0 ([be7bd52](https://github.com/mx-space/core/commit/be7bd52))
* chore(deps): update dependency eslint to v9.5.0 ([fbd59b9](https://github.com/mx-space/core/commit/fbd59b9))
* chore(deps): update dependency typescript to v5.5.2 (#1822) ([e4104b5](https://github.com/mx-space/core/commit/e4104b5)), closes [#1822](https://github.com/mx-space/core/issues/1822)
* chore(deps): update docker/build-push-action action to v6 (#1810) ([9412dd1](https://github.com/mx-space/core/commit/9412dd1)), closes [#1810](https://github.com/mx-space/core/issues/1810)
* chore(deps): update pnpm to v9.4.0 (#1811) ([4d94ea3](https://github.com/mx-space/core/commit/4d94ea3)), closes [#1811](https://github.com/mx-space/core/issues/1811)

## <small>5.8.4 (2024-06-14)</small>

* release: v5.8.4 ([2bee5b6](https://github.com/mx-space/core/commit/2bee5b6))
* feat: support `gh_token` closes 1758 ([39e10ef](https://github.com/mx-space/core/commit/39e10ef))
* chore(deps): update dependency @swc/core to v1.5.29 ([e3849c6](https://github.com/mx-space/core/commit/e3849c6))
* chore(deps): update dependency lint-staged to v15.2.7 ([a3078b9](https://github.com/mx-space/core/commit/a3078b9))
* chore(deps): update pnpm to v9.3.0 (#1790) ([05e067f](https://github.com/mx-space/core/commit/05e067f)), closes [#1790](https://github.com/mx-space/core/issues/1790)
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.11 ([b88b7bf](https://github.com/mx-space/core/commit/b88b7bf))
* fix(deps): update dependency openai to v4.51.0 (#1791) ([78c03e3](https://github.com/mx-space/core/commit/78c03e3)), closes [#1791](https://github.com/mx-space/core/issues/1791)

## <small>5.8.3 (2024-06-12)</small>

* release: v5.8.3 ([5db204f](https://github.com/mx-space/core/commit/5db204f))
* fix: master avatar in recent activity comments cannot be displayed (#1794) ([1750340](https://github.com/mx-space/core/commit/1750340)), closes [#1794](https://github.com/mx-space/core/issues/1794)
* fix(deps): update babel monorepo to v7.24.7 ([37e1a83](https://github.com/mx-space/core/commit/37e1a83))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.10 ([f2eb9c9](https://github.com/mx-space/core/commit/f2eb9c9))
* fix(deps): update dependency @fastify/multipart to v8.3.0 (#1786) ([0c40479](https://github.com/mx-space/core/commit/0c40479)), closes [#1786](https://github.com/mx-space/core/issues/1786)
* fix(deps): update dependency @langchain/openai to v0.1.2 (#1754) ([e0a6fcf](https://github.com/mx-space/core/commit/e0a6fcf)), closes [#1754](https://github.com/mx-space/core/issues/1754)
* fix(deps): update dependency @langchain/openai to v0.1.3 ([ca985b9](https://github.com/mx-space/core/commit/ca985b9))
* fix(deps): update dependency axios-retry to v4.4.0 (#1772) ([66bbe14](https://github.com/mx-space/core/commit/66bbe14)), closes [#1772](https://github.com/mx-space/core/issues/1772)
* fix(deps): update dependency cache-manager to v5.6.1 (#1784) ([c90dafa](https://github.com/mx-space/core/commit/c90dafa)), closes [#1784](https://github.com/mx-space/core/issues/1784)
* fix(deps): update dependency cache-manager-ioredis-yet to v2.1.1 (#1785) ([462a6a8](https://github.com/mx-space/core/commit/462a6a8)), closes [#1785](https://github.com/mx-space/core/issues/1785)
* fix(deps): update dependency isbot to v5.1.9 ([514bb52](https://github.com/mx-space/core/commit/514bb52))
* fix(deps): update dependency langchain to v0.2.5 ([2930d0c](https://github.com/mx-space/core/commit/2930d0c))
* fix(deps): update dependency linkedom to v0.18.3 ([098d726](https://github.com/mx-space/core/commit/098d726))
* fix(deps): update dependency openai to v4.49.0 (#1774) ([89b034b](https://github.com/mx-space/core/commit/89b034b)), closes [#1774](https://github.com/mx-space/core/issues/1774)
* fix(deps): update dependency openai to v4.49.1 ([e8f66d2](https://github.com/mx-space/core/commit/e8f66d2))
* chore(deps): update dependency @langchain/core to v0.2.6 ([8456525](https://github.com/mx-space/core/commit/8456525))
* chore(deps): update dependency @swc/core to v1.5.25 ([3c369e8](https://github.com/mx-space/core/commit/3c369e8))
* chore(deps): update dependency @swc/core to v1.5.27 ([82c3c6f](https://github.com/mx-space/core/commit/82c3c6f))
* chore(deps): update dependency @swc/core to v1.5.28 ([88048d8](https://github.com/mx-space/core/commit/88048d8))
* chore(deps): update dependency @types/lodash to v4.17.5 ([e71d517](https://github.com/mx-space/core/commit/e71d517))
* chore(deps): update dependency @types/node to v20.14.2 ([a0cb68b](https://github.com/mx-space/core/commit/a0cb68b))
* chore(deps): update dependency lint-staged to v15.2.6 ([3e628e2](https://github.com/mx-space/core/commit/3e628e2))
* chore(deps): update dependency prettier to v3.3.1 ([f39f373](https://github.com/mx-space/core/commit/f39f373))
* chore(deps): update dependency prettier to v3.3.2 ([f3263bd](https://github.com/mx-space/core/commit/f3263bd))
* chore(deps): update pnpm to v9.2.0 (#1782) ([e68148a](https://github.com/mx-space/core/commit/e68148a)), closes [#1782](https://github.com/mx-space/core/issues/1782)

## <small>5.8.2 (2024-06-04)</small>

* release: v5.8.2 ([20e69ea](https://github.com/mx-space/core/commit/20e69ea))
* chore(deps): update dependency @sxzz/eslint-config to v3.12.1 (#1766) ([abcf381](https://github.com/mx-space/core/commit/abcf381)), closes [#1766](https://github.com/mx-space/core/issues/1766)
* chore(deps): update dependency @types/node to v20.14.0 ([1105fb5](https://github.com/mx-space/core/commit/1105fb5))
* chore(deps): update dependency @types/node to v20.14.1 ([e82511d](https://github.com/mx-space/core/commit/e82511d))
* chore(deps): update dependency mongodb-memory-server to v9.3.0 (#1749) ([a707382](https://github.com/mx-space/core/commit/a707382)), closes [#1749](https://github.com/mx-space/core/issues/1749)
* chore(deps): update dependency tsup to v8.1.0 (#1767) ([5dfea70](https://github.com/mx-space/core/commit/5dfea70)), closes [#1767](https://github.com/mx-space/core/issues/1767)
* fix: delete file with EXDEV issue (#1770) ([b3dfbdf](https://github.com/mx-space/core/commit/b3dfbdf)), closes [#1770](https://github.com/mx-space/core/issues/1770)
* fix(deps): update nest monorepo to v10.3.9 (#1768) ([d627d38](https://github.com/mx-space/core/commit/d627d38)), closes [#1768](https://github.com/mx-space/core/issues/1768)

## <small>5.8.1 (2024-06-02)</small>

* release: v5.8.1 ([0c5ddd4](https://github.com/mx-space/core/commit/0c5ddd4))
* fix: ai summary language detect ([8764815](https://github.com/mx-space/core/commit/8764815))
* fix: check slug length ([6a58262](https://github.com/mx-space/core/commit/6a58262))
* fix(deps): update dependency inquirer to v9.2.23 ([eae2f50](https://github.com/mx-space/core/commit/eae2f50))
* fix(deps): update dependency langchain to v0.2.4 ([08f30b5](https://github.com/mx-space/core/commit/08f30b5))
* fix(deps): update dependency linkedom to v0.18.2 ([d24818a](https://github.com/mx-space/core/commit/d24818a))
* fix(deps): update dependency mongoose to v8.4.1 ([e37c986](https://github.com/mx-space/core/commit/e37c986))
* fix(deps): update dependency openai to v4.47.3 ([7996928](https://github.com/mx-space/core/commit/7996928))
* chore(deps): update dependency @innei/prettier to v0.13.2 ([73dba57](https://github.com/mx-space/core/commit/73dba57))
* chore(deps): update dependency @langchain/core to v0.2.4 ([4ac0929](https://github.com/mx-space/core/commit/4ac0929))
* chore(deps): update dependency @langchain/core to v0.2.5 ([1f0b96e](https://github.com/mx-space/core/commit/1f0b96e))
* chore(deps): update dependency @swc/core to v1.5.24 ([6595371](https://github.com/mx-space/core/commit/6595371))
* chore(deps): update dependency @types/node to v20.12.14 ([bab8ab2](https://github.com/mx-space/core/commit/bab8ab2))
* chore(deps): update dependency @types/node to v20.13.0 ([12d30b2](https://github.com/mx-space/core/commit/12d30b2))
* chore(deps): update dependency eslint to v9.4.0 ([fba9a8b](https://github.com/mx-space/core/commit/fba9a8b))
* chore(deps): update dependency prettier to v3.3.0 ([650ffab](https://github.com/mx-space/core/commit/650ffab))
* chore(deps): update pnpm to v9.1.4 (#1745) ([5fd386a](https://github.com/mx-space/core/commit/5fd386a)), closes [#1745](https://github.com/mx-space/core/issues/1745)
* chore(deps): update pnpm/action-setup action to v4 (#1682) ([550cf16](https://github.com/mx-space/core/commit/550cf16)), closes [#1682](https://github.com/mx-space/core/issues/1682)

## 5.8.0 (2024-05-30)

* release: v5.8.0 ([9e35599](https://github.com/mx-space/core/commit/9e35599))
* chore(deps): update dependency @langchain/core to v0.2.2 ([c0ba40c](https://github.com/mx-space/core/commit/c0ba40c))
* chore(deps): update dependency @langchain/core to v0.2.3 ([0f7c416](https://github.com/mx-space/core/commit/0f7c416))
* chore(deps): update dependency @swc/core to v1.5.22 ([7222ddd](https://github.com/mx-space/core/commit/7222ddd))
* chore(deps): update dependency @types/node to v20.12.13 ([07891b8](https://github.com/mx-space/core/commit/07891b8))
* fix(deps): update dependency @langchain/openai to v0.0.34 (#1734) ([98ac7c0](https://github.com/mx-space/core/commit/98ac7c0)), closes [#1734](https://github.com/mx-space/core/issues/1734)
* fix(deps): update dependency isbot to v5.1.8 ([d83ad94](https://github.com/mx-space/core/commit/d83ad94))
* fix(deps): update dependency langchain to v0.2.2 ([f9e1f57](https://github.com/mx-space/core/commit/f9e1f57))
* fix(deps): update dependency langchain to v0.2.3 ([a574cb0](https://github.com/mx-space/core/commit/a574cb0))
* fix(deps): update dependency mongoose-paginate-v2 to v1.8.2 ([e2f1e49](https://github.com/mx-space/core/commit/e2f1e49))
* fix(deps): update dependency openai to v4.47.2 ([b4f7857](https://github.com/mx-space/core/commit/b4f7857))
* fix(deps): update dependency ua-parser-js to v1.0.38 ([254ee4c](https://github.com/mx-space/core/commit/254ee4c))
* refactor: ai langchain (#1732) ([a043cfa](https://github.com/mx-space/core/commit/a043cfa)), closes [#1732](https://github.com/mx-space/core/issues/1732)

## <small>5.7.12 (2024-05-28)</small>

* release: v5.7.12 ([b187cac](https://github.com/mx-space/core/commit/b187cac))
* chore: remove pnpm version ([919fe78](https://github.com/mx-space/core/commit/919fe78))
* chore: update logger package ([01f2f04](https://github.com/mx-space/core/commit/01f2f04))
* chore(deps): update dependency eslint-plugin-unused-imports to v4 ([4e8313a](https://github.com/mx-space/core/commit/4e8313a))
* chore(deps): update dependency lint-staged to v15.2.5 ([9896076](https://github.com/mx-space/core/commit/9896076))
* chore(deps): update pnpm to v9.1.3 ([fccaf36](https://github.com/mx-space/core/commit/fccaf36))
* fix: cache aggregate query with querykey ([32230bc](https://github.com/mx-space/core/commit/32230bc))
* fix(deps): update babel monorepo to v7.24.6 ([6881179](https://github.com/mx-space/core/commit/6881179))
* fix(deps): update dependency @aws-sdk/client-s3 to v3.583.0 (#1727) ([2874eca](https://github.com/mx-space/core/commit/2874eca)), closes [#1727](https://github.com/mx-space/core/issues/1727)
* ci: fix pnpm version ([d6416e8](https://github.com/mx-space/core/commit/d6416e8))

## <small>5.7.11 (2024-05-24)</small>

* release: v5.7.11 ([9ea18e3](https://github.com/mx-space/core/commit/9ea18e3))
* fix: get all link ([dbf7c24](https://github.com/mx-space/core/commit/dbf7c24))
* fix(deps): update dependency @aws-sdk/client-s3 to v3.582.0 (#1723) ([2efcbe8](https://github.com/mx-space/core/commit/2efcbe8)), closes [#1723](https://github.com/mx-space/core/issues/1723)
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.8 ([fc0d978](https://github.com/mx-space/core/commit/fc0d978))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.9 ([4cc19c2](https://github.com/mx-space/core/commit/4cc19c2))
* fix(deps): update dependency cache-manager to v5.5.3 ([d1b0097](https://github.com/mx-space/core/commit/d1b0097))
* fix(deps): update dependency isbot to v5.1.7 ([b6efc7b](https://github.com/mx-space/core/commit/b6efc7b))
* chore(deps): update dependency axios to v1.7.2 ([a5a352e](https://github.com/mx-space/core/commit/a5a352e))
* chore(deps): update dependency lint-staged to v15.2.4 ([f5f342c](https://github.com/mx-space/core/commit/f5f342c))
* chore(deps): update supercharge/mongodb-github-action action to v1.11.0 (#1722) ([2953873](https://github.com/mx-space/core/commit/2953873)), closes [#1722](https://github.com/mx-space/core/issues/1722)

## <small>5.7.10 (2024-05-22)</small>

* release: v5.7.10 ([4c66693](https://github.com/mx-space/core/commit/4c66693))
* fix: asset push script ([f433ae7](https://github.com/mx-space/core/commit/f433ae7))
* fix(deps): update dependency axios-retry to v4.3.0 (#1718) ([df4fc28](https://github.com/mx-space/core/commit/df4fc28)), closes [#1718](https://github.com/mx-space/core/issues/1718)
* chore: replace innei homepage ([cc41239](https://github.com/mx-space/core/commit/cc41239))

## <small>5.7.9 (2024-05-21)</small>

* release: v5.7.9 ([5a522c1](https://github.com/mx-space/core/commit/5a522c1))
* ci: remove pnpm version in action ([b268a21](https://github.com/mx-space/core/commit/b268a21))
* chore: update pnpm ([2edbcef](https://github.com/mx-space/core/commit/2edbcef))
* chore(deps): update dependency axios to v1.7.1 ([9fea042](https://github.com/mx-space/core/commit/9fea042))
* fix: comment model url setter ([16b919c](https://github.com/mx-space/core/commit/16b919c))

## <small>5.7.8 (2024-05-20)</small>

* release: v5.7.8 ([f3f8563](https://github.com/mx-space/core/commit/f3f8563))
* chore: add test case ([79caa5e](https://github.com/mx-space/core/commit/79caa5e))
* chore(deps): update dependency axios to v1.7.0 (#1716) ([908e449](https://github.com/mx-space/core/commit/908e449)), closes [#1716](https://github.com/mx-space/core/issues/1716)
* fix: downgrade snakecase deps ([66a07e6](https://github.com/mx-space/core/commit/66a07e6))
* fix(deps): update dependency @typegoose/auto-increment to v4.4.0 (#1714) ([a10dd5b](https://github.com/mx-space/core/commit/a10dd5b)), closes [#1714](https://github.com/mx-space/core/issues/1714)

## <small>5.7.7 (2024-05-20)</small>

* release: v5.7.7 ([ce22763](https://github.com/mx-space/core/commit/ce22763))
* chore: update deps ([58ff7af](https://github.com/mx-space/core/commit/58ff7af))
* chore(deps): update dependency @types/lodash to v4.17.4 ([aa6362e](https://github.com/mx-space/core/commit/aa6362e))
* chore(deps): update dependency eslint to v9.3.0 ([aaae31b](https://github.com/mx-space/core/commit/aaae31b))
* fix: throw error when delete file exception ([5da084d](https://github.com/mx-space/core/commit/5da084d))
* fix(deps): update dependency @aws-sdk/client-s3 to v3.577.0 (#1688) ([4d883ee](https://github.com/mx-space/core/commit/4d883ee)), closes [#1688](https://github.com/mx-space/core/issues/1688)
* fix(deps): update dependency commander to v12.1.0 (#1713) ([3c30c1f](https://github.com/mx-space/core/commit/3c30c1f)), closes [#1713](https://github.com/mx-space/core/issues/1713)
* fix(deps): update dependency inquirer to v9.2.22 ([43e6331](https://github.com/mx-space/core/commit/43e6331))
* fix(deps): update dependency linkedom to v0.18.0 (#1696) ([1d4ced1](https://github.com/mx-space/core/commit/1d4ced1)), closes [#1696](https://github.com/mx-space/core/issues/1696)
* fix(deps): update dependency mongoose to v8.4.0 (#1709) ([abb912b](https://github.com/mx-space/core/commit/abb912b)), closes [#1709](https://github.com/mx-space/core/issues/1709)

## <small>5.7.6 (2024-05-17)</small>

* release: v5.7.6 ([e5b1982](https://github.com/mx-space/core/commit/e5b1982))
* chore: add gpt-4o model ([47e4739](https://github.com/mx-space/core/commit/47e4739))
* chore(deps): update dependency @swc/core to v1.5.6 ([d62feaa](https://github.com/mx-space/core/commit/d62feaa))
* chore(deps): update dependency @swc/core to v1.5.7 ([c683753](https://github.com/mx-space/core/commit/c683753))
* chore(deps): update dependency @types/lodash to v4.17.3 ([77b6c6d](https://github.com/mx-space/core/commit/77b6c6d))
* chore(deps): update dependency @types/node to v20.12.12 ([e50a776](https://github.com/mx-space/core/commit/e50a776))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.6 ([289e3cd](https://github.com/mx-space/core/commit/289e3cd))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.7 ([06c0050](https://github.com/mx-space/core/commit/06c0050))
* fix(deps): update dependency axios-retry to v4.2.0 (#1705) ([9f20ba2](https://github.com/mx-space/core/commit/9f20ba2)), closes [#1705](https://github.com/mx-space/core/issues/1705)
* fix(deps): update dependency inquirer to v9.2.21 ([57ece57](https://github.com/mx-space/core/commit/57ece57))
* fix(deps): update dependency mongoose to v8.3.5 ([eea7608](https://github.com/mx-space/core/commit/eea7608))
* fix(deps): update dependency mongoose-paginate-v2 to v1.8.1 (#1708) ([0aef6e0](https://github.com/mx-space/core/commit/0aef6e0)), closes [#1708](https://github.com/mx-space/core/issues/1708)
* fix(deps): update dependency openai to v4.47.1 (#1676) ([8892442](https://github.com/mx-space/core/commit/8892442)), closes [#1676](https://github.com/mx-space/core/issues/1676)

## <small>5.7.5 (2024-05-13)</small>

* release: v5.7.5 ([10b66e6](https://github.com/mx-space/core/commit/10b66e6))
* chore: docker image improvements (#1692) ([67bf187](https://github.com/mx-space/core/commit/67bf187)), closes [#1692](https://github.com/mx-space/core/issues/1692)
* chore(deps): update dependency @types/validator to v13.11.10 ([c5f20b5](https://github.com/mx-space/core/commit/c5f20b5))
* chore(deps): update dependency rimraf to v5.0.7 ([cdb5b26](https://github.com/mx-space/core/commit/cdb5b26))
* chore(deps): update pnpm to v9.1.1 ([81684fa](https://github.com/mx-space/core/commit/81684fa))
* fix: docker test in CI failed (#1695) ([33e86c8](https://github.com/mx-space/core/commit/33e86c8)), closes [#1695](https://github.com/mx-space/core/issues/1695)

## <small>5.7.4 (2024-05-11)</small>

* release: v5.7.4 ([9849cfb](https://github.com/mx-space/core/commit/9849cfb))
* fix: jud is array or object ([5fd79a8](https://github.com/mx-space/core/commit/5fd79a8))
* fix: passkey origin ([b2fc18d](https://github.com/mx-space/core/commit/b2fc18d))
* chore(release): bump @mx-space/api-client to v1.13.1 ([0858ba1](https://github.com/mx-space/core/commit/0858ba1))

## <small>5.7.3 (2024-05-11)</small>

* release: v5.7.3 ([c6bf7b7](https://github.com/mx-space/core/commit/c6bf7b7))
* fix: lru cache set ([6125030](https://github.com/mx-space/core/commit/6125030))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.4 ([0e69856](https://github.com/mx-space/core/commit/0e69856))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.5 ([30a8548](https://github.com/mx-space/core/commit/30a8548))
* fix(deps): update dependency @fastify/static to v7.0.4 ([30e72f1](https://github.com/mx-space/core/commit/30e72f1))
* fix(deps): update dependency mongoose to v8.3.4 ([b50e7ef](https://github.com/mx-space/core/commit/b50e7ef))
* chore(deps): update dependency @swc/core to v1.5.3 ([a27172f](https://github.com/mx-space/core/commit/a27172f))
* chore(deps): update dependency @swc/core to v1.5.5 ([5e469d1](https://github.com/mx-space/core/commit/5e469d1))
* chore(deps): update dependency @types/node to v20.12.10 ([6012dc7](https://github.com/mx-space/core/commit/6012dc7))
* chore(deps): update dependency @types/node to v20.12.11 ([3a8a69e](https://github.com/mx-space/core/commit/3a8a69e))
* chore(deps): update dependency rimraf to v5.0.6 ([32441e1](https://github.com/mx-space/core/commit/32441e1))
* chore(deps): update dependency semver to v7.6.1 ([3d075ef](https://github.com/mx-space/core/commit/3d075ef))
* chore(deps): update dependency semver to v7.6.2 ([c2d3b83](https://github.com/mx-space/core/commit/c2d3b83))
* feat: add bark push settings ([784c6cd](https://github.com/mx-space/core/commit/784c6cd))
* feat: add prod to dump memory ([5fc7fcd](https://github.com/mx-space/core/commit/5fc7fcd))

## <small>5.7.2 (2024-05-07)</small>

* release: v5.7.2 ([3f2f36a](https://github.com/mx-space/core/commit/3f2f36a))
* chore: fix backup description (#1675) ([6dd8fda](https://github.com/mx-space/core/commit/6dd8fda)), closes [#1675](https://github.com/mx-space/core/issues/1675)
* chore: inscrease throttle limit ([ca35668](https://github.com/mx-space/core/commit/ca35668))
* chore: upgrade pnpm ([019b519](https://github.com/mx-space/core/commit/019b519))
* chore(deps): update dependency @sxzz/eslint-config to v3.11.0 (#1672) ([ad8ccbf](https://github.com/mx-space/core/commit/ad8ccbf)), closes [#1672](https://github.com/mx-space/core/issues/1672)
* fix: bypass `OPTIONS` ([1a85d54](https://github.com/mx-space/core/commit/1a85d54))
* fix(deps): update dependency @aws-sdk/client-s3 to v3.569.0 (#1651) ([7c56488](https://github.com/mx-space/core/commit/7c56488)), closes [#1651](https://github.com/mx-space/core/issues/1651)
* fix(deps): update dependency openai to v4.40.2 (#1667) ([ed153a8](https://github.com/mx-space/core/commit/ed153a8)), closes [#1667](https://github.com/mx-space/core/issues/1667)

## <small>5.7.1 (2024-05-04)</small>

* release: v5.7.1 ([15ce925](https://github.com/mx-space/core/commit/15ce925))
* fix: need auth to generate ai content ([ef85afe](https://github.com/mx-space/core/commit/ef85afe))

## 5.7.0 (2024-05-04)

* release: v5.7.0 ([9933ab9](https://github.com/mx-space/core/commit/9933ab9))
* chore: import as tye ([949853d](https://github.com/mx-space/core/commit/949853d))
* chore(deps): update dependency @types/lodash to v4.17.1 ([d0225fe](https://github.com/mx-space/core/commit/d0225fe))
* chore(deps): update dependency eslint to v9.2.0 ([6278fec](https://github.com/mx-space/core/commit/6278fec))
* chore(release): bump @mx-space/api-client to v1.13.0 ([02cbd02](https://github.com/mx-space/core/commit/02cbd02))
* feat: ai writer helper module ([f8909bd](https://github.com/mx-space/core/commit/f8909bd))

## <small>5.6.7 (2024-05-03)</small>

* release: v5.6.7 ([e293118](https://github.com/mx-space/core/commit/e293118))
* fix: handle deleted content in get like data ([911640b](https://github.com/mx-space/core/commit/911640b))

## <small>5.6.6 (2024-05-03)</small>

* release: v5.6.6 ([0ab422b](https://github.com/mx-space/core/commit/0ab422b))
* fix: add logger info ([bed1997](https://github.com/mx-space/core/commit/bed1997))
* fix: ai summarize ([1707c01](https://github.com/mx-space/core/commit/1707c01))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.3 ([0b63c0b](https://github.com/mx-space/core/commit/0b63c0b))
* chore(deps): update dependency @types/node to v20.12.8 ([768a4be](https://github.com/mx-space/core/commit/768a4be))
* chore(deps): update dependency @types/nodemailer to v6.4.15 ([5ddabf2](https://github.com/mx-space/core/commit/5ddabf2))

## <small>5.6.5 (2024-05-01)</small>

* release: v5.6.5 ([4865c50](https://github.com/mx-space/core/commit/4865c50))
* fix: make throttle config ([4543459](https://github.com/mx-space/core/commit/4543459))
* fix: summary language detect logic ([90e5a6b](https://github.com/mx-space/core/commit/90e5a6b))
* fix(deps): update dependency cache-manager to v5.5.2 (#1659) ([88a80b0](https://github.com/mx-space/core/commit/88a80b0)), closes [#1659](https://github.com/mx-space/core/issues/1659)
* fix(deps): update dependency mongoose-lean-getters to v2.1.0 (#1656) ([f1190e2](https://github.com/mx-space/core/commit/f1190e2)), closes [#1656](https://github.com/mx-space/core/issues/1656)
* fix(deps): update dependency openai to v4.39.1 ([7bc272e](https://github.com/mx-space/core/commit/7bc272e))
* chore(deps): update dependency eslint-plugin-unused-imports to v3.2.0 ([6b0b477](https://github.com/mx-space/core/commit/6b0b477))

## <small>5.6.4 (2024-04-30)</small>

* release: v5.6.4 ([957ba84](https://github.com/mx-space/core/commit/957ba84))
* fix: download asset script ([ee92d48](https://github.com/mx-space/core/commit/ee92d48))
* fix: increase throttler ([eb95be1](https://github.com/mx-space/core/commit/eb95be1))
* fix: lint ([1ff8015](https://github.com/mx-space/core/commit/1ff8015))
* fix: lint ([358a5e6](https://github.com/mx-space/core/commit/358a5e6))
* fix: lint error ([c6980f9](https://github.com/mx-space/core/commit/c6980f9))
* fix: testing ([f74ef93](https://github.com/mx-space/core/commit/f74ef93))
* fix(deps): update babel monorepo to v7.24.5 (#1661) ([6a4a2dc](https://github.com/mx-space/core/commit/6a4a2dc)), closes [#1661](https://github.com/mx-space/core/issues/1661)
* fix(deps): update dependency cache-manager-ioredis-yet to v2.0.4 (#1660) ([cb4d2f0](https://github.com/mx-space/core/commit/cb4d2f0)), closes [#1660](https://github.com/mx-space/core/issues/1660)
* fix(deps): update dependency dayjs to v1.11.11 ([bd6cec5](https://github.com/mx-space/core/commit/bd6cec5))
* fix(deps): update dependency isbot to v5.1.6 (#1662) ([2b5a901](https://github.com/mx-space/core/commit/2b5a901)), closes [#1662](https://github.com/mx-space/core/issues/1662)
* fix(deps): update dependency lru-cache to v10.2.2 ([0adbd37](https://github.com/mx-space/core/commit/0adbd37))
* fix(deps): update dependency mongoose to v8.3.3 (#1663) ([dcff2bd](https://github.com/mx-space/core/commit/dcff2bd)), closes [#1663](https://github.com/mx-space/core/issues/1663)
* fix(deps): update dependency openai to v4.39.0 (#1664) ([13c26c1](https://github.com/mx-space/core/commit/13c26c1)), closes [#1664](https://github.com/mx-space/core/issues/1664)
* chore: lint with sxzz config ([e5ac04a](https://github.com/mx-space/core/commit/e5ac04a))
* chore: sxzz eslint ([c12bd99](https://github.com/mx-space/core/commit/c12bd99))
* chore(deps): update dependency @swc/core to v1.5.2 ([092aadf](https://github.com/mx-space/core/commit/092aadf))
* chore(deps): update dependency mongodb-memory-server to v9.2.0 (#1637) ([9432f4c](https://github.com/mx-space/core/commit/9432f4c)), closes [#1637](https://github.com/mx-space/core/issues/1637)

## <small>5.6.3 (2024-04-27)</small>

* release: v5.6.3 ([56e7bb3](https://github.com/mx-space/core/commit/56e7bb3))
* chore(release): bump @mx-space/api-client to v1.12.1 ([eee632c](https://github.com/mx-space/core/commit/eee632c))
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.2 ([608e470](https://github.com/mx-space/core/commit/608e470))
* fix(deps): update dependency inquirer to v9.2.20 ([3fd3070](https://github.com/mx-space/core/commit/3fd3070))
* fix(deps): update dependency isbot to v5.1.5 ([0e741f6](https://github.com/mx-space/core/commit/0e741f6))
* fix(deps): update dependency lru-cache to v10.2.1 ([53fef99](https://github.com/mx-space/core/commit/53fef99))
* feat: add `getLastYearPublication` api ([5a028c8](https://github.com/mx-space/core/commit/5a028c8))

## <small>5.6.2 (2024-04-26)</small>

* release: v5.6.2 ([c0d1b32](https://github.com/mx-space/core/commit/c0d1b32))
* chore: encryption and exclusion logic in configs.dto.ts ([a5483d9](https://github.com/mx-space/core/commit/a5483d9))
* fix: ai throw ([afdb6b7](https://github.com/mx-space/core/commit/afdb6b7))

## <small>5.6.1 (2024-04-26)</small>

* release: v5.6.1 ([ab2d3fd](https://github.com/mx-space/core/commit/ab2d3fd))
* chore: delete test in release ([ce397a7](https://github.com/mx-space/core/commit/ce397a7))

## 5.6.0 (2024-04-26)

* release: v5.6.0 ([fd3d8ec](https://github.com/mx-space/core/commit/fd3d8ec))
* chore: try fix vitest ([467ba31](https://github.com/mx-space/core/commit/467ba31))
* chore: upgrade pnpm ([5f94339](https://github.com/mx-space/core/commit/5f94339))
* chore(release): bump @mx-space/api-client to v1.11.2 ([d78a359](https://github.com/mx-space/core/commit/d78a359))
* chore(release): bump @mx-space/api-client to v1.12.0 ([cdb51e2](https://github.com/mx-space/core/commit/cdb51e2))
* fix: pass `truncate` ([924e7e4](https://github.com/mx-space/core/commit/924e7e4))
* fix: throw error when ai disabled ([786a399](https://github.com/mx-space/core/commit/786a399))
* feat: ai module (#1649) ([c989a2a](https://github.com/mx-space/core/commit/c989a2a)), closes [#1649](https://github.com/mx-space/core/issues/1649)

## <small>5.5.7 (2024-04-25)</small>

* release: v5.5.7 ([5ea551f](https://github.com/mx-space/core/commit/5ea551f))
* chore: update clerk ([99ecd3c](https://github.com/mx-space/core/commit/99ecd3c))
* chore: update readme ([3cc24dd](https://github.com/mx-space/core/commit/3cc24dd))
* chore(deps-dev): bump vite from 5.1.6 to 5.1.7 (#1586) ([0408618](https://github.com/mx-space/core/commit/0408618)), closes [#1586](https://github.com/mx-space/core/issues/1586)
* chore(deps): update dependency @swc/core to v1.4.17 ([179267c](https://github.com/mx-space/core/commit/179267c))
* chore(deps): update dependency @swc/core to v1.5.0 (#1642) ([dbe5d94](https://github.com/mx-space/core/commit/dbe5d94)), closes [#1642](https://github.com/mx-space/core/issues/1642)
* chore(deps): update dependency mongodb-memory-server to v9.2.0 (#1636) ([357290c](https://github.com/mx-space/core/commit/357290c)), closes [#1636](https://github.com/mx-space/core/issues/1636)
* chore(release): bump @mx-space/api-client to v1.11.1 ([f133c1f](https://github.com/mx-space/core/commit/f133c1f))
* fix: custom mongo connection string ([62243e8](https://github.com/mx-space/core/commit/62243e8))
* fix: delete regexp cache key ([f25f618](https://github.com/mx-space/core/commit/f25f618))
* fix: extends parent `isWhispers` ([d11382b](https://github.com/mx-space/core/commit/d11382b))
* fix: file trash ([9c3394c](https://github.com/mx-space/core/commit/9c3394c))
* fix: filter markdown video href ([52c344d](https://github.com/mx-space/core/commit/52c344d))
* fix: update docker-run.sh (#1643) ([21e84b1](https://github.com/mx-space/core/commit/21e84b1)), closes [#1643](https://github.com/mx-space/core/issues/1643)
* fix(deps): update dependency @clerk/clerk-sdk-node to v5.0.1 ([03c5bab](https://github.com/mx-space/core/commit/03c5bab))
* feat: add `truncate` for post list ([45e7cf8](https://github.com/mx-space/core/commit/45e7cf8))

## <small>5.5.6 (2024-04-22)</small>

* release: v5.5.6 ([6cb518e](https://github.com/mx-space/core/commit/6cb518e))
* fix: bypass options preflight ([845b307](https://github.com/mx-space/core/commit/845b307))
* fix: comment email link url ([0fd8fbf](https://github.com/mx-space/core/commit/0fd8fbf))

## <small>5.5.5 (2024-04-20)</small>

* release: v5.5.5 ([1789354](https://github.com/mx-space/core/commit/1789354))
* fix: logger ([e66e49a](https://github.com/mx-space/core/commit/e66e49a))
* fix: s3 region ([e18ce0d](https://github.com/mx-space/core/commit/e18ce0d))
* fix(deps): update dependency @typegoose/auto-increment to v4.3.0 (#1614) ([ab4cf31](https://github.com/mx-space/core/commit/ab4cf31)), closes [#1614](https://github.com/mx-space/core/issues/1614)
* chore(deps): update dependency ioredis to v5.4.1 (#1628) ([6462d75](https://github.com/mx-space/core/commit/6462d75)), closes [#1628](https://github.com/mx-space/core/issues/1628)
* feat: backup support s3 ([9dc3fbd](https://github.com/mx-space/core/commit/9dc3fbd))

## <small>5.5.4 (2024-04-20)</small>

* release: v5.5.4 ([bbfc557](https://github.com/mx-space/core/commit/bbfc557))
* fix: setup route jump #1619 ([e24b70d](https://github.com/mx-space/core/commit/e24b70d)), closes [#1619](https://github.com/mx-space/core/issues/1619)
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.15 ([c9971a9](https://github.com/mx-space/core/commit/c9971a9))
* fix(deps): update dependency marked to v12.0.2 ([abe48df](https://github.com/mx-space/core/commit/abe48df))
* fix(deps): update nest monorepo to v10.3.8 ([8e56dcd](https://github.com/mx-space/core/commit/8e56dcd))
* chore(deps): update dependency @swc/core to v1.4.15 ([48f25e2](https://github.com/mx-space/core/commit/48f25e2))
* chore(deps): update dependency @swc/core to v1.4.16 ([8d7c57b](https://github.com/mx-space/core/commit/8d7c57b))

## <small>5.5.3 (2024-04-17)</small>

* release: v5.5.3 ([b7037cc](https://github.com/mx-space/core/commit/b7037cc))
* fix: check activity ref type ([9c89987](https://github.com/mx-space/core/commit/9c89987))
* fix: comment filter ([ec58221](https://github.com/mx-space/core/commit/ec58221))
* fix(activity): filter comment state ([73abe9c](https://github.com/mx-space/core/commit/73abe9c))

## <small>5.5.2 (2024-04-17)</small>

* release: v5.5.2 ([e7849c8](https://github.com/mx-space/core/commit/e7849c8))
* chore: add 429 path info ([bff8f50](https://github.com/mx-space/core/commit/bff8f50))
* chore: add zx to ignore deps ([528b96e](https://github.com/mx-space/core/commit/528b96e))
* chore(deps): update dependency @swc/core to v1.4.14 ([8f9523d](https://github.com/mx-space/core/commit/8f9523d))
* chore(deps): update dependency @types/qs to v6.9.15 ([596da7f](https://github.com/mx-space/core/commit/596da7f))
* fix: filter hide note ([29e3ba5](https://github.com/mx-space/core/commit/29e3ba5))
* fix: user collection name ([85ca2f6](https://github.com/mx-space/core/commit/85ca2f6))
* fix(deps): update dependency @nestjs/schedule to v4.0.2 ([debacce](https://github.com/mx-space/core/commit/debacce))
* fix(deps): update dependency @typegoose/typegoose to v12.3.1 ([fb39902](https://github.com/mx-space/core/commit/fb39902))
* fix(deps): update dependency inquirer to v9.2.19 ([7cff84f](https://github.com/mx-space/core/commit/7cff84f))
* fix(deps): update dependency mongoose to v8.3.2 ([17e796f](https://github.com/mx-space/core/commit/17e796f))

## <small>5.5.1 (2024-04-14)</small>

* release: v5.5.1 ([eb012f3](https://github.com/mx-space/core/commit/eb012f3))
* chore: disable eslint upgrade ([fb6956a](https://github.com/mx-space/core/commit/fb6956a))
* chore(deps): update dependency eslint to v9 (#1598) ([08ffd06](https://github.com/mx-space/core/commit/08ffd06)), closes [#1598](https://github.com/mx-space/core/issues/1598)
* chore(deps): update pnpm to v8.15.7 ([14e0495](https://github.com/mx-space/core/commit/14e0495))
* feat: add recent notification api ([1111b96](https://github.com/mx-space/core/commit/1111b96))

## 5.5.0 (2024-04-13)

* release: v5.5.0 ([e042ed1](https://github.com/mx-space/core/commit/e042ed1))
* chore(deps): update dependency @innei/eslint-config-ts to v0.13.1 ([0078e18](https://github.com/mx-space/core/commit/0078e18))
* chore(deps): update dependency @innei/prettier to v0.13.1 ([791f3b3](https://github.com/mx-space/core/commit/791f3b3))
* chore(release): bump @mx-space/api-client to v1.11.0 ([8a4e335](https://github.com/mx-space/core/commit/8a4e335))
* chore(release): bump @mx-space/api-client to v1.11.0-alpha.0 ([0d1a680](https://github.com/mx-space/core/commit/0d1a680))
* fix: add some field ([903aa30](https://github.com/mx-space/core/commit/903aa30))
* fix(deps): update dependency ejs to v3.1.10 ([0963d50](https://github.com/mx-space/core/commit/0963d50))
* fix(deps): update dependency inquirer to v9.2.18 ([064ec68](https://github.com/mx-space/core/commit/064ec68))
* fix(deps): update dependency qs to v6.12.1 ([8d170ed](https://github.com/mx-space/core/commit/8d170ed))
* feat: add recent activity api ([b4726ad](https://github.com/mx-space/core/commit/b4726ad))

## <small>5.4.10 (2024-04-11)</small>

* release: v5.4.10 ([1ca3dc3](https://github.com/mx-space/core/commit/1ca3dc3))
* chore(release): bump @mx-space/api-client to v1.10.1 ([4539afe](https://github.com/mx-space/core/commit/4539afe))
* fix: add `hide` for note list api ([5a2b2de](https://github.com/mx-space/core/commit/5a2b2de))

## <small>5.4.9 (2024-04-11)</small>

* release: v5.4.9 ([5b4f108](https://github.com/mx-space/core/commit/5b4f108))
* fix: skip cache if request is authenticated ([70d9b69](https://github.com/mx-space/core/commit/70d9b69))
* fix(deps): update algoliasearch-client-javascript monorepo to v4.23.3 ([39bb8ce](https://github.com/mx-space/core/commit/39bb8ce))
* fix(deps): update dependency @typegoose/typegoose to v12.3.0 (#1601) ([a77bb04](https://github.com/mx-space/core/commit/a77bb04)), closes [#1601](https://github.com/mx-space/core/issues/1601)
* chore(deps): update robinraju/release-downloader action to v1.10 (#1609) ([b86dccf](https://github.com/mx-space/core/commit/b86dccf)), closes [#1609](https://github.com/mx-space/core/issues/1609)

## <small>5.4.8 (2024-04-11)</small>

* release: v5.4.8 ([64a34bb](https://github.com/mx-space/core/commit/64a34bb))
* fix: server time response ([ac918dc](https://github.com/mx-space/core/commit/ac918dc))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.14 ([70b76c7](https://github.com/mx-space/core/commit/70b76c7))
* fix(deps): update dependency mongoose to v8.3.1 ([a433fc5](https://github.com/mx-space/core/commit/a433fc5))
* chore(deps): update dependency @swc/core to v1.4.13 ([126b154](https://github.com/mx-space/core/commit/126b154))
* chore(deps): update dependency @types/node to v20.12.6 ([0fc6228](https://github.com/mx-space/core/commit/0fc6228))
* chore(deps): update dependency @types/node to v20.12.7 ([083e0c9](https://github.com/mx-space/core/commit/083e0c9))
* chore(deps): update dependency cron to v3.1.7 ([743a30a](https://github.com/mx-space/core/commit/743a30a))
* chore(deps): update dependency nanoid to v5.0.7 ([2a9c8d7](https://github.com/mx-space/core/commit/2a9c8d7))
* chore(deps): update dependency typescript to v5.4.5 ([59f0c88](https://github.com/mx-space/core/commit/59f0c88))
* chore(deps): update dependency unplugin-swc to v1.4.5 ([b6ddb7c](https://github.com/mx-space/core/commit/b6ddb7c))

## <small>5.4.7 (2024-04-06)</small>

* release: v5.4.7 ([10b7778](https://github.com/mx-space/core/commit/10b7778))
* fix: downgrade snakecase ([64e2dbf](https://github.com/mx-space/core/commit/64e2dbf))
* fix: downgrade snakecase ([f3a0d06](https://github.com/mx-space/core/commit/f3a0d06))

## <small>5.4.6 (2024-04-06)</small>

* release: v5.4.6 ([f973413](https://github.com/mx-space/core/commit/f973413))
* chore(deps): update dependency @innei/eslint-config-ts to v0.13.0 (#1563) ([9a0cc82](https://github.com/mx-space/core/commit/9a0cc82)), closes [#1563](https://github.com/mx-space/core/issues/1563)
* chore(deps): update dependency @swc/core to v1.4.12 ([ca61de6](https://github.com/mx-space/core/commit/ca61de6))
* chore(deps): update dependency @types/node to v20.12.4 ([c80ea6f](https://github.com/mx-space/core/commit/c80ea6f))
* chore(deps): update dependency @types/node to v20.12.5 ([5e4ad8d](https://github.com/mx-space/core/commit/5e4ad8d))
* chore(deps): update dependency typescript to v5.4.4 ([3215eac](https://github.com/mx-space/core/commit/3215eac))
* chore(release): bump @mx-space/api-client to v1.10.0 ([9ba515c](https://github.com/mx-space/core/commit/9ba515c))
* fix: update test snap ([45ae1f8](https://github.com/mx-space/core/commit/45ae1f8))
* fix(deps): update babel monorepo to v7.24.4 ([6a9e78b](https://github.com/mx-space/core/commit/6a9e78b))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.13 ([0288c79](https://github.com/mx-space/core/commit/0288c79))
* fix(deps): update dependency @fastify/static to v7.0.3 ([12da98f](https://github.com/mx-space/core/commit/12da98f))
* fix(deps): update dependency cache-manager to v5.5.0 (#1594) ([e1e6cdb](https://github.com/mx-space/core/commit/e1e6cdb)), closes [#1594](https://github.com/mx-space/core/issues/1594)
* fix(deps): update dependency cache-manager to v5.5.1 ([9bdce4b](https://github.com/mx-space/core/commit/9bdce4b))
* fix(deps): update dependency cache-manager-ioredis-yet to v2.0.3 ([0e41674](https://github.com/mx-space/core/commit/0e41674))
* fix(deps): update dependency mongoose to v8.3.0 (#1588) ([2207510](https://github.com/mx-space/core/commit/2207510)), closes [#1588](https://github.com/mx-space/core/issues/1588)
* fix(deps): update dependency snakecase-keys to v7 (#1566) ([69cd144](https://github.com/mx-space/core/commit/69cd144)), closes [#1566](https://github.com/mx-space/core/issues/1566)
* chore!: remove note music deprecated field ([04c749d](https://github.com/mx-space/core/commit/04c749d))
* feat(markdown): export with meta json ([ef4d639](https://github.com/mx-space/core/commit/ef4d639))

## <small>5.4.5 (2024-04-03)</small>

* release: v5.4.5 ([e3beae0](https://github.com/mx-space/core/commit/e3beae0))
* chore(deps): update dependency @types/node to v20.12.2 ([cb347db](https://github.com/mx-space/core/commit/cb347db))
* chore(deps): update dependency @types/node to v20.12.3 ([1151021](https://github.com/mx-space/core/commit/1151021))
* chore(deps): update pnpm to v8.15.6 ([c719880](https://github.com/mx-space/core/commit/c719880))
* chore(release): bump @mx-space/api-client to v1.9.0 ([03a1dc6](https://github.com/mx-space/core/commit/03a1dc6))
* feat: add get one recently api ([97f10b4](https://github.com/mx-space/core/commit/97f10b4))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.12 ([f2e9a5b](https://github.com/mx-space/core/commit/f2e9a5b))
* fix(deps): update dependency @fastify/static to v7.0.2 ([0ad5a14](https://github.com/mx-space/core/commit/0ad5a14))
* fix(deps): update dependency inquirer to v9.2.17 ([3fb381a](https://github.com/mx-space/core/commit/3fb381a))
* fix(deps): update dependency isbot to v5.1.3 ([d9f92b8](https://github.com/mx-space/core/commit/d9f92b8))
* fix(deps): update dependency isbot to v5.1.4 ([ec8c62a](https://github.com/mx-space/core/commit/ec8c62a))

## <small>5.4.4 (2024-03-29)</small>

* release: v5.4.4 ([8ddba09](https://github.com/mx-space/core/commit/8ddba09))
* fix: server time cors ([fd121cc](https://github.com/mx-space/core/commit/fd121cc))
* fix(api-client): bypass ts property ([d0f7c2d](https://github.com/mx-space/core/commit/d0f7c2d))
* chore(release): bump @mx-space/api-client to v1.8.1 ([30afb0c](https://github.com/mx-space/core/commit/30afb0c))

## <small>5.4.3 (2024-03-29)</small>

* release: v5.4.3 ([6a6b3c9](https://github.com/mx-space/core/commit/6a6b3c9))
* fix(deps): update dependency mongoose to v8.2.4 ([ef58bcf](https://github.com/mx-space/core/commit/ef58bcf))
* fix(deps): update dependency reflect-metadata to v0.2.2 ([6c174f5](https://github.com/mx-space/core/commit/6c174f5))
* chore(deps): update dependency mongodb-memory-server to v9.1.8 ([3aa61a0](https://github.com/mx-space/core/commit/3aa61a0))
* chore(deps): update dependency mongodb-memory-server to v9.1.8 ([87de5c9](https://github.com/mx-space/core/commit/87de5c9))

## <small>5.4.2 (2024-03-28)</small>

* release: v5.4.2 ([08f5510](https://github.com/mx-space/core/commit/08f5510))
* fix: bypass presence data morph ([04264c1](https://github.com/mx-space/core/commit/04264c1))
* fix(deps): update algoliasearch-client-javascript monorepo to v4.23.2 (#1568) ([0b06eb6](https://github.com/mx-space/core/commit/0b06eb6)), closes [#1568](https://github.com/mx-space/core/issues/1568)
* fix(deps): update nest monorepo to v10.3.6 (patch) (#1569) ([9d602ce](https://github.com/mx-space/core/commit/9d602ce)), closes [#1569](https://github.com/mx-space/core/issues/1569)
* fix(deps): update nest monorepo to v10.3.7 (patch) (#1570) ([91693d1](https://github.com/mx-space/core/commit/91693d1)), closes [#1570](https://github.com/mx-space/core/issues/1570)
* chore(deps): update dependency @innei/prettier to v0.13.0 (#1565) ([1417411](https://github.com/mx-space/core/commit/1417411)), closes [#1565](https://github.com/mx-space/core/issues/1565)

## <small>5.4.1 (2024-03-27)</small>

* release: v5.4.1 ([355fe62](https://github.com/mx-space/core/commit/355fe62))
* fix: join room at ([4917076](https://github.com/mx-space/core/commit/4917076))
* fix(deps): update dependency @nestjs/cache-manager to v2.2.2 ([ba0c673](https://github.com/mx-space/core/commit/ba0c673))
* fix(deps): update dependency linkedom to v0.16.11 ([30a425e](https://github.com/mx-space/core/commit/30a425e))
* chore: nginx conf ([346005c](https://github.com/mx-space/core/commit/346005c))
* chore(deps): update dependency @swc/core to v1.4.11 ([3febafa](https://github.com/mx-space/core/commit/3febafa))
* chore(deps): update dependency express to v4.19.2 ([ba9c1e4](https://github.com/mx-space/core/commit/ba9c1e4))

## 5.4.0 (2024-03-24)

* release: v5.4.0 ([befa6df](https://github.com/mx-space/core/commit/befa6df))
* feat: pass `isAuthenticated` to function call ([74ddc15](https://github.com/mx-space/core/commit/74ddc15))
* chore: rename a decorate ([cd491b3](https://github.com/mx-space/core/commit/cd491b3))

## <small>5.3.4 (2024-03-24)</small>

* release: v5.3.4 ([d8cebb0](https://github.com/mx-space/core/commit/d8cebb0))
* chore: update readme ([7d02ad1](https://github.com/mx-space/core/commit/7d02ad1))

## <small>5.3.3 (2024-03-23)</small>

* release: v5.3.3 ([01e3dfd](https://github.com/mx-space/core/commit/01e3dfd))
* feat: add other filed for search service ([8cc2d8f](https://github.com/mx-space/core/commit/8cc2d8f))
* feat: custom get response data ([1d1e3c5](https://github.com/mx-space/core/commit/1d1e3c5))
* fix: serverless update ([4776de6](https://github.com/mx-space/core/commit/4776de6))
* fix(deps): update dependency @babel/core to v7.24.3 ([05c5736](https://github.com/mx-space/core/commit/05c5736))
* fix(deps): update dependency @fastify/multipart to v8.2.0 (#1556) ([cae212f](https://github.com/mx-space/core/commit/cae212f)), closes [#1556](https://github.com/mx-space/core/issues/1556)
* fix(deps): update dependency axios-retry to v4.1.0 (#1550) ([a25e02a](https://github.com/mx-space/core/commit/a25e02a)), closes [#1550](https://github.com/mx-space/core/issues/1550)
* fix(deps): update dependency mongoose to v8.2.3 ([9537402](https://github.com/mx-space/core/commit/9537402))
* fix(deps): update dependency nodemailer to v6.9.13 ([fddb6e8](https://github.com/mx-space/core/commit/fddb6e8))
* fix(deps): update nest monorepo to v10.3.5 ([3f0a330](https://github.com/mx-space/core/commit/3f0a330))
* chore: export typings ([a0e3aa5](https://github.com/mx-space/core/commit/a0e3aa5))
* chore(deps): update dependency @innei/eslint-config-ts to v0.12.6 ([d1492ad](https://github.com/mx-space/core/commit/d1492ad))
* chore(deps): update dependency @innei/prettier to v0.12.6 (#1558) ([3170335](https://github.com/mx-space/core/commit/3170335)), closes [#1558](https://github.com/mx-space/core/issues/1558)
* chore(deps): update dependency @types/node to v20.11.30 ([b2666cc](https://github.com/mx-space/core/commit/b2666cc))
* chore(deps): update dependency @types/qs to v6.9.14 ([8cc099c](https://github.com/mx-space/core/commit/8cc099c))
* chore(deps): update dependency express to v4.19.1 (#1555) ([4fa8835](https://github.com/mx-space/core/commit/4fa8835)), closes [#1555](https://github.com/mx-space/core/issues/1555)
* chore(deps): update dependency typescript to v5.4.3 ([068076b](https://github.com/mx-space/core/commit/068076b))
* chore(release): bump @mx-space/api-client to v1.8.0 ([6a378b8](https://github.com/mx-space/core/commit/6a378b8))
* chore(release): bump @mx-space/api-client to v1.8.1-alpha.0 ([0a19970](https://github.com/mx-space/core/commit/0a19970))
* chore(release): bump @mx-space/webhook to v0.3.0 ([6fd5fba](https://github.com/mx-space/core/commit/6fd5fba))

## <small>5.3.2 (2024-03-19)</small>

* release: v5.3.2 ([cb62655](https://github.com/mx-space/core/commit/cb62655))
* chore: update deps ([68dcd91](https://github.com/mx-space/core/commit/68dcd91))
* chore(deps): update dependency @types/node to v20.11.29 ([6c9e3d1](https://github.com/mx-space/core/commit/6c9e3d1))
* chore(deps): update dependency @types/qs to v6.9.13 ([043260d](https://github.com/mx-space/core/commit/043260d))
* fix: remove only boardcast gateway room in post and note ([2e0c919](https://github.com/mx-space/core/commit/2e0c919))
* fix(deps): update dependency isbot to v5.1.2 ([10aed09](https://github.com/mx-space/core/commit/10aed09))
* fix(deps): update nest monorepo to v10.3.4 (patch) (#1544) ([c37ca86](https://github.com/mx-space/core/commit/c37ca86)), closes [#1544](https://github.com/mx-space/core/issues/1544)

## <small>5.3.1 (2024-03-18)</small>

* release: v5.3.1 ([94269b5](https://github.com/mx-space/core/commit/94269b5))
* fix: downgrade vitest ([46a098c](https://github.com/mx-space/core/commit/46a098c))

## 5.3.0 (2024-03-18)

* release: v5.3.0 ([4c14818](https://github.com/mx-space/core/commit/4c14818))
* feat: ws type read cunt ([310480f](https://github.com/mx-space/core/commit/310480f))
* chore(deps): update dependency @swc/core to v1.4.8 ([0106399](https://github.com/mx-space/core/commit/0106399))
* chore(deps): update dependency @types/node to v20.11.28 ([02a6c22](https://github.com/mx-space/core/commit/02a6c22))
* chore(deps): update dependency axios to v1.6.8 ([84042a3](https://github.com/mx-space/core/commit/84042a3))
* chore(deps): update dependency eslint to v8.57.0 ([deff9b4](https://github.com/mx-space/core/commit/deff9b4))
* chore(deps): update dependency socket.io to v4.7.5 ([99fd29c](https://github.com/mx-space/core/commit/99fd29c))
* chore(deps): update dependency vite to v5.1.6 ([d959053](https://github.com/mx-space/core/commit/d959053))
* chore(deps): update dependency vitest to v1.3.1 ([c54419b](https://github.com/mx-space/core/commit/c54419b))
* chore(deps): update dependency vitest to v1.4.0 (#1539) ([ff269f6](https://github.com/mx-space/core/commit/ff269f6)), closes [#1539](https://github.com/mx-space/core/issues/1539)
* chore(deps): update pnpm to v8.15.5 ([c33d861](https://github.com/mx-space/core/commit/c33d861))
* fix(deps): update dependency inquirer to v9.2.16 ([fe4fbd7](https://github.com/mx-space/core/commit/fe4fbd7))
* fix(deps): update dependency linkedom to v0.16.10 ([50a9ca1](https://github.com/mx-space/core/commit/50a9ca1))
* fix(deps): update dependency mongoose to v8.2.2 ([6795295](https://github.com/mx-space/core/commit/6795295))

## <small>5.2.2 (2024-03-14)</small>

* release: v5.2.2 ([3f0aca0](https://github.com/mx-space/core/commit/3f0aca0))
* chore: add cf cache header ([ef997e2](https://github.com/mx-space/core/commit/ef997e2))
* chore(deps): update dependency @swc/core to v1.4.7 ([04026d2](https://github.com/mx-space/core/commit/04026d2))
* chore(deps): update dependency @types/lodash to v4.17.0 ([61d6312](https://github.com/mx-space/core/commit/61d6312))
* chore(deps): update dependency @types/node to v20.11.27 ([9b91b9b](https://github.com/mx-space/core/commit/9b91b9b))
* chore(deps): update dependency vite-tsconfig-paths to v4.3.2 ([8c63747](https://github.com/mx-space/core/commit/8c63747))
* fix(deps): update dependency cache-manager-ioredis-yet to v2.0.2 ([52066c1](https://github.com/mx-space/core/commit/52066c1))
* fix(deps): update dependency linkedom to v0.16.9 ([11b74be](https://github.com/mx-space/core/commit/11b74be))

## <small>5.2.1 (2024-03-12)</small>

* release: v5.2.1 ([a51a5f3](https://github.com/mx-space/core/commit/a51a5f3))
* chore(deps): update dependency @types/node to v20.11.26 ([38ecc5c](https://github.com/mx-space/core/commit/38ecc5c))
* chore(deps): update dependency mongodb-memory-server to v9.1.7 ([057b2da](https://github.com/mx-space/core/commit/057b2da))
* chore(deps): update dependency vite to v5.1.6 ([cb20401](https://github.com/mx-space/core/commit/cb20401))
* fix: docker run script ([e08ddd3](https://github.com/mx-space/core/commit/e08ddd3))

## 5.2.0 (2024-03-10)

* release: v5.2.0 ([a180020](https://github.com/mx-space/core/commit/a180020))
* fix: add cache header ([f0640cd](https://github.com/mx-space/core/commit/f0640cd))
* fix(deps): update dependency cache-manager-ioredis-yet to v2.0.1 ([747a12a](https://github.com/mx-space/core/commit/747a12a))
* fix(deps): update dependency marked to v12.0.1 ([12bd435](https://github.com/mx-space/core/commit/12bd435))
* fix(deps): update dependency mongoose-lean-getters to v2 (#1517) ([34db0a6](https://github.com/mx-space/core/commit/34db0a6)), closes [#1517](https://github.com/mx-space/core/issues/1517)
* fix(deps): update dependency nodemailer to v6.9.12 ([4d4df4c](https://github.com/mx-space/core/commit/4d4df4c))
* fix(deps): update dependency qs to v6.12.0 (#1514) ([401f650](https://github.com/mx-space/core/commit/401f650)), closes [#1514](https://github.com/mx-space/core/issues/1514)
* chore: ignore all node_modules (#1521) ([9bd0f78](https://github.com/mx-space/core/commit/9bd0f78)), closes [#1521](https://github.com/mx-space/core/issues/1521)
* chore(deps): update dependency @innei/eslint-config-ts to v0.12.4 ([bb2bfc9](https://github.com/mx-space/core/commit/bb2bfc9))
* chore(deps): update dependency @innei/prettier to v0.12.4 ([cc68407](https://github.com/mx-space/core/commit/cc68407))
* chore(deps): update dependency @swc/core to v1.4.4 ([242e2f3](https://github.com/mx-space/core/commit/242e2f3))
* chore(deps): update dependency @swc/core to v1.4.5 ([d1e695f](https://github.com/mx-space/core/commit/d1e695f))
* chore(deps): update dependency @swc/core to v1.4.6 ([4547e84](https://github.com/mx-space/core/commit/4547e84))
* chore(deps): update dependency @types/node to v20.11.25 ([2c61ef5](https://github.com/mx-space/core/commit/2c61ef5))
* chore(deps): update dependency typescript to v5.4.2 (#1513) ([2bfe0f4](https://github.com/mx-space/core/commit/2bfe0f4)), closes [#1513](https://github.com/mx-space/core/issues/1513)

## <small>5.1.6 (2024-03-05)</small>

* release: v5.1.6 ([e8a3a00](https://github.com/mx-space/core/commit/e8a3a00))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.11 ([dcdfb59](https://github.com/mx-space/core/commit/dcdfb59))
* fix(deps): update dependency @typegoose/auto-increment to v4.2.0 (#1484) ([40b2100](https://github.com/mx-space/core/commit/40b2100)), closes [#1484](https://github.com/mx-space/core/issues/1484)
* fix(deps): update dependency @typegoose/typegoose to v12.2.0 (#1485) ([e3334ef](https://github.com/mx-space/core/commit/e3334ef)), closes [#1485](https://github.com/mx-space/core/issues/1485)
* fix(deps): update dependency cache-manager-ioredis-yet to v2 (#1504) ([f64dff0](https://github.com/mx-space/core/commit/f64dff0)), closes [#1504](https://github.com/mx-space/core/issues/1504)
* fix(deps): update dependency mongoose to v8.2.1 ([ca344a8](https://github.com/mx-space/core/commit/ca344a8))
* fix(deps): update dependency nodemailer to v6.9.11 ([dae4ef7](https://github.com/mx-space/core/commit/dae4ef7))
* fix(deps): update dependency xss to v1.0.15 ([959c4aa](https://github.com/mx-space/core/commit/959c4aa))
* chore(deps): update dependency @types/node to v20.11.24 ([76a6fa1](https://github.com/mx-space/core/commit/76a6fa1))
* chore(deps): update dependency express to v4.18.3 ([297da4e](https://github.com/mx-space/core/commit/297da4e))
* chore(deps): update dependency vite to v5.1.5 ([a6a1fb5](https://github.com/mx-space/core/commit/a6a1fb5))
* chore(deps): update pnpm/action-setup action to v3 (#1447) ([e6a31fc](https://github.com/mx-space/core/commit/e6a31fc)), closes [#1447](https://github.com/mx-space/core/issues/1447)

## <small>5.1.5 (2024-02-29)</small>

* release: v5.1.5 ([89820b5](https://github.com/mx-space/core/commit/89820b5))
* fix: deps ([1c54ddd](https://github.com/mx-space/core/commit/1c54ddd))
* fix: log ([a142e8b](https://github.com/mx-space/core/commit/a142e8b))
* fix: script ([c9deddd](https://github.com/mx-space/core/commit/c9deddd))
* fix: type ([6389731](https://github.com/mx-space/core/commit/6389731))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.10 ([e55797c](https://github.com/mx-space/core/commit/e55797c))
* fix(deps): update dependency @types/jsonwebtoken to v9.0.6 ([3481b50](https://github.com/mx-space/core/commit/3481b50))
* fix(deps): update dependency isbot to v5.1.1 ([db3ab52](https://github.com/mx-space/core/commit/db3ab52))
* fix(deps): update dependency mongoose to v8.2.0 (#1483) ([62c6855](https://github.com/mx-space/core/commit/62c6855)), closes [#1483](https://github.com/mx-space/core/issues/1483)
* fix(deps): update dependency nodemailer to v6.9.10 ([b9b5119](https://github.com/mx-space/core/commit/b9b5119))
* fix(deps): update dependency wildcard-match to v5.1.3 ([1218d7a](https://github.com/mx-space/core/commit/1218d7a))
* chore(deps): update dependency @types/node to v20.11.20 ([1e09762](https://github.com/mx-space/core/commit/1e09762))
* chore(deps): update dependency @types/node to v20.11.21 ([19ad0c9](https://github.com/mx-space/core/commit/19ad0c9))
* chore(deps): update dependency @types/node to v20.11.22 ([8a59c0d](https://github.com/mx-space/core/commit/8a59c0d))
* chore(deps): update dependency @types/qs to v6.9.12 ([c07d514](https://github.com/mx-space/core/commit/c07d514))
* chore(deps): update dependency @types/semver to v7.5.8 ([69e7675](https://github.com/mx-space/core/commit/69e7675))
* chore(deps): update dependency ky to v1.2.1 (#1491) ([e3f5d33](https://github.com/mx-space/core/commit/e3f5d33)), closes [#1491](https://github.com/mx-space/core/issues/1491)
* chore(deps): update pnpm to v8.15.4 ([bbeb592](https://github.com/mx-space/core/commit/bbeb592))
* chore(release): bump @mx-space/webhook to v0.2.3 ([43af81d](https://github.com/mx-space/core/commit/43af81d))
* chore(release): bump @mx-space/webhook to v0.2.4 ([480ed4f](https://github.com/mx-space/core/commit/480ed4f))
* fix!: remove ky ([f9d612f](https://github.com/mx-space/core/commit/f9d612f))

## <small>5.1.4 (2024-02-22)</small>

* release: v5.1.4 ([a0734f8](https://github.com/mx-space/core/commit/a0734f8))
* fix: remove ws guard ([147441c](https://github.com/mx-space/core/commit/147441c))

## <small>5.1.3 (2024-02-22)</small>

* release: v5.1.3 ([7cb6eea](https://github.com/mx-space/core/commit/7cb6eea))
* fix: activity ref type transform to lower case ([6342257](https://github.com/mx-space/core/commit/6342257))

## <small>5.1.2 (2024-02-21)</small>

* release: v5.1.2 ([69ba9ec](https://github.com/mx-space/core/commit/69ba9ec))
* fix: api injection ([9d095fb](https://github.com/mx-space/core/commit/9d095fb))
* fix: throttle ip tracker ([c82cb8f](https://github.com/mx-space/core/commit/c82cb8f))
* fix!: page proxy inject url ([070417c](https://github.com/mx-space/core/commit/070417c))
* chore(deps): update dependency vite to v5.1.4 ([c2e2f98](https://github.com/mx-space/core/commit/c2e2f98))

## <small>5.1.1 (2024-02-21)</small>

* release: v5.1.1 ([dfb1769](https://github.com/mx-space/core/commit/dfb1769))
* fix: refType of recentlies fixes #1478 ([b487b3a](https://github.com/mx-space/core/commit/b487b3a)), closes [#1478](https://github.com/mx-space/core/issues/1478)
* chore(deps): update dependency nanoid to v5.0.6 ([196c790](https://github.com/mx-space/core/commit/196c790))

## 5.1.0 (2024-02-20)

* release: v5.1.0 ([1577995](https://github.com/mx-space/core/commit/1577995))
* fix: remove wating if 427 and add query parameters to getReadingRangeRank ([2ce68aa](https://github.com/mx-space/core/commit/2ce68aa))
* fix: test ([4b3c858](https://github.com/mx-space/core/commit/4b3c858))
* fix: test case ([6ed5e40](https://github.com/mx-space/core/commit/6ed5e40))
* fix: un-limit upload size for backup service ([601a3dd](https://github.com/mx-space/core/commit/601a3dd))
* fix(deps): update dependency mongoose to v8.1.3 ([e84be0c](https://github.com/mx-space/core/commit/e84be0c))
* feat: reading rank ([029b47c](https://github.com/mx-space/core/commit/029b47c))
* refactor: get database writing model ([aeb8509](https://github.com/mx-space/core/commit/aeb8509))
* chore: readme ([b525df2](https://github.com/mx-space/core/commit/b525df2))
* chore: update deps ([feb2abc](https://github.com/mx-space/core/commit/feb2abc))
* chore: update docker compose ([54f1551](https://github.com/mx-space/core/commit/54f1551))
* chore(deps): update dependency @swc/core to v1.4.2 ([4c5d097](https://github.com/mx-space/core/commit/4c5d097))
* ci: Add linux/arm64 image for docker (#1455) ([b46c3c6](https://github.com/mx-space/core/commit/b46c3c6)), closes [#1455](https://github.com/mx-space/core/issues/1455)

## <small>5.0.1 (2024-02-17)</small>

* release: v5.0.1 ([959831a](https://github.com/mx-space/core/commit/959831a))
* fix: comment model with ip fixes #1473 ([f11ccb9](https://github.com/mx-space/core/commit/f11ccb9)), closes [#1473](https://github.com/mx-space/core/issues/1473)
* fix(deps): update dependency @simplewebauthn/server to v9.0.3 ([84f9b2b](https://github.com/mx-space/core/commit/84f9b2b))
* chore: delete root changelog ([7bbc582](https://github.com/mx-space/core/commit/7bbc582))

## 5.0.0 (2024-02-16)

* release: v5.0.0 ([8718798](https://github.com/mx-space/core/commit/8718798))

## 5.0.0-beta.2 (2024-02-16)

* release: v5.0.0-beta.2 ([d02b137](https://github.com/mx-space/core/commit/d02b137))
* fix: activity duration calculation ([ced3852](https://github.com/mx-space/core/commit/ced3852))
* fix: broadcast event add `joinedAt` ([d1704d8](https://github.com/mx-space/core/commit/d1704d8))
* fix: update model ([8bfa464](https://github.com/mx-space/core/commit/8bfa464))
* chore(deps): update dependency @types/node to v20.11.19 ([686eee7](https://github.com/mx-space/core/commit/686eee7))
* chore(deps): update dependency semver to v7.6.0 (#1431) ([ea403b2](https://github.com/mx-space/core/commit/ea403b2)), closes [#1431](https://github.com/mx-space/core/issues/1431)
* chore(deps): update dependency vite to v5.1.3 (#1468) ([7777aad](https://github.com/mx-space/core/commit/7777aad)), closes [#1468](https://github.com/mx-space/core/issues/1468)
* chore(deps): update pnpm to v8.15.3 (#1469) ([c7b6e38](https://github.com/mx-space/core/commit/c7b6e38)), closes [#1469](https://github.com/mx-space/core/issues/1469)
* chore(release): bump @mx-space/api-client to v1.8.0-beta.1 ([9c2b19c](https://github.com/mx-space/core/commit/9c2b19c))

## 5.0.0-beta.1 (2024-02-15)

* release: v5.0.0-beta.1 ([e4bd13a](https://github.com/mx-space/core/commit/e4bd13a))
* chore: update snap ([715b8ec](https://github.com/mx-space/core/commit/715b8ec))

## 5.0.0-beta.0 (2024-02-15)

* release: v5.0.0-beta.0 ([c10ee1b](https://github.com/mx-space/core/commit/c10ee1b))
* chore(deps): update dependency @types/node to v20.11.18 ([722045c](https://github.com/mx-space/core/commit/722045c))
* chore(deps): update dependency vite to v5.1.2 ([5c1a360](https://github.com/mx-space/core/commit/5c1a360))
* chore(release): bump @mx-space/api-client to v1.8.0-beta.0 ([74aaf46](https://github.com/mx-space/core/commit/74aaf46))
* fix: ipv6 ([3dff3df](https://github.com/mx-space/core/commit/3dff3df))
* fix: migration ([6d4254d](https://github.com/mx-space/core/commit/6d4254d))
* refactor!: rename note model field and fix exposure of hidden data ([6745194](https://github.com/mx-space/core/commit/6745194))

## 5.0.0-alpha.4 (2024-02-14)

* release: v5.0.0-alpha.4 ([a5dcb92](https://github.com/mx-space/core/commit/a5dcb92))
* chore(deps): update dependency eslint-plugin-unused-imports to v3.1.0 ([9745da1](https://github.com/mx-space/core/commit/9745da1))
* chore(deps): update dependency husky to v9.0.11 ([922b6c7](https://github.com/mx-space/core/commit/922b6c7))
* chore(release): bump @mx-space/api-client to v1.8.0-alpha.5 ([e353431](https://github.com/mx-space/core/commit/e353431))
* chore(release): bump @mx-space/api-client to v1.8.0-alpha.6 ([a6ceb22](https://github.com/mx-space/core/commit/a6ceb22))
* fix: api model ([c639c57](https://github.com/mx-space/core/commit/c639c57))
* feat: add api sdk for this ([4683b69](https://github.com/mx-space/core/commit/4683b69))
* feat: add get rooms ([cf71fc4](https://github.com/mx-space/core/commit/cf71fc4))

## 5.0.0-alpha.3 (2024-02-13)

* release: v5.0.0-alpha.3 ([0789598](https://github.com/mx-space/core/commit/0789598))
* fix: add real ip for cf ([057a232](https://github.com/mx-space/core/commit/057a232))
* chore(deps): update dependency @swc/core to v1.4.1 ([d5549fe](https://github.com/mx-space/core/commit/d5549fe))

## 5.0.0-alpha.2 (2024-02-13)

* release: v5.0.0-alpha.2 ([b5c6525](https://github.com/mx-space/core/commit/b5c6525))
* update ([7af97ab](https://github.com/mx-space/core/commit/7af97ab))
* feat: add bark push for cc ([76002c3](https://github.com/mx-space/core/commit/76002c3))
* chore(deps): update pnpm to v8.15.2 ([8a723ea](https://github.com/mx-space/core/commit/8a723ea))
* fix: post model type ([db87454](https://github.com/mx-space/core/commit/db87454))
* fix(deps): update dependency mongoose to v8.1.2 ([6844bd7](https://github.com/mx-space/core/commit/6844bd7))
* fix(deps): update nest monorepo to v10.3.3 ([a913599](https://github.com/mx-space/core/commit/a913599))

## 5.0.0-alpha.1 (2024-02-12)

* release: v5.0.0-alpha.1 ([501bbc8](https://github.com/mx-space/core/commit/501bbc8))
* chore: disable test workflow `node_modules` cache (#1456) ([1c5929a](https://github.com/mx-space/core/commit/1c5929a)), closes [#1456](https://github.com/mx-space/core/issues/1456)
* chore: update script ([d4208bc](https://github.com/mx-space/core/commit/d4208bc))
* chore(deps): update dependency @nestjs/cli to v10.3.2 ([4c38061](https://github.com/mx-space/core/commit/4c38061))
* chore(deps): update dependency @types/node to v20.11.17 ([b8e2eb7](https://github.com/mx-space/core/commit/b8e2eb7))
* chore(deps): update dependency @types/semver to v7.5.7 ([449b941](https://github.com/mx-space/core/commit/449b941))
* chore(deps): update dependency nanoid to v5.0.5 ([1cd3eb4](https://github.com/mx-space/core/commit/1cd3eb4))
* chore(deps): update dependency tsup to v8.0.2 ([1e247df](https://github.com/mx-space/core/commit/1e247df))
* chore(deps): update dependency vite to v5.1.1 (#1446) ([96e56c2](https://github.com/mx-space/core/commit/96e56c2)), closes [#1446](https://github.com/mx-space/core/issues/1446)
* feat: add activity type ([0cd84e7](https://github.com/mx-space/core/commit/0cd84e7))
* feat: file trash ([ed6eeb2](https://github.com/mx-space/core/commit/ed6eeb2))
* feat: support socket room and add activity presence (#1445) ([267632b](https://github.com/mx-space/core/commit/267632b)), closes [#1445](https://github.com/mx-space/core/issues/1445)
* fix: docker build workflow (#1451) ([d32ede3](https://github.com/mx-space/core/commit/d32ede3)), closes [#1451](https://github.com/mx-space/core/issues/1451)
* fix: init project script ([83441f1](https://github.com/mx-space/core/commit/83441f1))
* fix: script clone ([c334f45](https://github.com/mx-space/core/commit/c334f45))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.9 ([10865eb](https://github.com/mx-space/core/commit/10865eb))
* fix(deps): update dependency @fastify/static to v7.0.1 ([6c4d182](https://github.com/mx-space/core/commit/6c4d182))
* fix(deps): update dependency @nestjs/cache-manager to v2.2.1 ([d84282a](https://github.com/mx-space/core/commit/d84282a))
* fix(deps): update dependency @nestjs/event-emitter to v2.0.4 ([5af713b](https://github.com/mx-space/core/commit/5af713b))
* fix(deps): update dependency @nestjs/schedule to v4.0.1 ([f7d5ed6](https://github.com/mx-space/core/commit/f7d5ed6))
* fix(deps): update dependency @nestjs/throttler to v5.1.2 ([6812c20](https://github.com/mx-space/core/commit/6812c20))
* fix(deps): update dependency @simplewebauthn/server to v9.0.2 ([dc169f1](https://github.com/mx-space/core/commit/dc169f1))
* fix(deps): update nest monorepo ([6f32af9](https://github.com/mx-space/core/commit/6f32af9))

## 5.0.0-alpha.0 (2024-02-07)

* release: v5.0.0-alpha.0 ([5781e0b](https://github.com/mx-space/core/commit/5781e0b))
* perf: reduce memory usage (#1436) ([ed11374](https://github.com/mx-space/core/commit/ed11374)), closes [#1436](https://github.com/mx-space/core/issues/1436)
* fix(deps): update dependency nestjs-pretty-logger to v0.2.1 ([9addf45](https://github.com/mx-space/core/commit/9addf45))

## <small>4.11.8 (2024-02-06)</small>

* release: v4.11.8 ([956cd60](https://github.com/mx-space/core/commit/956cd60))
* fix: remove `env` expose ([a36d488](https://github.com/mx-space/core/commit/a36d488))

## <small>4.11.7 (2024-02-06)</small>

* release: v4.11.7 ([25450df](https://github.com/mx-space/core/commit/25450df))
* fix: secret getter ([351cbfd](https://github.com/mx-space/core/commit/351cbfd))
* fix: skip throttler guard if authed ([0dbe9c2](https://github.com/mx-space/core/commit/0dbe9c2))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.8 (#1428) ([9d3fe47](https://github.com/mx-space/core/commit/9d3fe47)), closes [#1428](https://github.com/mx-space/core/issues/1428)
* chore(deps): update dependency @nestjs/cli to v10.3.1 ([a5da9fd](https://github.com/mx-space/core/commit/a5da9fd))
* chore(deps): update dependency @swc/core to v1.4.0 (#1429) ([3c02bca](https://github.com/mx-space/core/commit/3c02bca)), closes [#1429](https://github.com/mx-space/core/issues/1429)
* chore(deps): update dependency @types/validator to v13.11.9 ([bf414a2](https://github.com/mx-space/core/commit/bf414a2))
* chore(deps): update dependency lint-staged to v15.2.2 ([168ba2e](https://github.com/mx-space/core/commit/168ba2e))

## <small>4.11.6 (2024-02-04)</small>

* release: v4.11.6 ([284f050](https://github.com/mx-space/core/commit/284f050))
* fix: compress search index data size keep less than 100K ([6718f8e](https://github.com/mx-space/core/commit/6718f8e))
* fix: update ([f055fea](https://github.com/mx-space/core/commit/f055fea))
* feat: adjustObjectSizeEfficiently function to accept a generic type ([8491ebd](https://github.com/mx-space/core/commit/8491ebd))
* feat: use EJS rendering for local-dev page ([bbb0e22](https://github.com/mx-space/core/commit/bbb0e22))

## <small>4.11.5 (2024-02-04)</small>

* release: v4.11.5 ([aff1d80](https://github.com/mx-space/core/commit/aff1d80))
* chore(deps): update dependency prettier to v3.2.5 (#1426) ([3af0926](https://github.com/mx-space/core/commit/3af0926)), closes [#1426](https://github.com/mx-space/core/issues/1426)
* feat: Add SlugTrackerModule to support if the post slug changes, redirect to original data to keep t ([00e7508](https://github.com/mx-space/core/commit/00e7508)), closes [#1425](https://github.com/mx-space/core/issues/1425)
* fix(deps): update dependency @fastify/static to v7 (#1422) ([b0a65ca](https://github.com/mx-space/core/commit/b0a65ca)), closes [#1422](https://github.com/mx-space/core/issues/1422)
* fix(deps): update dependency marked to v12 (#1424) ([97c1e6e](https://github.com/mx-space/core/commit/97c1e6e)), closes [#1424](https://github.com/mx-space/core/issues/1424)

## <small>4.11.4 (2024-02-03)</small>

* release: v4.11.4 ([3debe46](https://github.com/mx-space/core/commit/3debe46))
* feat!: disable sync module and add algolia search data export ([ccc7393](https://github.com/mx-space/core/commit/ccc7393))
* feat: manually trigger algolia search index update ([d094272](https://github.com/mx-space/core/commit/d094272))

## <small>4.11.3 (2024-02-02)</small>

* release: v4.11.3 ([9cebe9e](https://github.com/mx-space/core/commit/9cebe9e))

## <small>4.11.2 (2024-02-02)</small>

* release: v4.11.2 ([44db2f2](https://github.com/mx-space/core/commit/44db2f2))
* chore: update user authentication logic ([264c323](https://github.com/mx-space/core/commit/264c323))
* chore(deps): update dependency @innei/eslint-config-ts to v0.12.2 ([94cc47d](https://github.com/mx-space/core/commit/94cc47d))
* chore(deps): update dependency @innei/prettier to v0.12.2 ([c5f6aab](https://github.com/mx-space/core/commit/c5f6aab))
* chore(deps): update dependency @types/node to v20.11.14 ([d4d653a](https://github.com/mx-space/core/commit/d4d653a))
* chore(deps): update dependency @types/node to v20.11.15 ([75f59b4](https://github.com/mx-space/core/commit/75f59b4))
* chore(deps): update dependency @types/node to v20.11.16 ([99c4f09](https://github.com/mx-space/core/commit/99c4f09))
* chore(deps): update dependency husky to v9.0.10 ([cb0a480](https://github.com/mx-space/core/commit/cb0a480))
* chore(deps): update dependency lint-staged to v15.2.1 ([05df1fa](https://github.com/mx-space/core/commit/05df1fa))
* refactor: algolia search operations ([c266e2f](https://github.com/mx-space/core/commit/c266e2f))
* feat: add Algolia search functionality and event listeners ([31b1ba8](https://github.com/mx-space/core/commit/31b1ba8))
* feat: add local dev dashboard debug option ([64cddf1](https://github.com/mx-space/core/commit/64cddf1))
* fix: add validation for encrypt key length ([ed40949](https://github.com/mx-space/core/commit/ed40949))
* fix(deps): update dependency nodemailer to v6.9.9 ([0eb09ef](https://github.com/mx-space/core/commit/0eb09ef))
* fix(aggregate):get pages counts (#1415) ([f9c8e37](https://github.com/mx-space/core/commit/f9c8e37)), closes [#1415](https://github.com/mx-space/core/issues/1415)

## <small>4.11.1 (2024-01-31)</small>

* release: v4.11.1 ([fc39901](https://github.com/mx-space/core/commit/fc39901))
* fix: add Logger instance to the global scope ([c4a27cc](https://github.com/mx-space/core/commit/c4a27cc))
* fix: search service to use replaceAllObjects method ([00964c3](https://github.com/mx-space/core/commit/00964c3))

## 4.11.0 (2024-01-31)

* release: v4.11.0 ([dcfc7f3](https://github.com/mx-space/core/commit/dcfc7f3))
* fix: Remove unused code and update create method in PostController ([5f9e69f](https://github.com/mx-space/core/commit/5f9e69f))
* fix: session revoke ([2bfc745](https://github.com/mx-space/core/commit/2bfc745))
* chore: update deps ([2c2d299](https://github.com/mx-space/core/commit/2c2d299))
* chore(deps): update dependency @types/node to v20.11.11 ([3d4ed21](https://github.com/mx-space/core/commit/3d4ed21))
* chore(deps): update dependency @types/node to v20.11.13 ([4c9c5a4](https://github.com/mx-space/core/commit/4c9c5a4))
* chore(deps): update dependency husky to v9.0.7 ([ab3598d](https://github.com/mx-space/core/commit/ab3598d))
* chore(deps): update pnpm to v8.15.1 ([ee53418](https://github.com/mx-space/core/commit/ee53418))
* fix:post can custom `created` fixes #1410 ([abdf931](https://github.com/mx-space/core/commit/abdf931)), closes [#1410](https://github.com/mx-space/core/issues/1410)

## <small>4.10.9 (2024-01-29)</small>

* release: v4.10.9 ([0b4c73a](https://github.com/mx-space/core/commit/0b4c73a))
* fix: set `CBOR_NATIVE_ACCELERATION_DISABLED` to `true` ([e1163cd](https://github.com/mx-space/core/commit/e1163cd))
* fix(deps): update babel monorepo to v7.23.9 ([e61459f](https://github.com/mx-space/core/commit/e61459f))
* fix(deps): update dependency @simplewebauthn/server to v9 (#1387) ([54fbfe1](https://github.com/mx-space/core/commit/54fbfe1)), closes [#1387](https://github.com/mx-space/core/issues/1387)
* fix(deps): update dependency linkedom to v0.16.8 ([130d110](https://github.com/mx-space/core/commit/130d110))
* fix(deps): update dependency lru-cache to v10.2.0 (#1397) ([6ae866d](https://github.com/mx-space/core/commit/6ae866d)), closes [#1397](https://github.com/mx-space/core/issues/1397)
* fix(deps): update dependency marked to v11.2.0 (#1399) ([ea6e60e](https://github.com/mx-space/core/commit/ea6e60e)), closes [#1399](https://github.com/mx-space/core/issues/1399)
* fix(deps): update dependency mongoose to v8.1.1 ([73cf344](https://github.com/mx-space/core/commit/73cf344))
* fix(deps): update nest monorepo to v10.3.1 ([c33941e](https://github.com/mx-space/core/commit/c33941e))
* chore: update license ([731bc19](https://github.com/mx-space/core/commit/731bc19))
* chore(deps): update dependency @swc/core to v1.3.105 ([550e77d](https://github.com/mx-space/core/commit/550e77d))
* chore(deps): update dependency @swc/core to v1.3.106 ([133afe5](https://github.com/mx-space/core/commit/133afe5))
* chore(deps): update dependency @swc/core to v1.3.107 ([148d7e2](https://github.com/mx-space/core/commit/148d7e2))
* chore(deps): update dependency @types/node to v20.11.10 ([cfaa4bd](https://github.com/mx-space/core/commit/cfaa4bd))
* chore(deps): update dependency @types/node to v20.11.6 ([0b5ee17](https://github.com/mx-space/core/commit/0b5ee17))
* chore(deps): update dependency @types/node to v20.11.7 ([b79816b](https://github.com/mx-space/core/commit/b79816b))
* chore(deps): update dependency @types/node to v20.11.8 ([00165bd](https://github.com/mx-space/core/commit/00165bd))
* chore(deps): update dependency @types/node to v20.11.9 ([ce93746](https://github.com/mx-space/core/commit/ce93746))
* chore(deps): update dependency husky to v9 (#1394) ([782f757](https://github.com/mx-space/core/commit/782f757)), closes [#1394](https://github.com/mx-space/core/issues/1394)
* chore(deps): update pnpm to v8.14.2 ([d25280a](https://github.com/mx-space/core/commit/d25280a))
* chore(deps): update pnpm to v8.14.3 ([8a96a45](https://github.com/mx-space/core/commit/8a96a45))
* chore(deps): update pnpm to v8.15.0 (#1402) ([1007cd5](https://github.com/mx-space/core/commit/1007cd5)), closes [#1402](https://github.com/mx-space/core/issues/1402)
* chore(deps): update robinraju/release-downloader action to v1.9 (#1403) ([c4cbcc2](https://github.com/mx-space/core/commit/c4cbcc2)), closes [#1403](https://github.com/mx-space/core/issues/1403)

## <small>4.10.8 (2024-01-21)</small>

* release: v4.10.8 ([b9166a8](https://github.com/mx-space/core/commit/b9166a8))
* chore: update deps ([a3f7582](https://github.com/mx-space/core/commit/a3f7582))
* chore(deps-dev): bump vite from 5.0.11 to 5.0.12 (#1381) ([3d182a8](https://github.com/mx-space/core/commit/3d182a8)), closes [#1381](https://github.com/mx-space/core/issues/1381)
* chore(deps): update dependency vite to v5.0.12 ([6353d1d](https://github.com/mx-space/core/commit/6353d1d))
* fix: ip function error "[object Object]" (#1385) ([28d3239](https://github.com/mx-space/core/commit/28d3239)), closes [#1385](https://github.com/mx-space/core/issues/1385)
* fix(deps): update dependency @simplewebauthn/server to v8.3.7 ([63f7978](https://github.com/mx-space/core/commit/63f7978))
* fix(deps): update dependency cache-manager to v5.4.0 (#1382) ([5eb49de](https://github.com/mx-space/core/commit/5eb49de)), closes [#1382](https://github.com/mx-space/core/issues/1382)

## <small>4.10.7 (2024-01-19)</small>

* release: v4.10.7 ([b19a618](https://github.com/mx-space/core/commit/b19a618))
* refactor: dto decorators ([978c388](https://github.com/mx-space/core/commit/978c388))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.7 ([8a544b9](https://github.com/mx-space/core/commit/8a544b9))
* fix(deps): update dependency @fastify/cookie to v9.3.1 ([550d4ec](https://github.com/mx-space/core/commit/550d4ec))
* fix(deps): update dependency @typegoose/auto-increment to v4.1.0 (#1373) ([b5c5520](https://github.com/mx-space/core/commit/b5c5520)), closes [#1373](https://github.com/mx-space/core/issues/1373)
* fix(deps): update dependency snakecase-keys to v6 (#1377) ([9af88a3](https://github.com/mx-space/core/commit/9af88a3)), closes [#1377](https://github.com/mx-space/core/issues/1377)
* chore(deps): update actions/cache action to v4 (#1376) ([0cffdf0](https://github.com/mx-space/core/commit/0cffdf0)), closes [#1376](https://github.com/mx-space/core/issues/1376)

## <small>4.10.6 (2024-01-18)</small>

* release: v4.10.6 ([7ac86dc](https://github.com/mx-space/core/commit/7ac86dc))
* fix: sitemap data ([c10f089](https://github.com/mx-space/core/commit/c10f089))
* fix(deps): update dependency @fastify/cookie to v9.3.0 (#1363) ([2b100cd](https://github.com/mx-space/core/commit/2b100cd)), closes [#1363](https://github.com/mx-space/core/issues/1363)
* chore(deps): update dependency @swc/core to v1.3.103 ([aabaca4](https://github.com/mx-space/core/commit/aabaca4))
* chore(deps): update dependency @swc/core to v1.3.104 ([fb330a1](https://github.com/mx-space/core/commit/fb330a1))
* chore(deps): update dependency @types/node to v20.11.1 ([4409f61](https://github.com/mx-space/core/commit/4409f61))
* chore(deps): update dependency @types/node to v20.11.2 ([f747622](https://github.com/mx-space/core/commit/f747622))
* chore(deps): update dependency @types/node to v20.11.4 ([b8ecfb8](https://github.com/mx-space/core/commit/b8ecfb8))
* chore(deps): update dependency @types/node to v20.11.5 ([2364ded](https://github.com/mx-space/core/commit/2364ded))
* chore(deps): update dependency mongodb-memory-server to v9.1.6 ([24781e2](https://github.com/mx-space/core/commit/24781e2))
* chore(deps): update dependency prettier to v3.2.4 ([10c14e6](https://github.com/mx-space/core/commit/10c14e6))
* chore(deps): update dependency vite-tsconfig-paths to v4.3.1 (#1368) ([bd69076](https://github.com/mx-space/core/commit/bd69076)), closes [#1368](https://github.com/mx-space/core/issues/1368)
* feat: unsubscribe header for mail ([b28de23](https://github.com/mx-space/core/commit/b28de23))

## <small>4.10.5 (2024-01-14)</small>

* release: v4.10.5 ([563aff6](https://github.com/mx-space/core/commit/563aff6))
* chore: update built-in ip query function ([eb19f61](https://github.com/mx-space/core/commit/eb19f61))

## <small>4.10.4 (2024-01-14)</small>

* release: v4.10.4 ([d1828e0](https://github.com/mx-space/core/commit/d1828e0))
* chore: update deps ([40a5a1a](https://github.com/mx-space/core/commit/40a5a1a))
* chore(deps): update dependency @types/node to v20.11.0 ([376c6a0](https://github.com/mx-space/core/commit/376c6a0))
* chore(deps): update dependency mongodb-memory-server to v9.1.5 ([3455fb0](https://github.com/mx-space/core/commit/3455fb0))
* chore(deps): update dependency prettier to v3.2.1 ([f5bb22d](https://github.com/mx-space/core/commit/f5bb22d))
* chore(deps): update dependency prettier to v3.2.2 ([16683eb](https://github.com/mx-space/core/commit/16683eb))
* chore(deps): update pnpm to v8.14.1 ([e84a67e](https://github.com/mx-space/core/commit/e84a67e))
* fix: axios http ([0c18317](https://github.com/mx-space/core/commit/0c18317))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.6 ([cd61cdb](https://github.com/mx-space/core/commit/cd61cdb))
* fix(deps): update dependency @nestjs/cache-manager to v2.2.0 (#1351) ([b91263a](https://github.com/mx-space/core/commit/b91263a)), closes [#1351](https://github.com/mx-space/core/issues/1351)

## <small>4.10.3 (2024-01-10)</small>

* release: v4.10.3 ([fbcf115](https://github.com/mx-space/core/commit/fbcf115))
* fix: add 301 status when redirect ([775835f](https://github.com/mx-space/core/commit/775835f))

## <small>4.10.2 (2024-01-10)</small>

* release: v4.10.2 ([7dcec57](https://github.com/mx-space/core/commit/7dcec57))
* chore: cleanup ([e6b471b](https://github.com/mx-space/core/commit/e6b471b))
* chore(deps): update dependency @innei/eslint-config-ts to v0.12.1 ([34e06ea](https://github.com/mx-space/core/commit/34e06ea))
* chore(deps): update dependency @innei/prettier to v0.12.1 ([ca99604](https://github.com/mx-space/core/commit/ca99604))
* chore(deps): update dependency @nestjs/cli to v10.3.0 (#1348) ([6dca37a](https://github.com/mx-space/core/commit/6dca37a)), closes [#1348](https://github.com/mx-space/core/issues/1348)
* chore(deps): update dependency @types/node to v20.10.7 ([de9fcd9](https://github.com/mx-space/core/commit/de9fcd9))
* chore(deps): update dependency @types/node to v20.10.8 ([4a75121](https://github.com/mx-space/core/commit/4a75121))
* chore(deps): update dependency @types/validator to v13.11.8 ([16bae0e](https://github.com/mx-space/core/commit/16bae0e))
* fix: ci pipeline ([85750b9](https://github.com/mx-space/core/commit/85750b9))
* fix(deps): update algoliasearch-client-javascript monorepo to v4.22.1 ([b5040da](https://github.com/mx-space/core/commit/b5040da))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.5 ([ef6e04b](https://github.com/mx-space/core/commit/ef6e04b))
* fix(deps): update dependency mongoose to v8.0.4 (#1355) ([d03f413](https://github.com/mx-space/core/commit/d03f413)), closes [#1355](https://github.com/mx-space/core/issues/1355)
* feat: add `redirect` on url builder ([bdd6de5](https://github.com/mx-space/core/commit/bdd6de5))

## <small>4.10.1 (2024-01-07)</small>

* release: v4.10.1 ([1c9f926](https://github.com/mx-space/core/commit/1c9f926))
* chore: update isbot ([e7f2305](https://github.com/mx-space/core/commit/e7f2305))
* chore(deps): update dependency ky to v1.2.0 (#1344) ([9334f39](https://github.com/mx-space/core/commit/9334f39)), closes [#1344](https://github.com/mx-space/core/issues/1344)
* chore(deps): update pnpm to v8.14.0 (#1337) ([7930d1f](https://github.com/mx-space/core/commit/7930d1f)), closes [#1337](https://github.com/mx-space/core/issues/1337)
* fix: ci ([c988594](https://github.com/mx-space/core/commit/c988594))
* fix(deps): update dependency @fastify/multipart to v8.1.0 (#1343) ([17d3286](https://github.com/mx-space/core/commit/17d3286)), closes [#1343](https://github.com/mx-space/core/issues/1343)
* fix(deps): update dependency isbot to v3.8.0 (#1338) ([2e5d13d](https://github.com/mx-space/core/commit/2e5d13d)), closes [#1338](https://github.com/mx-space/core/issues/1338)
* fix(deps): update dependency mongoose-paginate-v2 to v1.8.0 (#1341) ([3e1d065](https://github.com/mx-space/core/commit/3e1d065)), closes [#1341](https://github.com/mx-space/core/issues/1341)

## 4.10.0 (2024-01-07)

* release: v4.10.0 ([a3d2d10](https://github.com/mx-space/core/commit/a3d2d10))
* fix: always create new require instance ([97526ce](https://github.com/mx-space/core/commit/97526ce))
* fix: bark url desc ([92651b1](https://github.com/mx-space/core/commit/92651b1))
* fix: ci scp (#1319) ([be5e4a1](https://github.com/mx-space/core/commit/be5e4a1)), closes [#1319](https://github.com/mx-space/core/issues/1319)
* fix: event type handling and update file paths ([c29be51](https://github.com/mx-space/core/commit/c29be51))
* fix: event variable in `readDataFromRequest` function ([bbd1a67](https://github.com/mx-space/core/commit/bbd1a67))
* fix: ingore migration collection backup ([813aa35](https://github.com/mx-space/core/commit/813aa35))
* fix: lock file ([696b5aa](https://github.com/mx-space/core/commit/696b5aa))
* fix: remove uptime in info ([f3e46e7](https://github.com/mx-space/core/commit/f3e46e7))
* fix: remove xlog api proxy ([91aa771](https://github.com/mx-space/core/commit/91aa771))
* fix: should export a enum value ([5ec2c29](https://github.com/mx-space/core/commit/5ec2c29))
* fix: ts ds happy ([9297b36](https://github.com/mx-space/core/commit/9297b36))
* fix: typo ([19bb8cc](https://github.com/mx-space/core/commit/19bb8cc))
* fix: update import statement in handler.ts ([1dd8099](https://github.com/mx-space/core/commit/1dd8099))
* fix(comment): add type guard on `source` ([e31b98a](https://github.com/mx-space/core/commit/e31b98a))
* fix(deps): update dependency @babel/core to v7.23.7 ([03368c5](https://github.com/mx-space/core/commit/03368c5))
* fix(deps): update dependency @simplewebauthn/server to v8.3.6 ([97d1ab7](https://github.com/mx-space/core/commit/97d1ab7))
* fix(deps): update dependency image-size to v1.1.0 (#1321) ([2fb8cec](https://github.com/mx-space/core/commit/2fb8cec)), closes [#1321](https://github.com/mx-space/core/issues/1321)
* fix(deps): update dependency image-size to v1.1.1 ([5e52b80](https://github.com/mx-space/core/commit/5e52b80))
* fix(deps): update dependency linkedom to v0.16.6 ([668a9af](https://github.com/mx-space/core/commit/668a9af))
* fix(deps): update dependency marked to v11.1.1 ([c0788f1](https://github.com/mx-space/core/commit/c0788f1))
* fix(deps): update dependency mongoose-aggregate-paginate-v2 to v1.0.7 (#1326) ([9f51058](https://github.com/mx-space/core/commit/9f51058)), closes [#1326](https://github.com/mx-space/core/issues/1326)
* fix(deps): update dependency nodemailer to v6.9.8 ([03c0eab](https://github.com/mx-space/core/commit/03c0eab))
* fix(sdk): ref type ([e2accf4](https://github.com/mx-space/core/commit/e2accf4))
* chore: update deps ([1bd7a7b](https://github.com/mx-space/core/commit/1bd7a7b))
* chore: update deps ([f72f2a4](https://github.com/mx-space/core/commit/f72f2a4))
* chore(api-client): add export for CollectionRefTypes ([3e8ee3e](https://github.com/mx-space/core/commit/3e8ee3e))
* chore(deps): update appleboy/scp-action action to v0.1.6 (#1320) ([b600455](https://github.com/mx-space/core/commit/b600455)), closes [#1320](https://github.com/mx-space/core/issues/1320)
* chore(deps): update appleboy/scp-action action to v0.1.7 ([fbede4c](https://github.com/mx-space/core/commit/fbede4c))
* chore(deps): update dependency @swc/core to v1.3.102 ([9d22ef3](https://github.com/mx-space/core/commit/9d22ef3))
* chore(deps): update dependency @types/node to v20.10.6 ([dd9cd2b](https://github.com/mx-space/core/commit/dd9cd2b))
* chore(deps): update dependency mongodb-memory-server to v9.1.4 ([6fd436f](https://github.com/mx-space/core/commit/6fd436f))
* chore(deps): update dependency vite to v5.0.11 ([ef2289d](https://github.com/mx-space/core/commit/ef2289d))
* chore(deps): update dependency vite-tsconfig-paths to v4.2.3 ([c05a531](https://github.com/mx-space/core/commit/c05a531))
* chore(deps): update pnpm to v8.13.1 (#1318) ([e16ea47](https://github.com/mx-space/core/commit/e16ea47)), closes [#1318](https://github.com/mx-space/core/issues/1318)
* chore(release): bump @mx-space/api-client to v1.7.0 ([1ec0987](https://github.com/mx-space/core/commit/1ec0987))
* chore(release): bump @mx-space/api-client to v1.7.1 ([919f7bf](https://github.com/mx-space/core/commit/919f7bf))
* chore(release): bump @mx-space/api-client to v1.7.2 ([6f2beda](https://github.com/mx-space/core/commit/6f2beda))
* chore(release): bump @mx-space/webhook to v0.2.0 ([9913994](https://github.com/mx-space/core/commit/9913994))
* chore(release): bump @mx-space/webhook to v0.2.1 ([dccca7b](https://github.com/mx-space/core/commit/dccca7b))
* chore(release): bump @mx-space/webhook to v0.2.2 ([c2f6a16](https://github.com/mx-space/core/commit/c2f6a16))
* test: ignore test case ([00c0462](https://github.com/mx-space/core/commit/00c0462))
* docs: update ([0a921bd](https://github.com/mx-space/core/commit/0a921bd))
* docs: update link (#1339) ([3ebad48](https://github.com/mx-space/core/commit/3ebad48)), closes [#1339](https://github.com/mx-space/core/issues/1339)
* refactor: change uptime cal ([8f5515a](https://github.com/mx-space/core/commit/8f5515a))
* refactor: webhook handler to improve readability and error handling ([af0268e](https://github.com/mx-space/core/commit/af0268e))
* feat: add clearDispatchEvents method to WebhookController and WebhookService ([bf2e753](https://github.com/mx-space/core/commit/bf2e753))

## <small>4.9.1 (2023-12-25)</small>

* release: v4.9.1 ([4a4a7a5](https://github.com/mx-space/core/commit/4a4a7a5))
* chore(release): bump @mx-space/webhook to v0.1.4 ([0087e51](https://github.com/mx-space/core/commit/0087e51))
* feat: add health_check ([889b0b0](https://github.com/mx-space/core/commit/889b0b0))
* fix: webhok scope filter ([6176065](https://github.com/mx-space/core/commit/6176065))
* fix(webhook): add health check ([2621304](https://github.com/mx-space/core/commit/2621304))

## 4.9.0 (2023-12-24)

* release: v4.9.0 ([9f97892](https://github.com/mx-space/core/commit/9f97892))
* fix: add field for algolia search ([c613bf7](https://github.com/mx-space/core/commit/c613bf7))
* fix: ci ([d947eee](https://github.com/mx-space/core/commit/d947eee))
* fix: emitter type ([08b58e5](https://github.com/mx-space/core/commit/08b58e5))
* fix: variant rename to `type` ([d255493](https://github.com/mx-space/core/commit/d255493))
* fix: webhook lib build script ([ee370bc](https://github.com/mx-space/core/commit/ee370bc))
* fix(deps): update dependency @algolia/client-search to v4.22.0 (#1308) ([4bf5f79](https://github.com/mx-space/core/commit/4bf5f79)), closes [#1308](https://github.com/mx-space/core/issues/1308)
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.3 ([84645c1](https://github.com/mx-space/core/commit/84645c1))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.4 ([309184c](https://github.com/mx-space/core/commit/309184c))
* fix(deps): update dependency @nestjs/throttler to v5.1.1 ([76e5422](https://github.com/mx-space/core/commit/76e5422))
* fix(deps): update dependency cache-manager to v5.3.2 ([6efb1ef](https://github.com/mx-space/core/commit/6efb1ef))
* chore: update redis adaptor ([826803c](https://github.com/mx-space/core/commit/826803c))
* chore(deps): update dependency @types/qs to v6.9.11 ([a3fca5f](https://github.com/mx-space/core/commit/a3fca5f))
* chore(release): bump @mx-space/webhook to v0.1.0 ([b8a8c35](https://github.com/mx-space/core/commit/b8a8c35))
* chore(release): bump @mx-space/webhook to v0.1.1 ([6987fc3](https://github.com/mx-space/core/commit/6987fc3))
* chore(release): bump @mx-space/webhook to v0.1.2 ([a2407eb](https://github.com/mx-space/core/commit/a2407eb))
* chore(release): bump @mx-space/webhook to v0.1.3 ([e2b7a35](https://github.com/mx-space/core/commit/e2b7a35))
* feat: support webhook (#1298) ([c6d037d](https://github.com/mx-space/core/commit/c6d037d)), closes [#1298](https://github.com/mx-space/core/issues/1298)
* feat(webhook): generic type for event emitter ([cfc3513](https://github.com/mx-space/core/commit/cfc3513))
* refactor: cron job and analyze batch ([2da44b0](https://github.com/mx-space/core/commit/2da44b0))

## <small>4.8.6 (2023-12-18)</small>

* release: v4.8.6 ([c14d97e](https://github.com/mx-space/core/commit/c14d97e))
* fix: bundle build ci ([99f4f4c](https://github.com/mx-space/core/commit/99f4f4c))
* fix: run prebuild before test ([1ce1824](https://github.com/mx-space/core/commit/1ce1824))
* fix: some `env` move to runtime inject ([a3510d2](https://github.com/mx-space/core/commit/a3510d2))
* fix: test ci ([25bb57e](https://github.com/mx-space/core/commit/25bb57e))
* fix(deps): update algoliasearch-client-javascript monorepo to v4.22.0 (#1294) ([e4fbeae](https://github.com/mx-space/core/commit/e4fbeae)), closes [#1294](https://github.com/mx-space/core/issues/1294)
* fix(deps): update babel monorepo to v7.23.6 ([68e603b](https://github.com/mx-space/core/commit/68e603b))
* fix(deps): update dependency @algolia/client-search to v4.22.0 (#1304) ([58c7f02](https://github.com/mx-space/core/commit/58c7f02)), closes [#1304](https://github.com/mx-space/core/issues/1304)
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.2 ([62b7fef](https://github.com/mx-space/core/commit/62b7fef))
* fix(deps): update dependency algoliasearch to v4.21.1 ([3b7b98b](https://github.com/mx-space/core/commit/3b7b98b))
* fix(deps): update dependency linkedom to v0.16.5 ([97a9435](https://github.com/mx-space/core/commit/97a9435))
* fix(deps): update dependency reflect-metadata to v0.2.1 (#1300) ([cc20933](https://github.com/mx-space/core/commit/cc20933)), closes [#1300](https://github.com/mx-space/core/issues/1300)
* fix(deps): update nest monorepo to v10.3.0 (minor) (#1307) ([3cbb081](https://github.com/mx-space/core/commit/3cbb081)), closes [#1307](https://github.com/mx-space/core/issues/1307)
* chore(deps): update dependency @swc/core to v1.3.101 ([8fea1df](https://github.com/mx-space/core/commit/8fea1df))
* chore(deps): update dependency @types/node to v20.10.5 ([330cda9](https://github.com/mx-space/core/commit/330cda9))
* chore(deps): update dependency mongodb-memory-server to v9.1.3 ([f778c7c](https://github.com/mx-space/core/commit/f778c7c))
* chore(deps): update dependency vite to v5.0.10 ([2e36973](https://github.com/mx-space/core/commit/2e36973))
* chore(deps): update dependency vite to v5.0.8 ([85633eb](https://github.com/mx-space/core/commit/85633eb))
* chore(deps): update dependency vite to v5.0.9 ([ee658b5](https://github.com/mx-space/core/commit/ee658b5))
* chore(deps): update pnpm to v8.12.1 (#1297) ([9ec70ba](https://github.com/mx-space/core/commit/9ec70ba)), closes [#1297](https://github.com/mx-space/core/issues/1297)
* feat: request context ([c643094](https://github.com/mx-space/core/commit/c643094))
* ci: remove optional ([13079aa](https://github.com/mx-space/core/commit/13079aa))
* refactor: upgrade nanoid ([deb8a85](https://github.com/mx-space/core/commit/deb8a85))
* refactor: upgrade zx ([43b1d98](https://github.com/mx-space/core/commit/43b1d98))

## <small>4.8.4 (2023-12-12)</small>

* release: v4.8.4 ([46bf306](https://github.com/mx-space/core/commit/46bf306))
* fix: remove swift ([ab204b8](https://github.com/mx-space/core/commit/ab204b8))
* fix: test case ([09db9c9](https://github.com/mx-space/core/commit/09db9c9))
* fix(deps): update algoliasearch-client-javascript monorepo to v4.21.0 (minor) (#1288) ([46c2d1f](https://github.com/mx-space/core/commit/46c2d1f)), closes [#1288](https://github.com/mx-space/core/issues/1288)
* fix(deps): update babel monorepo to v7.23.6 (patch) (#1287) ([237adc5](https://github.com/mx-space/core/commit/237adc5)), closes [#1287](https://github.com/mx-space/core/issues/1287)
* chore(deps): update supercharge/redis-github-action action to v1.8.0 (#1291) ([7a28ded](https://github.com/mx-space/core/commit/7a28ded)), closes [#1291](https://github.com/mx-space/core/issues/1291)

## <small>4.8.3 (2023-12-11)</small>

* release: v4.8.3 ([de08b99](https://github.com/mx-space/core/commit/de08b99))
* fix: test case ([ec37bd1](https://github.com/mx-space/core/commit/ec37bd1))
* chore: update deps ([cdf477c](https://github.com/mx-space/core/commit/cdf477c))

## <small>4.8.2 (2023-12-10)</small>

* release: v4.8.2 ([0568bce](https://github.com/mx-space/core/commit/0568bce))
* fix: disable pre requirement validation for auth security ([2444e39](https://github.com/mx-space/core/commit/2444e39))
* fix: guard if not passkey ([1cc940d](https://github.com/mx-space/core/commit/1cc940d))
* fix: update dockerfile ([593c9bc](https://github.com/mx-space/core/commit/593c9bc))

## <small>4.8.1 (2023-12-10)</small>

* release: v4.8.1 ([4315164](https://github.com/mx-space/core/commit/4315164))
* fix: remove hard code ([956d2d6](https://github.com/mx-space/core/commit/956d2d6))
* chore(deps): update dependency prettier to v3.1.1 ([14d6a6a](https://github.com/mx-space/core/commit/14d6a6a))
* chore(deps): update pnpm to v8.12.0 (#1284) ([e26a1f8](https://github.com/mx-space/core/commit/e26a1f8)), closes [#1284](https://github.com/mx-space/core/issues/1284)

## 4.8.0 (2023-12-10)

* release: v4.8.0 ([b1ee162](https://github.com/mx-space/core/commit/b1ee162))

## 4.8.0-alpha.2 (2023-12-10)

* release: v4.8.0-alpha.2 ([d0ebd45](https://github.com/mx-space/core/commit/d0ebd45))
* fix: add env ([6a7cfbd](https://github.com/mx-space/core/commit/6a7cfbd))

## 4.8.0-alpha.1 (2023-12-10)

* release: v4.8.0-alpha.1 ([3eac276](https://github.com/mx-space/core/commit/3eac276))
* chore: add source map for build ([726ba01](https://github.com/mx-space/core/commit/726ba01))
* fix: logger module ([b49faaf](https://github.com/mx-space/core/commit/b49faaf))

## 4.8.0-alpha.0 (2023-12-10)

* release: v4.8.0-alpha.0 ([ddd1e6a](https://github.com/mx-space/core/commit/ddd1e6a))
* feat: support user login by passkey (#1285) ([03cc449](https://github.com/mx-space/core/commit/03cc449)), closes [#1285](https://github.com/mx-space/core/issues/1285)
* chore(deps): update dependency @types/node to v20.10.3 ([aef2baf](https://github.com/mx-space/core/commit/aef2baf))
* chore(deps): update dependency @types/node to v20.10.4 ([e23aa47](https://github.com/mx-space/core/commit/e23aa47))
* chore(deps): update dependency lint-staged to v15.2.0 (#1269) ([ebf714b](https://github.com/mx-space/core/commit/ebf714b)), closes [#1269](https://github.com/mx-space/core/issues/1269)
* chore(deps): update dependency ts-node to v10.9.2 (#1281) ([40d2782](https://github.com/mx-space/core/commit/40d2782)), closes [#1281](https://github.com/mx-space/core/issues/1281)
* chore(deps): update dependency typescript to v5.3.3 ([5cb1c8e](https://github.com/mx-space/core/commit/5cb1c8e))
* chore(deps): update dependency unplugin-swc to v1.4.4 ([98f218f](https://github.com/mx-space/core/commit/98f218f))
* chore(deps): update dependency vite to v5.0.5 ([52ae00c](https://github.com/mx-space/core/commit/52ae00c))
* chore(deps): update dependency vite to v5.0.6 ([acea271](https://github.com/mx-space/core/commit/acea271))
* chore(deps): update dependency vite to v5.0.7 (#1282) ([2325cad](https://github.com/mx-space/core/commit/2325cad)), closes [#1282](https://github.com/mx-space/core/issues/1282)
* chore(deps): update dependency vite-tsconfig-paths to v4.2.2 ([eafe165](https://github.com/mx-space/core/commit/eafe165))
* chore(deps): update node.js to v20 (#1267) ([7b66498](https://github.com/mx-space/core/commit/7b66498)), closes [#1267](https://github.com/mx-space/core/issues/1267)
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.12.23 ([6d213ee](https://github.com/mx-space/core/commit/6d213ee))
* fix(deps): update dependency @clerk/clerk-sdk-node to v4.13.0 (#1278) ([20142ea](https://github.com/mx-space/core/commit/20142ea)), closes [#1278](https://github.com/mx-space/core/issues/1278)
* fix(deps): update dependency mongoose to v8.0.3 ([74e5c83](https://github.com/mx-space/core/commit/74e5c83))
* fix(deps): update dependency reflect-metadata to v0.1.14 ([b7d5811](https://github.com/mx-space/core/commit/b7d5811))

## <small>4.7.2 (2023-12-03)</small>

* release: v4.7.2 ([69756fb](https://github.com/mx-space/core/commit/69756fb))
* fix: lockfile ([a7e3cd7](https://github.com/mx-space/core/commit/a7e3cd7))
* fix: windows zip minetype detection ([1e9105a](https://github.com/mx-space/core/commit/1e9105a))

## <small>4.7.1 (2023-12-02)</small>

* release: v4.7.1 ([a4669cc](https://github.com/mx-space/core/commit/a4669cc))
* ci: remove darkwin build ([1494dfc](https://github.com/mx-space/core/commit/1494dfc))
* fix: change clerk auth verify ([1c10b47](https://github.com/mx-space/core/commit/1c10b47))

## 4.7.0 (2023-12-02)

* release: v4.7.0 ([eaded7c](https://github.com/mx-space/core/commit/eaded7c))
* fix: pass test case ([0e5eb09](https://github.com/mx-space/core/commit/0e5eb09))
* fix: release ci ([d82f913](https://github.com/mx-space/core/commit/d82f913))
* feat: support clerk auth ([18b9cbb](https://github.com/mx-space/core/commit/18b9cbb))
* chore(deps): update dependency @types/node to v20.10.2 ([19d262f](https://github.com/mx-space/core/commit/19d262f))

## <small>4.6.3 (2023-11-30)</small>

* release: v4.6.3 ([8c4ca40](https://github.com/mx-space/core/commit/8c4ca40))
* chore: lockfile ([7f850d7](https://github.com/mx-space/core/commit/7f850d7))
* chore: update moggose ([d5681a8](https://github.com/mx-space/core/commit/d5681a8))
* chore(deps): update actions/setup-node action to v4 (#1166) ([7914caa](https://github.com/mx-space/core/commit/7914caa)), closes [#1166](https://github.com/mx-space/core/issues/1166)
* chore(deps): update dependency @innei/eslint-config-ts to v0.12.0 (#1248) ([c8a8a34](https://github.com/mx-space/core/commit/c8a8a34)), closes [#1248](https://github.com/mx-space/core/issues/1248)
* chore(deps): update dependency @innei/prettier to v0.12.0 (#1249) ([5a681f8](https://github.com/mx-space/core/commit/5a681f8)), closes [#1249](https://github.com/mx-space/core/issues/1249)
* chore(deps): update dependency @swc/core to v1.3.100 ([4caf845](https://github.com/mx-space/core/commit/4caf845))
* chore(deps): update dependency @types/cache-manager to v4.0.6 ([5ecf16a](https://github.com/mx-space/core/commit/5ecf16a))
* chore(deps): update dependency @types/cors to v2.8.17 (#1242) ([cf49ad1](https://github.com/mx-space/core/commit/cf49ad1)), closes [#1242](https://github.com/mx-space/core/issues/1242)
* chore(deps): update dependency @types/lodash to v4.14.202 (#1201) ([f3cbaa8](https://github.com/mx-space/core/commit/f3cbaa8)), closes [#1201](https://github.com/mx-space/core/issues/1201)
* chore(deps): update dependency @types/node to v20.10.0 ([a42bde6](https://github.com/mx-space/core/commit/a42bde6))
* chore(deps): update dependency @types/node to v20.10.1 ([df30568](https://github.com/mx-space/core/commit/df30568))
* chore(deps): update dependency @types/node to v20.9.3 ([46bbcc3](https://github.com/mx-space/core/commit/46bbcc3))
* chore(deps): update dependency @types/node to v20.9.4 ([cc2f243](https://github.com/mx-space/core/commit/cc2f243))
* chore(deps): update dependency @types/node to v20.9.5 ([5937dc3](https://github.com/mx-space/core/commit/5937dc3))
* chore(deps): update dependency @types/semver to v7.5.6 ([7434fa8](https://github.com/mx-space/core/commit/7434fa8))
* chore(deps): update dependency tsup to v8 (#1234) ([9a0993e](https://github.com/mx-space/core/commit/9a0993e)), closes [#1234](https://github.com/mx-space/core/issues/1234)
* chore(deps): update dependency vite to v5.0.2 ([c9ae565](https://github.com/mx-space/core/commit/c9ae565))
* chore(deps): update dependency vite to v5.0.3 ([48eaaaa](https://github.com/mx-space/core/commit/48eaaaa))
* chore(deps): update dependency vite to v5.0.4 ([16ad7c1](https://github.com/mx-space/core/commit/16ad7c1))
* chore(deps): update pnpm to v8.11.0 (#1252) ([741e928](https://github.com/mx-space/core/commit/741e928)), closes [#1252](https://github.com/mx-space/core/issues/1252)
* fix: in test ([69b1c5f](https://github.com/mx-space/core/commit/69b1c5f))
* fix: typings ([221bf5f](https://github.com/mx-space/core/commit/221bf5f))
* fix: update error throw ([2a97fbe](https://github.com/mx-space/core/commit/2a97fbe))
* fix(deps): update babel monorepo to v7.23.5 ([64f6bb5](https://github.com/mx-space/core/commit/64f6bb5))
* fix(deps): update dependency @typegoose/auto-increment to v4 (#1255) ([4dff159](https://github.com/mx-space/core/commit/4dff159)), closes [#1255](https://github.com/mx-space/core/issues/1255)
* fix(deps): update dependency @typegoose/typegoose to v12 (#1254) ([033395a](https://github.com/mx-space/core/commit/033395a)), closes [#1254](https://github.com/mx-space/core/issues/1254)
* fix(deps): update dependency axios-retry to v4 (#1253) ([8d63c76](https://github.com/mx-space/core/commit/8d63c76)), closes [#1253](https://github.com/mx-space/core/issues/1253)
* fix(deps): update dependency lru-cache to v10.1.0 (#1247) ([c0b193e](https://github.com/mx-space/core/commit/c0b193e)), closes [#1247](https://github.com/mx-space/core/issues/1247)
* fix(deps): update dependency nestjs-pretty-logger to v0.1.1 ([90ac17e](https://github.com/mx-space/core/commit/90ac17e))
* fix(deps): update dependency nestjs-pretty-logger to v0.2.0 (#1257) ([4dee3b2](https://github.com/mx-space/core/commit/4dee3b2)), closes [#1257](https://github.com/mx-space/core/issues/1257)
* refactor: replace logger ([6913dc9](https://github.com/mx-space/core/commit/6913dc9))

## <small>4.6.2 (2023-11-21)</small>

* release: v4.6.2 ([24c85c2](https://github.com/mx-space/core/commit/24c85c2))
* fix: ci ([557c3ce](https://github.com/mx-space/core/commit/557c3ce))
* fix: comment model `refType` type ([1ad151a](https://github.com/mx-space/core/commit/1ad151a))
* fix: comment ref not found statud code ([3a0f67a](https://github.com/mx-space/core/commit/3a0f67a))
* fix: comment refType ([c8039ed](https://github.com/mx-space/core/commit/c8039ed))
* fix: guard init module ([6236de7](https://github.com/mx-space/core/commit/6236de7))
* fix(deps): update babel monorepo to v7.23.4 ([1e8859f](https://github.com/mx-space/core/commit/1e8859f))
* fix(deps): update dependency lru-cache to v10.0.3 ([083c427](https://github.com/mx-space/core/commit/083c427))
* fix(deps): update nest monorepo to v10.2.10 ([07600f3](https://github.com/mx-space/core/commit/07600f3))
* chore: log ci ([49e7c90](https://github.com/mx-space/core/commit/49e7c90))
* chore(deps): update dependency @swc/core to v1.3.99 ([cb07283](https://github.com/mx-space/core/commit/cb07283))
* chore(deps): update dependency @types/babel__core to v7.20.5 ([af54bac](https://github.com/mx-space/core/commit/af54bac))
* chore(deps): update dependency @types/validator to v13.11.7 ([42ec3b9](https://github.com/mx-space/core/commit/42ec3b9))
* chore(deps): update dependency typescript to v5.3.2 (#1237) ([14395ea](https://github.com/mx-space/core/commit/14395ea)), closes [#1237](https://github.com/mx-space/core/issues/1237)
* refactor: collection ref type ([66c2151](https://github.com/mx-space/core/commit/66c2151))

## <small>4.6.1 (2023-11-19)</small>

* release: v4.6.1 ([1404e3c](https://github.com/mx-space/core/commit/1404e3c))
* chore: update badge ([4a90597](https://github.com/mx-space/core/commit/4a90597))
* chore: update deps ([4ca372c](https://github.com/mx-space/core/commit/4ca372c))
* chore(deps): update dependency @types/node to v20.9.1 ([198def2](https://github.com/mx-space/core/commit/198def2))
* chore(deps): update dependency @types/node to v20.9.2 ([a440713](https://github.com/mx-space/core/commit/a440713))
* fix: comment populate `ref_type`, closes #1232 ([c9758a4](https://github.com/mx-space/core/commit/c9758a4)), closes [#1232](https://github.com/mx-space/core/issues/1232)
* fix: remove cdn download url ([795ab13](https://github.com/mx-space/core/commit/795ab13))
* fix(deps): update dependency @typegoose/typegoose to v11.7.1 ([57e565b](https://github.com/mx-space/core/commit/57e565b))
* fix(deps): update dependency axios-retry to v3.9.1 ([70fd41b](https://github.com/mx-space/core/commit/70fd41b))
* fix(deps): update dependency mongoose to v8.0.1 (#1221) ([2c3a218](https://github.com/mx-space/core/commit/2c3a218)), closes [#1221](https://github.com/mx-space/core/issues/1221)
* fix(deps): update nest monorepo to v10.2.9 ([0f26ffb](https://github.com/mx-space/core/commit/0f26ffb))

## 4.6.0 (2023-11-16)

* release: v4.6.0 ([c076a34](https://github.com/mx-space/core/commit/c076a34))
* fix: migrate db ([aee6f63](https://github.com/mx-space/core/commit/aee6f63))
* fix(deps): update babel monorepo to v7.23.3 ([b8adf44](https://github.com/mx-space/core/commit/b8adf44))
* fix(deps): update dependency @nestjs/event-emitter to v2.0.3 ([9f2c47d](https://github.com/mx-space/core/commit/9f2c47d))
* fix(deps): update dependency linkedom to v0.16.4 ([8aa1696](https://github.com/mx-space/core/commit/8aa1696))
* fix(deps): update dependency lru-cache to v10.0.2 ([538c3ae](https://github.com/mx-space/core/commit/538c3ae))
* fix(deps): update dependency marked to v10 (#1214) ([428bece](https://github.com/mx-space/core/commit/428bece)), closes [#1214](https://github.com/mx-space/core/issues/1214)
* fix(deps): update dependency marked to v9.1.6 ([d8a0d8a](https://github.com/mx-space/core/commit/d8a0d8a))
* chore: add gh mirror ([18b395b](https://github.com/mx-space/core/commit/18b395b))
* chore: update deps ([7767e99](https://github.com/mx-space/core/commit/7767e99))
* chore(ci): Refine workflow file (#1204) ([6032dff](https://github.com/mx-space/core/commit/6032dff)), closes [#1204](https://github.com/mx-space/core/issues/1204)
* chore(deps): update dependency @types/js-yaml to v4.0.9 ([2e85b5f](https://github.com/mx-space/core/commit/2e85b5f))
* chore(deps): update dependency @types/node to v20.9.0 ([5ed26ed](https://github.com/mx-space/core/commit/5ed26ed))
* chore(deps): update dependency @types/nodemailer to v6.4.14 ([2cbf6a8](https://github.com/mx-space/core/commit/2cbf6a8))
* chore(deps): update dependency @types/qs to v6.9.10 ([9a8e510](https://github.com/mx-space/core/commit/9a8e510))
* chore(deps): update dependency @types/remove-markdown to v0.3.4 ([1fe23f3](https://github.com/mx-space/core/commit/1fe23f3))
* chore(deps): update dependency @types/semver to v7.5.5 ([e5ed8ec](https://github.com/mx-space/core/commit/e5ed8ec))
* chore(deps): update dependency @types/ua-parser-js to v0.7.39 ([487c693](https://github.com/mx-space/core/commit/487c693))
* chore(deps): update dependency @types/validator to v13.11.6 ([e07c591](https://github.com/mx-space/core/commit/e07c591))
* chore(deps): update dependency prettier to v3.1.0 ([60170d1](https://github.com/mx-space/core/commit/60170d1))
* chore(deps): update pnpm to v8.10.3 ([c805839](https://github.com/mx-space/core/commit/c805839))
* chore(deps): update pnpm to v8.10.4 ([d721c5f](https://github.com/mx-space/core/commit/d721c5f))
* chore(deps): update pnpm to v8.10.5 ([ddbcc66](https://github.com/mx-space/core/commit/ddbcc66))
* feat: Sync system (#1208) ([255e05c](https://github.com/mx-space/core/commit/255e05c)), closes [#1208](https://github.com/mx-space/core/issues/1208)

## <small>4.5.3 (2023-11-07)</small>

* release: v4.5.3 ([2f63b16](https://github.com/mx-space/core/commit/2f63b16))
* fix: release pipe install ([9070e96](https://github.com/mx-space/core/commit/9070e96))
* chore: ci config ([4a378d6](https://github.com/mx-space/core/commit/4a378d6))

## <small>4.5.2 (2023-11-07)</small>

* release: v4.5.2 ([a93d38b](https://github.com/mx-space/core/commit/a93d38b))
* revert: "chore: Refine CI" (#1196) ([affedbb](https://github.com/mx-space/core/commit/affedbb)), closes [#1196](https://github.com/mx-space/core/issues/1196)

## <small>4.5.1 (2023-11-07)</small>

* release: v4.5.1 ([dcb961a](https://github.com/mx-space/core/commit/dcb961a))
* chore: Refine CI (#1189) ([698ed3b](https://github.com/mx-space/core/commit/698ed3b)), closes [#1189](https://github.com/mx-space/core/issues/1189)
* chore: update deps ([b3bf995](https://github.com/mx-space/core/commit/b3bf995))
* chore: update deps ([117153e](https://github.com/mx-space/core/commit/117153e))
* chore(deps): update dependency @types/babel__core to v7.20.4 ([fa4f5f1](https://github.com/mx-space/core/commit/fa4f5f1))
* chore(deps): update dependency @types/bcrypt to v5.0.2 ([491b112](https://github.com/mx-space/core/commit/491b112))
* chore(deps): update dependency @types/cache-manager to v4.0.5 ([500587d](https://github.com/mx-space/core/commit/500587d))
* chore(deps): update dependency redis-memory-server to v0.9.0 (#1171) ([6cae307](https://github.com/mx-space/core/commit/6cae307)), closes [#1171](https://github.com/mx-space/core/issues/1171)
* chore(deps): update pnpm to v8.10.2 (#1172) ([34d1e23](https://github.com/mx-space/core/commit/34d1e23)), closes [#1172](https://github.com/mx-space/core/issues/1172)
* fix: link exists check ([b58dc2f](https://github.com/mx-space/core/commit/b58dc2f))
* fix(deps): update dependency @nestjs/cache-manager to v2.1.1 ([0b7352d](https://github.com/mx-space/core/commit/0b7352d))
* fix(deps): update dependency inquirer to v9 (#1102) ([d7d5f49](https://github.com/mx-space/core/commit/d7d5f49)), closes [#1102](https://github.com/mx-space/core/issues/1102)
* fix(deps): update dependency marked to v9.1.5 ([274ca23](https://github.com/mx-space/core/commit/274ca23))
* fix(deps): update dependency mongoose to v8 (#1179) ([e5ca485](https://github.com/mx-space/core/commit/e5ca485)), closes [#1179](https://github.com/mx-space/core/issues/1179)
* fix(deps): update nest monorepo to v10.2.8 ([0f3b48c](https://github.com/mx-space/core/commit/0f3b48c))
* fix!: migrate maintain in db ([22da4b1](https://github.com/mx-space/core/commit/22da4b1))
* ci: fix disable optional in release ([e7466d0](https://github.com/mx-space/core/commit/e7466d0))

## 4.5.0 (2023-10-31)

* release: v4.5.0 ([73e83ec](https://github.com/mx-space/core/commit/73e83ec))
* chore: update deps ([2ce55ed](https://github.com/mx-space/core/commit/2ce55ed))
* chore(deps): update dependency @nestjs/cli to v10.2.1 ([efbc55d](https://github.com/mx-space/core/commit/efbc55d))
* chore(deps): update dependency @nestjs/schematics to v10.0.3 ([79d2dac](https://github.com/mx-space/core/commit/79d2dac))
* chore(deps): update dependency @types/node to v20.8.10 ([5e4a915](https://github.com/mx-space/core/commit/5e4a915))
* feat: add count apis ([f90772d](https://github.com/mx-space/core/commit/f90772d))
* fix(deps): update dependency marked to v9.1.4 ([3eabdb2](https://github.com/mx-space/core/commit/3eabdb2))
* fix(deps): update dependency mongoose to v7.6.4 ([148f281](https://github.com/mx-space/core/commit/148f281))

## <small>4.4.1 (2023-10-29)</small>

* release: v4.4.1 ([879f27c](https://github.com/mx-space/core/commit/879f27c))
* feat: upgrade deps ([a126bbd](https://github.com/mx-space/core/commit/a126bbd))
* fix: ack path ([05eda82](https://github.com/mx-space/core/commit/05eda82))
* fix(deps): update dependency @nestjs/throttler to v5.0.1 ([126c075](https://github.com/mx-space/core/commit/126c075))
* fix(deps): update dependency axios-retry to v3.8.1 ([d74db15](https://github.com/mx-space/core/commit/d74db15))
* fix(deps): update dependency linkedom to v0.16.1 (#1161) ([dbd7f1d](https://github.com/mx-space/core/commit/dbd7f1d)), closes [#1161](https://github.com/mx-space/core/issues/1161)
* fix(deps): update dependency marked to v9.1.3 ([dc0799c](https://github.com/mx-space/core/commit/dc0799c))
* fix(deps): update dependency nodemailer to v6.9.7 (#1160) ([e6ae312](https://github.com/mx-space/core/commit/e6ae312)), closes [#1160](https://github.com/mx-space/core/issues/1160)
* fix(deps): update dependency ua-parser-js to v1.0.37 ([77f384f](https://github.com/mx-space/core/commit/77f384f))
* chore: remove deprecated routes ([dd9caa0](https://github.com/mx-space/core/commit/dd9caa0))
* chore(deps): update dependency @nestjs/cli to v10.2.0 (#1162) ([bd89d75](https://github.com/mx-space/core/commit/bd89d75)), closes [#1162](https://github.com/mx-space/core/issues/1162)
* chore(deps): update dependency @types/node to v20.8.9 ([80bb50c](https://github.com/mx-space/core/commit/80bb50c))
* chore(deps): update docker/build-push-action action to v5 (#1154) ([53b79b5](https://github.com/mx-space/core/commit/53b79b5)), closes [#1154](https://github.com/mx-space/core/issues/1154)
* chore(deps): update docker/login-action action to v3 (#1155) ([1c38891](https://github.com/mx-space/core/commit/1c38891)), closes [#1155](https://github.com/mx-space/core/issues/1155)
* chore(deps): update docker/metadata-action action to v5 (#1156) ([58e63f5](https://github.com/mx-space/core/commit/58e63f5)), closes [#1156](https://github.com/mx-space/core/issues/1156)
* chore(deps): update docker/setup-buildx-action action to v3 (#1157) ([cee6c74](https://github.com/mx-space/core/commit/cee6c74)), closes [#1157](https://github.com/mx-space/core/issues/1157)
* chore(deps): update docker/setup-qemu-action action to v3 (#1158) ([9d86274](https://github.com/mx-space/core/commit/9d86274)), closes [#1158](https://github.com/mx-space/core/issues/1158)
* chore(release): bump @mx-space/api-client to v1.6.1 ([1476240](https://github.com/mx-space/core/commit/1476240))
* chore(release): bump @mx-space/api-client to v1.6.2 ([ba11fa4](https://github.com/mx-space/core/commit/ba11fa4))

## 4.4.0 (2023-10-21)

* release: v4.4.0 ([c65dcad](https://github.com/mx-space/core/commit/c65dcad))
* chore: update ([127fc7e](https://github.com/mx-space/core/commit/127fc7e))
* chore: update readme ([8990b30](https://github.com/mx-space/core/commit/8990b30))
* chore(deps): update pnpm to v8.9.2 (#1143) ([bc6fbd2](https://github.com/mx-space/core/commit/bc6fbd2)), closes [#1143](https://github.com/mx-space/core/issues/1143)
* chore(release): bump @mx-space/api-client to v1.6.0 ([e7f2e75](https://github.com/mx-space/core/commit/e7f2e75))
* fix!: remove deprecated api route ([5623ee1](https://github.com/mx-space/core/commit/5623ee1))
* feat(api-client): add ack controller ([08dc741](https://github.com/mx-space/core/commit/08dc741))
* refactor: counting logic ([4646473](https://github.com/mx-space/core/commit/4646473))

## <small>4.3.12 (2023-10-18)</small>

* release: v4.3.12 ([eac9743](https://github.com/mx-space/core/commit/eac9743))
* fix: disable api cache if query with ts ([b6796b4](https://github.com/mx-space/core/commit/b6796b4))
* fix: judge  is master ([25870cd](https://github.com/mx-space/core/commit/25870cd))
* fix: lint ([a2e351c](https://github.com/mx-space/core/commit/a2e351c))
* fix: typo ([bbc1821](https://github.com/mx-space/core/commit/bbc1821))
* fix(deps): update dependency ua-parser-js to v1.0.36 (#1132) ([badd8e8](https://github.com/mx-space/core/commit/badd8e8)), closes [#1132](https://github.com/mx-space/core/issues/1132)
* chore: update deps ([462189d](https://github.com/mx-space/core/commit/462189d))
* chore(deps): update dependency vite-tsconfig-paths to v4.2.1 (#1133) ([4d4ad0c](https://github.com/mx-space/core/commit/4d4ad0c)), closes [#1133](https://github.com/mx-space/core/issues/1133)
* chore(deps): update supercharge/redis-github-action action to v1.7.0 (#1127) ([dbf0c52](https://github.com/mx-space/core/commit/dbf0c52)), closes [#1127](https://github.com/mx-space/core/issues/1127)

## <small>4.3.11 (2023-09-24)</small>

* release: v4.3.11 ([cc21837](https://github.com/mx-space/core/commit/cc21837))
* chore: update deps ([ad43521](https://github.com/mx-space/core/commit/ad43521))
* fix: skip throttler for proxy controller ([62cd807](https://github.com/mx-space/core/commit/62cd807))

## <small>4.3.10 (2023-09-13)</small>

* release: v4.3.10 ([4f11c14](https://github.com/mx-space/core/commit/4f11c14))
* chore: add sitemap `changefreq` ([ef996fe](https://github.com/mx-space/core/commit/ef996fe))
* chore: upgrade marked ([399386c](https://github.com/mx-space/core/commit/399386c))
* chore(deps): update actions/checkout action to v4 (#1128) ([55a66d4](https://github.com/mx-space/core/commit/55a66d4)), closes [#1128](https://github.com/mx-space/core/issues/1128)
* chore(deps): update pnpm to v8.7.4 (#1126) ([81d01bd](https://github.com/mx-space/core/commit/81d01bd)), closes [#1126](https://github.com/mx-space/core/issues/1126)
* fix: server time middleware apply ([a4e1bc4](https://github.com/mx-space/core/commit/a4e1bc4))
* fix(deps): update babel monorepo to v7.22.17 (patch) (#1131) ([2f12db6](https://github.com/mx-space/core/commit/2f12db6)), closes [#1131](https://github.com/mx-space/core/issues/1131)

## <small>4.3.9 (2023-09-07)</small>

* release: v4.3.9 ([5c845a3](https://github.com/mx-space/core/commit/5c845a3))
* chore: update deps ([715b93b](https://github.com/mx-space/core/commit/715b93b))
* feat: add server time ([30aeaa7](https://github.com/mx-space/core/commit/30aeaa7))

## <small>4.3.8 (2023-09-05)</small>

* release: v4.3.8 ([28e480f](https://github.com/mx-space/core/commit/28e480f))
* fix: rss description ([d3c65b2](https://github.com/mx-space/core/commit/d3c65b2))

## <small>4.3.7 (2023-09-05)</small>

* release: v4.3.7 ([91cae2f](https://github.com/mx-space/core/commit/91cae2f))
* fix: only use swc in dev ([2bd87e9](https://github.com/mx-space/core/commit/2bd87e9))
* fix: rss 2.0 field ([8a39eaf](https://github.com/mx-space/core/commit/8a39eaf))
* feat: add swc to complie ([d23f71a](https://github.com/mx-space/core/commit/d23f71a))
* chore: update swc and vitest ([52b16b3](https://github.com/mx-space/core/commit/52b16b3))

## <small>4.3.6 (2023-09-05)</small>

* release: v4.3.6 ([a6cdc0a](https://github.com/mx-space/core/commit/a6cdc0a))
* feat: upgrade throttle ([a981f14](https://github.com/mx-space/core/commit/a981f14))
* chore: update minor deps ([15b92de](https://github.com/mx-space/core/commit/15b92de))
* chore(deps): update dependency @nestjs/cli to v10.1.16 (#1117) ([f77f5d2](https://github.com/mx-space/core/commit/f77f5d2)), closes [#1117](https://github.com/mx-space/core/issues/1117)
* chore(deps): update dependency prettier to v3.0.3 (#1118) ([2f62a77](https://github.com/mx-space/core/commit/2f62a77)), closes [#1118](https://github.com/mx-space/core/issues/1118)
* chore(deps): update dependency typescript to v5.2.2 (#1121) ([beb9aea](https://github.com/mx-space/core/commit/beb9aea)), closes [#1121](https://github.com/mx-space/core/issues/1121)
* fix: feed xml content ([a9913cb](https://github.com/mx-space/core/commit/a9913cb))
* fix: typo ([8e1fe79](https://github.com/mx-space/core/commit/8e1fe79))
* fix(deps): update babel monorepo to v7.22.11 (patch) (#1120) ([637c02c](https://github.com/mx-space/core/commit/637c02c)), closes [#1120](https://github.com/mx-space/core/issues/1120)

## <small>4.3.5 (2023-08-23)</small>

* release: v4.3.5 ([8482fdb](https://github.com/mx-space/core/commit/8482fdb))
* fix: remove lean for popluate ([d4d64a2](https://github.com/mx-space/core/commit/d4d64a2))

## <small>4.3.4 (2023-08-22)</small>

* release: v4.3.4 ([7ee1a42](https://github.com/mx-space/core/commit/7ee1a42))
* fix: docker-compose command (#1111) ([4495304](https://github.com/mx-space/core/commit/4495304)), closes [#1111](https://github.com/mx-space/core/issues/1111)
* fix: redis password auth ([0c1655e](https://github.com/mx-space/core/commit/0c1655e))
* chore: remove pty in readme (#1110) ([9f38660](https://github.com/mx-space/core/commit/9f38660)), closes [#1110](https://github.com/mx-space/core/issues/1110)
* chore: renovate ([0ceb181](https://github.com/mx-space/core/commit/0ceb181))
* chore: update deps ([87907d0](https://github.com/mx-space/core/commit/87907d0))
* chore(deps): update all non-major dependencies (minor) (#1098) ([a53ed73](https://github.com/mx-space/core/commit/a53ed73)), closes [#1098](https://github.com/mx-space/core/issues/1098)
* chore(deps): update all non-major dependencies (patch) (#1106) ([0e2e10f](https://github.com/mx-space/core/commit/0e2e10f)), closes [#1106](https://github.com/mx-space/core/issues/1106)

## <small>4.3.3 (2023-08-10)</small>

* release: v4.3.3 ([450aacd](https://github.com/mx-space/core/commit/450aacd))
* chore(pty): just disable it and no ref ([6867a9b](https://github.com/mx-space/core/commit/6867a9b))
* fix: bind port only local ([4993076](https://github.com/mx-space/core/commit/4993076))
* fix: build ([a44842a](https://github.com/mx-space/core/commit/a44842a))
* fix: remove webshell ([2b36d9a](https://github.com/mx-space/core/commit/2b36d9a))

## <small>4.3.2 (2023-08-10)</small>

* release: v4.3.2 ([a455b1a](https://github.com/mx-space/core/commit/a455b1a))
* chore: update deps ([1d91c14](https://github.com/mx-space/core/commit/1d91c14))
* fix: typo ([9c3f48a](https://github.com/mx-space/core/commit/9c3f48a))

## <small>4.3.1 (2023-08-10)</small>

* release: v4.3.1 ([b3e5930](https://github.com/mx-space/core/commit/b3e5930))
* fix: post data wrapped ([4132bab](https://github.com/mx-space/core/commit/4132bab))
* fix: remove default noe ([e3e49c0](https://github.com/mx-space/core/commit/e3e49c0))
* fix(deps): update dependency marked to v7 (#1107) ([a6d186a](https://github.com/mx-space/core/commit/a6d186a)), closes [#1107](https://github.com/mx-space/core/issues/1107)
* chore: remove method ([ebf9360](https://github.com/mx-space/core/commit/ebf9360))
* chore: update deps ([6b187ff](https://github.com/mx-space/core/commit/6b187ff))
* chore(release): bump @mx-space/api-client to v1.5.0 ([5e98ff0](https://github.com/mx-space/core/commit/5e98ff0))
* chore(release): bump @mx-space/api-client to v1.5.1 ([ed9d29c](https://github.com/mx-space/core/commit/ed9d29c))
* feat: allow disabling SSL/TLS for SMTP (#1108) ([42f2f83](https://github.com/mx-space/core/commit/42f2f83)), closes [#1108](https://github.com/mx-space/core/issues/1108)

## 4.3.0 (2023-08-06)

* release: v4.3.0 ([148667e](https://github.com/mx-space/core/commit/148667e))
* feat: activity controller ([61b4fb3](https://github.com/mx-space/core/commit/61b4fb3))
* feat: add api client for activity controller ([44ab9dc](https://github.com/mx-space/core/commit/44ab9dc))
* fix: like list query ([03ca5c6](https://github.com/mx-space/core/commit/03ca5c6))
* fix(deps): update all non-major dependencies (#1100) ([6d781ac](https://github.com/mx-space/core/commit/6d781ac)), closes [#1100](https://github.com/mx-space/core/issues/1100)
* chore: update markedjs ([99354ca](https://github.com/mx-space/core/commit/99354ca))

## <small>4.2.14 (2023-07-30)</small>

* release: v4.2.14 ([9bb7808](https://github.com/mx-space/core/commit/9bb7808))
* fix: create post error when related post ([72f78a2](https://github.com/mx-space/core/commit/72f78a2))
* fix: deps version ([c14e8bf](https://github.com/mx-space/core/commit/c14e8bf))
* chore: update deps ([de16dde](https://github.com/mx-space/core/commit/de16dde))

## <small>4.2.13 (2023-07-27)</small>

* release: v4.2.13 ([a0a5a3d](https://github.com/mx-space/core/commit/a0a5a3d))
* fix: distinguish between the types of comments ([e4ce8cd](https://github.com/mx-space/core/commit/e4ce8cd))
* fix: leanid ([b30565d](https://github.com/mx-space/core/commit/b30565d))
* fix: typo ([7054c79](https://github.com/mx-space/core/commit/7054c79))
* fix(deps): update all non-major dependencies (minor) (#1097) ([33b14d8](https://github.com/mx-space/core/commit/33b14d8)), closes [#1097](https://github.com/mx-space/core/issues/1097)
* fix(deps): update all non-major dependencies (patch) (#1081) ([80218f0](https://github.com/mx-space/core/commit/80218f0)), closes [#1081](https://github.com/mx-space/core/issues/1081)
* chore: code style ([805d060](https://github.com/mx-space/core/commit/805d060))

## <small>4.2.12 (2023-07-07)</small>

* release: v4.2.12 ([e1b4d88](https://github.com/mx-space/core/commit/e1b4d88))
* fix: related ([9c16544](https://github.com/mx-space/core/commit/9c16544))

## <small>4.2.11 (2023-07-05)</small>

* release: v4.2.11 ([d8b3652](https://github.com/mx-space/core/commit/d8b3652))
* fix: throw ([950dc8c](https://github.com/mx-space/core/commit/950dc8c))
* feat: add extra field for `/top` ([a7b4513](https://github.com/mx-space/core/commit/a7b4513))
* chore(deps): update all non-major dependencies (minor) (#1080) ([8fbfa81](https://github.com/mx-space/core/commit/8fbfa81)), closes [#1080](https://github.com/mx-space/core/issues/1080)

## <small>4.2.10 (2023-07-04)</small>

* release: v4.2.10 ([5eac636](https://github.com/mx-space/core/commit/5eac636))
* feat: fn support broardcast ([dadd3c8](https://github.com/mx-space/core/commit/dadd3c8))

## <small>4.2.9 (2023-07-03)</small>

* release: v4.2.9 ([51d3249](https://github.com/mx-space/core/commit/51d3249))
* fix: adjust module seq ([d24dc6e](https://github.com/mx-space/core/commit/d24dc6e))
* fix: timeline lean query ([313b8d0](https://github.com/mx-space/core/commit/313b8d0))

## <small>4.2.8 (2023-06-28)</small>

* release: v4.2.8 ([f4beb9d](https://github.com/mx-space/core/commit/f4beb9d))
* fix: add types in comment ([34d8d3f](https://github.com/mx-space/core/commit/34d8d3f))
* fix: nest comment children nested and limit max depth ([ccc5b54](https://github.com/mx-space/core/commit/ccc5b54))
* fix: omit data if patch post data ([904c31b](https://github.com/mx-space/core/commit/904c31b))
* fix: populate comment avatar ([591ae33](https://github.com/mx-space/core/commit/591ae33))
* fix: test port cmd ([f78ede7](https://github.com/mx-space/core/commit/f78ede7))
* feat: post related each other ([c822398](https://github.com/mx-space/core/commit/c822398))
* chore(release): bump @mx-space/api-client to v1.4.3 ([46103d8](https://github.com/mx-space/core/commit/46103d8))

## <small>4.2.7 (2023-06-27)</small>

* release: v4.2.7 ([73f5440](https://github.com/mx-space/core/commit/73f5440))
* fix: comment mail props ([26f23cb](https://github.com/mx-space/core/commit/26f23cb))
* feat: comment modal add `avatar` and `source` ([cf98260](https://github.com/mx-space/core/commit/cf98260))
* feat: serverless cache ttl ([0c4849c](https://github.com/mx-space/core/commit/0c4849c))
* chore: update deps ([d1fd000](https://github.com/mx-space/core/commit/d1fd000))

## <small>4.2.6 (2023-06-23)</small>

* release: v4.2.6 ([cdcb744](https://github.com/mx-space/core/commit/cdcb744))
* fix: enum uppercase ([33539aa](https://github.com/mx-space/core/commit/33539aa))
* fix: re-sign token ([719a49c](https://github.com/mx-space/core/commit/719a49c))

## <small>4.2.5 (2023-06-23)</small>

* release: v4.2.5 ([7eea2e3](https://github.com/mx-space/core/commit/7eea2e3))
* fix:test case ([2eb81b2](https://github.com/mx-space/core/commit/2eb81b2))
* fix: cache manger ttl ([adbb000](https://github.com/mx-space/core/commit/adbb000))
* fix: test ([38f4d3b](https://github.com/mx-space/core/commit/38f4d3b))
* feat: add process reporter ([6744f03](https://github.com/mx-space/core/commit/6744f03))

## <small>4.2.4 (2023-06-23)</small>

* release: v4.2.4 ([47a1179](https://github.com/mx-space/core/commit/47a1179))
* chore: update deps ([4f115fb](https://github.com/mx-space/core/commit/4f115fb))
* fix: re-sign jwt delay ([7536dd1](https://github.com/mx-space/core/commit/7536dd1))

## <small>4.2.3 (2023-06-20)</small>

* release: v4.2.3 ([972e2cd](https://github.com/mx-space/core/commit/972e2cd))
* fix: release script ([f190634](https://github.com/mx-space/core/commit/f190634))
* fix: type error ([45eba0e](https://github.com/mx-space/core/commit/45eba0e))
* fix(note): remove password field ([b49711c](https://github.com/mx-space/core/commit/b49711c))
* chore: add trusted domain ([5e7b5cf](https://github.com/mx-space/core/commit/5e7b5cf))
* chore: update deps ([8fd18e2](https://github.com/mx-space/core/commit/8fd18e2))
* chore(release): bump @mx-space/api-client to v1.4.2 ([d7e4db7](https://github.com/mx-space/core/commit/d7e4db7))

## <small>4.2.2 (2023-06-17)</small>

* release: v4.2.2 ([de0ed9f](https://github.com/mx-space/core/commit/de0ed9f))
* fix: test case ([fbcf2cc](https://github.com/mx-space/core/commit/fbcf2cc))
* refactor: cache clean and ttl ([06e21ec](https://github.com/mx-space/core/commit/06e21ec))

## <small>4.2.1 (2023-06-16)</small>

* release: v4.2.1 ([74ba088](https://github.com/mx-space/core/commit/74ba088))
* feat: add debug logging ([b5a2b7f](https://github.com/mx-space/core/commit/b5a2b7f))

## 4.2.0 (2023-06-16)

* release: v4.2.0 ([54275be](https://github.com/mx-space/core/commit/54275be))
* chore: lint ([b226666](https://github.com/mx-space/core/commit/b226666))
* chore: server cache ([b1afb6e](https://github.com/mx-space/core/commit/b1afb6e))
* chore: update deps ([0f53f86](https://github.com/mx-space/core/commit/0f53f86))
* chore: update deps ([0761cea](https://github.com/mx-space/core/commit/0761cea))
* chore(release): bump @mx-space/api-client to v1.4.1 ([43e7401](https://github.com/mx-space/core/commit/43e7401))
* fix: cp .env in docker ci ([3e48439](https://github.com/mx-space/core/commit/3e48439))
* fix: docker build ([944c571](https://github.com/mx-space/core/commit/944c571))
* fix(client): add `$serialized` for response object ([3a9e257](https://github.com/mx-space/core/commit/3a9e257))

## 4.1.0 (2023-06-08)

* release: v4.1.0 ([864fb31](https://github.com/mx-space/core/commit/864fb31))
* fix: escapeXml for feed ([5821c04](https://github.com/mx-space/core/commit/5821c04))

## 4.1.0-beta.1 (2023-06-07)

* release: v4.1.0-beta.1 ([b141e42](https://github.com/mx-space/core/commit/b141e42))
* fix: add config encrypt args to dockerfile ([2f455dc](https://github.com/mx-space/core/commit/2f455dc))
* fix: init proj script ([bec063f](https://github.com/mx-space/core/commit/bec063f))
* fix: remove marked warning ([f3f47ef](https://github.com/mx-space/core/commit/f3f47ef))
* feat: add some info on comment render ([a120498](https://github.com/mx-space/core/commit/a120498))
* chore: up `max_memory_restart` to 520M ([0131e86](https://github.com/mx-space/core/commit/0131e86))
* perf: cache get subscribe email template ([1b602ea](https://github.com/mx-space/core/commit/1b602ea))

## 4.1.0-beta.0 (2023-06-06)

* release: v4.1.0-beta.0 ([63213f1](https://github.com/mx-space/core/commit/63213f1))
* feat: update email template ([a874c66](https://github.com/mx-space/core/commit/a874c66))
* fix: bypass if not init system ([99b7a03](https://github.com/mx-space/core/commit/99b7a03))
* fix: update test case ([771d6c5](https://github.com/mx-space/core/commit/771d6c5))
* chore: lint ([4f2f9e3](https://github.com/mx-space/core/commit/4f2f9e3))
* refactor: email template module ([6f94a86](https://github.com/mx-space/core/commit/6f94a86))

## 4.1.0-alpha.0 (2023-06-04)

* release: v4.1.0-alpha.0 ([e5553ff](https://github.com/mx-space/core/commit/e5553ff))
* fix: push script ([754f560](https://github.com/mx-space/core/commit/754f560))
* fix(deps): update all non-major dependencies (patch) (#1079) ([4203077](https://github.com/mx-space/core/commit/4203077)), closes [#1079](https://github.com/mx-space/core/issues/1079)
* chore: remove swagger ([92a5460](https://github.com/mx-space/core/commit/92a5460))
* chore: update deps ([001c179](https://github.com/mx-space/core/commit/001c179))
* chore: update script ([8d5b366](https://github.com/mx-space/core/commit/8d5b366))
* chore(package.json): update dependencies ([1ec0928](https://github.com/mx-space/core/commit/1ec0928))
* refactor: monorepo structure (#1082) ([ffdc153](https://github.com/mx-space/core/commit/ffdc153)), closes [#1082](https://github.com/mx-space/core/issues/1082)

## <small>4.0.2 (2023-05-25)</small>

* release: v4.0.2 ([a601e1d](https://github.com/mx-space/core/commit/a601e1d))
* fix(deps): update all non-major dependencies (patch) (#1072) ([316ad0b](https://github.com/mx-space/core/commit/316ad0b)), closes [#1072](https://github.com/mx-space/core/issues/1072)
* fix(deps): update all non-major dependencies (patch) (#1076) ([96604b6](https://github.com/mx-space/core/commit/96604b6)), closes [#1076](https://github.com/mx-space/core/issues/1076)
* fix(serverless): delete stale built-in function ([83d8eed](https://github.com/mx-space/core/commit/83d8eed))
* chore(deps): update all non-major dependencies (minor) (#1073) ([9166517](https://github.com/mx-space/core/commit/9166517)), closes [#1073](https://github.com/mx-space/core/issues/1073)
* chore(deps): update all non-major dependencies (minor) (#1077) ([ca5e1f7](https://github.com/mx-space/core/commit/ca5e1f7)), closes [#1077](https://github.com/mx-space/core/issues/1077)

## <small>4.0.1 (2023-05-11)</small>

* release: v4.0.1 ([d0eec9c](https://github.com/mx-space/core/commit/d0eec9c))
* chore: update deps ([9431d88](https://github.com/mx-space/core/commit/9431d88))
* fix: update xlog get_page_id ([3c3a4f7](https://github.com/mx-space/core/commit/3c3a4f7))

## 4.0.0 (2023-05-02)

* release: v4.0.0 ([9eaa3e4](https://github.com/mx-space/core/commit/9eaa3e4))
* feat!: remove fs-extra ([99a3227](https://github.com/mx-space/core/commit/99a3227))
* feat!: upgrade to node 18 ([c85fe14](https://github.com/mx-space/core/commit/c85fe14))
* chore: add trusted domain ([70ff39c](https://github.com/mx-space/core/commit/70ff39c))
* chore: remove node-fetch ([5211320](https://github.com/mx-space/core/commit/5211320))
* ci: update renovate ([e3e18c1](https://github.com/mx-space/core/commit/e3e18c1))

## <small>3.43.7 (2023-04-30)</small>

* release: v3.43.7 ([307cf3a](https://github.com/mx-space/core/commit/307cf3a))
* feat: support page reorder ([e577109](https://github.com/mx-space/core/commit/e577109))
* fix: image record filter ([fa2f72a](https://github.com/mx-space/core/commit/fa2f72a))
* fix: images uniq ([9f62272](https://github.com/mx-space/core/commit/9f62272))

## <small>3.43.6 (2023-04-30)</small>

* release: v3.43.6 ([6c86e10](https://github.com/mx-space/core/commit/6c86e10))
* fix: search posts with category ([71f20e3](https://github.com/mx-space/core/commit/71f20e3))
* ci: reduce run ([e31b6ea](https://github.com/mx-space/core/commit/e31b6ea))

## <small>3.43.5 (2023-04-29)</small>

* release: v3.43.5 ([2f0b66a](https://github.com/mx-space/core/commit/2f0b66a))
* chore: update api-client ([fb69652](https://github.com/mx-space/core/commit/fb69652))
* chore(deps): update dependency @nestjs/cli to v9.4.2 (#1059) ([d41d8ff](https://github.com/mx-space/core/commit/d41d8ff)), closes [#1059](https://github.com/mx-space/core/issues/1059)
* chore(deps): update dependency @types/node to v18.16.0 (#1058) ([5bbb484](https://github.com/mx-space/core/commit/5bbb484)), closes [#1058](https://github.com/mx-space/core/issues/1058)
* chore(deps): update dependency lint-staged to v13.2.2 (#1061) ([2917341](https://github.com/mx-space/core/commit/2917341)), closes [#1061](https://github.com/mx-space/core/issues/1061)
* chore(release): bump @mx-space/api-client to v1.4.0 ([51dcf1f](https://github.com/mx-space/core/commit/51dcf1f))
* feat: select `meta` and `images` for top ([cd4c898](https://github.com/mx-space/core/commit/cd4c898))
* fix: remove require cache after install deps ([bda1322](https://github.com/mx-space/core/commit/bda1322))
* fix(deps): update dependency @types/jsonwebtoken to v9.0.2 (#1064) ([c89f4cf](https://github.com/mx-space/core/commit/c89f4cf)), closes [#1064](https://github.com/mx-space/core/issues/1064)
* fix(deps): update dependency mongoose to v7.1.0 (#1065) ([291a2f4](https://github.com/mx-space/core/commit/291a2f4)), closes [#1065](https://github.com/mx-space/core/issues/1065)
* fix(deps): update dependency mongoose-lean-getters to v1 (#1066) ([617d929](https://github.com/mx-space/core/commit/617d929)), closes [#1066](https://github.com/mx-space/core/issues/1066)
* fix(deps): update dependency rxjs to v7.8.1 (#1062) ([910b037](https://github.com/mx-space/core/commit/910b037)), closes [#1062](https://github.com/mx-space/core/issues/1062)

## <small>3.43.4 (2023-04-25)</small>

* release: v3.43.4 ([eaf999f](https://github.com/mx-space/core/commit/eaf999f))
* fix: autopopulate ([dd0ca23](https://github.com/mx-space/core/commit/dd0ca23))
* fix: autopopulate note ([040856e](https://github.com/mx-space/core/commit/040856e))
* fix: batch to schedule ([ccd570d](https://github.com/mx-space/core/commit/ccd570d))
* fix: lean of autopopulate ([cb72911](https://github.com/mx-space/core/commit/cb72911))
* fix: limit comment max deep of 10 ([9fa805a](https://github.com/mx-space/core/commit/9fa805a))
* fix(deps): update dependency @typegoose/typegoose to v11.0.2 (#1048) ([b16260b](https://github.com/mx-space/core/commit/b16260b)), closes [#1048](https://github.com/mx-space/core/issues/1048)
* fix(deps): update dependency commander to v10 (#984) ([4aee684](https://github.com/mx-space/core/commit/4aee684)), closes [#984](https://github.com/mx-space/core/issues/984)
* fix(deps): update dependency isbot to v3.6.10 (#1055) ([5580aae](https://github.com/mx-space/core/commit/5580aae)), closes [#1055](https://github.com/mx-space/core/issues/1055)
* fix(deps): update dependency mongoose to v7.0.4 (#1053) ([d366d78](https://github.com/mx-space/core/commit/d366d78)), closes [#1053](https://github.com/mx-space/core/issues/1053)
* chore: update lru ([44286f2](https://github.com/mx-space/core/commit/44286f2))
* chore: update test snap ([1ce6322](https://github.com/mx-space/core/commit/1ce6322))
* chore(deps): update dependency @nestjs/cli to v9.4.1 (#1056) ([aa60a97](https://github.com/mx-space/core/commit/aa60a97)), closes [#1056](https://github.com/mx-space/core/issues/1056)
* chore(deps): update dependency @types/lodash to v4.14.194 (#1045) ([e867405](https://github.com/mx-space/core/commit/e867405)), closes [#1045](https://github.com/mx-space/core/issues/1045)
* chore(deps): update dependency @types/node to v18.15.13 (#1054) ([1996375](https://github.com/mx-space/core/commit/1996375)), closes [#1054](https://github.com/mx-space/core/issues/1054)
* chore(deps): update dependency ioredis to v5.3.2 (#1047) ([ea0692c](https://github.com/mx-space/core/commit/ea0692c)), closes [#1047](https://github.com/mx-space/core/issues/1047)
* chore(deps): update dependency prettier to v2.8.8 (#1057) ([4bfd750](https://github.com/mx-space/core/commit/4bfd750)), closes [#1057](https://github.com/mx-space/core/issues/1057)
* chore(deps): update dependency rimraf to v5 (#1050) ([e94101d](https://github.com/mx-space/core/commit/e94101d)), closes [#1050](https://github.com/mx-space/core/issues/1050)
* chore(deps): update dependency semver to v7.5.0 (#1041) ([934a06b](https://github.com/mx-space/core/commit/934a06b)), closes [#1041](https://github.com/mx-space/core/issues/1041)

## <small>3.43.3 (2023-04-19)</small>

* release: v3.43.3 ([94ecad5](https://github.com/mx-space/core/commit/94ecad5))
* chore: update deps ([5ef2e3b](https://github.com/mx-space/core/commit/5ef2e3b))
* chore(deps): update dependency @types/lodash to v4.14.192 (#1025) ([ff45cd6](https://github.com/mx-space/core/commit/ff45cd6)), closes [#1025](https://github.com/mx-space/core/issues/1025)
* chore(deps): update dependency ky to v0.33.3 (#1018) ([9268e6c](https://github.com/mx-space/core/commit/9268e6c)), closes [#1018](https://github.com/mx-space/core/issues/1018)
* chore(deps): update dependency lint-staged to v13.2.1 (#1036) ([697c954](https://github.com/mx-space/core/commit/697c954)), closes [#1036](https://github.com/mx-space/core/issues/1036)
* chore(deps): update dependency mongodb-memory-server to v8.12.2 (#1034) ([0a5331f](https://github.com/mx-space/core/commit/0a5331f)), closes [#1034](https://github.com/mx-space/core/issues/1034)
* chore(deps): update dependency node-fetch to v3.3.1 (#1011) ([51ea221](https://github.com/mx-space/core/commit/51ea221)), closes [#1011](https://github.com/mx-space/core/issues/1011)
* chore(deps): update dependency typescript to v5.0.4 (#1037) ([b0f3a4b](https://github.com/mx-space/core/commit/b0f3a4b)), closes [#1037](https://github.com/mx-space/core/issues/1037)
* chore(deps): update dependency vite-tsconfig-paths to v4.0.9 (#1014) ([dbf91bc](https://github.com/mx-space/core/commit/dbf91bc)), closes [#1014](https://github.com/mx-space/core/issues/1014)
* chore(deps): update dependency vite-tsconfig-paths to v4.2.0 (#1042) ([d803ad5](https://github.com/mx-space/core/commit/d803ad5)), closes [#1042](https://github.com/mx-space/core/issues/1042)
* fix: check note is not public ([df2c541](https://github.com/mx-space/core/commit/df2c541))
* fix: secret note should shown when logged ([c72d921](https://github.com/mx-space/core/commit/c72d921))
* fix(deps): update dependency @fastify/multipart to v7.6.0 (#1043) ([057d83d](https://github.com/mx-space/core/commit/057d83d)), closes [#1043](https://github.com/mx-space/core/issues/1043)
* fix(deps): update dependency @fastify/static to v6.10.1 (#1032) ([a5eb45f](https://github.com/mx-space/core/commit/a5eb45f)), closes [#1032](https://github.com/mx-space/core/issues/1032)
* fix(deps): update dependency @nestjs/schedule to v2.2.1 (#1038) ([5d66f02](https://github.com/mx-space/core/commit/5d66f02)), closes [#1038](https://github.com/mx-space/core/issues/1038)
* fix(deps): update dependency algoliasearch to v4.17.0 (#1033) ([9bf7fda](https://github.com/mx-space/core/commit/9bf7fda)), closes [#1033](https://github.com/mx-space/core/issues/1033)
* fix(deps): update dependency lru-cache to v8.0.5 (#1039) ([cb791f1](https://github.com/mx-space/core/commit/cb791f1)), closes [#1039](https://github.com/mx-space/core/issues/1039)
* fix(deps): update dependency ua-parser-js to v1.0.35 (#1031) ([9e8695d](https://github.com/mx-space/core/commit/9e8695d)), closes [#1031](https://github.com/mx-space/core/issues/1031)
* fix(deps): update dependency vm2 to v3.9.16 (#1040) ([da6f397](https://github.com/mx-space/core/commit/da6f397)), closes [#1040](https://github.com/mx-space/core/issues/1040)
* fix(deps): update nest monorepo to v9.4.0 (minor) (#1044) ([ab80510](https://github.com/mx-space/core/commit/ab80510)), closes [#1044](https://github.com/mx-space/core/issues/1044)

## <small>3.43.2 (2023-04-08)</small>

* release: v3.43.2 ([ca95440](https://github.com/mx-space/core/commit/ca95440))
* feat: add api for get full url by id ([974cd17](https://github.com/mx-space/core/commit/974cd17))
* fix: getconfig max retry count and encrypt key ([fd56106](https://github.com/mx-space/core/commit/fd56106))

## <small>3.43.1 (2023-04-05)</small>

* release: v3.43.1 ([d912595](https://github.com/mx-space/core/commit/d912595))
* feat: add snippet for xlog summary ([710c083](https://github.com/mx-space/core/commit/710c083))
* fix(posts): get post paginate should parse `meta` as json ([f7b1d0d](https://github.com/mx-space/core/commit/f7b1d0d))
* chore: update docs ([f426816](https://github.com/mx-space/core/commit/f426816))

## 3.43.0 (2023-04-05)

* release: v3.43.0 ([b4847f9](https://github.com/mx-space/core/commit/b4847f9))
* fix: built-in snippets reference missing ([9ca58db](https://github.com/mx-space/core/commit/9ca58db))
* fix: make ts happy ([3f852a7](https://github.com/mx-space/core/commit/3f852a7))
* feat!: add xlog fn and `builtIn` on snippets model ([ae379a4](https://github.com/mx-space/core/commit/ae379a4))
* chore: update dependencies ([4fb5575](https://github.com/mx-space/core/commit/4fb5575))
* chore: update pnpm version ([fb311d4](https://github.com/mx-space/core/commit/fb311d4))
* chore(deps): update dependency tsup to v6.7.0 (#1028) ([837b679](https://github.com/mx-space/core/commit/837b679)), closes [#1028](https://github.com/mx-space/core/issues/1028)

## <small>3.42.7 (2023-03-29)</small>

* release: v3.42.7 ([7270ba8](https://github.com/mx-space/core/commit/7270ba8))
* chore: update deps ([de0f72f](https://github.com/mx-space/core/commit/de0f72f))
* ci: lock pnpm version ([dc4ffb9](https://github.com/mx-space/core/commit/dc4ffb9))

## <small>3.42.6 (2023-03-28)</small>

* release: v3.42.6 ([0b208d4](https://github.com/mx-space/core/commit/0b208d4))
* fix: comment `pin` default ([4f63b48](https://github.com/mx-space/core/commit/4f63b48))

## <small>3.42.5 (2023-03-26)</small>

* release: v3.42.5 ([e785ce4](https://github.com/mx-space/core/commit/e785ce4))
* fix: change getter of mongoose `_id` ([8dc1197](https://github.com/mx-space/core/commit/8dc1197))
* fix(api-client): add missing property `location` ([e6fd545](https://github.com/mx-space/core/commit/e6fd545))
* fix(deps): update babel monorepo to v7.21.3 (#1015) ([ef16942](https://github.com/mx-space/core/commit/ef16942)), closes [#1015](https://github.com/mx-space/core/issues/1015)
* fix(deps): update dependency @babel/plugin-transform-modules-commonjs to v7.21.2 (#992) ([050030d](https://github.com/mx-space/core/commit/050030d)), closes [#992](https://github.com/mx-space/core/issues/992)
* fix(deps): update dependency @fastify/multipart to v7.4.2 (#1000) ([55b329d](https://github.com/mx-space/core/commit/55b329d)), closes [#1000](https://github.com/mx-space/core/issues/1000)
* fix(deps): update dependency @typegoose/auto-increment to v2.2.0 (#993) ([bdec391](https://github.com/mx-space/core/commit/bdec391)), closes [#993](https://github.com/mx-space/core/issues/993)
* fix(deps): update dependency algoliasearch to v4.15.0 (#1004) ([093fe6f](https://github.com/mx-space/core/commit/093fe6f)), closes [#1004](https://github.com/mx-space/core/issues/1004)
* fix(deps): update dependency ejs to v3.1.9 (#1016) ([ea2cb8f](https://github.com/mx-space/core/commit/ea2cb8f)), closes [#1016](https://github.com/mx-space/core/issues/1016)
* fix(deps): update dependency linkedom to v0.14.24 (#1002) ([b7c0dc8](https://github.com/mx-space/core/commit/b7c0dc8)), closes [#1002](https://github.com/mx-space/core/issues/1002)
* fix(deps): update dependency lru-cache to v7.17.0 (#985) ([311bbaa](https://github.com/mx-space/core/commit/311bbaa)), closes [#985](https://github.com/mx-space/core/issues/985)
* fix(deps): update dependency lru-cache to v7.17.2 (#996) ([c11d68e](https://github.com/mx-space/core/commit/c11d68e)), closes [#996](https://github.com/mx-space/core/issues/996)
* fix(deps): update dependency lru-cache to v7.18.3 (#1006) ([7fb2087](https://github.com/mx-space/core/commit/7fb2087)), closes [#1006](https://github.com/mx-space/core/issues/1006)
* fix(deps): update dependency mongoose to v6.10.3 (#1007) ([9d8eb9d](https://github.com/mx-space/core/commit/9d8eb9d)), closes [#1007](https://github.com/mx-space/core/issues/1007)
* fix(deps): update dependency mongoose to v6.9.3 (#986) ([2e8bc4a](https://github.com/mx-space/core/commit/2e8bc4a)), closes [#986](https://github.com/mx-space/core/issues/986)
* fix(deps): update dependency qs to v6.11.1 (#1001) ([e96a9b9](https://github.com/mx-space/core/commit/e96a9b9)), closes [#1001](https://github.com/mx-space/core/issues/1001)
* fix(deps): update dependency ua-parser-js to v1.0.34 (#999) ([a678403](https://github.com/mx-space/core/commit/a678403)), closes [#999](https://github.com/mx-space/core/issues/999)
* chore(deps): update dependency @innei/eslint-config-ts to v0.9.8 (#1008) ([3767061](https://github.com/mx-space/core/commit/3767061)), closes [#1008](https://github.com/mx-space/core/issues/1008)
* chore(deps): update dependency @innei/prettier to v0.9.8 (#1009) ([84c90fd](https://github.com/mx-space/core/commit/84c90fd)), closes [#1009](https://github.com/mx-space/core/issues/1009)
* chore(deps): update dependency @types/express to v4.17.17 (#963) ([dba9388](https://github.com/mx-space/core/commit/dba9388)), closes [#963](https://github.com/mx-space/core/issues/963)
* chore(deps): update dependency @types/fs-extra to v11 (#975) ([ab8786b](https://github.com/mx-space/core/commit/ab8786b)), closes [#975](https://github.com/mx-space/core/issues/975)
* chore(deps): update dependency @types/node to v18.14.6 (#991) ([423f2e4](https://github.com/mx-space/core/commit/423f2e4)), closes [#991](https://github.com/mx-space/core/issues/991)
* chore(deps): update dependency @types/validator to v13.7.14 (#998) ([e8f9437](https://github.com/mx-space/core/commit/e8f9437)), closes [#998](https://github.com/mx-space/core/issues/998)
* chore(deps): update dependency lint-staged to v13.1.4 (#1010) ([6822b8c](https://github.com/mx-space/core/commit/6822b8c)), closes [#1010](https://github.com/mx-space/core/issues/1010)
* chore(deps): update dependency mongodb-memory-server to v8.11.5 (#989) ([3a18d7d](https://github.com/mx-space/core/commit/3a18d7d)), closes [#989](https://github.com/mx-space/core/issues/989)
* chore(deps): update dependency socket.io to v4.6.1 (#988) ([3063059](https://github.com/mx-space/core/commit/3063059)), closes [#988](https://github.com/mx-space/core/issues/988)
* chore(deps): update dependency tsup to v6.6.3 (#977) ([e7098b9](https://github.com/mx-space/core/commit/e7098b9)), closes [#977](https://github.com/mx-space/core/issues/977)
* chore(deps): update dependency zx to v7.2.0 (#995) ([8fb590a](https://github.com/mx-space/core/commit/8fb590a)), closes [#995](https://github.com/mx-space/core/issues/995)
* chore(deps): update supercharge/mongodb-github-action action to v1.9.0 (#1003) ([d6751f6](https://github.com/mx-space/core/commit/d6751f6)), closes [#1003](https://github.com/mx-space/core/issues/1003)
* chore(release): bump @mx-space/api-client to v1.3.5 ([761a470](https://github.com/mx-space/core/commit/761a470))
* feat: auto download admin (#1005 ([f57b23e](https://github.com/mx-space/core/commit/f57b23e)), closes [#1005](https://github.com/mx-space/core/issues/1005)

## <small>3.42.4 (2023-02-21)</small>

* release: v3.42.4 ([268372c](https://github.com/mx-space/core/commit/268372c))
* chore: renovate bot ([47daa01](https://github.com/mx-space/core/commit/47daa01))
* chore: update deps ([64f70a3](https://github.com/mx-space/core/commit/64f70a3))
* chore(deps): update docker/build-push-action action to v4 (#982) ([58b7e64](https://github.com/mx-space/core/commit/58b7e64)), closes [#982](https://github.com/mx-space/core/issues/982)
* chore(deps): update supercharge/redis-github-action action to v1.5.0 (#980) ([2e555b7](https://github.com/mx-space/core/commit/2e555b7)), closes [#980](https://github.com/mx-space/core/issues/980)
* fix(deps): update nest monorepo to v9.3.9 (#979) ([792f2d5](https://github.com/mx-space/core/commit/792f2d5)), closes [#979](https://github.com/mx-space/core/issues/979)

## <small>3.42.3 (2023-02-14)</small>

* release: v3.42.3 ([3df220e](https://github.com/mx-space/core/commit/3df220e))
* fix(fn): cached context ([145355f](https://github.com/mx-space/core/commit/145355f))

## <small>3.42.2 (2023-02-14)</small>

* release: v3.42.2 ([213893a](https://github.com/mx-space/core/commit/213893a))
* docs(serverless): update readme ([b8bd57c](https://github.com/mx-space/core/commit/b8bd57c))
* fix(api-client): subscribe post body instend of params ([8f028a9](https://github.com/mx-space/core/commit/8f028a9))
* fix(deps): update dependency mongoose-lean-getters to v0.4.0 (#974) ([a62fe1c](https://github.com/mx-space/core/commit/a62fe1c)), closes [#974](https://github.com/mx-space/core/issues/974)
* fix(fn): ip default function ([4b6f303](https://github.com/mx-space/core/commit/4b6f303))
* fix(subscribe): add guard for subscribe ([2ab6861](https://github.com/mx-space/core/commit/2ab6861))
* chore(deps): update dependency tsup to v6.6.2 (#973) ([e35df92](https://github.com/mx-space/core/commit/e35df92)), closes [#973](https://github.com/mx-space/core/issues/973)
* chore(release): bump @mx-space/api-client to v1.3.4 ([986d3ae](https://github.com/mx-space/core/commit/986d3ae))

## <small>3.42.1 (2023-02-14)</small>

* release: v3.42.1 ([9250018](https://github.com/mx-space/core/commit/9250018))
* fix: zip asset script ([7f97a77](https://github.com/mx-space/core/commit/7f97a77))
* fix(api-client): remove export adaptor source file ([d7c5c80](https://github.com/mx-space/core/commit/d7c5c80))
* chore(release): bump @mx-space/api-client to v1.3.3 ([cc2b588](https://github.com/mx-space/core/commit/cc2b588))

## 3.42.0 (2023-02-14)

* release: v3.42.0 ([edd3b39](https://github.com/mx-space/core/commit/edd3b39))
* chore: assets init script ([7ea1ba5](https://github.com/mx-space/core/commit/7ea1ba5))
* chore: update deps ([7e99265](https://github.com/mx-space/core/commit/7e99265))
* chore(deps): update dependency ioredis to v5.3.1 (#956) ([85de275](https://github.com/mx-space/core/commit/85de275)), closes [#956](https://github.com/mx-space/core/issues/956)
* chore(deps): update dependency node-fetch to v3.3.0 (#943) ([fdbf856](https://github.com/mx-space/core/commit/fdbf856)), closes [#943](https://github.com/mx-space/core/issues/943)
* chore(deps): update dependency socket.io to v4.6.0 (#972) ([6ea6690](https://github.com/mx-space/core/commit/6ea6690)), closes [#972](https://github.com/mx-space/core/issues/972)
* chore(process): change process title ([a1b2668](https://github.com/mx-space/core/commit/a1b2668))
* chore(release): bump @mx-space/api-client to v1.3.0 ([602f40a](https://github.com/mx-space/core/commit/602f40a))
* chore(release): bump @mx-space/api-client to v1.3.1 ([769a014](https://github.com/mx-space/core/commit/769a014))
* chore(release): bump @mx-space/api-client to v1.3.2 ([f03a1e5](https://github.com/mx-space/core/commit/f03a1e5))
* fix: email enable then can subscribe ([2aa46d0](https://github.com/mx-space/core/commit/2aa46d0))
* fix: init project script ([bfc2e25](https://github.com/mx-space/core/commit/bfc2e25))
* fix(deps): update dependency @nestjs/schedule to v2.2.0 (#959) ([623e8b0](https://github.com/mx-space/core/commit/623e8b0)), closes [#959](https://github.com/mx-space/core/issues/959)
* fix(deps): update dependency commander to v9.5.0 (#960) ([aeed31e](https://github.com/mx-space/core/commit/aeed31e)), closes [#960](https://github.com/mx-space/core/issues/960)
* fix(deps): update dependency mongoose to v6.9.1 (#971) ([41b401d](https://github.com/mx-space/core/commit/41b401d)), closes [#971](https://github.com/mx-space/core/issues/971)
* fix(deps): update dependency rxjs to v7.8.0 (#920) ([f910789](https://github.com/mx-space/core/commit/f910789)), closes [#920](https://github.com/mx-space/core/issues/920)
* fix(subscribe): provide toC `allow_type` ([35e1864](https://github.com/mx-space/core/commit/35e1864))
* test: fix case ([c9293d1](https://github.com/mx-space/core/commit/c9293d1))
* feat: newsletter subscribe (#968) ([c8667ec](https://github.com/mx-space/core/commit/c8667ec)), closes [#968](https://github.com/mx-space/core/issues/968)
* feat(fn): support built-in fnnctions (#967) ([80526ba](https://github.com/mx-space/core/commit/80526ba)), closes [#967](https://github.com/mx-space/core/issues/967)
* feat(subscribe): add feature list toggle ([1b80adb](https://github.com/mx-space/core/commit/1b80adb))
* pref(fn): cache context ([73eb4ed](https://github.com/mx-space/core/commit/73eb4ed))

## <small>3.41.4 (2023-02-10)</small>

* release: v3.41.4 ([3f011e8](https://github.com/mx-space/core/commit/3f011e8))
* fix: asset push script ([7a1ccdf](https://github.com/mx-space/core/commit/7a1ccdf))
* fix: docker compose (#961) ([9b6e1ff](https://github.com/mx-space/core/commit/9b6e1ff)), closes [#961](https://github.com/mx-space/core/issues/961)
* fix(tool): ipv6 query, closes #962 ([aabed05](https://github.com/mx-space/core/commit/aabed05)), closes [#962](https://github.com/mx-space/core/issues/962)

## <small>3.41.3 (2023-02-03)</small>

* release: v3.41.3 ([89a7fbf](https://github.com/mx-space/core/commit/89a7fbf))
* fix: add pure fetch adaptor ([7d96c26](https://github.com/mx-space/core/commit/7d96c26))
* fix: resolutions ([3c7ce43](https://github.com/mx-space/core/commit/3c7ce43))
* fix(deps): update dependency @babel/plugin-transform-typescript to v7.20.13 ([0fc6a92](https://github.com/mx-space/core/commit/0fc6a92))
* fix(deps): update dependency nodemailer to v6.9.1 ([982cae3](https://github.com/mx-space/core/commit/982cae3))
* fix(deps): update dependency ua-parser-js to v1.0.33 ([940c22a](https://github.com/mx-space/core/commit/940c22a))
* feat: upgrade mongoose ([42e8037](https://github.com/mx-space/core/commit/42e8037))
* chore: rename folder ([304dcf2](https://github.com/mx-space/core/commit/304dcf2))
* chore(api-client): bundler to tsup (#944) ([a2e3fc3](https://github.com/mx-space/core/commit/a2e3fc3)), closes [#944](https://github.com/mx-space/core/issues/944)
* chore(deps): update dependency @nestjs/cli to v9.1.9 ([4709f01](https://github.com/mx-space/core/commit/4709f01))
* chore(deps): update dependency @types/babel__core to v7.20.0 ([1a6164f](https://github.com/mx-space/core/commit/1a6164f))
* chore(deps): update dependency @types/express to v4.17.16 ([2116d02](https://github.com/mx-space/core/commit/2116d02))
* chore(deps): update dependency @types/validator to v13.7.11 ([9b14723](https://github.com/mx-space/core/commit/9b14723))
* chore(deps): update dependency @vercel/ncc to v0.36.1 ([4070e9c](https://github.com/mx-space/core/commit/4070e9c))
* chore(deps): update dependency ioredis to v5.2.6 ([fd698b3](https://github.com/mx-space/core/commit/fd698b3))
* chore(deps): update dependency mongodb-memory-server to v8.11.4 ([5faf383](https://github.com/mx-space/core/commit/5faf383))
* chore(deps): update dependency vite-tsconfig-paths to v4.0.5 ([315fef8](https://github.com/mx-space/core/commit/315fef8))
* chore(release): bump @mx-space/api-client to v1.1.0 ([7942b78](https://github.com/mx-space/core/commit/7942b78))
* chore(release): bump @mx-space/api-client to v1.2.0 ([2dd4c57](https://github.com/mx-space/core/commit/2dd4c57))

## <small>3.41.2 (2023-01-20)</small>

* release: v3.41.2 ([84b6394](https://github.com/mx-space/core/commit/84b6394))
* fix: replace ip endpoint ([5af255f](https://github.com/mx-space/core/commit/5af255f))
* fix(deps): update dependency mongoose to v6.8.4 ([1f024c2](https://github.com/mx-space/core/commit/1f024c2))
* chore(deps): update dependency ioredis to v5.2.5 ([0d4dabe](https://github.com/mx-space/core/commit/0d4dabe))
* chore(deps): update dependency mongodb-memory-server to v8.11.2 ([8ae6aff](https://github.com/mx-space/core/commit/8ae6aff))
* test: add some test case ([e4303d6](https://github.com/mx-space/core/commit/e4303d6))

## <small>3.41.1 (2023-01-17)</small>

* release: v3.41.1 ([d63ccd8](https://github.com/mx-space/core/commit/d63ccd8))
* fix: apply link ignore outdate ([b014abc](https://github.com/mx-space/core/commit/b014abc))
* fix(ci): remove invalid variable (#934) ([40faa35](https://github.com/mx-space/core/commit/40faa35)), closes [#934](https://github.com/mx-space/core/issues/934)
* fix(deps): update dependency @typegoose/auto-increment to v2 (#919) ([82c9d20](https://github.com/mx-space/core/commit/82c9d20)), closes [#919](https://github.com/mx-space/core/issues/919)
* chore: update badge ([3a3a9f9](https://github.com/mx-space/core/commit/3a3a9f9))
* chore: update max memory restart ([ef9a10c](https://github.com/mx-space/core/commit/ef9a10c))
* chore: update some deps and update ci (#935) ([7f1c25a](https://github.com/mx-space/core/commit/7f1c25a)), closes [#935](https://github.com/mx-space/core/issues/935)
* chore(deps): update dependency @types/cors to v2.8.13 ([7adff99](https://github.com/mx-space/core/commit/7adff99))
* chore(deps): update dependency vite to v4 (#910) ([09be099](https://github.com/mx-space/core/commit/09be099)), closes [#910](https://github.com/mx-space/core/issues/910)
* test: add note controller case (#939) ([02a08ad](https://github.com/mx-space/core/commit/02a08ad)), closes [#939](https://github.com/mx-space/core/issues/939)
* ci: build ([0162835](https://github.com/mx-space/core/commit/0162835))

## 3.41.0 (2022-12-25)

* release: v3.41.0 ([2b0d08c](https://github.com/mx-space/core/commit/2b0d08c))
* feat: add custom encrypt algorithm ([3636172](https://github.com/mx-space/core/commit/3636172))
* feat: support encrypt secret and configs (#931) ([9ed8b32](https://github.com/mx-space/core/commit/9ed8b32)), closes [#931](https://github.com/mx-space/core/issues/931)
* test: add consola to global scope ([efdbf98](https://github.com/mx-space/core/commit/efdbf98))
* test: add jsonschema route e2e ([82d1667](https://github.com/mx-space/core/commit/82d1667))
* fix: argv of `encrypt_key` ([36ffaa4](https://github.com/mx-space/core/commit/36ffaa4))
* fix: delete backup use body params ([19f7556](https://github.com/mx-space/core/commit/19f7556))
* fix: hide note secret text ([82451b8](https://github.com/mx-space/core/commit/82451b8))
* fix(api-client): add enum to exports ([9e82b8f](https://github.com/mx-space/core/commit/9e82b8f))
* fix(feed): hide note secret in rss ([bad4661](https://github.com/mx-space/core/commit/bad4661))
* chore: correct punctuation ([a7c1aa9](https://github.com/mx-space/core/commit/a7c1aa9))
* chore(release): bump @mx-space/api-client to v1.0.3 ([381c32e](https://github.com/mx-space/core/commit/381c32e))

## 3.40.0 (2022-12-23)

* release: v3.40.0 ([6dde686](https://github.com/mx-space/core/commit/6dde686))
* feat: add `liked` for post and note model ([1073c67](https://github.com/mx-space/core/commit/1073c67))
* feat: recently response add `comments` ([d25ba45](https://github.com/mx-space/core/commit/d25ba45))
* feat(api-client): add `attitude` method ([b44bb41](https://github.com/mx-space/core/commit/b44bb41))
* feat(recently): add attitude ([963b07a](https://github.com/mx-space/core/commit/963b07a))
* fix: comment ref should select `content` ([d90efeb](https://github.com/mx-space/core/commit/d90efeb))
* fix: missing api-client types ([4c603dc](https://github.com/mx-space/core/commit/4c603dc))
* fix: mongo query use objectId ([205b98e](https://github.com/mx-space/core/commit/205b98e))
* fix(recently): delete with ref comments ([7fe8bf6](https://github.com/mx-space/core/commit/7fe8bf6))
* chore(release): bump @mx-space/api-client to v1.0.0 ([213ceb1](https://github.com/mx-space/core/commit/213ceb1))
* ci: build ubuntu latest ([f976e34](https://github.com/mx-space/core/commit/f976e34))

## <small>3.39.7 (2022-12-22)</small>

* release: v3.39.7 ([7480040](https://github.com/mx-space/core/commit/7480040))
* ci: downgrade ubuntu version ([c583d33](https://github.com/mx-space/core/commit/c583d33))

## <small>3.39.6 (2022-12-21)</small>

* release: v3.39.6 ([dae0108](https://github.com/mx-space/core/commit/dae0108))
* fix: downgrade class-validator to 0.13.2 ([38b6c21](https://github.com/mx-space/core/commit/38b6c21))

## <small>3.39.5 (2022-12-21)</small>

* release: v3.39.5 ([d1c596d](https://github.com/mx-space/core/commit/d1c596d))

## <small>3.39.4 (2022-12-21)</small>

* release: v3.39.4 ([ed26754](https://github.com/mx-space/core/commit/ed26754))
* fix: build ci ([3160ced](https://github.com/mx-space/core/commit/3160ced))
* fix: revert update service ([659d2bc](https://github.com/mx-space/core/commit/659d2bc))
* fix(deps): update dependency algoliasearch to v4.14.3 ([7a71762](https://github.com/mx-space/core/commit/7a71762))
* fix(deps): update dependency mongoose to v6.8.1 ([06ab476](https://github.com/mx-space/core/commit/06ab476))
* feat: add `liked` on article response ([190596f](https://github.com/mx-space/core/commit/190596f))
* feat: move api-client as core's monorepo ([a281f45](https://github.com/mx-space/core/commit/a281f45))
* feat: use ghproxy to speed up update admin ([00d34c9](https://github.com/mx-space/core/commit/00d34c9))
* chore: update deploy script ([d8a1280](https://github.com/mx-space/core/commit/d8a1280))

## <small>3.39.3 (2022-12-18)</small>

* release: v3.39.3 ([b4aa94f](https://github.com/mx-space/core/commit/b4aa94f))
* chore(deps): update dependency @types/get-image-colors to v4.0.2 ([62c6633](https://github.com/mx-space/core/commit/62c6633))
* chore(deps): update dependency @types/marked to v4.0.8 ([6d88589](https://github.com/mx-space/core/commit/6d88589))
* chore(deps): update dependency @types/node to v18.11.11 ([58075a3](https://github.com/mx-space/core/commit/58075a3))
* chore(deps): update dependency @types/node to v18.11.12 ([eb761a3](https://github.com/mx-space/core/commit/eb761a3))
* chore(deps): update dependency @types/node to v18.11.13 ([4b16d50](https://github.com/mx-space/core/commit/4b16d50))
* chore(deps): update dependency @types/node to v18.11.15 ([1046431](https://github.com/mx-space/core/commit/1046431))
* chore(deps): update dependency @types/node to v18.11.16 ([538012b](https://github.com/mx-space/core/commit/538012b))
* chore(deps): update dependency @types/node to v18.11.17 ([369a438](https://github.com/mx-space/core/commit/369a438))
* chore(deps): update dependency @types/nodemailer to v6.4.7 ([ec24707](https://github.com/mx-space/core/commit/ec24707))
* chore(deps): update dependency @vercel/ncc to v0.36.0 (#897) ([18cfa4a](https://github.com/mx-space/core/commit/18cfa4a)), closes [#897](https://github.com/mx-space/core/issues/897)
* chore(deps): update dependency lint-staged to v13.1.0 (#891) ([222529e](https://github.com/mx-space/core/commit/222529e)), closes [#891](https://github.com/mx-space/core/issues/891)
* chore(deps): update dependency mongodb-memory-server to v8.10.2 ([e9695ce](https://github.com/mx-space/core/commit/e9695ce))
* chore(deps): update dependency prettier to v2.8.1 ([ed128e8](https://github.com/mx-space/core/commit/ed128e8))
* chore(deps): update dependency typescript to v4.9.4 ([25a5fb9](https://github.com/mx-space/core/commit/25a5fb9))
* chore(deps): update dependency vite to v3.2.5 ([6bf6717](https://github.com/mx-space/core/commit/6bf6717))
* chore(deps): update dependency vite-tsconfig-paths to v4 (#899) ([26479a0](https://github.com/mx-space/core/commit/26479a0)), closes [#899](https://github.com/mx-space/core/issues/899)
* fix: download progress of update admin ([da6336b](https://github.com/mx-space/core/commit/da6336b))
* fix(deps): update dependency @fastify/static to v6.6.0 (#892) ([79ca6cb](https://github.com/mx-space/core/commit/79ca6cb)), closes [#892](https://github.com/mx-space/core/issues/892)
* fix(deps): update dependency @nestjs/swagger to v6.1.4 ([f69b4d2](https://github.com/mx-space/core/commit/f69b4d2))
* fix(deps): update dependency @typegoose/auto-increment to v1.9.0 (#908) ([7b52ae6](https://github.com/mx-space/core/commit/7b52ae6)), closes [#908](https://github.com/mx-space/core/issues/908)
* fix(deps): update dependency class-validator to v0.14.0 (#909) ([51f0967](https://github.com/mx-space/core/commit/51f0967)), closes [#909](https://github.com/mx-space/core/issues/909)
* fix(deps): update dependency dayjs to v1.11.7 ([b0fe725](https://github.com/mx-space/core/commit/b0fe725))
* fix(deps): update dependency json5 to v2.2.2 ([48df514](https://github.com/mx-space/core/commit/48df514))
* fix(deps): update dependency marked to v4.2.4 ([c88016d](https://github.com/mx-space/core/commit/c88016d))
* fix(deps): update dependency mongoose to v6.8.0 (#895) ([49ca2e8](https://github.com/mx-space/core/commit/49ca2e8)), closes [#895](https://github.com/mx-space/core/issues/895)
* fix(deps): update dependency vm2 to v3.9.13 ([a5ea6ef](https://github.com/mx-space/core/commit/a5ea6ef))

## <small>3.39.2 (2022-12-04)</small>

* release: v3.39.2 ([36bb9c9](https://github.com/mx-space/core/commit/36bb9c9))
* chore(deps): update dependency @types/lodash to v4.14.191 ([dcbcec3](https://github.com/mx-space/core/commit/dcbcec3))
* chore(deps): update dependency @types/node to v18.11.10 ([f9d84e4](https://github.com/mx-space/core/commit/f9d84e4))
* chore(deps): update dependency mongodb-memory-server to v8.10.1 (#862) ([53195ca](https://github.com/mx-space/core/commit/53195ca)), closes [#862](https://github.com/mx-space/core/issues/862)
* chore(deps): update dependency prettier to v2.8.0 (#877) ([884251e](https://github.com/mx-space/core/commit/884251e)), closes [#877](https://github.com/mx-space/core/issues/877)
* chore(deps): update dependency tsconfig-paths to v4.1.1 ([8151812](https://github.com/mx-space/core/commit/8151812))
* chore(deps): update dependency typescript to v4.9.3 (#869) ([0c1c353](https://github.com/mx-space/core/commit/0c1c353)), closes [#869](https://github.com/mx-space/core/issues/869)
* chore(deps): update dependency vite-tsconfig-paths to v3.6.0 (#870) ([d24f056](https://github.com/mx-space/core/commit/d24f056)), closes [#870](https://github.com/mx-space/core/issues/870)
* fix: clear scope require cache only ([f1fe50e](https://github.com/mx-space/core/commit/f1fe50e))
* fix: set select false for `secret` ([7beeab3](https://github.com/mx-space/core/commit/7beeab3))
* fix(deps): update dependency @babel/core to v7.20.5 ([e00745b](https://github.com/mx-space/core/commit/e00745b))
* fix(deps): update dependency @typegoose/typegoose to v9.13.2 (#874) ([54ab234](https://github.com/mx-space/core/commit/54ab234)), closes [#874](https://github.com/mx-space/core/issues/874)
* fix(deps): update dependency mongoose to v6.7.4 ([d9404ff](https://github.com/mx-space/core/commit/d9404ff))
* fix(deps): update dependency mongoose to v6.7.5 ([3529335](https://github.com/mx-space/core/commit/3529335))
* fix(deps): update dependency rxjs to v7.6.0 (#890) ([f368016](https://github.com/mx-space/core/commit/f368016)), closes [#890](https://github.com/mx-space/core/issues/890)
* fix(deps): update dependency vm2 to v3.9.12 ([fda8c44](https://github.com/mx-space/core/commit/fda8c44))
* fix(deps): update nest monorepo to v9.2.1 ([b044457](https://github.com/mx-space/core/commit/b044457))

## <small>3.39.1 (2022-11-25)</small>

* release: v3.39.1 ([d9f1728](https://github.com/mx-space/core/commit/d9f1728))
* fix: update admin version ([990457d](https://github.com/mx-space/core/commit/990457d))

## 3.39.0 (2022-11-25)

* release: v3.39.0 ([37b46b5](https://github.com/mx-space/core/commit/37b46b5))
* feat: add secret for function (#881) ([432e747](https://github.com/mx-space/core/commit/432e747)), closes [#881](https://github.com/mx-space/core/issues/881)
* chore(deps): update dependency @types/lodash to v4.14.189 ([ac00db8](https://github.com/mx-space/core/commit/ac00db8))
* chore(deps): update dependency @types/lodash to v4.14.190 ([2cbb280](https://github.com/mx-space/core/commit/2cbb280))
* chore(deps): update dependency lint-staged to v13.0.4 ([3a62759](https://github.com/mx-space/core/commit/3a62759))
* chore(deps): update dependency socket.io to v4.5.4 ([bd88c98](https://github.com/mx-space/core/commit/bd88c98))
* chore(deps): update dependency vite to v3.2.4 ([0169286](https://github.com/mx-space/core/commit/0169286))
* chore(deps): update dependency vitest to v0.25.2 ([68e0122](https://github.com/mx-space/core/commit/68e0122))
* chore(deps): update dependency vitest to v0.25.3 ([80301ac](https://github.com/mx-space/core/commit/80301ac))
* fix(deps): update dependency @fastify/static to v6.5.1 ([dd88cac](https://github.com/mx-space/core/commit/dd88cac))
* fix(deps): update dependency linkedom to v0.14.20 ([eada716](https://github.com/mx-space/core/commit/eada716))
* fix(deps): update dependency linkedom to v0.14.21 ([0839361](https://github.com/mx-space/core/commit/0839361))
* fix(deps): update dependency marked to v4.2.3 ([1441b79](https://github.com/mx-space/core/commit/1441b79))
* fix(deps): update dependency mongoose to v6.7.3 ([830836b](https://github.com/mx-space/core/commit/830836b))

## <small>3.38.6 (2022-11-12)</small>

* release: v3.38.6 ([59e8fc4](https://github.com/mx-space/core/commit/59e8fc4))
* chore(deps): update dependency @types/babel__core to v7.1.20 ([c800fa2](https://github.com/mx-space/core/commit/c800fa2))
* chore(deps): update dependency @types/lodash to v4.14.187 ([5758f73](https://github.com/mx-space/core/commit/5758f73))
* chore(deps): update dependency @types/lodash to v4.14.188 ([885f6ac](https://github.com/mx-space/core/commit/885f6ac))
* chore(deps): update dependency @types/node to v18.11.8 ([d2f4460](https://github.com/mx-space/core/commit/d2f4460))
* chore(deps): update dependency @types/node to v18.11.9 ([56c67bf](https://github.com/mx-space/core/commit/56c67bf))
* chore(deps): update dependency @types/validator to v13.7.10 ([2a3ff65](https://github.com/mx-space/core/commit/2a3ff65))
* chore(deps): update dependency husky to v8.0.2 ([7d3fb4f](https://github.com/mx-space/core/commit/7d3fb4f))
* chore(deps): update dependency ioredis to v5.2.4 ([c57cf54](https://github.com/mx-space/core/commit/c57cf54))
* chore(deps): update dependency mongodb-memory-server to v8.9.5 ([f1067f3](https://github.com/mx-space/core/commit/f1067f3))
* chore(deps): update dependency vite to v3.2.2 ([f3c304a](https://github.com/mx-space/core/commit/f3c304a))
* chore(deps): update dependency vite to v3.2.3 ([56db864](https://github.com/mx-space/core/commit/56db864))
* chore(deps): update dependency vitest to v0.24.4 ([33ecb5b](https://github.com/mx-space/core/commit/33ecb5b))
* chore(deps): update dependency vitest to v0.24.5 ([b5abf42](https://github.com/mx-space/core/commit/b5abf42))
* chore(deps): update dependency vitest to v0.25.1 (#859) ([6911377](https://github.com/mx-space/core/commit/6911377)), closes [#859](https://github.com/mx-space/core/issues/859)
* chore(deps): update dependency webpack to v5.75.0 (#863) ([da52b1a](https://github.com/mx-space/core/commit/da52b1a)), closes [#863](https://github.com/mx-space/core/issues/863)
* fix(deps): update dependency @babel/core to v7.20.2 (#854) ([01331b7](https://github.com/mx-space/core/commit/01331b7)), closes [#854](https://github.com/mx-space/core/issues/854)
* fix(deps): update dependency @babel/plugin-transform-typescript to v7.20.2 ([d1cbf63](https://github.com/mx-space/core/commit/d1cbf63))
* fix(deps): update dependency isbot to v3.6.3 ([538ec70](https://github.com/mx-space/core/commit/538ec70))
* fix(deps): update dependency isbot to v3.6.5 ([5fb5647](https://github.com/mx-space/core/commit/5fb5647))
* fix(deps): update dependency lru-cache to v7.14.1 ([f443b69](https://github.com/mx-space/core/commit/f443b69))
* fix(deps): update dependency marked to v4.2.0 (#843) ([920dbb3](https://github.com/mx-space/core/commit/920dbb3)), closes [#843](https://github.com/mx-space/core/issues/843)
* fix(deps): update dependency marked to v4.2.1 ([195eb78](https://github.com/mx-space/core/commit/195eb78))
* fix(deps): update dependency marked to v4.2.2 ([ef4ce06](https://github.com/mx-space/core/commit/ef4ce06))
* fix(deps): update dependency mongoose to v6.7.1 ([fb224bb](https://github.com/mx-space/core/commit/fb224bb))
* fix(deps): update dependency mongoose to v6.7.2 ([7cfc060](https://github.com/mx-space/core/commit/7cfc060))
* fix(deps): update nest monorepo to v9.2.0 (minor) (#857) ([e7f9e96](https://github.com/mx-space/core/commit/e7f9e96)), closes [#857](https://github.com/mx-space/core/issues/857)

## <small>3.38.5 (2022-10-30)</small>

* release: v3.38.5 ([0a0b2e2](https://github.com/mx-space/core/commit/0a0b2e2))
* fix(deps): update dependency @babel/core to v7.19.6 ([10788e9](https://github.com/mx-space/core/commit/10788e9))
* fix(deps): update dependency @babel/plugin-transform-modules-commonjs to v7.19.6 (#814) ([13ff05a](https://github.com/mx-space/core/commit/13ff05a)), closes [#814](https://github.com/mx-space/core/issues/814)
* fix(deps): update dependency @babel/plugin-transform-typescript to v7.20.0 (#835) ([a3c23da](https://github.com/mx-space/core/commit/a3c23da)), closes [#835](https://github.com/mx-space/core/issues/835)
* fix(deps): update dependency @fastify/multipart to v7.3.0 (#830) ([a0d32b6](https://github.com/mx-space/core/commit/a0d32b6)), closes [#830](https://github.com/mx-space/core/issues/830)
* fix(deps): update dependency @nestjs/swagger to v6.1.3 ([500b494](https://github.com/mx-space/core/commit/500b494))
* fix(deps): update dependency dayjs to v1.11.6 ([288c64f](https://github.com/mx-space/core/commit/288c64f))
* fix(deps): update dependency isbot to v3.6.2 ([418040b](https://github.com/mx-space/core/commit/418040b))
* fix(deps): update dependency linkedom to v0.14.18 ([c79c5e0](https://github.com/mx-space/core/commit/c79c5e0))
* fix(deps): update dependency linkedom to v0.14.19 ([8dad005](https://github.com/mx-space/core/commit/8dad005))
* fix(deps): update dependency mongoose to v6.6.6 ([48104cf](https://github.com/mx-space/core/commit/48104cf))
* fix(deps): update dependency mongoose to v6.6.7 ([985ed34](https://github.com/mx-space/core/commit/985ed34))
* fix(deps): update dependency mongoose to v6.7.0 (#825) ([880fddd](https://github.com/mx-space/core/commit/880fddd)), closes [#825](https://github.com/mx-space/core/issues/825)
* fix(deps): update nest monorepo to v9.1.5 ([df05b2a](https://github.com/mx-space/core/commit/df05b2a))
* fix(deps): update nest monorepo to v9.1.6 ([c955653](https://github.com/mx-space/core/commit/c955653))
* chore(deps): update dependency @nestjs/cli to v9.1.5 (#834) ([dc82ec1](https://github.com/mx-space/core/commit/dc82ec1)), closes [#834](https://github.com/mx-space/core/issues/834)
* chore(deps): update dependency @types/node to v16.18.0 ([854de06](https://github.com/mx-space/core/commit/854de06))
* chore(deps): update dependency @types/node to v18 ([046d3dd](https://github.com/mx-space/core/commit/046d3dd))
* chore(deps): update dependency @types/node to v18.11.6 ([fc65d98](https://github.com/mx-space/core/commit/fc65d98))
* chore(deps): update dependency @types/node to v18.11.7 ([544069e](https://github.com/mx-space/core/commit/544069e))
* chore(deps): update dependency @types/semver to v7.3.13 ([ce6d251](https://github.com/mx-space/core/commit/ce6d251))
* chore(deps): update dependency @types/validator to v13.7.9 ([1817b51](https://github.com/mx-space/core/commit/1817b51))
* chore(deps): update dependency mongodb-memory-server to v8.9.4 ([a5f9fc8](https://github.com/mx-space/core/commit/a5f9fc8))
* chore(deps): update dependency vite to v3.2.0 (#829) ([f9ebddc](https://github.com/mx-space/core/commit/f9ebddc)), closes [#829](https://github.com/mx-space/core/issues/829)
* chore(deps): update dependency vite to v3.2.1 ([81567fd](https://github.com/mx-space/core/commit/81567fd))
* chore(deps): update dependency vite-tsconfig-paths to v3.5.2 ([697142a](https://github.com/mx-space/core/commit/697142a))
* ci: add node version for build ([2de5ec2](https://github.com/mx-space/core/commit/2de5ec2))

## <small>3.38.4 (2022-10-20)</small>

* release: v3.38.4 ([ed259cc](https://github.com/mx-space/core/commit/ed259cc))
* fix: pm2 argv ([bb35026](https://github.com/mx-space/core/commit/bb35026))

## <small>3.38.3 (2022-10-20)</small>

* release: v3.38.3 ([5ca24c8](https://github.com/mx-space/core/commit/5ca24c8))
* feat: support load yaml config ([380a88a](https://github.com/mx-space/core/commit/380a88a))
* fix: update admin version ([6f8aaa2](https://github.com/mx-space/core/commit/6f8aaa2))

## <small>3.38.1 (2022-10-19)</small>

* release: v3.38.1 ([b488994](https://github.com/mx-space/core/commit/b488994))
* fix: downgard emitter ([9296468](https://github.com/mx-space/core/commit/9296468))
* chore(deps): pin dependency socket.io to 4.5.3 ([d6efbd6](https://github.com/mx-space/core/commit/d6efbd6))
* chore(deps): update dependency @types/node to v16.11.68 ([a6f0afc](https://github.com/mx-space/core/commit/a6f0afc))

## 3.38.0 (2022-10-16)

* release: v3.38.0 ([256d0f5](https://github.com/mx-space/core/commit/256d0f5))
* chore(deps): update dependency @types/node to v16.11.66 ([45c84ec](https://github.com/mx-space/core/commit/45c84ec))
* chore(deps): update dependency @types/validator to v13.7.8 ([5b78f7c](https://github.com/mx-space/core/commit/5b78f7c))
* chore(deps): update dependency vitest to v0.24.3 ([9978414](https://github.com/mx-space/core/commit/9978414))
* chore(deps): update dependency zx to v7.1.1 (#793) ([961673c](https://github.com/mx-space/core/commit/961673c)), closes [#793](https://github.com/mx-space/core/issues/793)
* chore(deps): update pnpm/action-setup action to v2.2.4 ([a067c54](https://github.com/mx-space/core/commit/a067c54))
* feat: support mongo connection with user and password (#806) ([5a20c55](https://github.com/mx-space/core/commit/5a20c55)), closes [#806](https://github.com/mx-space/core/issues/806)
* feat(link): support send link audit result email ([e5e3428](https://github.com/mx-space/core/commit/e5e3428))
* fix(deps): update dependency @nestjs/throttler to v3.1.0 (#802) ([d110eff](https://github.com/mx-space/core/commit/d110eff)), closes [#802](https://github.com/mx-space/core/issues/802)
* fix(deps): update dependency bcrypt to v5.1.0 (#796) ([3094b80](https://github.com/mx-space/core/commit/3094b80)), closes [#796](https://github.com/mx-space/core/issues/796)
* fix(deps): update dependency ua-parser-js to v1.0.32 (#805) ([c74c3e7](https://github.com/mx-space/core/commit/c74c3e7)), closes [#805](https://github.com/mx-space/core/issues/805)

## <small>3.37.4 (2022-10-13)</small>

* release: v3.37.4 ([6d587d0](https://github.com/mx-space/core/commit/6d587d0))
* chore: remove script ([491a8cb](https://github.com/mx-space/core/commit/491a8cb))
* chore(deps): update dependency @types/node to v16.11.63 ([73755b8](https://github.com/mx-space/core/commit/73755b8))
* chore(deps): update dependency @types/node to v16.11.64 ([c0694cd](https://github.com/mx-space/core/commit/c0694cd))
* chore(deps): update dependency @types/node to v16.11.65 ([70ffb31](https://github.com/mx-space/core/commit/70ffb31))
* chore(deps): update dependency semver to v7.3.8 ([a6b41da](https://github.com/mx-space/core/commit/a6b41da))
* chore(deps): update dependency vite to v3.1.6 ([a773768](https://github.com/mx-space/core/commit/a773768))
* chore(deps): update dependency vite to v3.1.7 ([c90db41](https://github.com/mx-space/core/commit/c90db41))
* chore(deps): update dependency vite to v3.1.8 ([2b3c569](https://github.com/mx-space/core/commit/2b3c569))
* chore(deps): update dependency vitest to v0.24.1 (#797) ([1a7c909](https://github.com/mx-space/core/commit/1a7c909)), closes [#797](https://github.com/mx-space/core/issues/797)
* chore(deps): update pnpm/action-setup action to v2.2.3 ([425edb5](https://github.com/mx-space/core/commit/425edb5))
* fix(deps): update dependency isbot to v3.6.1 ([c7f96da](https://github.com/mx-space/core/commit/c7f96da))
* fix(deps): update dependency linkedom to v0.14.17 ([cb21e79](https://github.com/mx-space/core/commit/cb21e79))
* fix(deps): update dependency mongoose to v6.6.4 ([69a363a](https://github.com/mx-space/core/commit/69a363a))
* fix(deps): update dependency mongoose to v6.6.5 ([6754bb4](https://github.com/mx-space/core/commit/6754bb4))
* fix(deps): update nest monorepo to v9.1.4 ([445cc13](https://github.com/mx-space/core/commit/445cc13))
* fix(link): hide email if not master ([cd3faff](https://github.com/mx-space/core/commit/cd3faff))

## <small>3.37.3 (2022-10-02)</small>

* release: v3.37.3 ([bdd4c0e](https://github.com/mx-space/core/commit/bdd4c0e))
* chore: bump option ([376f07b](https://github.com/mx-space/core/commit/376f07b))
* chore: update deps ([c58ed78](https://github.com/mx-space/core/commit/c58ed78))
* chore(deps): update dependency @nestjs/cli to v9.1.4 ([96d1205](https://github.com/mx-space/core/commit/96d1205))
* chore(deps): update dependency @swc/core to v1.3.4 ([a2a26f8](https://github.com/mx-space/core/commit/a2a26f8))
* chore(deps): update dependency @types/lodash to v4.14.186 ([29e3962](https://github.com/mx-space/core/commit/29e3962))
* chore(deps): update dependency typescript to v4.8.4 ([efc1979](https://github.com/mx-space/core/commit/efc1979))
* chore(deps): update dependency vite to v3.1.4 ([845d333](https://github.com/mx-space/core/commit/845d333))
* feat(render): add info ([4d3e361](https://github.com/mx-space/core/commit/4d3e361))
* fix(deps): update babel monorepo to v7.19.3 ([81071b6](https://github.com/mx-space/core/commit/81071b6))
* fix(deps): update dependency marked to v4.1.1 ([21fd2fd](https://github.com/mx-space/core/commit/21fd2fd))
* fix(deps): update dependency mongoose to v6.6.3 ([f8a1258](https://github.com/mx-space/core/commit/f8a1258))
* pref: log time diff ([e034469](https://github.com/mx-space/core/commit/e034469))

## <small>3.37.2 (2022-09-27)</small>

* release: v3.37.2 ([0263f95](https://github.com/mx-space/core/commit/0263f95))
* feat: add disable comment for site ([9b97a15](https://github.com/mx-space/core/commit/9b97a15))
* fix(deps): update dependency @typegoose/typegoose to v9.12.1 ([9eed663](https://github.com/mx-space/core/commit/9eed663))
* fix(deps): update dependency mongoose to v6.6.2 ([6e2c5a1](https://github.com/mx-space/core/commit/6e2c5a1))
* fix(deps): update dependency rxjs to v7.5.7 ([8a95d5a](https://github.com/mx-space/core/commit/8a95d5a))
* chore(deps): update dependency @types/node to v16.11.61 ([fdeb2c0](https://github.com/mx-space/core/commit/fdeb2c0))
* chore(deps): update dependency @types/node to v16.11.62 ([6902946](https://github.com/mx-space/core/commit/6902946))
* chore(deps): update dependency mongodb-memory-server to v8.9.3 ([bb63408](https://github.com/mx-space/core/commit/bb63408))

## <small>3.37.1 (2022-09-25)</small>

* release: v3.37.1 ([fba730f](https://github.com/mx-space/core/commit/fba730f))
* fix(deps): update dependency @fastify/cookie to v8.2.0 (#759) ([8476962](https://github.com/mx-space/core/commit/8476962)), closes [#759](https://github.com/mx-space/core/issues/759)
* fix(deps): update dependency @fastify/multipart to v7.2.0 (#753) ([2cdceb9](https://github.com/mx-space/core/commit/2cdceb9)), closes [#753](https://github.com/mx-space/core/issues/753)
* fix(deps): update dependency @typegoose/auto-increment to v1.8.0 (#764) ([361ca29](https://github.com/mx-space/core/commit/361ca29)), closes [#764](https://github.com/mx-space/core/issues/764)
* fix(deps): update dependency isbot to v3.5.4 ([7b1d8b7](https://github.com/mx-space/core/commit/7b1d8b7))
* fix(deps): update dependency linkedom to v0.14.15 ([a891549](https://github.com/mx-space/core/commit/a891549))
* fix(deps): update dependency linkedom to v0.14.16 ([e6ff510](https://github.com/mx-space/core/commit/e6ff510))
* fix(deps): update nest monorepo to v9.1.2 (minor) (#758) ([2ec94c8](https://github.com/mx-space/core/commit/2ec94c8)), closes [#758](https://github.com/mx-space/core/issues/758)
* chore(deps): update dependency @swc/core to v1.3.2 (#756) ([89a61f1](https://github.com/mx-space/core/commit/89a61f1)), closes [#756](https://github.com/mx-space/core/issues/756)
* chore(deps): update dependency @swc/core to v1.3.3 ([34f38fe](https://github.com/mx-space/core/commit/34f38fe))
* chore(deps): update dependency @types/node to v16.11.60 ([f2ed994](https://github.com/mx-space/core/commit/f2ed994))
* chore(deps): update dependency @types/validator to v13.7.7 ([a62d968](https://github.com/mx-space/core/commit/a62d968))
* chore(deps): update dependency vite to v3.1.3 ([1ae3c3c](https://github.com/mx-space/core/commit/1ae3c3c))
* chore(deps): update dependency vite-tsconfig-paths to v3.5.1 ([8368b79](https://github.com/mx-space/core/commit/8368b79))

## 3.37.0 (2022-09-18)

* release: v3.37.0 ([b1f610e](https://github.com/mx-space/core/commit/b1f610e))
* chore: remove e2e test in ci ([efe8669](https://github.com/mx-space/core/commit/efe8669))
* chore(deps): update dependency vite to v3.1.2 ([9a70df7](https://github.com/mx-space/core/commit/9a70df7))
* chore(deps): update dependency vitest to v0.23.4 ([59c8b01](https://github.com/mx-space/core/commit/59c8b01))
* chore!: drop compatibility ([0c2a309](https://github.com/mx-space/core/commit/0c2a309))

## <small>3.36.5 (2022-09-16)</small>

* release: v3.36.5 ([b42777f](https://github.com/mx-space/core/commit/b42777f))
* chore: update emitter ([748f4e6](https://github.com/mx-space/core/commit/748f4e6))
* chore(deps): update dependency @nestjs/cli to v9.1.3 ([b79904a](https://github.com/mx-space/core/commit/b79904a))
* chore(deps): update dependency @swc/core to v1.3.1 ([708e800](https://github.com/mx-space/core/commit/708e800))
* chore(deps): update dependency @types/jest to v29.0.1 ([dfb1462](https://github.com/mx-space/core/commit/dfb1462))
* chore(deps): update dependency @types/lodash to v4.14.185 ([75d4115](https://github.com/mx-space/core/commit/75d4115))
* chore(deps): update dependency @types/marked to v4.0.7 ([cad4f57](https://github.com/mx-space/core/commit/cad4f57))
* chore(deps): update dependency @types/node to v16.11.57 ([81bd285](https://github.com/mx-space/core/commit/81bd285))
* chore(deps): update dependency @types/node to v16.11.58 ([3a21927](https://github.com/mx-space/core/commit/3a21927))
* chore(deps): update dependency @types/node to v16.11.59 ([694ebf3](https://github.com/mx-space/core/commit/694ebf3))
* chore(deps): update dependency @types/nodemailer to v6.4.6 ([c5fe03c](https://github.com/mx-space/core/commit/c5fe03c))
* chore(deps): update dependency jest to v29.0.2 ([932d505](https://github.com/mx-space/core/commit/932d505))
* chore(deps): update dependency jest to v29.0.3 ([da45f97](https://github.com/mx-space/core/commit/da45f97))
* chore(deps): update dependency mongodb-memory-server to v8.9.2 ([34a53ce](https://github.com/mx-space/core/commit/34a53ce))
* chore(deps): update dependency typescript to v4.7.4 ([d5a2c7e](https://github.com/mx-space/core/commit/d5a2c7e))
* chore(deps): update dependency typescript to v4.8.3 (#706) ([8708096](https://github.com/mx-space/core/commit/8708096)), closes [#706](https://github.com/mx-space/core/issues/706)
* chore(deps): update dependency vite to v3.1.1 ([cb0107c](https://github.com/mx-space/core/commit/cb0107c))
* chore(deps): update nest monorepo ([72c5437](https://github.com/mx-space/core/commit/72c5437))
* fix: do not emit unhandledreject event ([88feacb](https://github.com/mx-space/core/commit/88feacb))
* fix: use cravatar ([015d6eb](https://github.com/mx-space/core/commit/015d6eb))
* fix: watch test ([4cd97e9](https://github.com/mx-space/core/commit/4cd97e9))
* fix(deps): update babel monorepo to v7.19.0 (#730) ([a021b8d](https://github.com/mx-space/core/commit/a021b8d)), closes [#730](https://github.com/mx-space/core/issues/730)
* fix(deps): update babel monorepo to v7.19.1 ([de981ed](https://github.com/mx-space/core/commit/de981ed))
* fix(deps): update dependency @fastify/multipart to v7.1.2 ([63f8d1e](https://github.com/mx-space/core/commit/63f8d1e))
* fix(deps): update dependency @nestjs/swagger to v6.1.2 ([c8597d9](https://github.com/mx-space/core/commit/c8597d9))
* fix(deps): update dependency @typegoose/auto-increment to v1.7.0 (#745) ([6724fa8](https://github.com/mx-space/core/commit/6724fa8)), closes [#745](https://github.com/mx-space/core/issues/745)
* fix(deps): update dependency @typegoose/typegoose to v9.12.0 (#746) ([c7e2e23](https://github.com/mx-space/core/commit/c7e2e23)), closes [#746](https://github.com/mx-space/core/issues/746)
* fix(deps): update dependency isbot to v3.5.3 ([7766b21](https://github.com/mx-space/core/commit/7766b21))
* fix(deps): update dependency linkedom to v0.14.14 ([7f499c4](https://github.com/mx-space/core/commit/7f499c4))
* fix(deps): update dependency mongoose to v6.5.5 ([29271ed](https://github.com/mx-space/core/commit/29271ed))
* fix(deps): update dependency mongoose to v6.6.1 (#738) ([7835c9f](https://github.com/mx-space/core/commit/7835c9f)), closes [#738](https://github.com/mx-space/core/issues/738)
* fix(deps): update dependency mongoose-paginate-v2 to v1.7.1 ([93b0f67](https://github.com/mx-space/core/commit/93b0f67))
* feat: replace master avatar in comments if exist ([10a36fd](https://github.com/mx-space/core/commit/10a36fd))
* ci: remove e2e script ([efc720c](https://github.com/mx-space/core/commit/efc720c))
* refactor: move to vitest ([2513f88](https://github.com/mx-space/core/commit/2513f88))
* refactor: use create require instead use global require ([84099f3](https://github.com/mx-space/core/commit/84099f3))

## <small>3.36.4 (2022-09-03)</small>

* release: v3.36.4 ([5ab6c31](https://github.com/mx-space/core/commit/5ab6c31))
* fix: allow across version update in dev ([9dba4a7](https://github.com/mx-space/core/commit/9dba4a7))
* fix: unhandled reject message emit ([e3bb320](https://github.com/mx-space/core/commit/e3bb320))
* fix(deps): update dependency @nestjs/swagger to v6.1.1 ([2a9e54c](https://github.com/mx-space/core/commit/2a9e54c))
* fix(deps): update dependency marked to v4.1.0 (#718) ([4f47393](https://github.com/mx-space/core/commit/4f47393)), closes [#718](https://github.com/mx-space/core/issues/718)
* fix(deps): update dependency mongoose to v6.5.4 ([4b52eb3](https://github.com/mx-space/core/commit/4b52eb3))
* fix(deps): update dependency snakecase-keys to v5.4.4 ([8a4f8ec](https://github.com/mx-space/core/commit/8a4f8ec))
* chore(deps): update dependency @nestjs/schematics to v9.0.2 (#721) ([c8b0ce0](https://github.com/mx-space/core/commit/c8b0ce0)), closes [#721](https://github.com/mx-space/core/issues/721)
* chore(deps): update dependency @types/cache-manager to v4.0.2 ([4e68e81](https://github.com/mx-space/core/commit/4e68e81))
* chore(deps): update dependency @types/jest to v29 ([882262c](https://github.com/mx-space/core/commit/882262c))
* chore(deps): update dependency mongodb-memory-server to v8.9.1 ([73c36c9](https://github.com/mx-space/core/commit/73c36c9))
* chore(deps): update dependency redis-memory-server to v0.6.0 (#720) ([aa7a7d0](https://github.com/mx-space/core/commit/aa7a7d0)), closes [#720](https://github.com/mx-space/core/issues/720)

## <small>3.36.3 (2022-08-29)</small>

* release: v3.36.3 ([2678330](https://github.com/mx-space/core/commit/2678330))
* chore(deps): update dependency @types/validator to v13.7.6 ([ac82a7e](https://github.com/mx-space/core/commit/ac82a7e))
* chore(deps): update supercharge/mongodb-github-action action to v1.8.0 (#711) ([522ec30](https://github.com/mx-space/core/commit/522ec30)), closes [#711](https://github.com/mx-space/core/issues/711)
* fix: catch system uncaught exception ([90bfc62](https://github.com/mx-space/core/commit/90bfc62))
* fix(deps): update dependency @fastify/cookie to v8.1.0 (#715) ([73a2f8b](https://github.com/mx-space/core/commit/73a2f8b)), closes [#715](https://github.com/mx-space/core/issues/715)
* fix(deps): update dependency snakecase-keys to v5.4.3 ([bc484f5](https://github.com/mx-space/core/commit/bc484f5))
* fix(deps): update dependency vm2 to v3.9.11 ([75891ea](https://github.com/mx-space/core/commit/75891ea))

## <small>3.36.2 (2022-08-27)</small>

* release: v3.36.2 ([1ae10a1](https://github.com/mx-space/core/commit/1ae10a1))
* feat: test email is working ([a2f2be3](https://github.com/mx-space/core/commit/a2f2be3))
* perf: ncc pack speed ([a4410ec](https://github.com/mx-space/core/commit/a4410ec))
* refactor: remove cos-sdk ([fe5ec2b](https://github.com/mx-space/core/commit/fe5ec2b))
* refactor: remove pino ([6cf353d](https://github.com/mx-space/core/commit/6cf353d))
* refactor: remove request@2 ([87eb814](https://github.com/mx-space/core/commit/87eb814))
* fix: downgrade ts version ([9f086cd](https://github.com/mx-space/core/commit/9f086cd))
* fix(deps): update dependency @fastify/cookie to v8 (#683) ([a714957](https://github.com/mx-space/core/commit/a714957)), closes [#683](https://github.com/mx-space/core/issues/683)
* fix(deps): update dependency @nestjs/swagger to v6.1.0 (#708) ([c28f482](https://github.com/mx-space/core/commit/c28f482)), closes [#708](https://github.com/mx-space/core/issues/708)
* fix(deps): update dependency @typegoose/typegoose to v9.11.2 ([d2eda95](https://github.com/mx-space/core/commit/d2eda95))
* fix(deps): update dependency @types/jsonwebtoken to v8.5.9 ([2f548f7](https://github.com/mx-space/core/commit/2f548f7))
* fix(deps): update dependency isbot to v3.5.2 ([15ad2df](https://github.com/mx-space/core/commit/15ad2df))
* fix(deps): update dependency mongoose to v6.5.3 ([8fa6823](https://github.com/mx-space/core/commit/8fa6823))
* chore: update markedjs ([0c2249b](https://github.com/mx-space/core/commit/0c2249b))
* chore(deps): update dependency @nestjs/cli to v9.1.1 (#707) ([ed14567](https://github.com/mx-space/core/commit/ed14567)), closes [#707](https://github.com/mx-space/core/issues/707)
* chore(deps): update dependency @types/jest to v28.1.8 ([473b60b](https://github.com/mx-space/core/commit/473b60b))
* chore(deps): update dependency @types/node to v16.11.56 ([25a7167](https://github.com/mx-space/core/commit/25a7167))
* chore(deps): update dependency jest to v29 ([ab44e9a](https://github.com/mx-space/core/commit/ab44e9a))
* chore(deps): update dependency mongodb-memory-server to v8.9.0 (#694) ([9d3185d](https://github.com/mx-space/core/commit/9d3185d)), closes [#694](https://github.com/mx-space/core/issues/694)
* feat(post & note): custom created time ([842ff7e](https://github.com/mx-space/core/commit/842ff7e))

## <small>3.36.1 (2022-08-24)</small>

* release: v3.36.1 ([254aea5](https://github.com/mx-space/core/commit/254aea5))
* fix: socket boardcast not working ([fa68556](https://github.com/mx-space/core/commit/fa68556))
* fix: unit test ([15cfe1e](https://github.com/mx-space/core/commit/15cfe1e))
* fix(deps): update dependency @babel/core to v7.18.13 ([6354adc](https://github.com/mx-space/core/commit/6354adc))
* chore(deps): update dependency @types/node to v16.11.52 ([250e7fd](https://github.com/mx-space/core/commit/250e7fd))
* chore(deps): update dependency @types/node to v16.11.54 ([8d576f6](https://github.com/mx-space/core/commit/8d576f6))
* chore(deps): update dependency @types/node to v16.11.55 ([e65b25c](https://github.com/mx-space/core/commit/e65b25c))
* chore(deps): update dependency ioredis to v5.2.3 ([18d3840](https://github.com/mx-space/core/commit/18d3840))
* revert: durable of provider ([d775fd4](https://github.com/mx-space/core/commit/d775fd4))
* feat: add new macro ([fb9dc4e](https://github.com/mx-space/core/commit/fb9dc4e))
* refactor: app module ([a27b79e](https://github.com/mx-space/core/commit/a27b79e))

## 3.36.0 (2022-08-21)

* release: v3.36.0 ([583077a](https://github.com/mx-space/core/commit/583077a))
* feat: lru cache for complie typescript code ([05bfbe2](https://github.com/mx-space/core/commit/05bfbe2))
* feat: snippet and function refactor (#692) ([095ccd7](https://github.com/mx-space/core/commit/095ccd7)), closes [#692](https://github.com/mx-space/core/issues/692)
* feat: sort of log file list ([12037aa](https://github.com/mx-space/core/commit/12037aa))
* chore: enable cors all in dev ([41a1da8](https://github.com/mx-space/core/commit/41a1da8))
* chore(deps): pin dependencies ([9f8e910](https://github.com/mx-space/core/commit/9f8e910))
* chore(deps): update dependency @types/jest to v28.1.7 ([9241818](https://github.com/mx-space/core/commit/9241818))
* chore(deps): update dependency @types/lodash to v4.14.183 ([6f04058](https://github.com/mx-space/core/commit/6f04058))
* chore(deps): update dependency @types/lodash to v4.14.184 ([fc6f874](https://github.com/mx-space/core/commit/fc6f874))
* chore(deps): update dependency @types/node to v16.11.49 ([1e4c51b](https://github.com/mx-space/core/commit/1e4c51b))
* chore(deps): update dependency @types/node to v16.11.50 ([87a954c](https://github.com/mx-space/core/commit/87a954c))
* chore(deps): update dependency @types/node to v16.11.51 ([7571cac](https://github.com/mx-space/core/commit/7571cac))
* chore(deps): update dependency ts-jest to v28.0.8 ([7d73fa6](https://github.com/mx-space/core/commit/7d73fa6))
* fix: markdown render of image ([03a7207](https://github.com/mx-space/core/commit/03a7207))
* fix(comment): cast of `url` ([c0fbcc4](https://github.com/mx-space/core/commit/c0fbcc4))
* fix(deps): update dependency class-validator-jsonschema to v3.1.2 ([76d2965](https://github.com/mx-space/core/commit/76d2965))
* fix(deps): update dependency isbot to v3.5.1 ([a8dfff0](https://github.com/mx-space/core/commit/a8dfff0))
* fix(deps): update dependency xss to v1.0.14 ([35869c4](https://github.com/mx-space/core/commit/35869c4))
* fix(deps): update nest monorepo to v9.0.11 ([d420333](https://github.com/mx-space/core/commit/d420333))

## <small>3.35.9 (2022-08-13)</small>

* release: v3.35.9 ([00825d0](https://github.com/mx-space/core/commit/00825d0))
* chore: add redis timeout ([78d30b5](https://github.com/mx-space/core/commit/78d30b5))
* chore: change copy of rss tip ([1cfcd4b](https://github.com/mx-space/core/commit/1cfcd4b))
* chore: update deps ([69ccdc1](https://github.com/mx-space/core/commit/69ccdc1))
* chore(deps): update dependency @types/semver to v7.3.11 ([760a3c3](https://github.com/mx-space/core/commit/760a3c3))
* chore(deps): update dependency @types/semver to v7.3.12 ([1ff1d8c](https://github.com/mx-space/core/commit/1ff1d8c))
* feat: make some compatibility with Kami Markdown syntax ([eb33352](https://github.com/mx-space/core/commit/eb33352))
* fix(deps): update dependency @nestjs/event-emitter to v1.3.1 ([00c5a9c](https://github.com/mx-space/core/commit/00c5a9c))
* fix(deps): update dependency dayjs to v1.11.5 ([4880667](https://github.com/mx-space/core/commit/4880667))
* fix(deps): update dependency mongoose to v6.5.2 ([0588149](https://github.com/mx-space/core/commit/0588149))
* fix(deps): update dependency nodemailer to v6.7.8 ([e6dddd4](https://github.com/mx-space/core/commit/e6dddd4))
* fix(deps): update nest monorepo to v9.0.9 ([7629c04](https://github.com/mx-space/core/commit/7629c04))

## <small>3.35.8 (2022-08-07)</small>

* release: v3.35.8 ([8333bcd](https://github.com/mx-space/core/commit/8333bcd))
* feat: emit download progress ([1f44ca7](https://github.com/mx-space/core/commit/1f44ca7))
* refactor: change throw error code if not find ([8f4533b](https://github.com/mx-space/core/commit/8f4533b))
* fix: upgrade mongoose and refactor ([6defdd6](https://github.com/mx-space/core/commit/6defdd6))
* fix(deps): update babel monorepo to v7.18.10 ([da94036](https://github.com/mx-space/core/commit/da94036))
* fix(deps): update dependency @babel/plugin-transform-typescript to v7.18.12 ([34f6d51](https://github.com/mx-space/core/commit/34f6d51))
* fix(deps): update dependency @nestjs/swagger to v6.0.5 ([d940be0](https://github.com/mx-space/core/commit/d940be0))
* fix(deps): update dependency @typegoose/auto-increment to v1.6.0 (#660) ([bbc5c32](https://github.com/mx-space/core/commit/bbc5c32)), closes [#660](https://github.com/mx-space/core/issues/660)
* fix(deps): update dependency @typegoose/typegoose to v9.11.0 (#658) ([21e26d2](https://github.com/mx-space/core/commit/21e26d2)), closes [#658](https://github.com/mx-space/core/issues/658)
* fix(deps): update dependency jszip to v3.10.1 ([20d0a99](https://github.com/mx-space/core/commit/20d0a99))
* fix(deps): update nest monorepo to v9.0.7 ([a796042](https://github.com/mx-space/core/commit/a796042))
* fix(deps): update nest monorepo to v9.0.8 ([ae944e7](https://github.com/mx-space/core/commit/ae944e7))
* chore(deps): update dependency @types/nodemailer to v6.4.5 ([1b5d25f](https://github.com/mx-space/core/commit/1b5d25f))
* chore(deps): update dependency @types/validator to v13.7.5 ([49cbfa9](https://github.com/mx-space/core/commit/49cbfa9))
* chore(deps): update dependency tsconfig-paths to v4.1.0 (#670) ([32f085b](https://github.com/mx-space/core/commit/32f085b)), closes [#670](https://github.com/mx-space/core/issues/670)
* chore(deps): update dependency webpack to v5.74.0 (#652) ([cfceb3f](https://github.com/mx-space/core/commit/cfceb3f)), closes [#652](https://github.com/mx-space/core/issues/652)

## <small>3.35.7 (2022-07-28)</small>

* release: v3.35.7 ([fea5c52](https://github.com/mx-space/core/commit/fea5c52))
* refactor: scan table cron ([ab5e547](https://github.com/mx-space/core/commit/ab5e547))
* fix: pick env instead of inject whole env ([6735006](https://github.com/mx-space/core/commit/6735006))
* fix(deps): update dependency @fastify/cookie to v7.3.1 (#647) ([f53226c](https://github.com/mx-space/core/commit/f53226c)), closes [#647](https://github.com/mx-space/core/issues/647)
* fix(deps): update dependency algoliasearch to v4.14.2 ([64c757a](https://github.com/mx-space/core/commit/64c757a))
* fix(deps): update nest monorepo to v9.0.6 (patch) (#657) ([782c7ef](https://github.com/mx-space/core/commit/782c7ef)), closes [#657](https://github.com/mx-space/core/issues/657)

## <small>3.35.6 (2022-07-27)</small>

* release: v3.35.6 ([5477cc8](https://github.com/mx-space/core/commit/5477cc8))
* fix(deps): update dependency @fastify/static to v6.4.1 ([2b93e91](https://github.com/mx-space/core/commit/2b93e91))
* fix(deps): update dependency algoliasearch to v4.14.1 ([24a56f2](https://github.com/mx-space/core/commit/24a56f2))
* fix(deps): update dependency mongoose to v6.4.6 ([1224548](https://github.com/mx-space/core/commit/1224548))
* fix(deps): update dependency mongoose to v6.4.7 ([086b128](https://github.com/mx-space/core/commit/086b128))
* fix(deps): update dependency mongoose to v6.5.0 (#654) ([53451e2](https://github.com/mx-space/core/commit/53451e2)), closes [#654](https://github.com/mx-space/core/issues/654)
* fix(deps): update dependency mongoose-lean-getters to v0.3.5 ([5c921c5](https://github.com/mx-space/core/commit/5c921c5))
* feat: table scan to delete outdate token ([19791bb](https://github.com/mx-space/core/commit/19791bb))
* chore(deps): update dependency ioredis to v5.2.2 ([8973d00](https://github.com/mx-space/core/commit/8973d00))
* chore(deps): update dependency mongodb-memory-server to v8.8.0 (#651) ([34ef33f](https://github.com/mx-space/core/commit/34ef33f)), closes [#651](https://github.com/mx-space/core/issues/651)

## <small>3.35.5 (2022-07-20)</small>

* release: v3.35.5 ([630e575](https://github.com/mx-space/core/commit/630e575))
* feat: comment whispers (#643) ([3bc265d](https://github.com/mx-space/core/commit/3bc265d)), closes [#643](https://github.com/mx-space/core/issues/643)
* fix: file is not exist and throw ([d21cdc5](https://github.com/mx-space/core/commit/d21cdc5))
* fix(deps): update dependency @babel/core to v7.18.9 (#638) ([8bebb17](https://github.com/mx-space/core/commit/8bebb17)), closes [#638](https://github.com/mx-space/core/issues/638)
* fix(deps): update dependency @fastify/cookie to v7.2.0 (#560) ([da8ece4](https://github.com/mx-space/core/commit/da8ece4)), closes [#560](https://github.com/mx-space/core/issues/560)
* fix(deps): update dependency algoliasearch to v4.14.0 (#640) ([29ef236](https://github.com/mx-space/core/commit/29ef236)), closes [#640](https://github.com/mx-space/core/issues/640)
* fix(deps): update dependency dayjs to v1.11.4 ([c286a19](https://github.com/mx-space/core/commit/c286a19))
* fix(deps): update dependency mongoose to v6.4.5 ([0b9de53](https://github.com/mx-space/core/commit/0b9de53))
* fix(deps): update nest monorepo to v9.0.4 (patch) (#639) ([88ac5d5](https://github.com/mx-space/core/commit/88ac5d5)), closes [#639](https://github.com/mx-space/core/issues/639)
* fix(deps): update nest monorepo to v9.0.5 ([62db6c9](https://github.com/mx-space/core/commit/62db6c9))
* chore(deps): update dependency ioredis to v5.2.1 ([70d1142](https://github.com/mx-space/core/commit/70d1142))
* chore(deps): update dependency ts-jest to v28.0.7 ([da61b8a](https://github.com/mx-space/core/commit/da61b8a))

## <small>3.35.4 (2022-07-16)</small>

* release: v3.35.4 ([ed704e4](https://github.com/mx-space/core/commit/ed704e4))
* fix(deps): update dependency @nestjs/swagger to v6.0.4 ([a00c195](https://github.com/mx-space/core/commit/a00c195))
* fix(post): flat lookup `$category` ([d23daf1](https://github.com/mx-space/core/commit/d23daf1))
* chore(deps): update dependency @types/jest to v28.1.6 ([cb536f2](https://github.com/mx-space/core/commit/cb536f2))
* chore(deps): update dependency ts-jest to v28.0.6 ([2cfc626](https://github.com/mx-space/core/commit/2cfc626))
* chore(deps): update dependency ts-node to v10.9.1 (#632) ([83f6599](https://github.com/mx-space/core/commit/83f6599)), closes [#632](https://github.com/mx-space/core/issues/632)

## <small>3.35.3 (2022-07-14)</small>

* release: v3.35.3 ([567b25c](https://github.com/mx-space/core/commit/567b25c))

## <small>3.35.2 (2022-07-14)</small>

* release: v3.35.2 ([68c113c](https://github.com/mx-space/core/commit/68c113c))
* chore: cleanup ([626773e](https://github.com/mx-space/core/commit/626773e))
* chore(deps): update dependency @types/jest to v28.1.5 ([cd0d361](https://github.com/mx-space/core/commit/cd0d361))
* chore(deps): update dependency ioredis to v5.2.0 (#627) ([48aefe0](https://github.com/mx-space/core/commit/48aefe0)), closes [#627](https://github.com/mx-space/core/issues/627)
* chore(deps): update dependency jest to v28.1.3 ([24be0cf](https://github.com/mx-space/core/commit/24be0cf))
* fix: search decorator ([16d07a0](https://github.com/mx-space/core/commit/16d07a0))
* fix: test docker on pr ([b86e95a](https://github.com/mx-space/core/commit/b86e95a))
* fix(deps): update dependency @nestjs/event-emitter to v1.3.0 (#616) ([dfdec53](https://github.com/mx-space/core/commit/dfdec53)), closes [#616](https://github.com/mx-space/core/issues/616)
* fix(deps): update dependency @nestjs/swagger to v6.0.3 ([5eec4e3](https://github.com/mx-space/core/commit/5eec4e3))
* fix(deps): update dependency image-size to v1.0.2 ([6f24cf9](https://github.com/mx-space/core/commit/6f24cf9))
* fix(deps): update dependency marked to v4.0.18 ([9e62ce8](https://github.com/mx-space/core/commit/9e62ce8))
* fix(deps): update dependency rxjs to v7.5.6 ([0ae4c15](https://github.com/mx-space/core/commit/0ae4c15))
* fix(deps): update nest monorepo to v9.0.3 ([3daafc2](https://github.com/mx-space/core/commit/3daafc2))
* fix(update): shell output ([f3da1ea](https://github.com/mx-space/core/commit/f3da1ea))
* revert: docker permission ([d4cf346](https://github.com/mx-space/core/commit/d4cf346))
* chore :  mx user home → host directory (#625) ([3d803ef](https://github.com/mx-space/core/commit/3d803ef)), closes [#625](https://github.com/mx-space/core/issues/625)
* feat/upgrade nest v9 (#620) ([1290a78](https://github.com/mx-space/core/commit/1290a78)), closes [#620](https://github.com/mx-space/core/issues/620)
* refactor: exec command ([ba4c25f](https://github.com/mx-space/core/commit/ba4c25f))

## <small>3.35.1 (2022-07-11)</small>

* release: v3.35.1 ([21a7562](https://github.com/mx-space/core/commit/21a7562))
* fix: pin value when update posts ([20b03d1](https://github.com/mx-space/core/commit/20b03d1))
* fix(deps): update dependency @babel/plugin-transform-typescript to v7.18.8 ([0bcef78](https://github.com/mx-space/core/commit/0bcef78))
* fix(deps): update dependency mongoose to v6.4.4 ([23c8330](https://github.com/mx-space/core/commit/23c8330))
* chore: docker adduser ([8b43add](https://github.com/mx-space/core/commit/8b43add))
* perf: use read stream to transfer data ([37e4297](https://github.com/mx-space/core/commit/37e4297))

## 3.35.0 (2022-07-08)

* release: v3.35.0 ([0864e41](https://github.com/mx-space/core/commit/0864e41))
* chore: remove debug ([1c5f221](https://github.com/mx-space/core/commit/1c5f221))
* chore: update mongoose ([14200f9](https://github.com/mx-space/core/commit/14200f9))
* feat: support upgrage admin dashboard (#612) ([18a304e](https://github.com/mx-space/core/commit/18a304e)), closes [#612](https://github.com/mx-space/core/issues/612)
* fix: create `package.json` ([7faed81](https://github.com/mx-space/core/commit/7faed81))
* fix: make jest happy ([d2b42b6](https://github.com/mx-space/core/commit/d2b42b6))
* fix(deps): update dependency @typegoose/auto-increment to v1.4.1 (#606) ([8bc125d](https://github.com/mx-space/core/commit/8bc125d)), closes [#606](https://github.com/mx-space/core/issues/606)
* fix(deps): update dependency axios-retry to v3.3.1 (#597) ([055e4ab](https://github.com/mx-space/core/commit/055e4ab)), closes [#597](https://github.com/mx-space/core/issues/597)
* fix(deps): update dependency mongoose-paginate-v2 to v1.7.0 (#607) ([a16e580](https://github.com/mx-space/core/commit/a16e580)), closes [#607](https://github.com/mx-space/core/issues/607)
* fix(deps): update dependency nodemailer to v6.7.7 ([57835fe](https://github.com/mx-space/core/commit/57835fe))
* refactor: remove cron clsuter compatibility hack (#610) ([63c9e30](https://github.com/mx-space/core/commit/63c9e30)), closes [#610](https://github.com/mx-space/core/issues/610)
* ci: add timeout ([8d7d440](https://github.com/mx-space/core/commit/8d7d440))

## 3.34.0 (2022-07-04)

* release: v3.34.0 ([5f756b5](https://github.com/mx-space/core/commit/5f756b5))
* feat: pkg graph ([6a1a592](https://github.com/mx-space/core/commit/6a1a592))
* feat: use sse to pipe install deps output ([9c399a0](https://github.com/mx-space/core/commit/9c399a0))
* refactor: extract dependency module ([18bfc4b](https://github.com/mx-space/core/commit/18bfc4b))
* chore(deps): update dependency @types/cache-manager to v4.0.1 ([9f4fd41](https://github.com/mx-space/core/commit/9f4fd41))
* chore(deps): update dependency @types/validator to v13.7.4 ([a8b4a50](https://github.com/mx-space/core/commit/a8b4a50))
* chore(deps): update dependency ts-node to v10.8.2 ([02492e1](https://github.com/mx-space/core/commit/02492e1))
* fix: record error log throwed in serverless fn ([74d6d7e](https://github.com/mx-space/core/commit/74d6d7e))
* fix(fn): replace directly access code define file ([4a5c6de](https://github.com/mx-space/core/commit/4a5c6de))

## <small>3.33.1 (2022-07-02)</small>

* release: v3.33.1 ([a307aad](https://github.com/mx-space/core/commit/a307aad))
* fix: post pin sort order ([4aa9b79](https://github.com/mx-space/core/commit/4aa9b79))
* fix(deps): update babel monorepo to v7.18.6 ([e3718e9](https://github.com/mx-space/core/commit/e3718e9))
* fix(deps): update dependency axios-retry to v3.2.6 ([7c617ea](https://github.com/mx-space/core/commit/7c617ea))
* fix(deps): update dependency nodemailer to v6.7.6 ([19d341d](https://github.com/mx-space/core/commit/19d341d))
* fix(deps): update dependency qs to v6.11.0 (#594) ([260ce43](https://github.com/mx-space/core/commit/260ce43)), closes [#594](https://github.com/mx-space/core/issues/594)
* chore(deps): update dependency @types/jest to v28.1.4 ([7396487](https://github.com/mx-space/core/commit/7396487))
* chore(deps): update dependency jest to v28.1.2 ([3c4520e](https://github.com/mx-space/core/commit/3c4520e))
* chore(deps): update dependency mongodb-memory-server to v8.7.2 ([ea96e4b](https://github.com/mx-space/core/commit/ea96e4b))
* feat: add process title ([a242918](https://github.com/mx-space/core/commit/a242918))

## 3.33.0 (2022-06-27)

* release: v3.33.0 ([c4ab15c](https://github.com/mx-space/core/commit/c4ab15c))
* fix: post event emit twice when create ([6e47cc6](https://github.com/mx-space/core/commit/6e47cc6))
* ci: fix ([76bc6d3](https://github.com/mx-space/core/commit/76bc6d3))
* chore: speed-up ci ([a582e88](https://github.com/mx-space/core/commit/a582e88))

## 3.33.0-alpha.0 (2022-06-26)

* release: v3.33.0-alpha.0 ([626b963](https://github.com/mx-space/core/commit/626b963))
* fix: login success status code ([b4d20d4](https://github.com/mx-space/core/commit/b4d20d4))
* refactor: login session with jwt ([8408f2e](https://github.com/mx-space/core/commit/8408f2e))
* fix!: change markdown render into ejs controller ([e764dd5](https://github.com/mx-space/core/commit/e764dd5))

## 3.32.0 (2022-06-26)

* release: v3.32.0 ([f83f716](https://github.com/mx-space/core/commit/f83f716))
* fix: hardcode origin ([5e599cd](https://github.com/mx-space/core/commit/5e599cd))
* fix: host wildcard ([382d55f](https://github.com/mx-space/core/commit/382d55f))
* fix: local ip cors ([ed767b9](https://github.com/mx-space/core/commit/ed767b9))
* fix: pin is undefine ([cae7d23](https://github.com/mx-space/core/commit/cae7d23))
* fix: popluate category for related post ([eb79152](https://github.com/mx-space/core/commit/eb79152))
* fix: realtime log gatewway ([d7867f3](https://github.com/mx-space/core/commit/d7867f3))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.12 ([5e9621e](https://github.com/mx-space/core/commit/5e9621e))
* feat: related post ([df07623](https://github.com/mx-space/core/commit/df07623))
* chore: store paw ([e2ea7c3](https://github.com/mx-space/core/commit/e2ea7c3))
* chore: upadte paw ([c6e5322](https://github.com/mx-space/core/commit/c6e5322))
* chore(deps): update dependency @nestjs/cli to v8.2.7 ([0527636](https://github.com/mx-space/core/commit/0527636))
* chore(deps): update dependency @nestjs/cli to v8.2.8 ([c37c4c8](https://github.com/mx-space/core/commit/c37c4c8))
* chore(deps): update dependency ioredis to v5.1.0 (#592) ([63740ff](https://github.com/mx-space/core/commit/63740ff)), closes [#592](https://github.com/mx-space/core/issues/592)
* chore(deps): update dependency lint-staged to v13.0.3 ([9c46b80](https://github.com/mx-space/core/commit/9c46b80))
* chore(deps): update dependency mongodb-memory-server to v8.7.1 ([4fd24c3](https://github.com/mx-space/core/commit/4fd24c3))
* chore(deps): update dependency ts-loader to v9.3.1 ([0947fe0](https://github.com/mx-space/core/commit/0947fe0))

## <small>3.31.1 (2022-06-22)</small>

* release: v3.31.1 ([23f1a5c](https://github.com/mx-space/core/commit/23f1a5c))
* fix: remove serverless fn comment and close #585 ([3769898](https://github.com/mx-space/core/commit/3769898)), closes [#585](https://github.com/mx-space/core/issues/585)
* fix(deps): update dependency linkedom to v0.14.12 ([f7e83d6](https://github.com/mx-space/core/commit/f7e83d6))
* fix(deps): update dependency mongoose-lean-getters to v0.3.4 ([a1452c8](https://github.com/mx-space/core/commit/a1452c8))
* chore(deps): update dependency @types/jest to v28.1.3 ([0c3b114](https://github.com/mx-space/core/commit/0c3b114))
* chore(deps): update dependency mongodb-memory-server to v8.7.0 ([6de6f8b](https://github.com/mx-space/core/commit/6de6f8b))
* refactory: global prefix routes (#583) ([c8aac34](https://github.com/mx-space/core/commit/c8aac34)), closes [#583](https://github.com/mx-space/core/issues/583)
* ci: checkout depth ([93b864e](https://github.com/mx-space/core/commit/93b864e))

## 3.31.0 (2022-06-19)

* release: v3.31.0 ([0b8521f](https://github.com/mx-space/core/commit/0b8521f))
* chore: add changelog gerenate ([f90fc84](https://github.com/mx-space/core/commit/f90fc84))
* chore: add comment for fixme ([5835d4f](https://github.com/mx-space/core/commit/5835d4f))
* feat: support json5 for snippet ([f359a17](https://github.com/mx-space/core/commit/f359a17))

## 3.31.0-alpha.1 (2022-06-18)

* release: v3.31.0-alpha.1 ([9994d4b](https://github.com/mx-space/core/commit/9994d4b))
* fix: remove designated refType ([b046eee](https://github.com/mx-space/core/commit/b046eee))

## 3.31.0-alpha.0 (2022-06-18)

* release: v3.31.0-alpha.0 ([18ec4f1](https://github.com/mx-space/core/commit/18ec4f1))
* fix: idepotence ttl ([1c7ba43](https://github.com/mx-space/core/commit/1c7ba43))
* fix: recenly ref ([c5fbd40](https://github.com/mx-space/core/commit/c5fbd40))
* fix(deps): update dependency mongoose to v6.3.9 ([671df49](https://github.com/mx-space/core/commit/671df49))
* refactor: extract subpub from redis ([1da8ef9](https://github.com/mx-space/core/commit/1da8ef9))
* refactor: remove unnessary exception ([09cca08](https://github.com/mx-space/core/commit/09cca08))
* refactor: serverless exception ([675a932](https://github.com/mx-space/core/commit/675a932))
* chore: ignore deps ([48a840b](https://github.com/mx-space/core/commit/48a840b))
* chore(deps): update dependency @types/jest to v28.1.2 ([141568b](https://github.com/mx-space/core/commit/141568b))
* chore(deps): update dependency lint-staged to v13.0.2 ([ae48efe](https://github.com/mx-space/core/commit/ae48efe))
* chore(deps): update dependency typescript to v4.7.4 ([1ed1ce4](https://github.com/mx-space/core/commit/1ed1ce4))
* feat: url builder ([07f9c6b](https://github.com/mx-space/core/commit/07f9c6b))
* docs: add section for serverless fn ([7ee6346](https://github.com/mx-space/core/commit/7ee6346))

## <small>3.30.2 (2022-06-16)</small>

* release: v3.30.2 ([841c4a0](https://github.com/mx-space/core/commit/841c4a0))
* fix: comment pin only once ([a1792da](https://github.com/mx-space/core/commit/a1792da))
* fix: comment pin sort ([89d73b1](https://github.com/mx-space/core/commit/89d73b1))
* fix: docker add health check ([f6db675](https://github.com/mx-space/core/commit/f6db675))
* fix(deps): update dependency @babel/core to v7.18.5 ([5723a58](https://github.com/mx-space/core/commit/5723a58))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.11 ([fdea024](https://github.com/mx-space/core/commit/fdea024))
* fix(deps): update dependency marked to v4.0.17 ([de42510](https://github.com/mx-space/core/commit/de42510))
* fix(deps): update dependency mongoose to v6.3.8 ([3367e26](https://github.com/mx-space/core/commit/3367e26))
* fix(deps): update nest monorepo to v8.4.7 ([cfea925](https://github.com/mx-space/core/commit/cfea925))
* feat: comment pin ([d78f60b](https://github.com/mx-space/core/commit/d78f60b))
* chore(deps): update dependency mongodb-memory-server to v8.6.1 ([8a06476](https://github.com/mx-space/core/commit/8a06476))
* chore(deps): update dependency ts-jest to v28.0.5 ([5ab364f](https://github.com/mx-space/core/commit/5ab364f))

## <small>3.30.1 (2022-06-13)</small>

* release: v3.30.1 ([6abfc99](https://github.com/mx-space/core/commit/6abfc99))
* fix: custom token validate ([9764920](https://github.com/mx-space/core/commit/9764920))
* fix: use inspect object ([5def2ca](https://github.com/mx-space/core/commit/5def2ca))

## 3.30.0 (2022-06-12)

* release: v3.30.0 ([80197e5](https://github.com/mx-space/core/commit/80197e5))
* fix: jwt verfiy ([102b072](https://github.com/mx-space/core/commit/102b072))
* fix: pin order ([ae8ed8a](https://github.com/mx-space/core/commit/ae8ed8a))
* fix: pin sort ([61cc473](https://github.com/mx-space/core/commit/61cc473))
* feat: post pin ([2a1d59f](https://github.com/mx-space/core/commit/2a1d59f))
* chore: cleanup ([71029fb](https://github.com/mx-space/core/commit/71029fb))

## 3.30.0-alpha.1 (2022-06-11)

* release: v3.30.0-alpha.1 ([aaa4daf](https://github.com/mx-space/core/commit/aaa4daf))
* docs: update readme ([fbfe6c9](https://github.com/mx-space/core/commit/fbfe6c9))
* chore: add uppercase header field in auth gateway ([9ec9cc6](https://github.com/mx-space/core/commit/9ec9cc6))
* chore: clean middleware ([15a9d09](https://github.com/mx-space/core/commit/15a9d09))
* test: add case for jwt ([36785a6](https://github.com/mx-space/core/commit/36785a6))
* feat: add access db instance in function ([698656e](https://github.com/mx-space/core/commit/698656e))
* feat: add jwt service ([0d67b0b](https://github.com/mx-space/core/commit/0d67b0b))
* feat: add signout ([136734a](https://github.com/mx-space/core/commit/136734a))
* refactor: auth jwt ([c128241](https://github.com/mx-space/core/commit/c128241))
* refactor(event-manager): move emit into handler ([5213455](https://github.com/mx-space/core/commit/5213455))
* fix: idempotence pending status (#566) ([602be61](https://github.com/mx-space/core/commit/602be61)), closes [#566](https://github.com/mx-space/core/issues/566)
* fix: resolution dependency to reduce size ([fcb4faa](https://github.com/mx-space/core/commit/fcb4faa))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.10 ([1be687f](https://github.com/mx-space/core/commit/1be687f))

## 3.30.0-alpha.0 (2022-06-09)

* release: v3.30.0-alpha.0 ([0bdc3b1](https://github.com/mx-space/core/commit/0bdc3b1))
* feat: bark support (#563) ([1642026](https://github.com/mx-space/core/commit/1642026)), closes [#563](https://github.com/mx-space/core/issues/563)
* fix: performance import ([27b85ef](https://github.com/mx-space/core/commit/27b85ef))
* fix: remove python2 builder ([213d7ee](https://github.com/mx-space/core/commit/213d7ee))
* fix: remove python2 in dockerfile (#557) ([4c061ec](https://github.com/mx-space/core/commit/4c061ec)), closes [#557](https://github.com/mx-space/core/issues/557)
* fix(deps): update dependency dayjs to v1.11.3 ([9498aff](https://github.com/mx-space/core/commit/9498aff))
* fix(deps): update dependency linkedom to v0.14.11 ([8f98908](https://github.com/mx-space/core/commit/8f98908))
* fix(deps): update dependency mongoose to v6.3.6 ([423055f](https://github.com/mx-space/core/commit/423055f))
* fix(deps): update dependency qs to v6.10.5 ([5fc1124](https://github.com/mx-space/core/commit/5fc1124))
* fix(deps): update dependency xss to v1.0.13 ([a4de831](https://github.com/mx-space/core/commit/a4de831))
* refactor: axios debug mode ([c87cba2](https://github.com/mx-space/core/commit/c87cba2))
* chore(deps): update dependency @types/cache-manager to v4 ([25558d8](https://github.com/mx-space/core/commit/25558d8))
* chore(deps): update dependency @types/jest to v28.1.1 ([e424c98](https://github.com/mx-space/core/commit/e424c98))
* chore(deps): update dependency @types/validator to v13.7.3 ([1d55a82](https://github.com/mx-space/core/commit/1d55a82))
* chore(deps): update dependency jest to v28.1.1 ([ac115bd](https://github.com/mx-space/core/commit/ac115bd))
* chore(deps): update dependency lint-staged to v13 ([9b6faa0](https://github.com/mx-space/core/commit/9b6faa0))
* chore(deps): update dependency lint-staged to v13.0.1 ([4ab26fd](https://github.com/mx-space/core/commit/4ab26fd))
* chore(deps): update dependency webpack to v5.73.0 ([c624e54](https://github.com/mx-space/core/commit/c624e54))

## <small>3.29.2 (2022-06-04)</small>

* release: v3.29.2 ([51b50ea](https://github.com/mx-space/core/commit/51b50ea))
* feat: add comment option for ip record ([454d5b0](https://github.com/mx-space/core/commit/454d5b0))
* fix: config patch ([92500ed](https://github.com/mx-space/core/commit/92500ed))
* fix: jsonschema ([5c60368](https://github.com/mx-space/core/commit/5c60368))
* fix(deps): update dependency cache-manager to v4.0.1 ([d4fb889](https://github.com/mx-space/core/commit/d4fb889))
* fix(deps): update dependency xss to v1.0.12 ([e96f368](https://github.com/mx-space/core/commit/e96f368))
* chore(deps): update dependency ts-node to v10.8.1 ([77a34c7](https://github.com/mx-space/core/commit/77a34c7))
* chore(deps): update dependency typescript to v4.7.3 ([e8d1da4](https://github.com/mx-space/core/commit/e8d1da4))

## <small>3.29.1 (2022-06-03)</small>

* release: v3.29.1 ([51eaebe](https://github.com/mx-space/core/commit/51eaebe))
* fix: jsonschema ([cb78f77](https://github.com/mx-space/core/commit/cb78f77))
* fix(deps): update dependency @babel/plugin-transform-typescript to v7.18.4 ([3d73cc9](https://github.com/mx-space/core/commit/3d73cc9))
* fix(deps): update dependency @typegoose/typegoose to v9.9.0 ([d6b9e4e](https://github.com/mx-space/core/commit/d6b9e4e))
* fix(deps): update dependency cache-manager to v4 ([2c2263a](https://github.com/mx-space/core/commit/2c2263a))
* fix(deps): update dependency mongoose to v6.3.5 ([dbfb15e](https://github.com/mx-space/core/commit/dbfb15e))
* fix(deps): update dependency mongoose-lean-getters to v0.3.3 ([c64b083](https://github.com/mx-space/core/commit/c64b083))
* fix(deps): update nest monorepo to v8.4.6 ([0ceaec4](https://github.com/mx-space/core/commit/0ceaec4))
* chore(deps): update dependency @types/jest to v27.5.2 ([b955ee0](https://github.com/mx-space/core/commit/b955ee0))
* chore(deps): update dependency @types/jest to v28 ([0768963](https://github.com/mx-space/core/commit/0768963))
* chore(deps): update dependency ioredis to v5.0.6 ([05291dd](https://github.com/mx-space/core/commit/05291dd))
* chore(deps): update dependency lint-staged to v12.4.3 ([88fd04f](https://github.com/mx-space/core/commit/88fd04f))
* chore(deps): update dependency ts-jest to v28.0.4 ([9513c3f](https://github.com/mx-space/core/commit/9513c3f))
* chore(deps): update pnpm/action-setup action to v2.2.2 ([b6cdf37](https://github.com/mx-space/core/commit/b6cdf37))
* docs: readme ([a096bd1](https://github.com/mx-space/core/commit/a096bd1))
* docs: update readme ([29ef9e1](https://github.com/mx-space/core/commit/29ef9e1))

## 3.29.0 (2022-05-28)

* release: v3.29.0 ([bd33d81](https://github.com/mx-space/core/commit/bd33d81))
* chore: cleanup ([d4b503c](https://github.com/mx-space/core/commit/d4b503c))
* chore(deps): update dependency @vercel/ncc to v0.34.0 ([a0f2b62](https://github.com/mx-space/core/commit/a0f2b62))
* chore(deps): update dependency ts-node to v10.8.0 ([9a122e7](https://github.com/mx-space/core/commit/9a122e7))
* chore(deps): update dependency typescript to v4.7.2 ([9c3bbfb](https://github.com/mx-space/core/commit/9c3bbfb))
* feat: add idempotence interceptor ([d19c726](https://github.com/mx-space/core/commit/d19c726))
* fix: note create event scope ([e6c5745](https://github.com/mx-space/core/commit/e6c5745))

## <small>3.28.3 (2022-05-27)</small>

* release: v3.28.3 ([6d5d664](https://github.com/mx-space/core/commit/6d5d664))
* fix: comment event ([6209aca](https://github.com/mx-space/core/commit/6209aca))
* fix: query ip timeout ([55c90d0](https://github.com/mx-space/core/commit/55c90d0))

## <small>3.28.2 (2022-05-26)</small>

* release: v3.28.2 ([8780668](https://github.com/mx-space/core/commit/8780668))
* fix: install pkg when restore data ([e3a6d4b](https://github.com/mx-space/core/commit/e3a6d4b))
* fix: skip proxy route when record analyze ([4a26a00](https://github.com/mx-space/core/commit/4a26a00))
* fix(deps): update babel monorepo to v7.18.2 ([127d909](https://github.com/mx-space/core/commit/127d909))

## <small>3.28.1 (2022-05-25)</small>

* release: v3.28.1 ([cad51a1](https://github.com/mx-space/core/commit/cad51a1))
* fix: demo cache key prefix ([2c237b7](https://github.com/mx-space/core/commit/2c237b7))
* feat: demo mode ([ad1b5f6](https://github.com/mx-space/core/commit/ad1b5f6))
* chore(deps): update dependency lint-staged to v12.4.2 ([bd274b8](https://github.com/mx-space/core/commit/bd274b8))
* chore(deps): update dependency ts-jest to v28.0.3 ([f3f452e](https://github.com/mx-space/core/commit/f3f452e))

## 3.28.0 (2022-05-24)

* release: v3.28.0 ([f51954d](https://github.com/mx-space/core/commit/f51954d))
* chore : restart for docker install ([2e722e4](https://github.com/mx-space/core/commit/2e722e4))
* feat: add cache header for file ([0a26299](https://github.com/mx-space/core/commit/0a26299))
* fix(deps): update dependency jszip to v3.10.0 ([ae5436b](https://github.com/mx-space/core/commit/ae5436b))
* fix(deps): update dependency passport to v0.6.0 ([60c4c46](https://github.com/mx-space/core/commit/60c4c46))
* chore(deps): update dependency mongodb-memory-server to v8.6.0 ([965120e](https://github.com/mx-space/core/commit/965120e))

## 3.28.0-alpha.1 (2022-05-22)

* release: v3.28.0-alpha.1 ([d606338](https://github.com/mx-space/core/commit/d606338))
* fix: file name hash ([158629f](https://github.com/mx-space/core/commit/158629f))
* fix: resolve file url ([bca11de](https://github.com/mx-space/core/commit/bca11de))

## 3.28.0-alpha.0 (2022-05-22)

* release: v3.28.0-alpha.0 ([f60fcfe](https://github.com/mx-space/core/commit/f60fcfe))
* fix: file response ([62ffd6f](https://github.com/mx-space/core/commit/62ffd6f))
* feat: add throttle ([59c50a4](https://github.com/mx-space/core/commit/59c50a4))
* feat: file module ([110d9ca](https://github.com/mx-space/core/commit/110d9ca))

## <small>3.27.2 (2022-05-21)</small>

* release: v3.27.2 ([3abae4a](https://github.com/mx-space/core/commit/3abae4a))
* fix: pager dto and sort query ([43813df](https://github.com/mx-space/core/commit/43813df))

## <small>3.27.1 (2022-05-21)</small>

* release: v3.27.1 ([8c12e8c](https://github.com/mx-space/core/commit/8c12e8c))

## 3.27.0 (2022-05-21)

* release: v3.27.0 ([256e0bb](https://github.com/mx-space/core/commit/256e0bb))
* fix: script to fetch ([6125c4f](https://github.com/mx-space/core/commit/6125c4f))
* fix(deps): update dependency @nestjs/schedule to v2.0.1 ([48589f6](https://github.com/mx-space/core/commit/48589f6))
* fix(deps): update dependency cache-manager to v3.6.3 ([7d05e7c](https://github.com/mx-space/core/commit/7d05e7c))

## 3.27.0-alpha.0 (2022-05-20)

* release: v3.27.0-alpha.0 ([4786d8a](https://github.com/mx-space/core/commit/4786d8a))
* fix: change `fn` route ([357a635](https://github.com/mx-space/core/commit/357a635))
* fix: link dto description can be empty ([bfa6af3](https://github.com/mx-space/core/commit/bfa6af3))
* fix: note model relationship ([ba2c8bb](https://github.com/mx-space/core/commit/ba2c8bb))
* fix: note topic paginator ([cdced95](https://github.com/mx-space/core/commit/cdced95))
* fix: note update lean ([e06c76c](https://github.com/mx-space/core/commit/e06c76c))
* fix(deps): update babel monorepo ([6a39511](https://github.com/mx-space/core/commit/6a39511))
* fix(deps): update babel monorepo to v7.17.12 ([2928598](https://github.com/mx-space/core/commit/2928598))
* fix(deps): update dependency @babel/plugin-transform-typescript to v7.17.12 ([e01ba83](https://github.com/mx-space/core/commit/e01ba83))
* fix(deps): update dependency @nestjs/jwt to v8.0.1 ([8dd2c0a](https://github.com/mx-space/core/commit/8dd2c0a))
* fix(deps): update dependency algoliasearch to v4.13.1 ([dafacb6](https://github.com/mx-space/core/commit/dafacb6))
* fix(deps): update dependency cache-manager to v3.6.2 ([fbceb24](https://github.com/mx-space/core/commit/fbceb24))
* fix(deps): update dependency isbot to v3.4.8 ([537cbec](https://github.com/mx-space/core/commit/537cbec))
* fix(deps): update dependency isbot to v3.5.0 ([7b16997](https://github.com/mx-space/core/commit/7b16997))
* fix(deps): update dependency marked to v4.0.16 ([267b4a7](https://github.com/mx-space/core/commit/267b4a7))
* fix(deps): update dependency mongoose to v6.3.4 ([7a348b9](https://github.com/mx-space/core/commit/7a348b9))
* fix(deps): update dependency passport to v0.5.3 ([a7fc893](https://github.com/mx-space/core/commit/a7fc893))
* fix(topic): add vaildation ([6f79df9](https://github.com/mx-space/core/commit/6f79df9))
* fix(topic): limit of intro ([b7c6310](https://github.com/mx-space/core/commit/b7c6310))
* chore: fix typo ([913cff7](https://github.com/mx-space/core/commit/913cff7))
* chore: remove log nodepath ([59c36e0](https://github.com/mx-space/core/commit/59c36e0))
* chore(deps): update dependency @nestjs/cli to v8.2.6 ([e8c05e1](https://github.com/mx-space/core/commit/e8c05e1))
* chore(deps): update dependency ioredis to v5.0.5 ([8423e93](https://github.com/mx-space/core/commit/8423e93))
* feat: add topic model ([2ebabec](https://github.com/mx-space/core/commit/2ebabec))
* feat: note topic init ([46fe004](https://github.com/mx-space/core/commit/46fe004))
* refactor: extract note model ([fd32568](https://github.com/mx-space/core/commit/fd32568))

## <small>3.26.7 (2022-05-16)</small>

* release: v3.26.7 ([fbcba6b](https://github.com/mx-space/core/commit/fbcba6b))
* fix: delete article with delete comment ([4e39690](https://github.com/mx-space/core/commit/4e39690))
* fix: nest module deps ([f552b62](https://github.com/mx-space/core/commit/f552b62))
* fix: worker url ([66e882b](https://github.com/mx-space/core/commit/66e882b))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.9 ([d9de63d](https://github.com/mx-space/core/commit/d9de63d))
* fix(deps): update dependency ejs to v3.1.8 ([a46e990](https://github.com/mx-space/core/commit/a46e990))
* fix(deps): update dependency isbot to v3.4.7 ([b0456df](https://github.com/mx-space/core/commit/b0456df))
* fix(deps): update dependency snakecase-keys to v5.4.2 ([9c27f3d](https://github.com/mx-space/core/commit/9c27f3d))
* fix(deps): update nest monorepo to v8.4.5 ([c3566d2](https://github.com/mx-space/core/commit/c3566d2))
* fix(serverless): add route entry ([dc7b0d7](https://github.com/mx-space/core/commit/dc7b0d7))
* chore(deps): update dependency @types/cron to v2 ([4d76fce](https://github.com/mx-space/core/commit/4d76fce))
* chore(deps): update dependency @types/ejs to v3.1.1 ([aa0c49b](https://github.com/mx-space/core/commit/aa0c49b))
* chore(deps): update dependency @types/jest to v27.5.1 ([6320bfa](https://github.com/mx-space/core/commit/6320bfa))
* chore(deps): update dependency webpack to v5.72.1 ([e0186c3](https://github.com/mx-space/core/commit/e0186c3))

## <small>3.26.6 (2022-05-10)</small>

* release: v3.26.6 ([0163bee](https://github.com/mx-space/core/commit/0163bee))
* chore: update deps ([913cf7a](https://github.com/mx-space/core/commit/913cf7a))
* fix(deps): update dependency mongoose to v6.3.3 ([b8328f7](https://github.com/mx-space/core/commit/b8328f7))

## <small>3.26.5 (2022-05-08)</small>

* release: v3.26.5 ([6ee0789](https://github.com/mx-space/core/commit/6ee0789))
* fix: snippet private data leak ([513d9e0](https://github.com/mx-space/core/commit/513d9e0))

## <small>3.26.4 (2022-05-08)</small>

* release: v3.26.4 ([f076c1d](https://github.com/mx-space/core/commit/f076c1d))
* chore: update deps ([bbfedea](https://github.com/mx-space/core/commit/bbfedea))
* chore(deps): update dependency jest to v28.1.0 ([c865075](https://github.com/mx-space/core/commit/c865075))
* chore(deps): update dependency ts-jest to v28.0.2 ([5e47e3e](https://github.com/mx-space/core/commit/5e47e3e))
* chore(deps): update docker/build-push-action action to v3 ([563dd0d](https://github.com/mx-space/core/commit/563dd0d))
* chore(deps): update docker/login-action action to v2 ([1c4696a](https://github.com/mx-space/core/commit/1c4696a))
* chore(deps): update docker/metadata-action action to v4 ([609e0f3](https://github.com/mx-space/core/commit/609e0f3))
* chore(deps): update docker/setup-buildx-action action to v2 ([4bada6b](https://github.com/mx-space/core/commit/4bada6b))
* chore(deps): update docker/setup-qemu-action action to v2 ([f71c026](https://github.com/mx-space/core/commit/f71c026))
* fix: disable pnpm 7 strict peer deps ([75cc9f5](https://github.com/mx-space/core/commit/75cc9f5))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.8 ([32da143](https://github.com/mx-space/core/commit/32da143))
* fix(deps): update dependency dayjs to v1.11.2 ([fcbc1e5](https://github.com/mx-space/core/commit/fcbc1e5))
* fix(deps): update dependency linkedom to v0.14.9 ([e406550](https://github.com/mx-space/core/commit/e406550))

## <small>3.26.3 (2022-05-03)</small>

* release: v3.26.3 ([3ed17b9](https://github.com/mx-space/core/commit/3ed17b9))
* chore: update deps ([e85fa8d](https://github.com/mx-space/core/commit/e85fa8d))
* fix: exchange location order ([454159e](https://github.com/mx-space/core/commit/454159e))
* fix: remove comment location duplicated name ([8acb7fd](https://github.com/mx-space/core/commit/8acb7fd))

## <small>3.26.2 (2022-05-02)</small>

* release: v3.26.2 ([6767ce6](https://github.com/mx-space/core/commit/6767ce6))
* fix: comment emit event scope ([ed424e0](https://github.com/mx-space/core/commit/ed424e0))
* chore: update deps ([fb057e8](https://github.com/mx-space/core/commit/fb057e8))

## <small>3.26.1 (2022-05-01)</small>

* release: v3.26.1 ([53b2230](https://github.com/mx-space/core/commit/53b2230))
* fix: comment lost avatar ([2346ce5](https://github.com/mx-space/core/commit/2346ce5))

## 3.26.0 (2022-04-30)

* release: v3.26.0 ([78d3c25](https://github.com/mx-space/core/commit/78d3c25))
* chore: change text macro defualt flag ([220189f](https://github.com/mx-space/core/commit/220189f))
* chore: cleanup ([a4124c0](https://github.com/mx-space/core/commit/a4124c0))
* chore: flush after close redis ([529c166](https://github.com/mx-space/core/commit/529c166))
* chore(deps): update dependency mongodb-memory-server to v8.5.2 ([338993f](https://github.com/mx-space/core/commit/338993f))
* test: fix test suit ([204df21](https://github.com/mx-space/core/commit/204df21))
* refactor: text macro ([8f786bc](https://github.com/mx-space/core/commit/8f786bc))
* feat: add styling and typography method for macors ([80bb68e](https://github.com/mx-space/core/commit/80bb68e))
* fix(deps): update dependency @babel/core to v7.17.10 ([c2709d1](https://github.com/mx-space/core/commit/c2709d1))
* fix(deps): update dependency axios-retry to v3.2.5 ([1e9f203](https://github.com/mx-space/core/commit/1e9f203))
* fix(deps): update dependency nodemailer to v6.7.4 ([d6be01a](https://github.com/mx-space/core/commit/d6be01a))

## <small>3.25.3 (2022-04-29)</small>

* release: v3.25.3 ([d20e018](https://github.com/mx-space/core/commit/d20e018))
* feat: add comment location expose ([06089dd](https://github.com/mx-space/core/commit/06089dd))
* fix: remove master role vaild in category ([1b913f0](https://github.com/mx-space/core/commit/1b913f0))
* fix(deps): update dependency mongoose-lean-virtuals to v0.9.1 ([baf103a](https://github.com/mx-space/core/commit/baf103a))
* chore(deps): update dependency @types/node to v16.11.31 ([06132c7](https://github.com/mx-space/core/commit/06132c7))
* chore(deps): update dependency @types/node to v16.11.32 ([0836dab](https://github.com/mx-space/core/commit/0836dab))
* chore(deps): update dependency lint-staged to v12.4.1 ([536a2d7](https://github.com/mx-space/core/commit/536a2d7))
* chore(deps): update dependency ts-loader to v9.2.9 ([1655b67](https://github.com/mx-space/core/commit/1655b67))
* chore(deps): update dependency typescript to v4.6.4 ([b926772](https://github.com/mx-space/core/commit/b926772))

## <small>3.25.2 (2022-04-26)</small>

* release: v3.25.2 ([9089af2](https://github.com/mx-space/core/commit/9089af2))
* fix: note dto update ([0bb62e8](https://github.com/mx-space/core/commit/0bb62e8))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.7 ([dded729](https://github.com/mx-space/core/commit/dded729))
* chore(deps): update dependency @types/node to v16.11.29 ([611419a](https://github.com/mx-space/core/commit/611419a))

## <small>3.25.1 (2022-04-25)</small>

* release: v3.25.1 ([4fb34a0](https://github.com/mx-space/core/commit/4fb34a0))
* fix: slug unique ([1b614e9](https://github.com/mx-space/core/commit/1b614e9))
* chore(deps): update dependency @types/node to v16.11.28 ([d64c225](https://github.com/mx-space/core/commit/d64c225))

## 3.25.0 (2022-04-25)

* release: v3.25.0 ([7685272](https://github.com/mx-space/core/commit/7685272))
* fix: slug validate ([debd1b7](https://github.com/mx-space/core/commit/debd1b7))

## 3.25.0-alpha.4 (2022-04-24)

* release: v3.25.0-alpha.4 ([ef06585](https://github.com/mx-space/core/commit/ef06585))

## 3.25.0-alpha.3 (2022-04-24)

* fix: test failed ([a5c1afb](https://github.com/mx-space/core/commit/a5c1afb))
* fix(deps): update dependency mongoose to v6.3.1 ([a4415c6](https://github.com/mx-space/core/commit/a4415c6))
* release: v3.25.0-alpha.3 ([482b250](https://github.com/mx-space/core/commit/482b250))
* chore: cleanup ([84c3043](https://github.com/mx-space/core/commit/84c3043))
* chore(deps): update dependency mongodb-memory-server to v8.5.1 ([a46be17](https://github.com/mx-space/core/commit/a46be17))
* feat: serverless access db support ([2dbca32](https://github.com/mx-space/core/commit/2dbca32))

## 3.25.0-alpha.2 (2022-04-23)

* release: v3.25.0-alpha.2 ([eefb627](https://github.com/mx-space/core/commit/eefb627))
* fix: catch all error in text macro replace ([a571fac](https://github.com/mx-space/core/commit/a571fac))
* fix: json type make ts-jest happy ([9b4633b](https://github.com/mx-space/core/commit/9b4633b))
* fix: meta lean ([112b34c](https://github.com/mx-space/core/commit/112b34c))
* feat: add meta for write model ([20a788c](https://github.com/mx-space/core/commit/20a788c))

## 3.25.0-alpha.1 (2022-04-22)

* release: v3.25.0-alpha.1 ([60290d4](https://github.com/mx-space/core/commit/60290d4))
* fix: page macor ([22c9730](https://github.com/mx-space/core/commit/22c9730))

## 3.25.0-alpha.0 (2022-04-22)

* release: v3.25.0-alpha.0 ([fac86ab](https://github.com/mx-space/core/commit/fac86ab))
* fix: remove only flag to run test ([947813f](https://github.com/mx-space/core/commit/947813f))
* fix(deps): update dependency @typegoose/typegoose to v9.8.1 ([e7690c3](https://github.com/mx-space/core/commit/e7690c3))
* fix(deps): update dependency ejs to v3.1.7 ([b35f228](https://github.com/mx-space/core/commit/b35f228))
* feat: function eval marco ([5c33536](https://github.com/mx-space/core/commit/5c33536))
* feat: page controller support macro ([bbc7607](https://github.com/mx-space/core/commit/bbc7607))
* feat: text macros ([b09f231](https://github.com/mx-space/core/commit/b09f231))
* chore(deps): update dependency lint-staged to v12.4.0 (#446) ([055e3c7](https://github.com/mx-space/core/commit/055e3c7)), closes [#446](https://github.com/mx-space/core/issues/446)
* chore(deps): update dependency mongodb-memory-server to v8.5.0 (#438) ([0d481e8](https://github.com/mx-space/core/commit/0d481e8)), closes [#438](https://github.com/mx-space/core/issues/438)

## <small>3.24.5 (2022-04-20)</small>

* release: v3.24.5 ([275e58c](https://github.com/mx-space/core/commit/275e58c))
* feat: boardcast error event ([835295e](https://github.com/mx-space/core/commit/835295e))
* fix(deps): update dependency isbot to v3.4.6 ([5689520](https://github.com/mx-space/core/commit/5689520))

## <small>3.24.4 (2022-04-19)</small>

* release: v3.24.4 ([43f1d44](https://github.com/mx-space/core/commit/43f1d44))
* chore: code style ([4ec23b3](https://github.com/mx-space/core/commit/4ec23b3))
* chore(deps): update dependency @types/lodash to v4.14.182 ([c2fe0af](https://github.com/mx-space/core/commit/c2fe0af))
* fix: eslint type style ([a9a8c3a](https://github.com/mx-space/core/commit/a9a8c3a))
* fix: make ts happy ([5f45822](https://github.com/mx-space/core/commit/5f45822))
* fix(deps): update dependency @typegoose/auto-increment to v1.3.0 (#439) ([a80eb8e](https://github.com/mx-space/core/commit/a80eb8e)), closes [#439](https://github.com/mx-space/core/issues/439)
* fix(deps): update dependency fastify-cookie to v5.6.1 ([21e1230](https://github.com/mx-space/core/commit/21e1230))
* fix(deps): update dependency nanoid to v3.3.3 ([38effeb](https://github.com/mx-space/core/commit/38effeb))
* fix(deps): update dependency zx-cjs to v6.1.0 (#437) ([412ad64](https://github.com/mx-space/core/commit/412ad64)), closes [#437](https://github.com/mx-space/core/issues/437)

## <small>3.24.3 (2022-04-17)</small>

* release: v3.24.3 ([ecda18c](https://github.com/mx-space/core/commit/ecda18c))
* fix: add page slug validate ([deef809](https://github.com/mx-space/core/commit/deef809))
* fix: slugify ([f6c2456](https://github.com/mx-space/core/commit/f6c2456))
* fix(deps): update dependency dayjs to v1.11.1 ([33bd11e](https://github.com/mx-space/core/commit/33bd11e))
* fix(deps): update dependency fastify-swagger to v5.1.1 ([7c9a057](https://github.com/mx-space/core/commit/7c9a057))
* fix(deps): update dependency linkedom to v0.14.6 ([2078aaa](https://github.com/mx-space/core/commit/2078aaa))
* fix(deps): update dependency linkedom to v0.14.7 ([d9e3a69](https://github.com/mx-space/core/commit/d9e3a69))
* fix(deps): update dependency snakecase-keys to v5.4.1 ([5cfad42](https://github.com/mx-space/core/commit/5cfad42))
* chore: cleanup ([6365526](https://github.com/mx-space/core/commit/6365526))
* chore(deps): update dependency @innei-util/eslint-config-ts to v0.8.2 (#426) ([fea0d81](https://github.com/mx-space/core/commit/fea0d81)), closes [#426](https://github.com/mx-space/core/issues/426)
* chore(deps): update dependency @innei-util/prettier to v0.5.1 ([f2d9db7](https://github.com/mx-space/core/commit/f2d9db7))
* chore(deps): update dependency @innei-util/prettier to v0.8.2 (#428) ([41a2fa0](https://github.com/mx-space/core/commit/41a2fa0)), closes [#428](https://github.com/mx-space/core/issues/428)
* chore(deps): update dependency @types/mongoose-paginate-v2 to v1.6.4 ([91cf30d](https://github.com/mx-space/core/commit/91cf30d))
* chore(deps): update dependency @types/node to v16.11.27 ([24da092](https://github.com/mx-space/core/commit/24da092))
* chore(deps): update dependency lint-staged to v12.3.8 ([399013d](https://github.com/mx-space/core/commit/399013d))

## <small>3.24.2 (2022-04-12)</small>

* release: v3.24.2 ([d911e3c](https://github.com/mx-space/core/commit/d911e3c))
* fix: link apply dto ([94b5df6](https://github.com/mx-space/core/commit/94b5df6))
* chore(deps): update dependency @vercel/ncc to v0.33.4 ([2e9e296](https://github.com/mx-space/core/commit/2e9e296))

## <small>3.24.1 (2022-04-11)</small>

* release: v3.24.1 ([8fe9c42](https://github.com/mx-space/core/commit/8fe9c42))
* chore(deps): update dependency webpack to v5.72.0 (#419) ([3710e70](https://github.com/mx-space/core/commit/3710e70)), closes [#419](https://github.com/mx-space/core/issues/419)
* fix(deps): update dependency marked to v4.0.14 (#423) ([9e1d5c5](https://github.com/mx-space/core/commit/9e1d5c5)), closes [#423](https://github.com/mx-space/core/issues/423)
* fix(deps): update dependency snakecase-keys to v5.4.0 (#414) ([e2fa729](https://github.com/mx-space/core/commit/e2fa729)), closes [#414](https://github.com/mx-space/core/issues/414)

## 3.24.0 (2022-04-10)

* release: v3.24.0 ([5475afd](https://github.com/mx-space/core/commit/5475afd))

## 3.24.0-alpha.3 (2022-04-10)

* release: v3.24.0-alpha.3 ([ac8e7e8](https://github.com/mx-space/core/commit/ac8e7e8))
* fix: serverless module found ([f48c3a9](https://github.com/mx-space/core/commit/f48c3a9))

## 3.24.0-alpha.2 (2022-04-10)

* release: v3.24.0-alpha.2 ([20ae9f0](https://github.com/mx-space/core/commit/20ae9f0))
* fix: pm2 cluster instance count ([981270b](https://github.com/mx-space/core/commit/981270b))
* fix: shared gateway boardcast ([a32299e](https://github.com/mx-space/core/commit/a32299e))
* fix: test config ([1bc6b61](https://github.com/mx-space/core/commit/1bc6b61))
* fix: token auth and base curl event name ([0107909](https://github.com/mx-space/core/commit/0107909))
* chore(deps): update dependency ioredis to v5.0.4 ([413160f](https://github.com/mx-space/core/commit/413160f))

## 3.24.0-alpha.1 (2022-04-09)

* release: v3.24.0-alpha.1 ([3851385](https://github.com/mx-space/core/commit/3851385))
* refactor: auth gateway ([1abc929](https://github.com/mx-space/core/commit/1abc929))
* fix: comment send email ([d532888](https://github.com/mx-space/core/commit/d532888))

## 3.24.0-alpha.0 (2022-04-09)

* release: v3.24.0-alpha.0 ([92df4dd](https://github.com/mx-space/core/commit/92df4dd))
* fix: tsconfig ([d27b46f](https://github.com/mx-space/core/commit/d27b46f))
* fix(deps): update babel monorepo to v7.17.9 ([4ae2542](https://github.com/mx-space/core/commit/4ae2542))
* fix(deps): update dependency cache-manager to v3.6.1 ([89225ba](https://github.com/mx-space/core/commit/89225ba))
* fix(deps): update dependency jszip to v3.9.1 ([aa72dbc](https://github.com/mx-space/core/commit/aa72dbc))
* fix(deps): update dependency marked to v4.0.13 ([f46cdec](https://github.com/mx-space/core/commit/f46cdec))
* pref: minify package ([cdb8018](https://github.com/mx-space/core/commit/cdb8018))
* chore(deps): update dependency @nestjs/schematics to v8.0.10 ([92eaa35](https://github.com/mx-space/core/commit/92eaa35))
* chore(deps): update nest monorepo ([a9ce6df](https://github.com/mx-space/core/commit/a9ce6df))

## <small>3.23.5 (2022-04-05)</small>

* release: v3.23.5 ([e48f957](https://github.com/mx-space/core/commit/e48f957))
* fix: manager install command ([b67db72](https://github.com/mx-space/core/commit/b67db72))

## <small>3.23.3 (2022-04-05)</small>

* release: v3.23.3 ([30efcfc](https://github.com/mx-space/core/commit/30efcfc))
* chore: update ioredis to v5 ([47c6ab8](https://github.com/mx-space/core/commit/47c6ab8))
* chore(deps): update dependency webpack to v5.71.0 (#411) ([e7548e0](https://github.com/mx-space/core/commit/e7548e0)), closes [#411](https://github.com/mx-space/core/issues/411)
* fix(deps): update dependency @nestjs/schedule to v1.1.0 (#406) ([b2e0773](https://github.com/mx-space/core/commit/b2e0773)), closes [#406](https://github.com/mx-space/core/issues/406)
* fix(deps): update dependency jszip to v3.9.0 (#413) ([49073bb](https://github.com/mx-space/core/commit/49073bb)), closes [#413](https://github.com/mx-space/core/issues/413)

## <small>3.23.2 (2022-04-05)</small>

* release: v3.23.2 ([7475f81](https://github.com/mx-space/core/commit/7475f81))
* chore: import order ([eec3cc8](https://github.com/mx-space/core/commit/eec3cc8))
* feat: import snippets ([c86df4a](https://github.com/mx-space/core/commit/c86df4a))
* refactor: move file ([3398dc0](https://github.com/mx-space/core/commit/3398dc0))

## <small>3.23.1 (2022-04-04)</small>

* release: v3.23.1 ([6e206b7](https://github.com/mx-space/core/commit/6e206b7))
* feat: webpack build ([7638f2b](https://github.com/mx-space/core/commit/7638f2b))
* fix: url allowed for validator ([00b6e3b](https://github.com/mx-space/core/commit/00b6e3b))
* fix(deps): update dependency fastify-swagger to v5.1.0 (#402) ([08b214c](https://github.com/mx-space/core/commit/08b214c)), closes [#402](https://github.com/mx-space/core/issues/402)
* fix(deps): update dependency jszip to v3.8.0 (#409) ([fc4bbb0](https://github.com/mx-space/core/commit/fc4bbb0)), closes [#409](https://github.com/mx-space/core/issues/409)
* refactor: extract gateway boardcast ([e130ab0](https://github.com/mx-space/core/commit/e130ab0))
* chore(deps): update dependency @nestjs/schematics to v8.0.9 ([b1bb9db](https://github.com/mx-space/core/commit/b1bb9db))
* chore(deps): update dependency @types/lodash to v4.14.181 ([d9ae03d](https://github.com/mx-space/core/commit/d9ae03d))
* chore(deps): update dependency mongodb-memory-server to v8.4.2 ([8a43f60](https://github.com/mx-space/core/commit/8a43f60))
* chore(deps): update dependency prettier to v2.6.2 ([3ff3a37](https://github.com/mx-space/core/commit/3ff3a37))

## 3.23.0 (2022-03-28)

* release: v3.23.0 ([56927d5](https://github.com/mx-space/core/commit/56927d5))
* fix(deps): update dependency nanoid to v3.3.2 ([f1bfecf](https://github.com/mx-space/core/commit/f1bfecf))

## 3.23.0-alpha.0 (2022-03-27)

* release: v3.23.0-alpha.0 ([0e0835a](https://github.com/mx-space/core/commit/0e0835a))
* refactor: add cwd constant ([b89897a](https://github.com/mx-space/core/commit/b89897a))
* refactor: fix type guard (#404) ([382d046](https://github.com/mx-space/core/commit/382d046)), closes [#404](https://github.com/mx-space/core/issues/404)
* fix(deps): update dependency @nestjs/swagger to v5.2.1 ([441db06](https://github.com/mx-space/core/commit/441db06))
* fix(deps): update nest monorepo to v8.4.3 (patch) (#401) ([c8d9572](https://github.com/mx-space/core/commit/c8d9572)), closes [#401](https://github.com/mx-space/core/issues/401)
* chore: link module ([d982a97](https://github.com/mx-space/core/commit/d982a97))
* chore(deps): update dependency @innei-util/prettier to v0.5.0 ([99ae5a9](https://github.com/mx-space/core/commit/99ae5a9))

## <small>3.22.3 (2022-03-25)</small>

* release: v3.22.3 ([905250d](https://github.com/mx-space/core/commit/905250d))
* refactor: pty gateway file path ([de87672](https://github.com/mx-space/core/commit/de87672))
* fix: lost rsync command ([6994b3e](https://github.com/mx-space/core/commit/6994b3e))
* fix(deps): update dependency @typegoose/typegoose to v9.7.1 ([fb41336](https://github.com/mx-space/core/commit/fb41336))
* chore(deps): update dependency @innei-util/eslint-config-ts to v0.5.1 ([1b9deb6](https://github.com/mx-space/core/commit/1b9deb6))
* chore(deps): update dependency ts-jest to v27.1.4 ([511da86](https://github.com/mx-space/core/commit/511da86))
* chore(deps): update dependency typescript to v4.6.3 ([634aa7c](https://github.com/mx-space/core/commit/634aa7c))

## <small>3.22.2 (2022-03-23)</small>

* release: v3.22.2 ([e08237a](https://github.com/mx-space/core/commit/e08237a))
* fix: admin editor ([867663d](https://github.com/mx-space/core/commit/867663d))

## <small>3.22.1 (2022-03-23)</small>

* release: v3.22.1 ([fc5dd85](https://github.com/mx-space/core/commit/fc5dd85))
* chore: cleanup ([7635b86](https://github.com/mx-space/core/commit/7635b86))
* chore(deps): update actions/cache action to v3 ([49b9cbf](https://github.com/mx-space/core/commit/49b9cbf))
* chore(deps): update dependency @nestjs/cli to v8.2.4 ([4570456](https://github.com/mx-space/core/commit/4570456))
* chore(deps): update dependency @types/babel__core to v7.1.19 ([68f8082](https://github.com/mx-space/core/commit/68f8082))
* chore(deps): update dependency @types/marked to v4.0.3 ([c82051d](https://github.com/mx-space/core/commit/c82051d))
* chore(deps): update dependency tsconfig-paths to v3.14.1 ([a4a1292](https://github.com/mx-space/core/commit/a4a1292))
* fix: lodash can not clone a function ([201afc9](https://github.com/mx-space/core/commit/201afc9))
* fix: test error ([812f94e](https://github.com/mx-space/core/commit/812f94e))
* fix(deps): update dependency nodemailer to v6.7.3 ([c738182](https://github.com/mx-space/core/commit/c738182))
* fix(deps): update nest monorepo to v8.4.2 ([0e5f545](https://github.com/mx-space/core/commit/0e5f545))
* feat: support esm import statement ([cf57a14](https://github.com/mx-space/core/commit/cf57a14))
* feat: update docs ([facd5f6](https://github.com/mx-space/core/commit/facd5f6))
* refactor: file structure ([b7525a5](https://github.com/mx-space/core/commit/b7525a5))
* refactor: remove nestjs-typegoose ([cf8f7ea](https://github.com/mx-space/core/commit/cf8f7ea))

## 3.22.0 (2022-03-20)

* release: v3.22.0 ([6d0789a](https://github.com/mx-space/core/commit/6d0789a))
* refactor(backup): restore user asset file ([a8570a5](https://github.com/mx-space/core/commit/a8570a5))

## 3.21.0 (2022-03-19)

* release: v3.21.0 ([ed4b4a9](https://github.com/mx-space/core/commit/ed4b4a9))
* chore(deps): update dependency @types/ioredis to v4.28.10 ([de416fa](https://github.com/mx-space/core/commit/de416fa))
* chore(deps): update dependency @types/ioredis to v4.28.9 ([fdab079](https://github.com/mx-space/core/commit/fdab079))
* chore(deps): update dependency lint-staged to v12.3.7 ([04fa2da](https://github.com/mx-space/core/commit/04fa2da))
* feat: friend link options ([eecb51a](https://github.com/mx-space/core/commit/eecb51a))
* fix: docker env ([0774ce2](https://github.com/mx-space/core/commit/0774ce2))
* fix: if no snippet match throw error ([29a0301](https://github.com/mx-space/core/commit/29a0301))
* fix(deps): update dependency @babel/core to v7.17.8 ([452ab8b](https://github.com/mx-space/core/commit/452ab8b))
* fix(link): filter pass link in get all api ([9ae87c5](https://github.com/mx-space/core/commit/9ae87c5))

## <small>3.20.11 (2022-03-17)</small>

* release: v3.20.10 ([5d75072](https://github.com/mx-space/core/commit/5d75072))
* release: v3.20.11 ([99d8451](https://github.com/mx-space/core/commit/99d8451))
* docs: add dev guide ([5fdc650](https://github.com/mx-space/core/commit/5fdc650))
* chore: code style ([a68a223](https://github.com/mx-space/core/commit/a68a223))
* chore(deps): update dependency @nestjs/cli to v8.2.3 ([c2f06b1](https://github.com/mx-space/core/commit/c2f06b1))
* chore(deps): update dependency @types/lodash to v4.14.180 ([d762267](https://github.com/mx-space/core/commit/d762267))
* chore(deps): update dependency lint-staged to v12.3.6 ([0791843](https://github.com/mx-space/core/commit/0791843))
* chore(deps): update dependency mongodb-memory-server to v8.4.1 ([bd47e84](https://github.com/mx-space/core/commit/bd47e84))
* chore(deps): update dependency prettier to v2.6.0 ([5fa7250](https://github.com/mx-space/core/commit/5fa7250))
* fix: add allowed thrid lib ([fe75275](https://github.com/mx-space/core/commit/fe75275))
* fix(deps): update dependency @babel/core to v7.17.7 ([b7ff531](https://github.com/mx-space/core/commit/b7ff531))
* refactor: replace eval to validate valid function with ast parse ([b767d64](https://github.com/mx-space/core/commit/b767d64))

## <small>3.20.9 (2022-03-14)</small>

* release: v3.20.9 ([7b63e09](https://github.com/mx-space/core/commit/7b63e09))
* fix: make ts happy ([d228c5d](https://github.com/mx-space/core/commit/d228c5d))
* fix: serverless vm2 safe-eval ([c20cc59](https://github.com/mx-space/core/commit/c20cc59))
* chore: update deps ([ad2c5d9](https://github.com/mx-space/core/commit/ad2c5d9))
* feat: add redis storage for serverless ([7d0b71a](https://github.com/mx-space/core/commit/7d0b71a))
* feat(serverless): support typescript ([8c74a53](https://github.com/mx-space/core/commit/8c74a53))

## <small>3.20.8 (2022-03-13)</small>

* release: v3.20.8 ([389fe6b](https://github.com/mx-space/core/commit/389fe6b))
* refactor: use redis hash to store online count ([d42b60e](https://github.com/mx-space/core/commit/d42b60e))
* feat: cache snippet ([f408129](https://github.com/mx-space/core/commit/f408129))
* fix(serverless): add condition on query ([d98e3fb](https://github.com/mx-space/core/commit/d98e3fb))

## <small>3.20.7 (2022-03-13)</small>

* release: v3.20.7 ([ca93b3b](https://github.com/mx-space/core/commit/ca93b3b))
* fix: add create field index ([088966f](https://github.com/mx-space/core/commit/088966f))

## <small>3.20.6 (2022-03-12)</small>

* release: v3.20.6 ([7e689d6](https://github.com/mx-space/core/commit/7e689d6))
* feat: add serverless wildcard match ([9bc4b14](https://github.com/mx-space/core/commit/9bc4b14))
* fix: snippet not found throw ([cf91ff8](https://github.com/mx-space/core/commit/cf91ff8))

## <small>3.20.5 (2022-03-12)</small>

* release: v3.20.5 ([29c9984](https://github.com/mx-space/core/commit/29c9984))
* docs: add methods ([58c3e15](https://github.com/mx-space/core/commit/58c3e15))
* docs: readme ([22c418d](https://github.com/mx-space/core/commit/22c418d))
* chore: remove old proposal ([87232bc](https://github.com/mx-space/core/commit/87232bc))
* fix: add schema field for snippet ([5ded8e1](https://github.com/mx-space/core/commit/5ded8e1))
* fix(deps): update dependency isbot to v3.4.5 ([4b74c55](https://github.com/mx-space/core/commit/4b74c55))
* feat: add snippet aggregate api ([faa651c](https://github.com/mx-space/core/commit/faa651c))
* feat(serverless): add `getMaster` ([d81c2dc](https://github.com/mx-space/core/commit/d81c2dc))

## <small>3.20.4 (2022-03-11)</small>

* release: v3.20.4 ([fb8f7d5](https://github.com/mx-space/core/commit/fb8f7d5))
* test: fix type error ([6f6a80f](https://github.com/mx-space/core/commit/6f6a80f))
* feat: cron to clean require cache ([5bbdd8b](https://github.com/mx-space/core/commit/5bbdd8b))
* feat(serverless): add res object on func ([bc5de61](https://github.com/mx-space/core/commit/bc5de61))
* chore: update todo ([0443d15](https://github.com/mx-space/core/commit/0443d15))
* chore(deps): update dependency ts-loader to v9.2.8 ([19ee9a6](https://github.com/mx-space/core/commit/19ee9a6))
* chore(deps): update dependency ts-node to v10.7.0 ([a89a384](https://github.com/mx-space/core/commit/a89a384))
* fix: after test db close ([782c128](https://github.com/mx-space/core/commit/782c128))
* fix: ncc pack error ([d9ac794](https://github.com/mx-space/core/commit/d9ac794))
* fix(deps): update dependency fastify-swagger to v5 ([a0a1188](https://github.com/mx-space/core/commit/a0a1188))
* refactor: serverless module ([0fc0b6f](https://github.com/mx-space/core/commit/0fc0b6f))
* docs: remove draft ([fd8bcdb](https://github.com/mx-space/core/commit/fd8bcdb))
* docs: update serverless docs ([5d88d63](https://github.com/mx-space/core/commit/5d88d63))

## <small>3.20.3 (2022-03-10)</small>

* release: v3.20.3 ([a23f688](https://github.com/mx-space/core/commit/a23f688))
* chore: add path expose for docker ([dfdde96](https://github.com/mx-space/core/commit/dfdde96))
* chore: add serverless docs ([0c63e8e](https://github.com/mx-space/core/commit/0c63e8e))
* fix: can disable require cache ([86a4b49](https://github.com/mx-space/core/commit/86a4b49))
* feat(func): add require.resolve on mock require ([b255e6e](https://github.com/mx-space/core/commit/b255e6e))

## <small>3.20.2 (2022-03-10)</small>

* release: v3.20.2 ([ceb854a](https://github.com/mx-space/core/commit/ceb854a))
* test: add serverless function test case ([45d0f0d](https://github.com/mx-space/core/commit/45d0f0d))
* feat: add `throws` on function ([a4b3340](https://github.com/mx-space/core/commit/a4b3340))
* feat: add function scope req res ([a62bcf3](https://github.com/mx-space/core/commit/a62bcf3))
* fix(deps): update dependency rxjs to v7.5.5 ([370e75f](https://github.com/mx-space/core/commit/370e75f))

## <small>3.20.1 (2022-03-09)</small>

* release: v3.20.1 ([ec2006e](https://github.com/mx-space/core/commit/ec2006e))
* fix: expose global modules ([93335fe](https://github.com/mx-space/core/commit/93335fe))
* fix: hard code node path ([814d82b](https://github.com/mx-space/core/commit/814d82b))
* fix(function): allow prefix `@mx-space` lib ([cec8334](https://github.com/mx-space/core/commit/cec8334))

## 3.20.0 (2022-03-09)

* release: v3.20.0 ([7bfb513](https://github.com/mx-space/core/commit/7bfb513))
* chore: change copywrite ([d479890](https://github.com/mx-space/core/commit/d479890))
* chore(deps): update dependency @nestjs/schematics to v8.0.8 ([eee7678](https://github.com/mx-space/core/commit/eee7678))
* feat: function require mock and clonedeep ([ee8e98e](https://github.com/mx-space/core/commit/ee8e98e))
* feat: http cache ([7d63d2e](https://github.com/mx-space/core/commit/7d63d2e))
* feat: init serverless function ([b701428](https://github.com/mx-space/core/commit/b701428))
* feat: inject mock require and ctx to serverless fun ([d0e680a](https://github.com/mx-space/core/commit/d0e680a))
* feat: run function ([b6d6101](https://github.com/mx-space/core/commit/b6d6101))
* fix: safe path join ([13b1021](https://github.com/mx-space/core/commit/13b1021))
* fix: test case ([be3c650](https://github.com/mx-space/core/commit/be3c650))
* fix: test case for snippet ([474da8a](https://github.com/mx-space/core/commit/474da8a))
* fix(deps): update dependency fastify-swagger to v4.17.1 ([425c8d0](https://github.com/mx-space/core/commit/425c8d0))
* refactor: async io handle ([d794f8c](https://github.com/mx-space/core/commit/d794f8c))
* docs: serverless proposal ([dbb4688](https://github.com/mx-space/core/commit/dbb4688))

## <small>3.19.1 (2022-03-06)</small>

* release: v3.19.1 ([2478159](https://github.com/mx-space/core/commit/2478159))
* feat: add admin db query ([d9cadc8](https://github.com/mx-space/core/commit/d9cadc8))
* fix: add ApiName for link controller ([29c60cc](https://github.com/mx-space/core/commit/29c60cc))
* fix(deps): update dependency xss to v1.0.11 ([331c192](https://github.com/mx-space/core/commit/331c192))
* chore: update deps ([9c86ecc](https://github.com/mx-space/core/commit/9c86ecc))
* chore(deps): update dependency lint-staged to v12.3.5 ([b28e723](https://github.com/mx-space/core/commit/b28e723))

## 3.19.0 (2022-03-03)

* release: v3.19.0 ([371f169](https://github.com/mx-space/core/commit/371f169))
* chore(deps): update dependency @nestjs/cli to v8.2.2 ([cc592c0](https://github.com/mx-space/core/commit/cc592c0))
* fix: query with password post in timeline ([bf370c1](https://github.com/mx-space/core/commit/bf370c1))
* fix: remove post model `hide` field ([20f0b4d](https://github.com/mx-space/core/commit/20f0b4d))

## <small>3.18.12 (2022-03-02)</small>

* release: v3.18.12 ([fad4a78](https://github.com/mx-space/core/commit/fad4a78))
* chore(deps): update actions/checkout action to v3 ([9bb9717](https://github.com/mx-space/core/commit/9bb9717))
* chore(deps): update actions/setup-node action to v3 ([7208481](https://github.com/mx-space/core/commit/7208481))
* chore(deps): update dependency @types/cache-manager to v3.4.3 ([8970b7c](https://github.com/mx-space/core/commit/8970b7c))
* chore(deps): update dependency @types/lodash to v4.14.179 ([264a0fc](https://github.com/mx-space/core/commit/264a0fc))
* chore(deps): update dependency ts-loader to v9.2.7 ([8743f96](https://github.com/mx-space/core/commit/8743f96))
* chore(deps): update dependency ts-node to v10.6.0 ([e3bf6e4](https://github.com/mx-space/core/commit/e3bf6e4))
* chore(deps): update dependency typescript to v4.6.2 ([4552ec8](https://github.com/mx-space/core/commit/4552ec8))
* fix: remove now releatival ([4e3d9ec](https://github.com/mx-space/core/commit/4e3d9ec))
* fix: shanghai tz for docker ([f8c900c](https://github.com/mx-space/core/commit/f8c900c))
* fix(deps): update dependency @nestjs/event-emitter to v1.1.0 ([d2561c6](https://github.com/mx-space/core/commit/d2561c6))
* fix(deps): update dependency @typegoose/auto-increment to v1.2.0 ([eb0ac32](https://github.com/mx-space/core/commit/eb0ac32))
* fix(deps): update dependency algoliasearch to v4.12.2 ([bd553b4](https://github.com/mx-space/core/commit/bd553b4))
* fix(deps): update dependency dayjs to v1.10.8 ([4a9b36b](https://github.com/mx-space/core/commit/4a9b36b))
* fix(deps): update dependency fastify-cookie to v5.6.0 ([24cbb7c](https://github.com/mx-space/core/commit/24cbb7c))
* fix(deps): update dependency mongoose-paginate-v2 to v1.6.3 ([3cd6a56](https://github.com/mx-space/core/commit/3cd6a56))
* fix(deps): update nest monorepo to v8.4.0 ([399cfc1](https://github.com/mx-space/core/commit/399cfc1))

## <small>3.18.11 (2022-02-25)</small>

* release: v3.18.11 ([de5d017](https://github.com/mx-space/core/commit/de5d017))
* fix: gateway ([3e271d0](https://github.com/mx-space/core/commit/3e271d0))
* fix: pageproxy inject env in local proxy ([130f6f0](https://github.com/mx-space/core/commit/130f6f0))
* fix(deps): pin dependency jsdom to 19.0.0 ([cc34b8d](https://github.com/mx-space/core/commit/cc34b8d))
* chore(deps): update dependency @types/node to v16.11.26 ([8cf0f56](https://github.com/mx-space/core/commit/8cf0f56))
* chore(deps): update pnpm/action-setup action to v2.2.1 ([b3a8b01](https://github.com/mx-space/core/commit/b3a8b01))

## <small>3.18.10 (2022-02-24)</small>

* release: v3.18.10 ([3a32ef7](https://github.com/mx-space/core/commit/3a32ef7))
* pref: add cache for static assets ([0d31c43](https://github.com/mx-space/core/commit/0d31c43))
* fix: docker script ([ae4a660](https://github.com/mx-space/core/commit/ae4a660))
* fix: write file sync ([6d9694e](https://github.com/mx-space/core/commit/6d9694e))

## <small>3.18.9 (2022-02-24)</small>

* release: v3.18.9 ([2de994f](https://github.com/mx-space/core/commit/2de994f))
* fix: stop when error ([f9147fb](https://github.com/mx-space/core/commit/f9147fb))
* chore: rename step ([c26b092](https://github.com/mx-space/core/commit/c26b092))

## <small>3.18.8 (2022-02-24)</small>

* release: v3.18.8 ([6894da2](https://github.com/mx-space/core/commit/6894da2))
* fix: ci build script ([eeea74e](https://github.com/mx-space/core/commit/eeea74e))
* fix: ignore global prefix for proxy route ([93d37f3](https://github.com/mx-space/core/commit/93d37f3))
* fix: path base ([d575bde](https://github.com/mx-space/core/commit/d575bde))
* fix: remove windows build ([768ef59](https://github.com/mx-space/core/commit/768ef59))
* feat: add bundled local admin asset and entry ([786201d](https://github.com/mx-space/core/commit/786201d))
* chore(deps): update dependency @nestjs/schematics to v8.0.7 ([6fc9594](https://github.com/mx-space/core/commit/6fc9594))
* chore(deps): update dependency @types/jest to v27.4.1 ([f308087](https://github.com/mx-space/core/commit/f308087))

## <small>3.18.7 (2022-02-23)</small>

* release: v3.18.7 ([b9445b5](https://github.com/mx-space/core/commit/b9445b5))
* docs: update ([a590cbc](https://github.com/mx-space/core/commit/a590cbc))
* feat: add shebang ([a973fbb](https://github.com/mx-space/core/commit/a973fbb))
* fix(ci): windows shell ([106e318](https://github.com/mx-space/core/commit/106e318))

## <small>3.18.6 (2022-02-23)</small>

* release: v3.18.6 ([22e172a](https://github.com/mx-space/core/commit/22e172a))
* fix: deploy script ([74a546b](https://github.com/mx-space/core/commit/74a546b))
* fix: matrix build ci ([b261350](https://github.com/mx-space/core/commit/b261350))

## <small>3.18.5 (2022-02-23)</small>

* release: v3.18.5 ([273ddd7](https://github.com/mx-space/core/commit/273ddd7))
* Revert "release: v3.18.5" ([b2e0bf1](https://github.com/mx-space/core/commit/b2e0bf1))
* fix: build ci action ([703cd1c](https://github.com/mx-space/core/commit/703cd1c))
* fix: update mongoose ([19b5740](https://github.com/mx-space/core/commit/19b5740))
* fix(deps): update dependency @nestjs/passport to v8.2.0 (#331) ([d10efca](https://github.com/mx-space/core/commit/d10efca)), closes [#331](https://github.com/mx-space/core/issues/331)
* fix(deps): update dependency @nestjs/passport to v8.2.1 ([71d8d90](https://github.com/mx-space/core/commit/71d8d90))
* fix(deps): update dependency @typegoose/typegoose to v9.7.0 ([0a2a19d](https://github.com/mx-space/core/commit/0a2a19d))
* fix(deps): update dependency isbot to v3.4.3 ([d1c5194](https://github.com/mx-space/core/commit/d1c5194))
* fix(deps): update dependency nanoid to v3.3.0 (#330) ([253eab9](https://github.com/mx-space/core/commit/253eab9)), closes [#330](https://github.com/mx-space/core/issues/330)
* fix(deps): update dependency nanoid to v3.3.1 ([c5658d1](https://github.com/mx-space/core/commit/c5658d1))
* fix(deps): update nest monorepo to v8.3.0 (#328) ([10f7d1f](https://github.com/mx-space/core/commit/10f7d1f)), closes [#328](https://github.com/mx-space/core/issues/328)
* fix(deps): update nest monorepo to v8.3.1 ([888886e](https://github.com/mx-space/core/commit/888886e))
* chore: add funding ([fb1c8c6](https://github.com/mx-space/core/commit/fb1c8c6))
* chore(deps): update dependency mongodb-memory-server to v8.4.0 (#336) ([0956b8f](https://github.com/mx-space/core/commit/0956b8f)), closes [#336](https://github.com/mx-space/core/issues/336)
* chore(deps): update pnpm/action-setup action to v2.2.0 ([6c6622a](https://github.com/mx-space/core/commit/6c6622a))
* ci: build matrix ([abf2332](https://github.com/mx-space/core/commit/abf2332))
* ci: update pnpm version ([ff0d639](https://github.com/mx-space/core/commit/ff0d639))
* refactor: extract interface ([c1efdbb](https://github.com/mx-space/core/commit/c1efdbb))
* refactor: 分离 Option Controller ([8ce4052](https://github.com/mx-space/core/commit/8ce4052))
* feat: config jsonschema ([477b78c](https://github.com/mx-space/core/commit/477b78c))
* feaat: replace checkbot method to use isbot lib ([e3e9b53](https://github.com/mx-space/core/commit/e3e9b53))

## <small>3.18.4 (2022-02-15)</small>

* release: v3.18.4 ([460b717](https://github.com/mx-space/core/commit/460b717))
* chore(deps): update dependency @nestjs/cli to v8.2.1 ([c843a95](https://github.com/mx-space/core/commit/c843a95))
* chore(deps): update dependency @types/node to v16.11.25 ([b863f90](https://github.com/mx-space/core/commit/b863f90))
* chore(deps): update dependency lint-staged to v12.3.4 ([6495934](https://github.com/mx-space/core/commit/6495934))
* feat: add log for php request ([5252e76](https://github.com/mx-space/core/commit/5252e76))
* feat: fancy report for normal term but hack in vpty ([6aacb9c](https://github.com/mx-space/core/commit/6aacb9c))
* docs: update ([dae8170](https://github.com/mx-space/core/commit/dae8170))
* fix: instance up to cpus ([6ec245b](https://github.com/mx-space/core/commit/6ec245b))

## <small>3.18.3 (2022-02-13)</small>

* release: v3.18.3 ([3bd225a](https://github.com/mx-space/core/commit/3bd225a))
* refactor: logger and fix color ([570b727](https://github.com/mx-space/core/commit/570b727))
* fix: ban php request, fuck you ([bf280d2](https://github.com/mx-space/core/commit/bf280d2))
* fix: cron start once ([b90ce6c](https://github.com/mx-space/core/commit/b90ce6c))
* fix: error loger ([4a35231](https://github.com/mx-space/core/commit/4a35231))
* fix: get real socket ip ([b11f269](https://github.com/mx-space/core/commit/b11f269))

## <small>3.18.2 (2022-02-13)</small>

* release: v3.18.2 ([4e33e59](https://github.com/mx-space/core/commit/4e33e59))
* chore: update readme ([b458f46](https://github.com/mx-space/core/commit/b458f46))
* chore(deps): update dependency @vercel/ncc to v0.33.3 ([fb487bc](https://github.com/mx-space/core/commit/fb487bc))
* fix: add bash for docker alpine ([3d3e204](https://github.com/mx-space/core/commit/3d3e204))
* fix: mkdir first ([00e2c20](https://github.com/mx-space/core/commit/00e2c20))
* refactor: datetime util of format ([5f3dcc8](https://github.com/mx-space/core/commit/5f3dcc8))
* refactor: global register ([658026d](https://github.com/mx-space/core/commit/658026d))
* refactor: pty gateway ([7718de0](https://github.com/mx-space/core/commit/7718de0))
* feat: pty session record ([0928299](https://github.com/mx-space/core/commit/0928299))

## <small>3.18.1 (2022-02-12)</small>

* release: v3.18.1 ([a8238a1](https://github.com/mx-space/core/commit/a8238a1))
* fix: log clean cron ([9f8c369](https://github.com/mx-space/core/commit/9f8c369))
* fix: pm2 cluster mode dup run cron ([f6cc468](https://github.com/mx-space/core/commit/f6cc468))
* fix(deps): update dependency fastify-multipart to v5.3.1 ([1c9fdc9](https://github.com/mx-space/core/commit/1c9fdc9))
* fix(deps): update dependency mongoose-paginate-v2 to v1.6.2 ([66537cf](https://github.com/mx-space/core/commit/66537cf))
* pref: modify pageproxy indexEntryCdnUrl (#322) ([ed08d8c](https://github.com/mx-space/core/commit/ed08d8c)), closes [#322](https://github.com/mx-space/core/issues/322)
* chore(deps): update dependency @vercel/ncc to v0.33.2 ([5cd9e43](https://github.com/mx-space/core/commit/5cd9e43))

## 3.18.0 (2022-02-11)

* release: v3.18.0 ([da1470a](https://github.com/mx-space/core/commit/da1470a))
* chore: resolve typescript version ([d30ab2f](https://github.com/mx-space/core/commit/d30ab2f))
* chore(deps): update dependency ts-node to v10.5.0 (#310) ([da38601](https://github.com/mx-space/core/commit/da38601)), closes [#310](https://github.com/mx-space/core/issues/310)
* chore(deps): update pnpm/action-setup action to v2.1.0 (#312) ([0ff5e8b](https://github.com/mx-space/core/commit/0ff5e8b)), closes [#312](https://github.com/mx-space/core/issues/312)
* break: remove gql ([4c56535](https://github.com/mx-space/core/commit/4c56535))
* fix(deps): update dependency fastify-swagger to v4.15.0 (#307) ([96ea8db](https://github.com/mx-space/core/commit/96ea8db)), closes [#307](https://github.com/mx-space/core/issues/307)

## <small>3.17.1 (2022-02-11)</small>

* release: v3.17.1 ([ddd21fc](https://github.com/mx-space/core/commit/ddd21fc))
* fix: docker script ([af56dc4](https://github.com/mx-space/core/commit/af56dc4))
* fix: log & ws-log improve ([08c5311](https://github.com/mx-space/core/commit/08c5311))
* fix(deps): update dependency @typegoose/typegoose to v9.6.2 ([cf18e76](https://github.com/mx-space/core/commit/cf18e76))
* fix(deps): update dependency apollo-server-fastify to v3.6.3 ([99a2426](https://github.com/mx-space/core/commit/99a2426))
* fix(deps): update dependency rxjs to v7.5.4 ([0da14aa](https://github.com/mx-space/core/commit/0da14aa))
* chore(deps): update dependency @innei-util/prettier to v0.2.2 ([007f84c](https://github.com/mx-space/core/commit/007f84c))
* chore(deps): update dependency @nestjs/schematics to v8.0.6 ([76b3911](https://github.com/mx-space/core/commit/76b3911))
* chore(deps): update dependency @types/node to v16.11.24 ([650669b](https://github.com/mx-space/core/commit/650669b))
* chore(deps): update dependency ioredis to v4.28.5 ([061aba6](https://github.com/mx-space/core/commit/061aba6))
* chore(deps): update dependency jest to v27.5.1 ([54908ce](https://github.com/mx-space/core/commit/54908ce))

## 3.17.0 (2022-02-10)

* release: v3.17.0 ([3c33a61](https://github.com/mx-space/core/commit/3c33a61))
* feat: add terminal password ([64ba198](https://github.com/mx-space/core/commit/64ba198))
* feat: pre-run command support ([8ef6ec3](https://github.com/mx-space/core/commit/8ef6ec3))
* feat: pty support ([f04ac9e](https://github.com/mx-space/core/commit/f04ac9e))
* feat: terminal password support ([f20945c](https://github.com/mx-space/core/commit/f20945c))
* fix: rename all symbols ([46bbf18](https://github.com/mx-space/core/commit/46bbf18))

## <small>3.16.1 (2022-02-09)</small>

* release: v3.16.1 ([7ace6ca](https://github.com/mx-space/core/commit/7ace6ca))
* fix: rename admin repo name ([bae0f9f](https://github.com/mx-space/core/commit/bae0f9f))
* fix: rename repo name ([3144784](https://github.com/mx-space/core/commit/3144784))
* fix: replace version prefix `v` ([e48be83](https://github.com/mx-space/core/commit/e48be83))
* refactor: replce node-vibrant ([962e919](https://github.com/mx-space/core/commit/962e919))
* docs: update readme ([6b14c69](https://github.com/mx-space/core/commit/6b14c69))

## 3.16.0 (2022-02-09)

* release: v3.16.0 ([df02969](https://github.com/mx-space/core/commit/df02969))
* chore: update admin version ([b46cff6](https://github.com/mx-space/core/commit/b46cff6))
* chore: update deps ([9fdb8cc](https://github.com/mx-space/core/commit/9fdb8cc))
* chore(deps): update dependency @types/node to v16.11.22 (#298) ([a001921](https://github.com/mx-space/core/commit/a001921)), closes [#298](https://github.com/mx-space/core/issues/298)
* feat: add delete log ([22b6ca1](https://github.com/mx-space/core/commit/22b6ca1))
* feat: native log ([da42721](https://github.com/mx-space/core/commit/da42721))
* fix: admin gateway singleton ([8f73e61](https://github.com/mx-space/core/commit/8f73e61))
* fix: ci test & search options ([35baef1](https://github.com/mx-space/core/commit/35baef1))
* fix: guard and error pipe ([280f852](https://github.com/mx-space/core/commit/280f852))
* fix: redis sub channel ([0e2f520](https://github.com/mx-space/core/commit/0e2f520))

## <small>3.15.8 (2022-02-03)</small>

* release: v3.15.8 ([8a2c90d](https://github.com/mx-space/core/commit/8a2c90d))
* ci: fix again ([990d811](https://github.com/mx-space/core/commit/990d811))

## <small>3.15.7 (2022-02-03)</small>

* release: v3.15.7 ([0198a97](https://github.com/mx-space/core/commit/0198a97))
* fix: algolia search page ([3a9aea6](https://github.com/mx-space/core/commit/3a9aea6))
* ci: fix secrets ([d8f9af8](https://github.com/mx-space/core/commit/d8f9af8))
* ci: revert workflow ([2812aee](https://github.com/mx-space/core/commit/2812aee))

## <small>3.15.6 (2022-02-03)</small>

* release: v3.15.6 ([aa6ff5b](https://github.com/mx-space/core/commit/aa6ff5b))
* fix: jest test global env ([fe55bbc](https://github.com/mx-space/core/commit/fe55bbc))
* fix: search by algolia populate data ([955a112](https://github.com/mx-space/core/commit/955a112))
* pref: improve analyze query spped ([a6f8cf8](https://github.com/mx-space/core/commit/a6f8cf8))
* ci: workflow reusing ([c7ef462](https://github.com/mx-space/core/commit/c7ef462))

## <small>3.15.5 (2022-01-31)</small>

* release: v3.15.5 ([6bcd86f](https://github.com/mx-space/core/commit/6bcd86f))
* fix: check health retry and timeout ([5c4b58a](https://github.com/mx-space/core/commit/5c4b58a))
* fix: limit apply link char length ([6c0cac1](https://github.com/mx-space/core/commit/6c0cac1))

## <small>3.15.4 (2022-01-31)</small>

* release: v3.15.4 ([8cd8d3e](https://github.com/mx-space/core/commit/8cd8d3e))
* chore: update package ([9210659](https://github.com/mx-space/core/commit/9210659))
* chore(deps): update dependency @types/marked to v4.0.2 ([7a52e43](https://github.com/mx-space/core/commit/7a52e43))
* chore(deps): update dependency lint-staged to v12.3.2 (#286) ([6e19fdc](https://github.com/mx-space/core/commit/6e19fdc)), closes [#286](https://github.com/mx-space/core/issues/286)
* fix(deps): update dependency @nestjs/swagger to v5.2.0 (#292) ([b8fa295](https://github.com/mx-space/core/commit/b8fa295)), closes [#292](https://github.com/mx-space/core/issues/292)
* fix(deps): update dependency fastify-multipart to v5.3.0 (#291) ([f524a5a](https://github.com/mx-space/core/commit/f524a5a)), closes [#291](https://github.com/mx-space/core/issues/291)
* fix(deps): update dependency graphql to v15.8.0 (#219) ([220bdb7](https://github.com/mx-space/core/commit/220bdb7)), closes [#219](https://github.com/mx-space/core/issues/219)
* feat: link check ([5edb959](https://github.com/mx-space/core/commit/5edb959))

## <small>3.15.3 (2022-01-30)</small>

* release: v3.15.3 ([5f180f4](https://github.com/mx-space/core/commit/5f180f4))
* chore: update admin version ([56d0f20](https://github.com/mx-space/core/commit/56d0f20))
* chore: update admin version ([d50e89a](https://github.com/mx-space/core/commit/d50e89a))
* chore(deps): update dependency @innei-util/prettier to v0.2.0 (#296) ([0f1addc](https://github.com/mx-space/core/commit/0f1addc)), closes [#296](https://github.com/mx-space/core/issues/296)
* fix: add image prop to valid body ([911b82e](https://github.com/mx-space/core/commit/911b82e))
* fix(deps): update dependency algoliasearch to v4.12.1 ([43bb657](https://github.com/mx-space/core/commit/43bb657))
* fix(deps): update dependency marked to v4.0.11 ([205d837](https://github.com/mx-space/core/commit/205d837))
* fix(deps): update dependency marked to v4.0.12 ([311d5cc](https://github.com/mx-space/core/commit/311d5cc))
* fix(util): embed-in require vibrant ([668379a](https://github.com/mx-space/core/commit/668379a))

## <small>3.15.2 (2022-01-21)</small>

* release: v3.15.2 ([569c556](https://github.com/mx-space/core/commit/569c556))
* fix: script ([85f658f](https://github.com/mx-space/core/commit/85f658f))

## <small>3.15.1 (2022-01-21)</small>

* release: v3.15.1 ([e4b29f5](https://github.com/mx-space/core/commit/e4b29f5))
* fix: project vaildation ([ceb8b75](https://github.com/mx-space/core/commit/ceb8b75))
* fix(deps): update dependency apollo-server-fastify to v3.6.2 ([f30a79e](https://github.com/mx-space/core/commit/f30a79e))
* fix(deps): update nest monorepo to v8.2.6 ([30df4df](https://github.com/mx-space/core/commit/30df4df))
* chore(deps): update dependency @types/node to v16.11.21 ([23f8116](https://github.com/mx-space/core/commit/23f8116))
* chore(deps): update dependency typescript to v4.5.5 ([466d600](https://github.com/mx-space/core/commit/466d600))

## 3.15.0 (2022-01-18)

* release: v3.15.0 ([adeb175](https://github.com/mx-space/core/commit/adeb175))
* chore: update admin version ([e2d99ab](https://github.com/mx-space/core/commit/e2d99ab))
* fix: test ([a53a0c3](https://github.com/mx-space/core/commit/a53a0c3))
* fix: test disable redis subpub ([72006a1](https://github.com/mx-space/core/commit/72006a1))
* refactor: clean aggregate cache to event ([ab796b7](https://github.com/mx-space/core/commit/ab796b7))
* refactor: config to ts ([9b8c4ce](https://github.com/mx-space/core/commit/9b8c4ce))
* refactor: tq in redis ([7320592](https://github.com/mx-space/core/commit/7320592))
* refactor: use redis subpib instead of cluster post ([0593a0d](https://github.com/mx-space/core/commit/0593a0d))

## <small>3.14.1 (2022-01-18)</small>

* release: v3.14.1 ([eaa3589](https://github.com/mx-space/core/commit/eaa3589))
* fix: worker event bus emit ([bcc90f9](https://github.com/mx-space/core/commit/bcc90f9))

## 3.14.0 (2022-01-18)

* release: v3.14.0 ([c80048f](https://github.com/mx-space/core/commit/c80048f))
* chore: default enable cluster ([270e451](https://github.com/mx-space/core/commit/270e451))
* chore(deps): update dependency @types/node to v16.11.20 ([bb304ff](https://github.com/mx-space/core/commit/bb304ff))
* feat: make app clustering ([61f8ab9](https://github.com/mx-space/core/commit/61f8ab9))
* fix: docker build ([9f89522](https://github.com/mx-space/core/commit/9f89522))

## <small>3.13.6 (2022-01-16)</small>

* release: 3.13.5 ([3e7de68](https://github.com/mx-space/core/commit/3e7de68))
* release: v3.13.6 ([ff947c8](https://github.com/mx-space/core/commit/ff947c8))
* refactor: config service ([70da42f](https://github.com/mx-space/core/commit/70da42f))
* refactor: config store stateless ([286a82b](https://github.com/mx-space/core/commit/286a82b))
* refactor: gateway socket stateless ([88e4741](https://github.com/mx-space/core/commit/88e4741))
* chore: remove field ([966112c](https://github.com/mx-space/core/commit/966112c))
* fix(deps): update dependency marked to v4.0.10 ([b381b47](https://github.com/mx-space/core/commit/b381b47))
* test: add mock db test ([12a2da7](https://github.com/mx-space/core/commit/12a2da7))
* ci: deploy script ([f4e0f71](https://github.com/mx-space/core/commit/f4e0f71))

## <small>3.13.4 (2022-01-13)</small>

* release: v3.13.4 ([82a7c58](https://github.com/mx-space/core/commit/82a7c58))
* feat: update mongoose to v6 ([409a5e1](https://github.com/mx-space/core/commit/409a5e1))
* fix: test script ([ecbce84](https://github.com/mx-space/core/commit/ecbce84))
* fix(deps): update dependency nanoid to v3.1.31 ([ccb248a](https://github.com/mx-space/core/commit/ccb248a))
* fix(deps): update dependency nanoid to v3.1.32 (#275) ([bb59143](https://github.com/mx-space/core/commit/bb59143)), closes [#275](https://github.com/mx-space/core/issues/275)

## <small>3.13.3 (2022-01-11)</small>

* release: v3.13.3 ([90596a7](https://github.com/mx-space/core/commit/90596a7))
* chore: update admin version ([824aa37](https://github.com/mx-space/core/commit/824aa37))
* fix: universal curl sort on getAll ([ab6847e](https://github.com/mx-space/core/commit/ab6847e))

## <small>3.13.2 (2022-01-11)</small>

* release: v3.13.2 ([5bccc47](https://github.com/mx-space/core/commit/5bccc47))
* fix: request scope lead to analyze error ([90d902c](https://github.com/mx-space/core/commit/90d902c))

## <small>3.13.1 (2022-01-11)</small>

* release: v3.13.1 ([a2cce68](https://github.com/mx-space/core/commit/a2cce68))
* fix: backup cron ([66829b5](https://github.com/mx-space/core/commit/66829b5))
* fix: missing deps injection ([31876a7](https://github.com/mx-space/core/commit/31876a7))
* fix(deps): update dependency image-size to v1.0.1 ([0a79b6c](https://github.com/mx-space/core/commit/0a79b6c))

## 3.13.0 (2022-01-10)

* release: v3.13.0 ([c2edefb](https://github.com/mx-space/core/commit/c2edefb))
* feat: add debug for dev ([3243d29](https://github.com/mx-space/core/commit/3243d29))
* feat: add retry on axios req ([2af891d](https://github.com/mx-space/core/commit/2af891d))
* chore(deps): update dependency @nestjs/cli to v8.1.8 ([4773a4d](https://github.com/mx-space/core/commit/4773a4d))

## <small>3.12.11 (2022-01-10)</small>

* release: v3.12.11 ([2d61d1c](https://github.com/mx-space/core/commit/2d61d1c))
* chore: update admin version ([40f5645](https://github.com/mx-space/core/commit/40f5645))
* fix(snippet): delete field when update ([e3a182f](https://github.com/mx-space/core/commit/e3a182f))

## <small>3.12.10 (2022-01-09)</small>

* release: v3.12.10 ([23ae8f3](https://github.com/mx-space/core/commit/23ae8f3))
* fix: add reset email template api ([395f237](https://github.com/mx-space/core/commit/395f237))
* fix: ignore analyzes collection in backup ([8b47aac](https://github.com/mx-space/core/commit/8b47aac))
* fix(deps): update dependency fastify-swagger to v4.13.1 ([0ecd731](https://github.com/mx-space/core/commit/0ecd731))

## <small>3.12.9 (2022-01-08)</small>

* release: v3.12.9 ([4924ab6](https://github.com/mx-space/core/commit/4924ab6))
* chore: change version when dev mode ([d351681](https://github.com/mx-space/core/commit/d351681))
* chore: update admin version ([6236809](https://github.com/mx-space/core/commit/6236809))
* chore(deps): update dependency lint-staged to v12.1.6 ([0bd9684](https://github.com/mx-space/core/commit/0bd9684))
* chore(deps): update dependency lint-staged to v12.1.7 ([2f2c89b](https://github.com/mx-space/core/commit/2f2c89b))
* fix(deps): update dependency marked to v4.0.9 ([89cb51a](https://github.com/mx-space/core/commit/89cb51a))
* fix(deps): update dependency mongoose-paginate-v2 to v1.4.3 ([57c22db](https://github.com/mx-space/core/commit/57c22db))

## <small>3.12.8 (2022-01-06)</small>

* release: v3.12.8 ([cb27732](https://github.com/mx-space/core/commit/cb27732))
* fix: delete note password field after compare ([8f6c644](https://github.com/mx-space/core/commit/8f6c644))
* fix: get note timeline on with password note ([9826adc](https://github.com/mx-space/core/commit/9826adc))

## <small>3.12.7 (2022-01-06)</small>

* release: v3.12.7 ([d3f7683](https://github.com/mx-space/core/commit/d3f7683))
* chore: update cdn url ([93131ec](https://github.com/mx-space/core/commit/93131ec))
* chore: update script ([c8b537a](https://github.com/mx-space/core/commit/c8b537a))
* chore(deps): update dependency @types/mongoose-paginate-v2 to v1.4.3 ([f9c750b](https://github.com/mx-space/core/commit/f9c750b))
* chore(deps): update dependency @types/node to v16.11.19 ([84304ba](https://github.com/mx-space/core/commit/84304ba))
* chore(deps): update dependency jest to v27.4.6 ([afbd408](https://github.com/mx-space/core/commit/afbd408))
* chore(deps): update dependency jest to v27.4.7 (#262) ([af6ec2e](https://github.com/mx-space/core/commit/af6ec2e)), closes [#262](https://github.com/mx-space/core/issues/262)
* chore(deps): update supercharge/redis-github-action action to v1.4.0 (#248) ([dffc13c](https://github.com/mx-space/core/commit/dffc13c)), closes [#248](https://github.com/mx-space/core/issues/248)
* fix(deps): update dependency fastify-cookie to v5.5.0 (#254) ([58a5572](https://github.com/mx-space/core/commit/58a5572)), closes [#254](https://github.com/mx-space/core/issues/254)
* fix(deps): update dependency fastify-swagger to v4.13.0 (#236) ([eb8959a](https://github.com/mx-space/core/commit/eb8959a)), closes [#236](https://github.com/mx-space/core/issues/236)

## <small>3.12.6 (2022-01-04)</small>

* release: v3.12.6 ([d2ef68d](https://github.com/mx-space/core/commit/d2ef68d))
* fix: update deps yaml ([bdad503](https://github.com/mx-space/core/commit/bdad503))

## <small>3.12.5 (2022-01-04)</small>

* release: v3.12.5 ([adf541d](https://github.com/mx-space/core/commit/adf541d))
* chore: update admin version ([9dc81c8](https://github.com/mx-space/core/commit/9dc81c8))
* chore(deps): update dependency @types/ioredis to v4.28.6 ([0b34856](https://github.com/mx-space/core/commit/0b34856))
* chore(deps): update dependency @types/ioredis to v4.28.7 ([92e6c35](https://github.com/mx-space/core/commit/92e6c35))
* chore(deps): update dependency @types/node to v16.11.18 ([b3956ce](https://github.com/mx-space/core/commit/b3956ce))
* chore(deps): update dependency lint-staged to v12.1.5 ([95b4fd1](https://github.com/mx-space/core/commit/95b4fd1))

## <small>3.12.4 (2021-12-31)</small>

* release: v3.12.4 ([9556da7](https://github.com/mx-space/core/commit/9556da7))
* fix: change return payload on snippet api ([9573f47](https://github.com/mx-space/core/commit/9573f47))
* chore(deps): update dependency @types/jest to v27.4.0 ([9940e9f](https://github.com/mx-space/core/commit/9940e9f))

## <small>3.12.3 (2021-12-30)</small>

* release: v3.12.3 ([e518de5](https://github.com/mx-space/core/commit/e518de5))
* Update docker.yml (#251) ([b873809](https://github.com/mx-space/core/commit/b873809)), closes [#251](https://github.com/mx-space/core/issues/251)

## <small>3.12.2 (2021-12-28)</small>

* release: v3.12.2 ([c77e3c7](https://github.com/mx-space/core/commit/c77e3c7))
* feat: add error message output in dev ([759c807](https://github.com/mx-space/core/commit/759c807))
* feat(aggregate): add `url` ([497796f](https://github.com/mx-space/core/commit/497796f))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.5 ([b07bd66](https://github.com/mx-space/core/commit/b07bd66))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.6 ([36d675f](https://github.com/mx-space/core/commit/36d675f))
* fix(search): search cron lead judge ([1c601e2](https://github.com/mx-space/core/commit/1c601e2))
* chore(deps): update dependency @types/html-minifier to v4.0.2 ([daa5e0e](https://github.com/mx-space/core/commit/daa5e0e))
* chore(deps): update dependency @types/mongoose-paginate-v2 to v1.4.2 ([cbc245e](https://github.com/mx-space/core/commit/cbc245e))
* chore(deps): update dependency @types/node to v16.11.17 ([d5f89f1](https://github.com/mx-space/core/commit/d5f89f1))
* chore(deps): update dependency lint-staged to v12.1.4 ([65afe65](https://github.com/mx-space/core/commit/65afe65))

## <small>3.12.1 (2021-12-23)</small>

* release: v3.12.1 ([4057c49](https://github.com/mx-space/core/commit/4057c49))
* fix: page order ([fa66448](https://github.com/mx-space/core/commit/fa66448))

## 3.12.0 (2021-12-23)

* release: v3.12.0 ([530e6fe](https://github.com/mx-space/core/commit/530e6fe))
* chore: update admin version ([25e033a](https://github.com/mx-space/core/commit/25e033a))
* chore(deps): update dependency @types/node to v16.11.16 ([acaded7](https://github.com/mx-space/core/commit/acaded7))
* fix(algolia): repush if config enable ([4681da9](https://github.com/mx-space/core/commit/4681da9))
* feat(snippet): yaml support ([99a2ef0](https://github.com/mx-space/core/commit/99a2ef0))

## <small>3.11.9 (2021-12-21)</small>

* release: v3.11.9 ([806ee16](https://github.com/mx-space/core/commit/806ee16))
* chore: update admin version ([c12a879](https://github.com/mx-space/core/commit/c12a879))
* chore(deps): update dependency @types/node to v16.11.15 ([7ef2d13](https://github.com/mx-space/core/commit/7ef2d13))
* fix(render): forhidden no access to see post ([cc72bad](https://github.com/mx-space/core/commit/cc72bad))
* feat: allow root controller method allow all cors ([4d4eaeb](https://github.com/mx-space/core/commit/4d4eaeb))

## <small>3.11.8 (2021-12-19)</small>

* release: v3.11.8 ([6538906](https://github.com/mx-space/core/commit/6538906))
* fix: note password compare ([dddd7f3](https://github.com/mx-space/core/commit/dddd7f3))
* fix(deps): update dependency marked to v4.0.8 ([1bfc76b](https://github.com/mx-space/core/commit/1bfc76b))
* fix(deps): update dependency passport to v0.5.1 ([e9488bd](https://github.com/mx-space/core/commit/e9488bd))
* fix(deps): update dependency passport to v0.5.2 ([d7d5194](https://github.com/mx-space/core/commit/d7d5194))
* fix(deps): update nest monorepo to v8.2.4 ([71cfa93](https://github.com/mx-space/core/commit/71cfa93))
* chore(deps): update dependency @types/ioredis to v4.28.5 ([205baf1](https://github.com/mx-space/core/commit/205baf1))
* chore(deps): update dependency @types/node to v16.11.14 ([b4e42bc](https://github.com/mx-space/core/commit/b4e42bc))
* chore(deps): update dependency @vercel/ncc to v0.33.1 ([6608a46](https://github.com/mx-space/core/commit/6608a46))
* chore(deps): update dependency lint-staged to v12.1.3 ([a1aed85](https://github.com/mx-space/core/commit/a1aed85))
* chore(deps): update dependency ts-jest to v27.1.2 ([d467ce9](https://github.com/mx-space/core/commit/d467ce9))

## <small>3.11.7 (2021-12-16)</small>

* release: v3.11.7 ([8ad6e0e](https://github.com/mx-space/core/commit/8ad6e0e))
* chore: update deps ([d602913](https://github.com/mx-space/core/commit/d602913))
* chore(deps): update dependency @nestjs/cli to v8.1.6 ([20190fd](https://github.com/mx-space/core/commit/20190fd))
* chore(deps): update dependency @types/ioredis to v4.28.4 ([cddba32](https://github.com/mx-space/core/commit/cddba32))
* chore(deps): update dependency jest to v27.4.4 ([6e71ab4](https://github.com/mx-space/core/commit/6e71ab4))
* chore(deps): update dependency jest to v27.4.5 ([f4d0c34](https://github.com/mx-space/core/commit/f4d0c34))
* chore(deps): update dependency typescript to v4.5.4 ([b4e2a72](https://github.com/mx-space/core/commit/b4e2a72))
* fix: fastify resolution ([39580d9](https://github.com/mx-space/core/commit/39580d9))
* fix(deps): update dependency fastify-multipart to v5.2.1 (#216) ([723374a](https://github.com/mx-space/core/commit/723374a)), closes [#216](https://github.com/mx-space/core/issues/216)

## <small>3.11.6 (2021-12-10)</small>

* release: v3.11.6 ([e760086](https://github.com/mx-space/core/commit/e760086))
* chore: update admin version ([7270c70](https://github.com/mx-space/core/commit/7270c70))
* chore(deps): update dependency @types/ioredis to v4.28.2 ([8c0940b](https://github.com/mx-space/core/commit/8c0940b))
* chore(deps): update dependency @types/ioredis to v4.28.3 ([e043f72](https://github.com/mx-space/core/commit/e043f72))
* chore(deps): update dependency @types/lodash to v4.14.178 ([9760706](https://github.com/mx-space/core/commit/9760706))
* chore(deps): update dependency @types/mongoose-paginate-v2 to v1.4.1 ([a383aa8](https://github.com/mx-space/core/commit/a383aa8))
* chore(deps): update dependency @types/node to v16.11.11 ([5234a5f](https://github.com/mx-space/core/commit/5234a5f))
* chore(deps): update dependency @types/node to v16.11.12 ([e86e102](https://github.com/mx-space/core/commit/e86e102))
* chore(deps): update dependency @vercel/ncc to v0.33.0 (#212) ([6280cff](https://github.com/mx-space/core/commit/6280cff)), closes [#212](https://github.com/mx-space/core/issues/212)
* chore(deps): update dependency jest to v27.4.0 ([6f38032](https://github.com/mx-space/core/commit/6f38032))
* chore(deps): update dependency jest to v27.4.1 ([37d5ee2](https://github.com/mx-space/core/commit/37d5ee2))
* chore(deps): update dependency jest to v27.4.2 ([4372214](https://github.com/mx-space/core/commit/4372214))
* chore(deps): update dependency jest to v27.4.3 ([6041084](https://github.com/mx-space/core/commit/6041084))
* chore(deps): update dependency prettier to v2.5.1 ([5a3fba0](https://github.com/mx-space/core/commit/5a3fba0))
* chore(deps): update dependency ts-jest to v27.1.0 ([d281bcb](https://github.com/mx-space/core/commit/d281bcb))
* chore(deps): update dependency ts-jest to v27.1.1 ([a8e6b64](https://github.com/mx-space/core/commit/a8e6b64))
* chore(deps): update dependency typescript to v4.5.3 ([09fcfa8](https://github.com/mx-space/core/commit/09fcfa8))
* fix: poplaute `category` field in comment list ([4c16b26](https://github.com/mx-space/core/commit/4c16b26))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.4 ([00a3680](https://github.com/mx-space/core/commit/00a3680))
* fix(deps): update dependency marked to v4.0.6 ([230d0b2](https://github.com/mx-space/core/commit/230d0b2))
* fix(deps): update dependency marked to v4.0.7 ([1e3949c](https://github.com/mx-space/core/commit/1e3949c))
* fix(deps): update dependency nodemailer to v6.7.2 ([4f8bed3](https://github.com/mx-space/core/commit/4f8bed3))

## <small>3.11.5 (2021-11-26)</small>

* release: v3.11.5 ([c07829e](https://github.com/mx-space/core/commit/c07829e))
* test: skip auth in test only ([aee8253](https://github.com/mx-space/core/commit/aee8253))

## <small>3.11.4 (2021-11-26)</small>

* release: v3.11.4 ([4b17a9c](https://github.com/mx-space/core/commit/4b17a9c))
* fix(auth): !!!accidentally bypassing authentication ([89d36a8](https://github.com/mx-space/core/commit/89d36a8))
* fix(deps): update dependency class-transformer to v0.5.1 (#193) ([6fff33d](https://github.com/mx-space/core/commit/6fff33d)), closes [#193](https://github.com/mx-space/core/issues/193)
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.3 ([2b7a333](https://github.com/mx-space/core/commit/2b7a333))
* fix(deps): update dependency fastify-cookie to v5.4.0 (#197) ([6c415cf](https://github.com/mx-space/core/commit/6c415cf)), closes [#197](https://github.com/mx-space/core/issues/197)
* fix(deps): update dependency marked to v4.0.5 ([e86d5d8](https://github.com/mx-space/core/commit/e86d5d8))
* fix(search): poplute truely field `category` ([c65ef2d](https://github.com/mx-space/core/commit/c65ef2d))
* chore(deps): update dependency lint-staged to v12.1.2 (#194) ([bf11362](https://github.com/mx-space/core/commit/bf11362)), closes [#194](https://github.com/mx-space/core/issues/194)
* chore(deps): update dependency prettier to v2.5.0 (#201) ([046e481](https://github.com/mx-space/core/commit/046e481)), closes [#201](https://github.com/mx-space/core/issues/201)
* chore(deps): update dependency tsconfig-paths to v3.12.0 (#191) ([c50552d](https://github.com/mx-space/core/commit/c50552d)), closes [#191](https://github.com/mx-space/core/issues/191)

## <small>3.11.3 (2021-11-24)</small>

* release: v3.11.3 ([0a99096](https://github.com/mx-space/core/commit/0a99096))
* chore: update admin version ([1cb4710](https://github.com/mx-space/core/commit/1cb4710))
* chore: update admin version ([91eb025](https://github.com/mx-space/core/commit/91eb025))
* chore(admin): merge package field ([53b95b4](https://github.com/mx-space/core/commit/53b95b4))
* chore(deps): update dependency @types/node to v16.11.10 ([521e0b0](https://github.com/mx-space/core/commit/521e0b0))
* fix: add auth on `tool` controller ([1bd29b7](https://github.com/mx-space/core/commit/1bd29b7))
* fix: change typo ([49db94c](https://github.com/mx-space/core/commit/49db94c))
* fix: update lock file ([c76af4e](https://github.com/mx-space/core/commit/c76af4e))
* fix(deps): update dependency @nestjs/graphql to v9.1.2 ([e423f92](https://github.com/mx-space/core/commit/e423f92))
* fix(deps): update dependency class-validator to v0.13.2 ([d739bb3](https://github.com/mx-space/core/commit/d739bb3))
* fix(deps): update nest monorepo to v8.2.3 ([7438fef](https://github.com/mx-space/core/commit/7438fef))
* fix(recently): multi-choice `before` and `after` ([be4ebd3](https://github.com/mx-space/core/commit/be4ebd3))
* refactor: pageproxy ([9373cd5](https://github.com/mx-space/core/commit/9373cd5))

## <small>3.11.2 (2021-11-20)</small>

* release: v3.11.2 ([ad81ab7](https://github.com/mx-space/core/commit/ad81ab7))
* chore: update dashboard version ([9a8470f](https://github.com/mx-space/core/commit/9a8470f))
* chore(deps): update dependency typescript to v4.5.2 (#181) ([397bf85](https://github.com/mx-space/core/commit/397bf85)), closes [#181](https://github.com/mx-space/core/issues/181)
* chore(deps): update supercharge/mongodb-github-action action to v1.7.0 (#174) ([aa22a57](https://github.com/mx-space/core/commit/aa22a57)), closes [#174](https://github.com/mx-space/core/issues/174)
* fix: config merge ([cf0b3aa](https://github.com/mx-space/core/commit/cf0b3aa))
* fix(deps): update dependency marked to v4.0.4 (#190) ([e4467f3](https://github.com/mx-space/core/commit/e4467f3)), closes [#190](https://github.com/mx-space/core/issues/190)

## <small>3.11.1 (2021-11-19)</small>

* release: v3.11.1 ([a510e1a](https://github.com/mx-space/core/commit/a510e1a))
* fix: add `id` on login  payload ([4803a4d](https://github.com/mx-space/core/commit/4803a4d))
* fix(deps): update dependency @nestjs/schedule to v1.0.2 ([74eed91](https://github.com/mx-space/core/commit/74eed91))
* fix(deps): update dependency @nestjs/swagger to v5.1.5 ([75f485f](https://github.com/mx-space/core/commit/75f485f))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.1 ([dc967d5](https://github.com/mx-space/core/commit/dc967d5))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.2 ([654a5aa](https://github.com/mx-space/core/commit/654a5aa))
* test: add attche token to header test ([9b614c0](https://github.com/mx-space/core/commit/9b614c0))
* chore(deps): update dependency @types/jest to v27.0.3 ([00a70ec](https://github.com/mx-space/core/commit/00a70ec))
* chore(deps): update dependency @types/marked to v4.0.1 ([f6462d8](https://github.com/mx-space/core/commit/f6462d8))
* chore(deps): update dependency @types/node to v16.11.8 ([169f3b3](https://github.com/mx-space/core/commit/169f3b3))
* chore(deps): update dependency @types/node to v16.11.9 ([9a1b20e](https://github.com/mx-space/core/commit/9a1b20e))
* chore(deps): update dependency lint-staged to v12.0.3 ([587a18e](https://github.com/mx-space/core/commit/587a18e))
* chore(deps): update nest monorepo ([916f79b](https://github.com/mx-space/core/commit/916f79b))

## 3.11.0 (2021-11-17)

* release: v3.11.0 ([ace91fd](https://github.com/mx-space/core/commit/ace91fd))
* chore: update dashboard version ([63a9d15](https://github.com/mx-space/core/commit/63a9d15))
* refactor(category): adjust aggregate multi-category ([dbbc3e2](https://github.com/mx-space/core/commit/dbbc3e2))

## <small>3.10.3 (2021-11-17)</small>

* release: v3.10.3 ([5e79851](https://github.com/mx-space/core/commit/5e79851))
* fix(deps): update dependency cache-manager to v3.6.0 (#168) ([e6b506e](https://github.com/mx-space/core/commit/e6b506e)), closes [#168](https://github.com/mx-space/core/issues/168)
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.10.10 ([200ab81](https://github.com/mx-space/core/commit/200ab81))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.11.0 (#179) ([43c6250](https://github.com/mx-space/core/commit/43c6250)), closes [#179](https://github.com/mx-space/core/issues/179)
* fix(deps): update dependency marked to v4.0.3 ([b078f2d](https://github.com/mx-space/core/commit/b078f2d))
* fix(deps): update dependency nodemailer to v6.7.1 ([b27e122](https://github.com/mx-space/core/commit/b27e122))
* fix(deps): update dependency snakecase-keys to v5.1.2 ([79db46e](https://github.com/mx-space/core/commit/79db46e))
* fix(deps): update nest monorepo to v8.2.1 ([e757b86](https://github.com/mx-space/core/commit/e757b86))
* fix(tag): return correct tag name ([64e31b9](https://github.com/mx-space/core/commit/64e31b9))
* chore(deps): pin dependency @types/marked to 4.0.0 ([b3056f1](https://github.com/mx-space/core/commit/b3056f1))
* chore(deps): update dependency @nestjs/schematics to v8.0.5 ([21d51c3](https://github.com/mx-space/core/commit/21d51c3))
* chore(deps): update dependency @types/lodash to v4.14.177 ([dcb09d0](https://github.com/mx-space/core/commit/dcb09d0))
* chore(deps): update dependency @vercel/ncc to v0.32.0 (#178) ([f0c308d](https://github.com/mx-space/core/commit/f0c308d)), closes [#178](https://github.com/mx-space/core/issues/178)
* chore(deps): update dependency lint-staged to v12 (#171) ([34f268d](https://github.com/mx-space/core/commit/34f268d)), closes [#171](https://github.com/mx-space/core/issues/171)

## <small>3.10.2 (2021-11-16)</small>

* release: v3.10.2 ([d59054a](https://github.com/mx-space/core/commit/d59054a))
* fix: lint error ([137d723](https://github.com/mx-space/core/commit/137d723))
* fix(category): return origial enum if truely type ([856b06f](https://github.com/mx-space/core/commit/856b06f))
* fix(comment): return new comment after reply ([4dfdae6](https://github.com/mx-space/core/commit/4dfdae6))
* fix(deps): update dependency apollo-server-fastify to v3.4.1 ([cb987d8](https://github.com/mx-space/core/commit/cb987d8))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.10.7 ([fe7363f](https://github.com/mx-space/core/commit/fe7363f))
* fix(deps): update dependency fastify-cookie to v5.3.2 ([bf7ba52](https://github.com/mx-space/core/commit/bf7ba52))
* chore: update admin version ([c478538](https://github.com/mx-space/core/commit/c478538))
* chore: update deps ([5628c33](https://github.com/mx-space/core/commit/5628c33))
* chore: update marked ([ba700b4](https://github.com/mx-space/core/commit/ba700b4))
* chore(deps): update dependency @types/ioredis to v4.28.0 ([3587191](https://github.com/mx-space/core/commit/3587191))
* chore(deps): update dependency @types/ioredis to v4.28.1 ([654dd9c](https://github.com/mx-space/core/commit/654dd9c))
* chore(deps): update dependency @types/marked to v3.0.3 ([0f5a20d](https://github.com/mx-space/core/commit/0f5a20d))
* chore(deps): update dependency @types/node to v16.11.7 ([e16511b](https://github.com/mx-space/core/commit/e16511b))
* test: add markdown unit test & fix typo ([40ab803](https://github.com/mx-space/core/commit/40ab803))

## <small>3.10.1 (2021-10-30)</small>

* release: v3.10.1 ([01db8f1](https://github.com/mx-space/core/commit/01db8f1))
* fix(deps): update dependency @nestjs/graphql to v9.1.1 (#131) ([e5c6618](https://github.com/mx-space/core/commit/e5c6618)), closes [#131](https://github.com/mx-space/core/issues/131)
* fix(deps): update dependency algoliasearch to v4.11.0 (#132) ([e741f69](https://github.com/mx-space/core/commit/e741f69)), closes [#132](https://github.com/mx-space/core/issues/132)
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.10.6 ([25c1576](https://github.com/mx-space/core/commit/25c1576))
* fix(deps): update dependency fastify-swagger to v4.12.6 ([54a9fa7](https://github.com/mx-space/core/commit/54a9fa7))
* fix(deps): update dependency graphql to v15.7.2 (#151) ([b26cb48](https://github.com/mx-space/core/commit/b26cb48)), closes [#151](https://github.com/mx-space/core/issues/151)
* fix(deps): update dependency marked to v3.0.8 ([7b07846](https://github.com/mx-space/core/commit/7b07846))
* fix(deps): update dependency ua-parser-js to v0.7.30 ([8b2fac2](https://github.com/mx-space/core/commit/8b2fac2))
* fix(deps): update dependency ua-parser-js to v0.7.31 ([cdf2835](https://github.com/mx-space/core/commit/cdf2835))
* fix(deps): update dependency ua-parser-js to v1 (#142) ([4aa6874](https://github.com/mx-space/core/commit/4aa6874)), closes [#142](https://github.com/mx-space/core/issues/142)
* fix(deps): update nest monorepo to v8.1.2 ([70e5726](https://github.com/mx-space/core/commit/70e5726))
* chore(deps): update dependency @types/node to v16.11.6 ([6eb2442](https://github.com/mx-space/core/commit/6eb2442))
* chore(deps): update dependency @types/node to v16.9.6 ([6300778](https://github.com/mx-space/core/commit/6300778))
* chore(deps): update dependency lint-staged to v11.2.4 ([2213cab](https://github.com/mx-space/core/commit/2213cab))
* chore(deps): update dependency lint-staged to v11.2.5 ([e4eaa8a](https://github.com/mx-space/core/commit/e4eaa8a))
* chore(deps): update dependency lint-staged to v11.2.6 ([36018b5](https://github.com/mx-space/core/commit/36018b5))
* chore(deps): update dependency ts-node to v10.4.0 (#143) ([1a4e8c5](https://github.com/mx-space/core/commit/1a4e8c5)), closes [#143](https://github.com/mx-space/core/issues/143)

## 3.10.0 (2021-10-22)

* release: v3.10.0 ([d38870e](https://github.com/mx-space/core/commit/d38870e))
* chore: move file ([80080c5](https://github.com/mx-space/core/commit/80080c5))
* chore: update admin version ([1a48300](https://github.com/mx-space/core/commit/1a48300))
* chore(deps): update dependency @nestjs/cli to v8.1.4 ([9c729d1](https://github.com/mx-space/core/commit/9c729d1))
* chore(deps): update dependency @nestjs/schematics to v8.0.4 ([146dbd6](https://github.com/mx-space/core/commit/146dbd6))
* chore(deps): update dependency @types/ioredis to v4.27.8 ([b8063f4](https://github.com/mx-space/core/commit/b8063f4))
* chore(deps): update dependency @types/lodash to v4.14.176 ([78ac1eb](https://github.com/mx-space/core/commit/78ac1eb))
* chore(deps): update dependency @types/marked to v3.0.2 ([0cb53bf](https://github.com/mx-space/core/commit/0cb53bf))
* chore(deps): update dependency husky to v7.0.4 ([dec531c](https://github.com/mx-space/core/commit/dec531c))
* chore(deps): update dependency jest to v27.3.1 (#129) ([7a74adb](https://github.com/mx-space/core/commit/7a74adb)), closes [#129](https://github.com/mx-space/core/issues/129)
* chore(deps): update dependency ts-jest to v27.0.6 ([8d70bb4](https://github.com/mx-space/core/commit/8d70bb4))
* chore(deps): update dependency ts-jest to v27.0.7 ([50b1247](https://github.com/mx-space/core/commit/50b1247))
* chore(deps): update dependency ts-node to v10.3.1 ([455554a](https://github.com/mx-space/core/commit/455554a))
* dev/snippet (#130) ([4b7378a](https://github.com/mx-space/core/commit/4b7378a)), closes [#130](https://github.com/mx-space/core/issues/130)
* fix: create-tag script ([6548555](https://github.com/mx-space/core/commit/6548555))
* fix(deps): update dependency @nestjs/swagger to v5.1.1 ([1cc7fdf](https://github.com/mx-space/core/commit/1cc7fdf))
* fix(deps): update dependency @nestjs/swagger to v5.1.3 ([6097c54](https://github.com/mx-space/core/commit/6097c54))
* fix(deps): update dependency @nestjs/swagger to v5.1.4 ([b3f9adb](https://github.com/mx-space/core/commit/b3f9adb))
* fix(deps): update dependency fastify-swagger to v4.12.5 ([0800654](https://github.com/mx-space/core/commit/0800654))
* fix(deps): update dependency mongoose-lean-virtuals to v0.9.0 (#122) ([3f70923](https://github.com/mx-space/core/commit/3f70923)), closes [#122](https://github.com/mx-space/core/issues/122)
* refactor: change page type ([3e48716](https://github.com/mx-space/core/commit/3e48716))

## <small>3.9.5 (2021-10-14)</small>

* release: v3.9.5 ([55ce596](https://github.com/mx-space/core/commit/55ce596))
* chore: remove debug workflow ([e1a17af](https://github.com/mx-space/core/commit/e1a17af))
* test: docker ([453b226](https://github.com/mx-space/core/commit/453b226))
* test: docker build ([f7e1722](https://github.com/mx-space/core/commit/f7e1722))
* test: server ci ([6852a7a](https://github.com/mx-space/core/commit/6852a7a))
* fix: downgrade eslint to v7 ([8928574](https://github.com/mx-space/core/commit/8928574))

## <small>3.9.4 (2021-10-14)</small>

* release: v3.9.4 ([19058c0](https://github.com/mx-space/core/commit/19058c0))
* chore: update deps ([10cb574](https://github.com/mx-space/core/commit/10cb574))
* fix(deps): update dependency nanoid to v3.1.30 ([7fe753c](https://github.com/mx-space/core/commit/7fe753c))

## <small>3.9.3 (2021-10-13)</small>

* release: v3.9.3 ([d188688](https://github.com/mx-space/core/commit/d188688))
* fix: argv import ([46fc667](https://github.com/mx-space/core/commit/46fc667))

## <small>3.9.2 (2021-10-13)</small>

* release: v3.9.2 ([0c51cd1](https://github.com/mx-space/core/commit/0c51cd1))
* chore: update dashboard version ([370cdd8](https://github.com/mx-space/core/commit/370cdd8))
* chore: update deps ([c949ce3](https://github.com/mx-space/core/commit/c949ce3))
* chore(deps): update dependency @types/ioredis to v4.27.7 ([500a18b](https://github.com/mx-space/core/commit/500a18b))
* chore(deps): update dependency jest to v27.2.5 ([cb1ad68](https://github.com/mx-space/core/commit/cb1ad68))
* chore(deps): update dependency lint-staged to v11.2.1 ([ae24f04](https://github.com/mx-space/core/commit/ae24f04))
* chore(deps): update dependency lint-staged to v11.2.2 ([312afad](https://github.com/mx-space/core/commit/312afad))
* chore(deps): update dependency lint-staged to v11.2.3 ([97fddce](https://github.com/mx-space/core/commit/97fddce))
* chore(deps): update dependency ts-node to v10.3.0 (#116) ([76e0a52](https://github.com/mx-space/core/commit/76e0a52)), closes [#116](https://github.com/mx-space/core/issues/116)
* chore(deps): update dependency typescript to v4.4.4 ([5e6ff52](https://github.com/mx-space/core/commit/5e6ff52))
* fix(deps): update dependency @nestjs/graphql to v9.0.6 ([def3691](https://github.com/mx-space/core/commit/def3691))
* fix(deps): update dependency apollo-server-fastify to v3.4.0 (#117) ([98c30fa](https://github.com/mx-space/core/commit/98c30fa)), closes [#117](https://github.com/mx-space/core/issues/117)
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.10.5 ([7405202](https://github.com/mx-space/core/commit/7405202))
* fix(deps): update dependency fastify-multipart to v5.0.2 ([af9bfbc](https://github.com/mx-space/core/commit/af9bfbc))
* fix(deps): update dependency marked to v3.0.7 ([ff188c5](https://github.com/mx-space/core/commit/ff188c5))
* fix(deps): update dependency nodemailer to v6.7.0 (#115) ([413df05](https://github.com/mx-space/core/commit/413df05)), closes [#115](https://github.com/mx-space/core/issues/115)
* fix(deps): update dependency xss to v1.0.10 ([6d355e0](https://github.com/mx-space/core/commit/6d355e0))
* feat: update admin versiob ([24fa8c0](https://github.com/mx-space/core/commit/24fa8c0))

## <small>3.9.1 (2021-10-07)</small>

* release: v3.9.1 ([6195d7f](https://github.com/mx-space/core/commit/6195d7f))
* fix: backup default option and update admin version ([cf4323b](https://github.com/mx-space/core/commit/cf4323b))
* fix(deps): update dependency camelcase-keys to v7.0.1 (#96) ([eb931e5](https://github.com/mx-space/core/commit/eb931e5)), closes [#96](https://github.com/mx-space/core/issues/96)
* fix(deps): update dependency graphql to v15.6.1 (#101) ([8675623](https://github.com/mx-space/core/commit/8675623)), closes [#101](https://github.com/mx-space/core/issues/101)
* fix(deps): update dependency marked to v3.0.6 ([95fbb58](https://github.com/mx-space/core/commit/95fbb58))
* fix(deps): update dependency nanoid to v3.1.29 (#102) ([0450161](https://github.com/mx-space/core/commit/0450161)), closes [#102](https://github.com/mx-space/core/issues/102)
* fix(deps): update dependency snakecase-keys to v5.1.0 (#100) ([2983c06](https://github.com/mx-space/core/commit/2983c06)), closes [#100](https://github.com/mx-space/core/issues/100)
* fix(deps): update nest monorepo to v8.0.10 (patch) (#87) ([f8f4f89](https://github.com/mx-space/core/commit/f8f4f89)), closes [#87](https://github.com/mx-space/core/issues/87)
* chore: reduce build time ([479be86](https://github.com/mx-space/core/commit/479be86))
* chore(deps): update dependency @types/ioredis to v4.27.6 ([7f911eb](https://github.com/mx-space/core/commit/7f911eb))
* chore(deps): update dependency lint-staged to v11.2.0 (#99) ([3e4b12d](https://github.com/mx-space/core/commit/3e4b12d)), closes [#99](https://github.com/mx-space/core/issues/99)

## 3.9.0 (2021-10-04)

* release: v3.9.0 ([6c23ffa](https://github.com/mx-space/core/commit/6c23ffa))
* feat: pageproxy can assign version ([5c6d929](https://github.com/mx-space/core/commit/5c6d929))

## <small>3.8.2 (2021-10-04)</small>

* release: v3.8.2 ([77fc6b4](https://github.com/mx-space/core/commit/77fc6b4))
* fix: apply link email mark optional ([523702f](https://github.com/mx-space/core/commit/523702f))
* feat: add pageproxy page source ([aa7e322](https://github.com/mx-space/core/commit/aa7e322))

## <small>3.8.1 (2021-10-04)</small>

* release: v3.8.1 ([822af93](https://github.com/mx-space/core/commit/822af93))
* fix: markdown import logic ([bb108e4](https://github.com/mx-space/core/commit/bb108e4))

## 3.8.0 (2021-10-03)

* release: v3.8.0 ([d95cb98](https://github.com/mx-space/core/commit/d95cb98))
* fix: use logger after listen ([b410e71](https://github.com/mx-space/core/commit/b410e71))

## <small>3.7.10 (2021-10-03)</small>

* release: v3.7.10 ([eb04d31](https://github.com/mx-space/core/commit/eb04d31))
* feat: use custom logger ([0ce61f6](https://github.com/mx-space/core/commit/0ce61f6))

## <small>3.7.9 (2021-10-03)</small>

* release: v3.7.9 ([a7be95e](https://github.com/mx-space/core/commit/a7be95e))
* refactor: change io async ([167644a](https://github.com/mx-space/core/commit/167644a))
* refactor: markdown template theme ([c97570b](https://github.com/mx-space/core/commit/c97570b))
* fix: Import user module repeatedly (#92) ([f7c4b42](https://github.com/mx-space/core/commit/f7c4b42)), closes [#92](https://github.com/mx-space/core/issues/92)
* fix(deps): update dependency fastify-swagger to v4.12.4 ([cc9ad63](https://github.com/mx-space/core/commit/cc9ad63))

## <small>3.7.8 (2021-10-02)</small>

* release: v3.7.8 ([95ed423](https://github.com/mx-space/core/commit/95ed423))
* fix: docker script ([fd7f9c8](https://github.com/mx-space/core/commit/fd7f9c8))
* feat: add env for docker-compose ([9cef745](https://github.com/mx-space/core/commit/9cef745))

## <small>3.7.7 (2021-10-02)</small>

* release: v3.7.7 ([9103863](https://github.com/mx-space/core/commit/9103863))
* fix: app config shared ([b7db64e](https://github.com/mx-space/core/commit/b7db64e))
* fix: node patch ([1ea8ab2](https://github.com/mx-space/core/commit/1ea8ab2))
* fix(deps): update dependency rxjs to v7.3.1 ([bd55864](https://github.com/mx-space/core/commit/bd55864))
* ci: docker version ([6faf5a8](https://github.com/mx-space/core/commit/6faf5a8))

## <small>3.7.6 (2021-10-01)</small>

* release: v3.7.6 ([40d259d](https://github.com/mx-space/core/commit/40d259d))
* fix: mongorestore argv ([10d6d02](https://github.com/mx-space/core/commit/10d6d02))

## <small>3.7.5 (2021-10-01)</small>

* release: v3.7.5 ([aca74fc](https://github.com/mx-space/core/commit/aca74fc))
* fix: illegal operation on a directory ([8a27d4b](https://github.com/mx-space/core/commit/8a27d4b))

## <small>3.7.4 (2021-10-01)</small>

* release: v3.7.4 ([e0eba36](https://github.com/mx-space/core/commit/e0eba36))
* fix: backup cmd ([855492e](https://github.com/mx-space/core/commit/855492e))
* fix: nestjs middleware bug, use interceptor ([57f04aa](https://github.com/mx-space/core/commit/57f04aa))
* fix: remove unnessary app info field ([c4cf9b3](https://github.com/mx-space/core/commit/c4cf9b3))

## <small>3.7.3 (2021-09-30)</small>

* release: v3.7.3 ([d8066e4](https://github.com/mx-space/core/commit/d8066e4))
* fix: package lock update ([fc341d5](https://github.com/mx-space/core/commit/fc341d5))

## <small>3.7.2 (2021-09-30)</small>

* release: v3.7.2 ([04373c0](https://github.com/mx-space/core/commit/04373c0))
* feat: markdown template ([990ffb5](https://github.com/mx-space/core/commit/990ffb5))
* chore(deps): update dependency @types/ioredis to v4.27.5 ([830cab0](https://github.com/mx-space/core/commit/830cab0))
* chore(deps): update dependency jest to v27.2.4 ([8dfd5db](https://github.com/mx-space/core/commit/8dfd5db))
* fix(deps): update dependency fastify-swagger to v4.12.3 ([97b8652](https://github.com/mx-space/core/commit/97b8652))

## <small>3.7.1 (2021-09-29)</small>

* release: v3.7.1 ([beab716](https://github.com/mx-space/core/commit/beab716))
* fix: backup after force remove temp ([53cdf9a](https://github.com/mx-space/core/commit/53cdf9a))
* fix(deps): update dependency fastify-swagger to v4.12.2 ([1adf30d](https://github.com/mx-space/core/commit/1adf30d))

## 3.7.0 (2021-09-28)

* release: v3.7.0 ([9ae1f5b](https://github.com/mx-space/core/commit/9ae1f5b))
* feat: page sort support ([8537b05](https://github.com/mx-space/core/commit/8537b05))
* fix(deps): update dependency @nestjs/graphql to v9.0.5 ([b7b3271](https://github.com/mx-space/core/commit/b7b3271))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.10.4 (#83) ([64d1b32](https://github.com/mx-space/core/commit/64d1b32)), closes [#83](https://github.com/mx-space/core/issues/83)
* fix(deps): update dependency fastify-multipart to v5.0.1 ([396233a](https://github.com/mx-space/core/commit/396233a))
* fix(deps): update dependency passport to v0.5.0 (#74) ([3022736](https://github.com/mx-space/core/commit/3022736)), closes [#74](https://github.com/mx-space/core/issues/74)
* chore(deps): update dependency @types/lodash to v4.14.175 ([d6e91ce](https://github.com/mx-space/core/commit/d6e91ce))
* chore(deps): update dependency jest to v27.2.3 ([fd42e2e](https://github.com/mx-space/core/commit/fd42e2e))

## <small>3.6.21 (2021-09-27)</small>

* release: v3.6.21 ([5bdccb2](https://github.com/mx-space/core/commit/5bdccb2))
* feat: add author and created to markdown render ([af90344](https://github.com/mx-space/core/commit/af90344))
* fix(deps): update dependency @typegoose/auto-increment to v1 (#73) ([66715d0](https://github.com/mx-space/core/commit/66715d0)), closes [#73](https://github.com/mx-space/core/issues/73)
* fix(deps): update dependency graphql to v15.6.0 (#66) ([db8db82](https://github.com/mx-space/core/commit/db8db82)), closes [#66](https://github.com/mx-space/core/issues/66)

## <small>3.6.20 (2021-09-27)</small>

* release: v3.6.20 ([5c6198d](https://github.com/mx-space/core/commit/5c6198d))
* refactor: asset service & markdown render asset ([29618d2](https://github.com/mx-space/core/commit/29618d2))
* fix(deps): update dependency fastify-swagger to v4.12.1 ([08a4753](https://github.com/mx-space/core/commit/08a4753))
* fix(deps): update dependency nanoid to v3.1.28 ([28ec5ae](https://github.com/mx-space/core/commit/28ec5ae))

## <small>3.6.19 (2021-09-26)</small>

* release: v3.6.19 ([a6acf15](https://github.com/mx-space/core/commit/a6acf15))
* fix: dont npm install in bump stage ([f2b7786](https://github.com/mx-space/core/commit/f2b7786))
* fix: sequence of note list ([9abd9c2](https://github.com/mx-space/core/commit/9abd9c2))
* fix(deps): pin dependency fastify-cookie to 5.3.1 ([cb7ec6e](https://github.com/mx-space/core/commit/cb7ec6e))
* refactor: extract get search index method ([68d9934](https://github.com/mx-space/core/commit/68d9934))
* docs: readme ([f657a9b](https://github.com/mx-space/core/commit/f657a9b))
* chore: docker comment ([f0863b6](https://github.com/mx-space/core/commit/f0863b6))
* chore(deps): update dependency jest to v27.2.2 ([5f3d134](https://github.com/mx-space/core/commit/5f3d134))
* feat: add created on api `top` ([242c0e7](https://github.com/mx-space/core/commit/242c0e7))
* ci: Uppercase of ci name ([7cacde6](https://github.com/mx-space/core/commit/7cacde6))

## <small>3.6.18 (2021-09-25)</small>

* release: v3.6.18 ([2b4a1ee](https://github.com/mx-space/core/commit/2b4a1ee))
* fix: script bump use zx ([556bde9](https://github.com/mx-space/core/commit/556bde9))
* refactor: remove fastify-secure-session ([bb7e5d8](https://github.com/mx-space/core/commit/bb7e5d8))

## <small>3.6.17 (2021-09-25)</small>

* release: v3.6.17 ([8d2a7f7](https://github.com/mx-space/core/commit/8d2a7f7))
* fix: comment email mooogse type ([c5277e7](https://github.com/mx-space/core/commit/c5277e7))

## <small>3.6.16 (2021-09-25)</small>

* release: v3.6.16 ([4dd224c](https://github.com/mx-space/core/commit/4dd224c))
* fix: hide email public for guest ([e319014](https://github.com/mx-space/core/commit/e319014))
* fix(deps): update dependency nodemailer to v6.6.4 ([af581b2](https://github.com/mx-space/core/commit/af581b2))
* fix(deps): update dependency nodemailer to v6.6.5 ([d6c19b8](https://github.com/mx-space/core/commit/d6c19b8))
* fix(deps): update nest monorepo to v8.0.7 ([fa2d52c](https://github.com/mx-space/core/commit/fa2d52c))
* chore(deps): update dependency @types/lodash to v4.14.174 ([fbd6fd9](https://github.com/mx-space/core/commit/fbd6fd9))

## <small>3.6.15 (2021-09-23)</small>

* release: v3.6.15 ([e3e441d](https://github.com/mx-space/core/commit/e3e441d))
* fix: rss & sitemap cache ([a6d0812](https://github.com/mx-space/core/commit/a6d0812))
* docs: update readme ([0238a05](https://github.com/mx-space/core/commit/0238a05))

## <small>3.6.14 (2021-09-23)</small>

* release: v3.6.14 ([18820ab](https://github.com/mx-space/core/commit/18820ab))
* fix: build in docker compose ([ce9f4bc](https://github.com/mx-space/core/commit/ce9f4bc))
* fix: node type error ([4ebc77e](https://github.com/mx-space/core/commit/4ebc77e))
* ci: add docker ([8ec97b5](https://github.com/mx-space/core/commit/8ec97b5))
* chore: remove unused deps ([a58dad8](https://github.com/mx-space/core/commit/a58dad8))
* chore: update docker compose ([136345d](https://github.com/mx-space/core/commit/136345d))
* feat: docker compose ([6e89b97](https://github.com/mx-space/core/commit/6e89b97))
* chore:ci typo ([c5616d2](https://github.com/mx-space/core/commit/c5616d2))
* test: add e2e ([4091339](https://github.com/mx-space/core/commit/4091339))

## <small>3.6.13 (2021-09-22)</small>

* release: v3.6.13 ([17ff2da](https://github.com/mx-space/core/commit/17ff2da))
* refactor: markdown render stucture ([ab2dabb](https://github.com/mx-space/core/commit/ab2dabb))

## <small>3.6.12 (2021-09-22)</small>

* release: v3.6.12 ([3087c21](https://github.com/mx-space/core/commit/3087c21))
* fix: bump script ([3a4663a](https://github.com/mx-space/core/commit/3a4663a))
* fix: recently & remove sync config ([3f10589](https://github.com/mx-space/core/commit/3f10589))
* fix: script again ([d9ea155](https://github.com/mx-space/core/commit/d9ea155))
* fix: unqi ip and spam keyword ([a86ebf9](https://github.com/mx-space/core/commit/a86ebf9))
* release: ([7d3f8b7](https://github.com/mx-space/core/commit/7d3f8b7))
* chore: add script ([58415d6](https://github.com/mx-space/core/commit/58415d6))
* chore: script script ([eda9837](https://github.com/mx-space/core/commit/eda9837))

## <small>3.6.10 (2021-09-22)</small>

* release: v3.6.10 ([36e8450](https://github.com/mx-space/core/commit/36e8450))
* docs: add download script ([8a8b752](https://github.com/mx-space/core/commit/8a8b752))
* docs: update ([1debe3d](https://github.com/mx-space/core/commit/1debe3d))
* docs: update ([8b3068c](https://github.com/mx-space/core/commit/8b3068c))
* fix: mkdir first ([a1d5666](https://github.com/mx-space/core/commit/a1d5666))
* test: add user test ([5f9abcd](https://github.com/mx-space/core/commit/5f9abcd))
* chore(deps): update dependency @types/jest to v27.0.2 ([24c6af3](https://github.com/mx-space/core/commit/24c6af3))
* chore(deps): update dependency jest to v27.2.1 ([8da1c6b](https://github.com/mx-space/core/commit/8da1c6b))
* chore(deps): update dependency ts-loader to v9.2.6 ([40eba61](https://github.com/mx-space/core/commit/40eba61))

## <small>3.6.9 (2021-09-20)</small>

* release: v3.6.9 ([9ab3f5d](https://github.com/mx-space/core/commit/9ab3f5d))
* fix: counting interceptor error in gql request ([bc65a2e](https://github.com/mx-space/core/commit/bc65a2e))
* fix(deps): pin dependency fastify-secure-session to 2.3.1 ([8d463b2](https://github.com/mx-space/core/commit/8d463b2))

## <small>3.6.8 (2021-09-20)</small>

* release: v3.6.8 ([1cbbe8d](https://github.com/mx-space/core/commit/1cbbe8d))
* feat: pageproxy debug mode ([8b7532d](https://github.com/mx-space/core/commit/8b7532d))

## <small>3.6.7 (2021-09-20)</small>

* release: v3.6.7 ([d657994](https://github.com/mx-space/core/commit/d657994))
* fix: jest parse json error ([997d84c](https://github.com/mx-space/core/commit/997d84c))
* fix: pageproxy cache entty ([b36badc](https://github.com/mx-space/core/commit/b36badc))

## <small>3.6.6 (2021-09-20)</small>

* release: v3.6.6 ([6ed8605](https://github.com/mx-space/core/commit/6ed8605))
* fix: add tslib 2021 ([76c5eb2](https://github.com/mx-space/core/commit/76c5eb2))
* pref: improve something ([e5ae3f8](https://github.com/mx-space/core/commit/e5ae3f8))

## <small>3.6.5 (2021-09-20)</small>

* release: v3.6.5 ([64c8744](https://github.com/mx-space/core/commit/64c8744))
* fix: empty data compatibility ([581ca9e](https://github.com/mx-space/core/commit/581ca9e))
* feat: pageproxy enable in dev mode ([0391607](https://github.com/mx-space/core/commit/0391607))

## <small>3.6.4 (2021-09-19)</small>

* release: v3.6.4 ([3c45aa0](https://github.com/mx-space/core/commit/3c45aa0))
* feat: init module ([ad1ca18](https://github.com/mx-space/core/commit/ad1ca18))

## <small>3.6.3 (2021-09-19)</small>

* release: v3.6.3 ([27e6e85](https://github.com/mx-space/core/commit/27e6e85))
* docs: add changelog ([189f4cb](https://github.com/mx-space/core/commit/189f4cb))
* fix: destruct nullable ([9ae39c4](https://github.com/mx-space/core/commit/9ae39c4))
* chore: reduce cache ttl ([f1b608a](https://github.com/mx-space/core/commit/f1b608a))

## <small>3.6.2 (2021-09-19)</small>

* release: v3.6.2 ([7a4978c](https://github.com/mx-space/core/commit/7a4978c))
* feat: taskqueue ([2dea189](https://github.com/mx-space/core/commit/2dea189))

## <small>3.6.1 (2021-09-19)</small>

* release: v3.6.1 ([1e9ad69](https://github.com/mx-space/core/commit/1e9ad69))
* fix: wrong entry ([c731662](https://github.com/mx-space/core/commit/c731662))

## 3.6.0 (2021-09-19)

* release: v3.6.0 ([1a5f53f](https://github.com/mx-space/core/commit/1a5f53f))
* feat: admin page proxy ([e1e28ed](https://github.com/mx-space/core/commit/e1e28ed))

## <small>3.5.5 (2021-09-19)</small>

* release: v3.5.5 ([e815a49](https://github.com/mx-space/core/commit/e815a49))
* feat: geoapi init ([d81e539](https://github.com/mx-space/core/commit/d81e539))
* feat: page proxy init ([4871871](https://github.com/mx-space/core/commit/4871871))
* fix(deps): update dependency mongoose-lean-virtuals to v0.8.1 ([654b470](https://github.com/mx-space/core/commit/654b470))

## <small>3.5.4 (2021-09-18)</small>

* release: v3.5.4 ([bcaaf84](https://github.com/mx-space/core/commit/bcaaf84))
* fix: search route ([aedd189](https://github.com/mx-space/core/commit/aedd189))

## <small>3.5.2 (2021-09-18)</small>

* release: v3.5.2 ([c3aed36](https://github.com/mx-space/core/commit/c3aed36))
* fix: remove rss `,` ([c778a09](https://github.com/mx-space/core/commit/c778a09))

## <small>3.5.1 (2021-09-18)</small>

* release: v3.5.1 ([6da2179](https://github.com/mx-space/core/commit/6da2179))
* fix: cache key and cron cache clean ([14e2d20](https://github.com/mx-space/core/commit/14e2d20))

## 3.5.0 (2021-09-18)

* release: v3.5.0 ([b65bb59](https://github.com/mx-space/core/commit/b65bb59))
* feat: search module & algolia ([6fc3108](https://github.com/mx-space/core/commit/6fc3108))
* fix: nullable of modified ([09f33da](https://github.com/mx-space/core/commit/09f33da))
* fix(deps): pin dependency camelcase-keys to 7.0.0 ([043dc9d](https://github.com/mx-space/core/commit/043dc9d))

## <small>3.4.5 (2021-09-18)</small>

* release: v3.4.5 ([c5351ca](https://github.com/mx-space/core/commit/c5351ca))
* fix: comment guest secure field `mail` ([cd55c9e](https://github.com/mx-space/core/commit/cd55c9e))
* fix: gql payload type ([990c496](https://github.com/mx-space/core/commit/990c496))

## <small>3.4.4 (2021-09-18)</small>

* release: v3.4.4 ([5de33b0](https://github.com/mx-space/core/commit/5de33b0))
* chore: update deps ([4b9319c](https://github.com/mx-space/core/commit/4b9319c))
* chore(deps): update dependency @types/ioredis to v4.27.4 ([a9724b0](https://github.com/mx-space/core/commit/a9724b0))
* fix: config readonly & clone deep ([9563ff3](https://github.com/mx-space/core/commit/9563ff3))

## <small>3.4.3 (2021-09-16)</small>

* release: v3.4.3 ([b1a8709](https://github.com/mx-space/core/commit/b1a8709))
* fix: patch link data ([639904f](https://github.com/mx-space/core/commit/639904f))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.10.3 ([d857435](https://github.com/mx-space/core/commit/d857435))
* chore(deps): update dependency @types/ioredis to v4.27.3 ([7686252](https://github.com/mx-space/core/commit/7686252))
* chore(deps): update dependency prettier to v2.4.1 ([5605f7d](https://github.com/mx-space/core/commit/5605f7d))

## <small>3.4.2 (2021-09-16)</small>

* release: v3.4.2 ([07ad769](https://github.com/mx-space/core/commit/07ad769))
* fix: cos setting camcelcase ([c5d60ea](https://github.com/mx-space/core/commit/c5d60ea))

## <small>3.4.1 (2021-09-16)</small>

* release: v3.4.1 ([3810c4c](https://github.com/mx-space/core/commit/3810c4c))
* fix: wait for config load ([d786bf9](https://github.com/mx-space/core/commit/d786bf9))

## 3.4.0 (2021-09-16)

* release: v3.4.0 ([3534375](https://github.com/mx-space/core/commit/3534375))
* feat: log module ([bb910d4](https://github.com/mx-space/core/commit/bb910d4))
* chore: remove health module ([3797d63](https://github.com/mx-space/core/commit/3797d63))
* chore(deps): pin dependencies ([24b5e02](https://github.com/mx-space/core/commit/24b5e02))
* chore(deps): update dependency @types/lodash to v4.14.173 ([d188c7f](https://github.com/mx-space/core/commit/d188c7f))
* chore(deps): update dependency jest to v27.2.0 ([0fbd51c](https://github.com/mx-space/core/commit/0fbd51c))
* fix: typo ([af4ccf9](https://github.com/mx-space/core/commit/af4ccf9))
* fix: zx global register ([90e3d14](https://github.com/mx-space/core/commit/90e3d14))
* fix(deps): update dependency @typegoose/typegoose to v8.3.0 (#45) ([8d3c482](https://github.com/mx-space/core/commit/8d3c482)), closes [#45](https://github.com/mx-space/core/issues/45)
* fix(deps): update dependency marked to v3.0.4 ([411a538](https://github.com/mx-space/core/commit/411a538))
* docs: readme ([a05b226](https://github.com/mx-space/core/commit/a05b226))

## <small>3.3.3 (2021-09-13)</small>

* release: v3.3.3 ([863bec3](https://github.com/mx-space/core/commit/863bec3))
* fix: nest header & render cache ([013cdef](https://github.com/mx-space/core/commit/013cdef))

## <small>3.3.2 (2021-09-13)</small>

* release: v3.3.2 ([1790e98](https://github.com/mx-space/core/commit/1790e98))
* refactor: shared database service ([c0966fa](https://github.com/mx-space/core/commit/c0966fa))
* fix: minify html mermaid parse error ([c353f4b](https://github.com/mx-space/core/commit/c353f4b))

## <small>3.3.1 (2021-09-13)</small>

* release: v3.3.1 ([ac9b652](https://github.com/mx-space/core/commit/ac9b652))
* fix: ignore minify js ([0489920](https://github.com/mx-space/core/commit/0489920))
* chore: add sourcemap ([e718dd0](https://github.com/mx-space/core/commit/e718dd0))

## 3.3.0 (2021-09-13)

* release: v3.3.0 ([e894182](https://github.com/mx-space/core/commit/e894182))
* feat: gen sitemap ([0866e17](https://github.com/mx-space/core/commit/0866e17))
* feat: minify html & improve render ([8600048](https://github.com/mx-space/core/commit/8600048))

## <small>3.2.1 (2021-09-13)</small>

* release: v3.2.1 ([332fb0a](https://github.com/mx-space/core/commit/332fb0a))
* fix: new a date ([7921dd8](https://github.com/mx-space/core/commit/7921dd8))

## 3.2.0 (2021-09-13)

* release: v3.2.0 ([a8f7c2d](https://github.com/mx-space/core/commit/a8f7c2d))
* refactor: use ast to parse image node ([3d04105](https://github.com/mx-space/core/commit/3d04105))
* feat: marked parse ([b1785c2](https://github.com/mx-space/core/commit/b1785c2))
* feat: server build rss ([058c9c2](https://github.com/mx-space/core/commit/058c9c2))

## 3.1.0 (2021-09-12)

* release: v3.1.0 ([a1e1682](https://github.com/mx-space/core/commit/a1e1682))
* feat: markdown render & asset helper ([fcf4261](https://github.com/mx-space/core/commit/fcf4261))
* chore: add gen docs script ([4c5fee4](https://github.com/mx-space/core/commit/4c5fee4))
* chore(deps): pin dependency @types/ejs to 3.1.0 ([8ae32a8](https://github.com/mx-space/core/commit/8ae32a8))
* fix: ecosysyem config ([5b6c207](https://github.com/mx-space/core/commit/5b6c207))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.10.2 ([850601f](https://github.com/mx-space/core/commit/850601f))

## <small>3.0.6 (2021-09-11)</small>

* release: v3.0.6 ([e2bd743](https://github.com/mx-space/core/commit/e2bd743))
* feat: add email ejs template route ([3861162](https://github.com/mx-space/core/commit/3861162))

## <small>3.0.5 (2021-09-11)</small>

* release: v3.0.5 ([5c0be27](https://github.com/mx-space/core/commit/5c0be27))
* chore: update script ([c8c9208](https://github.com/mx-space/core/commit/c8c9208))
* chore(deps): update dependency jest to v27.1.1 ([21c9352](https://github.com/mx-space/core/commit/21c9352))
* chore(deps): update dependency typescript to v4.4.3 ([3382aaa](https://github.com/mx-space/core/commit/3382aaa))
* fix(deps): update dependency cos-nodejs-sdk-v5 to v2.10.1 ([e941840](https://github.com/mx-space/core/commit/e941840))

## <small>3.0.4 (2021-09-10)</small>

* release: v3.0.3 ([bbf9f46](https://github.com/mx-space/core/commit/bbf9f46))
* release: v3.0.4 ([28e0d0b](https://github.com/mx-space/core/commit/28e0d0b))
* fix: email from field ([7bf0041](https://github.com/mx-space/core/commit/7bf0041))
* fix(deps): pin dependencies (#38) ([88dbd58](https://github.com/mx-space/core/commit/88dbd58)), closes [#38](https://github.com/mx-space/core/issues/38)
* chore: deps ([3eea6d9](https://github.com/mx-space/core/commit/3eea6d9))
* chore: remove unused deps ([6c4eb7c](https://github.com/mx-space/core/commit/6c4eb7c))

## <small>3.0.2 (2021-09-10)</small>

* release: v3.0.2 ([9fd09c0](https://github.com/mx-space/core/commit/9fd09c0))
* ci: pass env ([e951652](https://github.com/mx-space/core/commit/e951652))

## <small>3.0.1 (2021-09-10)</small>

* release: v3.0.1 ([c94f1f3](https://github.com/mx-space/core/commit/c94f1f3))
* feat: pass argv ([c712250](https://github.com/mx-space/core/commit/c712250))

## 3.0.0 (2021-09-10)

* release: v3.0.0 ([08a69ac](https://github.com/mx-space/core/commit/08a69ac))
* fix(deps): pin dependency algoliasearch to 4.10.5 (#36) ([ab40f56](https://github.com/mx-space/core/commit/ab40f56)), closes [#36](https://github.com/mx-space/core/issues/36)
* fix(deps): pin dependency apollo-server-fastify to 3.3.0 (#37) ([7f5b81e](https://github.com/mx-space/core/commit/7f5b81e)), closes [#37](https://github.com/mx-space/core/issues/37)
* chore: add license ([1e24615](https://github.com/mx-space/core/commit/1e24615))
* chore: enable bot ([91fc0c5](https://github.com/mx-space/core/commit/91fc0c5))
* chore(deps): pin dependencies (#31) ([1dca024](https://github.com/mx-space/core/commit/1dca024)), closes [#31](https://github.com/mx-space/core/issues/31)

## 3.0.0-canary.5 (2021-09-10)

* release: v3.0.0-canary.5 ([6a0ff02](https://github.com/mx-space/core/commit/6a0ff02))
* chore: remove test action ([c5cfd75](https://github.com/mx-space/core/commit/c5cfd75))
* chore: update scripts ([070ecb2](https://github.com/mx-space/core/commit/070ecb2))

## 3.0.0-canary.4 (2021-09-10)

* release: v3.0.0-canary.4 ([62b6a52](https://github.com/mx-space/core/commit/62b6a52))
* ci: re-test cd ([36234fc](https://github.com/mx-space/core/commit/36234fc))

## 3.0.0-canary.3.2 (2021-09-10)

* release: v3.0.0-canary.3.1 ([ed28a42](https://github.com/mx-space/core/commit/ed28a42))
* release: v3.0.0-canary.3.2 ([9131fc1](https://github.com/mx-space/core/commit/9131fc1))
* fix: test action ([559a48f](https://github.com/mx-space/core/commit/559a48f))

## 3.0.0-canary.3.1 (2021-09-10)

* release: v3.0.0-canary.3.1 ([fb28c83](https://github.com/mx-space/core/commit/fb28c83))

## 3.0.0-canary.3 (2021-09-10)

* release: v3.0.0-canary.3 ([9468712](https://github.com/mx-space/core/commit/9468712))
* chore: update api version ([a0289c2](https://github.com/mx-space/core/commit/a0289c2))

## 3.0.0-canary.2.1 (2021-09-10)

* release: v3.0.0-canary.2.1 ([031a130](https://github.com/mx-space/core/commit/031a130))
* fix: ci asset ([548068a](https://github.com/mx-space/core/commit/548068a))
* fix: deploy workdir ([08817c2](https://github.com/mx-space/core/commit/08817c2))

## 3.0.0-canary.2 (2021-09-10)

* release: v3.0.0-canary.2 ([56573c4](https://github.com/mx-space/core/commit/56573c4))
* feat: note gql ([37a8f66](https://github.com/mx-space/core/commit/37a8f66))

## 3.0.0-canary.1 (2021-09-10)

* release: v3.0.0-canary.1 ([70a1fe4](https://github.com/mx-space/core/commit/70a1fe4))
* fix: crud bug & other ([970b928](https://github.com/mx-space/core/commit/970b928))

## 3.0.0-canary.0 (2021-09-09)

* release: v3.0.0-canary.0 ([add3133](https://github.com/mx-space/core/commit/add3133))
* fix: cache clean ([d12c086](https://github.com/mx-space/core/commit/d12c086))
* fix: field compatibility ([25b98b2](https://github.com/mx-space/core/commit/25b98b2))
* fix: interceptor response transfrom ([3821160](https://github.com/mx-space/core/commit/3821160))
* feat: algoliasearch ([95c4b58](https://github.com/mx-space/core/commit/95c4b58))

## 3.0.0-beta.1 (2021-09-09)

* release: v3.0.0-beta.1 ([584c3f3](https://github.com/mx-space/core/commit/584c3f3))
* chore: lock typescript ([e53f17f](https://github.com/mx-space/core/commit/e53f17f))
* chore: update eslin ([b691e32](https://github.com/mx-space/core/commit/b691e32))
* feat: init recently module ([80af238](https://github.com/mx-space/core/commit/80af238))

## 3.0.0-beta.0 (2021-09-08)

* release: v3.0.0-beta.0 ([25657fc](https://github.com/mx-space/core/commit/25657fc))
* fix: yargs ([03e95fe](https://github.com/mx-space/core/commit/03e95fe))

## 3.0.0-alpha.3 (2021-09-08)

* release: v3.0.0-alpha.3 ([63ce0dc](https://github.com/mx-space/core/commit/63ce0dc))

## 3.0.0-alpha.2 (2021-09-08)

* release: v3.0.0-alpha.2 ([9758b45](https://github.com/mx-space/core/commit/9758b45))
* fix: GQL guard ([7da83fd](https://github.com/mx-space/core/commit/7da83fd))
* feat: gql init ([0ff9cc0](https://github.com/mx-space/core/commit/0ff9cc0))
* doc: readme ([4b1acd3](https://github.com/mx-space/core/commit/4b1acd3))

## 3.0.0-alpha.1 (2021-09-07)

* release: v3.0.0-alpha.1 ([a6e0a37](https://github.com/mx-space/core/commit/a6e0a37))
* ci: release action ([c64c632](https://github.com/mx-space/core/commit/c64c632))
* feat: add encypt paw doc ([ce71fb6](https://github.com/mx-space/core/commit/ce71fb6))
* feat: aggregate module ([b22878d](https://github.com/mx-space/core/commit/b22878d))
* feat: analyze middleware ([9a294fa](https://github.com/mx-space/core/commit/9a294fa))
* feat: anayzle module ([6bb6bf0](https://github.com/mx-space/core/commit/6bb6bf0))
* feat: backup module ([bad54a2](https://github.com/mx-space/core/commit/bad54a2))
* feat: base crud ([54e6e8e](https://github.com/mx-space/core/commit/54e6e8e))
* feat: category module done ([f75e7ed](https://github.com/mx-space/core/commit/f75e7ed))
* feat: comment module init ([11abc68](https://github.com/mx-space/core/commit/11abc68))
* feat: comment service init ([4fcb0df](https://github.com/mx-space/core/commit/4fcb0df))
* feat: cron task ([34e421a](https://github.com/mx-space/core/commit/34e421a))
* feat: docker init ([c92d723](https://github.com/mx-space/core/commit/c92d723))
* feat: image & http service, migration more ([3515851](https://github.com/mx-space/core/commit/3515851))
* feat: init ([b676658](https://github.com/mx-space/core/commit/b676658))
* feat: init again ([8a15554](https://github.com/mx-space/core/commit/8a15554))
* feat: init category module ([07f4f19](https://github.com/mx-space/core/commit/07f4f19))
* feat: init configs module ([deca66e](https://github.com/mx-space/core/commit/deca66e))
* feat: init email service ([df9f544](https://github.com/mx-space/core/commit/df9f544))
* feat: init model & add counting interecptor ([e99d975](https://github.com/mx-space/core/commit/e99d975))
* feat: init page module ([988cf60](https://github.com/mx-space/core/commit/988cf60))
* feat: markdown helper ([89d1647](https://github.com/mx-space/core/commit/89d1647))
* feat: middleware & user module init ([44b835d](https://github.com/mx-space/core/commit/44b835d))
* feat: model init ([b02e2cf](https://github.com/mx-space/core/commit/b02e2cf))
* feat: note module ([fd1921a](https://github.com/mx-space/core/commit/fd1921a))
* feat: note module done ([8ce7532](https://github.com/mx-space/core/commit/8ce7532))
* feat: openapi decorator ([f4f147b](https://github.com/mx-space/core/commit/f4f147b))
* feat: option module init ([94e5052](https://github.com/mx-space/core/commit/94e5052))
* feat: paginator ([5a86ddc](https://github.com/mx-space/core/commit/5a86ddc))
* update: readme ([5c19ab7](https://github.com/mx-space/core/commit/5c19ab7))
* fix: app config ([6635fee](https://github.com/mx-space/core/commit/6635fee))
* fix: cache interceptor & 204 content ([7c65bf6](https://github.com/mx-space/core/commit/7c65bf6))
* fix: cache interecptor ([c4ab247](https://github.com/mx-space/core/commit/c4ab247))
* fix: exception filter ([a17afd0](https://github.com/mx-space/core/commit/a17afd0))
* fix: filter logger ([7a0fc37](https://github.com/mx-space/core/commit/7a0fc37))
* fix: swagger property ([7fec9c8](https://github.com/mx-space/core/commit/7fec9c8))
* chore: clean up ([70c3065](https://github.com/mx-space/core/commit/70c3065))
* chore: cli webpack ([98cfba2](https://github.com/mx-space/core/commit/98cfba2))
* chore: Configure Renovate (#1) ([32a62d8](https://github.com/mx-space/core/commit/32a62d8)), closes [#1](https://github.com/mx-space/core/issues/1)
* chore: disable renovate temp ([ff4a86c](https://github.com/mx-space/core/commit/ff4a86c))
* chore: format ([f7d6134](https://github.com/mx-space/core/commit/f7d6134))
* chore: format ([d13829b](https://github.com/mx-space/core/commit/d13829b))
* chore: or ([db19461](https://github.com/mx-space/core/commit/db19461))
* chore: Pin dependencies (#4) ([18bf2ba](https://github.com/mx-space/core/commit/18bf2ba)), closes [#4](https://github.com/mx-space/core/issues/4)
* chore: qaq ([02f8004](https://github.com/mx-space/core/commit/02f8004))
* chore: replace redis with ioredis ([f3fb7ec](https://github.com/mx-space/core/commit/f3fb7ec))
* chore: update deps ([05bdda7](https://github.com/mx-space/core/commit/05bdda7))
* init ([9285a1b](https://github.com/mx-space/core/commit/9285a1b))
* refactor: ([eaf4a6b](https://github.com/mx-space/core/commit/eaf4a6b))
* Update dependency @typegoose/typegoose to v8 (#12) ([08b725b](https://github.com/mx-space/core/commit/08b725b)), closes [#12](https://github.com/mx-space/core/issues/12)
