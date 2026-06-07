# Lexical Text Ownership — Design

**Date:** 2026-06-08
**Status:** Draft (awaiting user review)
**Scope:** apps/core, apps/admin, packages/cli, new packages/lexical-extras
**Related:** apps/core/src/processors/helper/helper.lexical.service.ts

## Problem

mx-core stores blog posts/notes/pages in two `contentFormat` modes:

- `markdown` — raw markdown string in the `text` column
- `lexical` — Lexical JSON in the `content` column, plus a markdown projection in the `text` column

On every create/update, `LexicalService.populateText(doc)` re-derives `text` from `content` via `lexicalToMarkdown`, which uses `@haklex/rich-headless`. This **overwrites** any client-provided `text`.

This produces three concrete failures:

1. **Custom mx nodes crash the server.** mx-core defined Lexical nodes (`map`, `afilmory`) that the admin SPA renders. `@haklex/rich-headless` does not register them; `sanitizeSerializedJSON` drops them. When every root child is dropped, Lexical's `setEditorState` throws `"editor state is empty"` and the request returns 500.
2. **Cross-repo release blocks deploys.** Adding a new mx-private node requires bumping `@haklex/rich-headless` (separate repo) before mx-core can deploy.
3. **Server duplicates work the editor already did.** The admin editor's `onTextChange` callback produces a markdown projection that knows every custom node (it renders them). The server discards that projection and re-derives via a less-capable library.

Three fallback layers (sanitize-empty → raw extract, setEditorState-throws → raw extract, markdown-empty-after-drops → raw extract) were added to stop the 500s. They work but they are band-aids — they hide the structural problem.

## Goal

Reframe `text` as a writer-owned projection of `content`. Server validates and stores; server does not synthesize or overwrite on the storage path. Remove all storage-path fallbacks.

## Non-goals

- Schema migration of the `text` column. Column stays as-is.
- Backfilling existing rows. Existing `text` values are already what the server derived; reads continue to work.
- Yohaku's React rendering of Lexical (separate React layer, out of scope).
- A new column or field for plain text vs markdown projection. `text` remains the single projection field.

## Invariant

> For lexical writes, `content` and `text` are a writer-owned atomic pair. The server validates presence and stores them verbatim. Server-side projection is permitted **only** in explicitly named internal-tooling paths (today: AI translation), uses the shared `@mx-space/lexical-extras` package, and never overwrites a writer-supplied `text`.
>
> Corollary: unknown Lexical nodes are not a storage concern. They are a client/editor projection concern.

## Architecture

### Roles

| Role | Write responsibility | Node-knowledge source |
|---|---|---|
| admin SPA | derives `text` via editor `onTextChange`; sends `content + text` | the editor itself (full) |
| mxs CLI | derives `text` via `mxLexicalToMarkdown`; sends `content + text` | `@mx-space/lexical-extras` |
| 3rd-party REST callers | must send `content + text` for lexical mode | their own implementation |
| mx-core server (storage path) | validates + stores verbatim | none required |
| mx-core AI translation (server-internal writer) | derives `text` via `mxLexicalToMarkdown` | `@mx-space/lexical-extras` |

### New shared package: `@mx-space/lexical-extras`

Location: `packages/lexical-extras/`. Published to npm. Zero React, zero DOM in the main entrypoint.

**Public API (frozen by this spec; implementation may follow):**

```ts
// Main entry — pure JS, safe for any runtime
export interface MxNode {
  type: string
  toMarkdown(node: any): string
  toText(node: any): string
}

export const mxNodeRegistry: Record<string, MxNode>
export function mxLexicalToMarkdown(state: SerializedEditorState | string): string
export function mxLexicalToText(state: SerializedEditorState | string): string

// Subpath for advanced consumers (CLI registers these into LiteXML registry)
// @mx-space/lexical-extras/nodes
export const mxLiteXmlNodes: LiteXmlNodeEntry[]
```

Initial registry entries:

| `type` | `toMarkdown` (example) | `toText` (example) |
|---|---|---|
| `map` | `📍 ${title}\n${pois.map(p => '- ' + p.title).join('\n')}` | `${title} ${pois.map(p => p.title).join(' ')}` |
| `afilmory` | `🖼️ ${baseUrl}/album · ${source.items.length} photos` | `${source.items.length} photos` |

Exact string shapes are implementation-tunable; the interface is frozen.

### `mxLexicalToMarkdown` algorithm

1. Accept `SerializedEditorState | string`. If string, `JSON.parse`; bail to `''` on parse failure (warn).
2. If `root.children` is not an array, bail to `''` (warn).
3. Walk top-level `root.children`. For each node:
   - If `node.type ∈ mxNodeRegistry` → replace with `{ type: 'paragraph', children: [{ type: 'text', text: registry[type].toMarkdown(node) }] }`.
   - Else if `node.type ∈ allHeadlessNodes` (haklex set) → keep verbatim.
   - Else → warn and drop (no throw).
4. Construct minimal editor state from the processed children.
5. `createHeadlessEditor({ nodes: allHeadlessNodes })` → `parseEditorState` → `setEditorState` → `$toMarkdown()`.
6. If the processed root has zero children, return `''` without invoking the editor.

Known limitation: the preprocessor replaces only top-level mx nodes. Inline mx nodes (none today) would require extending the walker to recurse into known container children. Spec documents this; implementation lands when needed.

### `mxLexicalToText` algorithm

Lighter path for RSS/OG/search use cases:

1. Accept `SerializedEditorState | string`. Parse with same bail rules.
2. Walk `root.children`. For each node:
   - If `node.type ∈ mxNodeRegistry` → emit `registry[type].toText(node)`.
   - Else → reuse the existing `extractBlockText`-style plain text walk for known structural children.
3. Join with `\n\n`.
4. Does **not** invoke `@lexical/headless` — no `setEditorState`, no haklex dependency at runtime.

### Consumer topology

```
@haklex/rich-headless ──┐
                        ├──> @mx-space/lexical-extras ──┬──> mx-core server (AI translation only)
mx node registry ───────┘                                ├──> mxs CLI (writers' derivation)
                                                         ├──> Yohaku SSR (RSS / OG / text utils)
                                                         └──> admin (search helpers, scripts)

React rendering is each frontend's own concern:
  admin: src/vendor/rich-editor (map/afilmory React components)
  Yohaku: own renderer (map/afilmory React components)
```

## Components — server changes (`apps/core`)

### DTO

`note/post/page` create/update DTOs become a discriminated union on `contentFormat`:

```ts
const lexicalWrite = z.object({
  contentFormat: z.literal('lexical'),
  content: z.string().min(1),
  text: z.string().min(1),
  // ...rest unchanged
})

const markdownWrite = z.object({
  contentFormat: z.literal('markdown').optional(),
  text: z.string(),
  content: z.literal('').optional(),
  // ...rest unchanged
})

const writeSchema = z.discriminatedUnion('contentFormat', [lexicalWrite, markdownWrite])
```

For `update`, both `content` and `text` are optional; but if one is sent, the other must accompany it (enforced via a refinement). Meta-only updates (no content/text) are allowed.

### Error codes

Added to `~/constants/error-code.constant.ts`:

| Code | HTTP | Trigger |
|---|---|---|
| `LEXICAL_TEXT_REQUIRED` | 400 | lexical mode, content sent, text missing/empty |
| `LEXICAL_CONTENT_REQUIRED` | 400 | lexical mode, text sent, content missing/empty |
| `CONTENT_TEXT_MISMATCH` | 400 | update with only one of (content, text) sent |

Surfaces via existing `AppExceptionFilter`; envelope shape unchanged.

### `LexicalService` changes

**Removed:**

- `populateText` (whole method)
- `extractRawTextFallback` (added during the 500-mitigation, no longer needed)
- `collectStringValues` (added during the 500-mitigation, no longer needed)
- The three fallback layers inside `lexicalToMarkdown`

**Changed:**

- `lexicalToMarkdown` becomes a thin wrapper around `mxLexicalToMarkdown` from the shared package. No try/catch, no fallback; errors propagate.

**Preserved:**

- `extractRootBlocks`, `extractBlockText`, `extractSummaryFromLexical`, `normalizeBlockIds` — unrelated to this redesign.

### Call sites that drop `populateText`

| File | Action |
|---|---|
| `note.service.ts:278` (`create`) | remove `populateText` call |
| `note.service.ts:360` (`updateById`) | remove `populateText` call |
| `page.service.ts:75`, `:142` | remove |
| `post.service.ts:153`, `:316` | remove |

AI translation call sites (4 places in `ai-translation/*`) — keep their `lexicalToMarkdown` calls; they now route through the shared package via the thin wrapper.

## Components — admin (`apps/admin`)

- The lexical-mode write path already derives `text` via `onTextChange` and sends it. No data-flow change.
- Save-button guard: before submitting a lexical save, ensure the latest `onTextChange` value is in state. If a debounce is in flight and state has stale `text` while `content` is current, force a flush or call `mxLexicalToMarkdown(content)` locally as a same-version derivation. Goal: never submit `content` without a matching `text`.
- Admin may import `@mx-space/lexical-extras` to perform the local same-version derivation in the save handler.

## Components — CLI (`packages/cli`), phase 2

CLI today already sends both `content` and `text` via `resolveContent` (`domain/payload.ts:336-340`), so the wire contract is already compatible with the strict server.

Phase 2 changes (separate PR, not blocking phase 1 deploy):

- `services/Lexical.ts` — replace inline `createHeadlessEditor` + `sanitizeSerializedJSON` in `lexicalJsonToMarkdown` with a call to `mxLexicalToMarkdown` from the shared package.
- `materializeForEditor` / `payloadToLitexml` — extend the LiteXML registry with `mxLiteXmlNodes` so `edit`-ing an existing note with `map`/`afilmory` does not silently drop those nodes when materializing the XML buffer.

## Data flow — write path

```
[admin / cli / 3rd party]
      │
      │  POST { contentFormat:'lexical', content, text, ...rest }
      ▼
[server controller]
      │  Zod discriminatedUnion validation
      │    missing text → 400 LEXICAL_TEXT_REQUIRED
      │    missing content → 400 LEXICAL_CONTENT_REQUIRED
      ▼
[service.create / update]
      │  no populateText call
      ▼
[repository.create]
      │  store content + text verbatim
      ▼
[Postgres]

—— AI translation inner loop (server-internal writer) ——
[ai-translation strategy]
      │  produce translated content (JSON)
      │  text = lexicalService.lexicalToMarkdown(content)   ← only server-side derivation point
      ▼
[repository.update] (patch.text + patch.content)
```

Read path: unchanged. Search/RSS/public API read `text` directly.

## Error handling

### Server validation matrix (lexical mode)

POST (create):

| Input | Result | Code |
|---|---|---|
| content + text both present, non-empty | accept | — |
| content missing or empty | 400 | `LEXICAL_CONTENT_REQUIRED` |
| text missing or empty | 400 | `LEXICAL_TEXT_REQUIRED` |

PUT (update):

| Input | Result | Code |
|---|---|---|
| content + text both present, non-empty | accept | — |
| neither sent (meta-only update) | accept | — |
| only one of content / text sent | 400 | `CONTENT_TEXT_MISMATCH` |
| both sent but one is empty string | 400 | `CONTENT_TEXT_MISMATCH` |

`CONTENT_TEXT_MISMATCH` exists specifically to express the "they travel together" invariant on partial updates. `LEXICAL_TEXT_REQUIRED` / `LEXICAL_CONTENT_REQUIRED` exist for the create path where both fields are mandatory.

### Shared package error policy

| Case | Behavior |
|---|---|
| input is not valid JSON | return `''`, warn once |
| `root.children` is not an array | return `''`, warn once |
| all children unknown | return `''`, warn per unknown type |
| partial unknown children | drop unknown + warn; rest derived normally |
| `haklex` `setEditorState` throws | **propagates** — signals registry/haklex inconsistency, must fix the package |

The package's only soft path is "input shape is unusable" → empty string. All other failures propagate. Production code does not catch.

### No production fallbacks

- The server's `lexicalToMarkdown` wrapper does not catch.
- AI translation does not catch.
- DTO validation fails fast at the controller boundary.

This is the explicit anti-fallback stance. Future PRs that need a fallback must justify it in the PR description and include an `// REMOVE BY: <date>` comment.

## Testing

### Shared package — `packages/lexical-extras/test/`

| File | Coverage |
|---|---|
| `mx-lexical-to-markdown.spec.ts` | fixtures for plain paragraph, with `map`, with `afilmory`, mixed known+mx, all-unknown, empty |
| `mx-lexical-to-text.spec.ts` | same fixtures; assert text-shape outputs |
| `node-registry.spec.ts` | lock `map` / `afilmory` `toMarkdown` and `toText` byte shapes |
| `edge-cases.spec.ts` | invalid JSON → `''`; `root.children` non-array → `''`; document the inline-node limitation |

### Server — `apps/core/test/`

DTO validation tests (extend existing or new file `note-validation.spec.ts`):

| Test | Expectation |
|---|---|
| POST lexical note with content + text | 201 |
| POST lexical note missing text | 400 `LEXICAL_TEXT_REQUIRED` |
| POST lexical note missing content | 400 `LEXICAL_CONTENT_REQUIRED` |
| POST lexical note with text empty | 400 `LEXICAL_TEXT_REQUIRED` |
| POST lexical note with content empty | 400 `LEXICAL_CONTENT_REQUIRED` |
| PUT meta-only (no content/text) | 200 |
| PUT only-text (lexical mode) | 400 `CONTENT_TEXT_MISMATCH` |
| PUT only-content (lexical mode) | 400 `CONTENT_TEXT_MISMATCH` |

Service-layer tests:

| Test | Expectation |
|---|---|
| `note.service.create({ content, text })` | repository receives original content and text verbatim |
| `note.service.create` spy on `lexicalToMarkdown` | call count 0 in the create path |
| `note.service.updateById` | same |

AI translation tests (extend existing):

| Test | Expectation |
|---|---|
| translation patch | `patch.text === mxLexicalToMarkdown(patch.content)` |
| translation with `map` node | `patch.text` contains registry `toMarkdown` output |

Existing e2e fixtures updated:

| Fixture | Change |
|---|---|
| `test/src/contracts/note.contract.spec.ts` | lexical create payload includes `text` |
| `test/src/contracts/admin/notes-admin.contract.spec.ts` | same |
| `test/src/processors/helper/helper.lexical.service.spec.ts` | drop `populateText` tests; drop the three fallback tests added during 500-mitigation; add shared-package routing test |

### CLI (phase 2)

`packages/cli/test/cli/note/edit.test.ts` and `update.test.ts` — assert payload sent to server includes `text` derived via the shared package.

## Regression risk

| Risk | Mitigation |
|---|---|
| Existing DB rows have a `text` derived by the old code | Reads unchanged; column stays; no backfill needed |
| Admin save fires before `onTextChange` debounce completes | Save-button guard flushes pending text or derives locally via shared package |
| Yohaku not yet consuming `mxLexicalToText` | Out of scope this PR; package ships, Yohaku adoption is a separate change |
| `@haklex/rich-headless` future breaking change | Pin the version in the shared package; CI builds the shared package against a locked haklex |

## Deployment order

| Step | Content | Blocks |
|---|---|---|
| 1 | `@mx-space/lexical-extras` implementation + tests + npm publish at `0.1.0` | mx-core install |
| 2 | mx-core depends on the shared package; remove `populateText`; remove fallbacks; tighten DTO; rewire AI translation; tests | server deploy |
| 3 | admin: save-button guard ensures content/text travel together | admin release |
| 4 | CLI: replace `lexicalJsonToMarkdown` internals; extend LiteXML registry | mxs npm release |

Steps 2 and 3 must ship together (server↔admin wire contract changes). Step 1 is a npm release; step 4 is independent and follows.

## What we tell our future selves

> Persistence must not synthesize or overwrite writer-owned projections. For lexical content, the writer owns both `content` and `text`; the server validates presence and stores them as submitted. Server-side projection is permitted only in explicitly named internal-tooling paths, must not overwrite supplied text, and must have a named owner, telemetry, and a removal condition.
>
> Unknown Lexical nodes are not a storage concern. They are a client/editor projection concern.

Any future PR that re-introduces a server-side storage-path projection or a `try/catch → fallback derive` block violates this invariant. The reviewer's job is to refuse such a PR or demand the `// REMOVE BY: <date>` comment plus a tracked ticket.

## Open issues deferred to implementation

- Exact byte shape of `map.toMarkdown` and `afilmory.toMarkdown` outputs (implementation may iterate based on RSS/OG output preferences).
- Whether admin imports `@mx-space/lexical-extras` for the save-button local derivation, or instead synchronously flushes the pending `onTextChange` value. Either satisfies the invariant.
- Naming: `@mx-space/lexical-extras` vs `@mx-space/lexical-bridge`. Spec uses `lexical-extras`; final name decided at implementation.
