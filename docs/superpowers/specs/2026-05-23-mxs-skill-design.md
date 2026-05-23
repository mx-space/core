# mxs skill — bundled AI skill documentation accessible from the CLI

**Status:** Design approved, ready for implementation plan.
**Owner:** Innei
**Date:** 2026-05-23

## Goal

Expose the existing AI-author skill content as a first-class `mxs skill` command tree, so that downstream AI agents (Claude Code, Codex, Cursor, etc.) can fetch authoring guidance, command syntax, liteXML reference, and safety rules directly from the installed CLI — without needing to clone the mx-core repo or fetch external URLs.

Primary audience: **AI agents** (machine consumption). Default output mode is `llm` (raw markdown), suitable for direct context injection.

## Non-goals

- Pretty terminal browsing for humans is supported but not optimized (readable mode reuses the existing markdown→ANSI renderer from `cli/help/`; no pager, no TUI).
- No content editing through the CLI — chapters are read-only artifacts shipped with the package.
- No external content fetch — the CLI never reaches the network for skill content.

## Content sources

Two registries are merged at runtime into one chapter list:

1. **CLI-native** — markdown files shipped in `packages/cli/skills/` (added to `package.json#files`, included in the npm tarball).
2. **haklex liteXML** — markdown files inside the installed `@haklex/rich-litexml` package, under `.claude/skills/litexml-authoring/`. Requires haklex to add this glob to its own `package.json#files` and publish a new version (`@haklex/rich-litexml@0.16.0`).

Sync is automatic and version-bound: the liteXML content the CLI exposes always matches the installed haklex version. No build-time copy, no network, no submodule.

If haklex is older than 0.16.0, the litexml chapters are silently absent from the registry. `mxs skill litexml*` then returns `ChapterNotFound` whose `details.hint` advises upgrading `@haklex/rich-litexml` to ≥0.16.0. No log noise on the happy path.

## Chapter inventory

19 chapters total — 15 CLI-native + 4 from haklex.

| slug | source | content |
|---|---|---|
| `overview` | cli | Top-level reference map (from current `SKILL.md`) |
| `workflow` | cli | Mandatory workflow + safety rules (from current `SKILL.md`) |
| `commands-post` | cli | post create/edit/publish/list/view/delete/translate |
| `commands-note` | cli | note CRUD + publish |
| `commands-page` | cli | page CRUD |
| `commands-comment` | cli | comment list/view/moderation |
| `commands-category` | cli | category CRUD |
| `commands-topic` | cli | topic CRUD |
| `commands-config` | cli | config get/set/list |
| `commands-auth` | cli | login/logout/probe/token |
| `commands-profile` | cli | profile add/use/list/remove |
| `authoring` | cli | Content authoring workflows (current `content-authoring.md` minus liteXML) |
| `auth-config` | cli | Profile management, env vars, target selection |
| `output-modes` | cli | `--json` / `--llm` / readable / xml mode reference |
| `safety` | cli | Mutation safety, verification, exit codes |
| `litexml` | haklex | liteXML overview (from haklex `SKILL.md`) |
| `litexml-nodes` | haklex | Node reference — structural + extensions merged |
| `litexml-recipes` | haklex | Authoring recipes |
| `litexml-cli` | haklex | haklex CLI tooling + mxs interop |

The current `command-index.md` is split per resource group so that an agent can retrieve only the relevant subset (e.g. just `commands-post` when authoring a post). The `litexml-*` prefix prevents slug collisions across sources.

## Chapter file format

Each chapter is a standalone markdown file with YAML frontmatter:

```yaml
---
slug: commands-post
title: Post commands
description: One-line summary, surfaced in `mxs skill` list output
order: 30
---
```

- `slug` — required, globally unique, kebab-case. The indexer fails fast if two files declare the same slug.
- `title` — required, human-readable.
- `description` — required, one-line. Used in list output.
- `order` — required integer. Controls list / `--all` ordering. Non-contiguous values are fine (overview=0, workflow=10, commands-* in the 20–40 range, etc.) so insertions are cheap.

The indexer fails fast at load time with a descriptive error if any chapter is missing a required field, has an invalid `order` value, or duplicates another chapter's `slug`. These failures bubble as `SkillCorpusEmpty` with the offending filename in `details`.

Frontmatter parsing uses a minimal in-tree YAML subset (key/value strings only) to avoid adding a dependency. Multi-line values and lists are not supported and not needed.

## CLI surface

```
mxs skill                          # list chapters (slug + one-line description)
mxs skill <slug>                   # print one chapter's raw markdown
mxs skill all                      # concatenate all chapters in registry order
mxs skill search <kw>              # case-insensitive substring search, returns hit chapters with snippets
```

- `mxs skill` (bare) is an alias for `mxs skill list`.
- Subcommand structure follows `@effect/cli` conventions; no global flags are introduced.
- All four verbs respect the existing global output flags (`--json`, `--llm`, `--readable`, `--xml`, `--pretty-json`) via the existing `OutputOptions` FiberRef.
- No authentication, no API calls, no dry-run — this is a read-only documentation command. It does not depend on the `Api` or `Resolver` services.

### Output modes

| mode | list | get / all | search |
|---|---|---|---|
| `llm` (default) | `slug\tdescription` one line per chapter | raw markdown body | hit chapters concatenated with `# slug\n\nsnippet\n\n---\n` separators |
| `json` | `{ok, data: [{slug, title, description}]}` | `{ok, data: {slug, title, body}}` | `{ok, data: [{slug, title, snippets}]}` |
| `pretty-json` | as `json`, 2-space indent | as `json` | as `json` |
| `readable` | markdown→ANSI list (like `mxs --help` group view) | markdown→ANSI render with basic syntax highlight | hit chapters ANSI-rendered with match highlight |
| `xml` | `<chapters><chapter slug="..." />...</chapters>` | `<chapter slug="...">body</chapter>` | `<hits><hit slug="..."><snippet>...</snippet></hit></hits>` |

The `--all` mode in `llm` joins chapters with `\n\n---\n\n`; in `xml` it emits one `<chapter>` element per chapter inside a `<chapters>` root.

## Architecture

### Files

```
packages/cli/skills/                           # CLI-native markdown (new)
  overview.md
  workflow.md
  commands-post.md
  ...
  safety.md
packages/cli/src/cli/skill/                    # command group (new)
  index.ts       # aggregator: Command.withSubcommands
  list.ts        # `mxs skill` / `mxs skill list`
  get.ts         # `mxs skill <slug>`
  all.ts         # `mxs skill all`
  search.ts      # `mxs skill search <kw>`
  views.ts       # View<T> definitions for the four verbs
packages/cli/src/services/
  Skill.ts                                     # Skill service: Context.Tag + Layer (new)
  Renderer/markdown.ts                         # extracted markdown→ANSI helper (refactor)
packages/cli/src/domain/errors.ts              # add ChapterNotFound, SkillCorpusEmpty
```

### Skill service

```typescript
interface Chapter {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly order: number
  readonly source: 'cli' | 'haklex'
  readonly body: string
}

interface SearchHit {
  readonly slug: string
  readonly title: string
  readonly snippets: readonly string[]
}

class Skill extends Context.Tag('Skill') {
  readonly list: Effect<readonly Chapter[]>
  readonly get: (slug: string) => Effect<Chapter, ChapterNotFound>
  readonly all: Effect<readonly Chapter[]>            // ordered by `order`
  readonly search: (kw: string) => Effect<readonly SearchHit[]>
}
```

- The `.Default` layer registers the production wiring in `src/layers/App.ts`. Skill has no dependency on global flags, so it is wired in `App.ts` alongside the regular services (not in `bin/mxs.ts`).
- Chapters are lazy-loaded on first access and cached in a `Ref<Map<string, Chapter>>`. Subsequent calls hit the cache.
- Both source directories are scanned in parallel. Failure to read either is non-fatal: the registry is built from whatever succeeds. An empty registry (both sources failed or absent) yields `SkillCorpusEmpty` on any verb call.

### Path resolution

Both source dirs are resolved via `import.meta.url`:

- CLI-native: `new URL('../../skills/', import.meta.url)` resolves correctly under both `tsx` (dev) and the built `dist/` layout (`dist/services/Skill.mjs` → `dist/../skills/`). No build-time conditional.
- haklex: `import.meta.resolve('@haklex/rich-litexml/package.json')` → `dirname` → join `.claude/skills/litexml-authoring/`. Wrapped in `Effect.tryPromise` with `catchAll` returning `[]` so a missing or older haklex doesn't break the registry.

### Snippet extraction

For `search`, each chapter contributes up to 3 snippets. A snippet is a ±60-character window around a match, joined with `…` if windows overlap. Matches are ranked by where they occur: title (weight 3) > description (weight 2) > body (weight 1). Ties broken by `order`.

## Renderer integration

- Output is emitted via the existing `Renderer.emit(view)` pipeline — no direct `console.log` calls in the verb handlers.
- New `View<T>` definitions live in `src/cli/skill/views.ts`: `SkillListView`, `SkillChapterView`, `SkillSearchView`.
- The markdown→ANSI helper currently inlined in `src/cli/help/index.ts` is extracted to `src/services/Renderer/markdown.ts` so both `help` and `skill` consume it. This is a targeted, in-scope refactor.

## Errors

Two new tagged errors in `src/domain/errors.ts`:

| tag | exit code | when |
|---|---|---|
| `ChapterNotFound` | 1 | `mxs skill <slug>` with no matching chapter; `details.slug` carries the requested slug |
| `SkillCorpusEmpty` | 1 | Both source dirs unreadable / empty; user-actionable hint: `reinstall @mx-space/cli` |

Both map through the existing `exitCodeForTag` table.

## Tests

Vitest with `@effect/vitest`, following established patterns under `packages/cli/test/`:

- `test/services/Skill.test.ts` — `it.effect` with an in-memory `FileSystem` substituting both source dirs. Covers: frontmatter parsing, slug collision, missing-slug lookup, registry ordering, search ranking, empty corpus.
- `test/cli/skill/list.test.ts`, `get.test.ts`, `all.test.ts`, `search.test.ts` — canned Skill layer, exercise each verb's view emission across all output modes.
- `test/integration/cli-skill.test.ts` — spawns the binary; asserts on stdout/exit for `mxs skill`, `mxs skill commands-post`, `mxs skill search dry-run`, `mxs skill missing-slug` (exits 1).

## Cross-repo coordination

This design requires one change in the sibling `haklex` repo:

1. In `packages/rich-litexml/package.json`, extend `files` to include `".claude/skills/litexml-authoring/**"`.
2. Publish `@haklex/rich-litexml@0.16.0` (minor — additive file inclusion, no API change).
3. In `mx-core`, bump the cli's pinned haklex version to `^0.16.0`.

Step 3 happens as part of the implementation. Steps 1–2 are scheduled with the haklex release pipeline; the CLI implementation can land first and continue to function (litexml chapters absent until haklex republishes).

## Documentation updates

- `packages/cli/README.md` — add a `mxs skill` section under the command reference.
- `packages/cli/agents.md` — note that `mxs skill` is the canonical entry point for downstream agents.
- `packages/cli/ROADMAP.md` — mark `skill` shipped.

## Release

Implementation lands in a single PR. After merge:

- Bump `@mx-space/cli` minor (`0.6.0` → `0.7.0`) — additive command, no breaking change.
- Publish to npm.
- Coordinate haklex `0.16.0` publish so that a fresh `mxs` install picks up litexml chapters automatically.
