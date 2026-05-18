# CLI Renderer: Decouple Domain Logic, Introduce View Contract

**Date:** 2026-05-18
**Scope:** `packages/cli` — refactor `src/services/Renderer.ts`
**Status:** Design approved, awaiting implementation plan

## Problem

`packages/cli/src/services/Renderer.ts` is 876 lines (the project rule is 500
max per file) and concentrates four unrelated concerns into one module:

1. **Output mode plumbing** — `OutputOptions`, `FiberRef`, mode validation.
2. **IO primitives** — `writeStdout` / `writeStderr` / TTY detection / color.
3. **Domain rendering** — hard-coded knowledge of post / note / page schemas:
   - `DocumentKind = 'post' | 'note' | 'page'` enumerates business kinds.
   - `collectReadableFields` knows post-specific fields (`tags`, `category`,
     `pin`), note-specific (`nid`, `mood`, `weather`, `topic`, `public_at`),
     page-specific (`subtitle`, `order`).
   - `collectEnvelopeMeta` duplicates the same domain knowledge with a
     different field set for XML envelope mode.
   - `publishState` / `relationLabel` / `contentFormat` decode backend
     conventions (snake_case vs camelCase, relation shapes).
   - `tryLexicalToLitexml` knows the Lexical content format and pulls in
     `@haklex/rich-litexml`.
   - `renderPostList` is post-list-specific.
4. **Service surface** — eleven `emit*` methods, four of which (`emitDocument`,
   `emitPostList`, `emitProfileShow`, `emitProfileList`) are typed dispatchers
   that each carry their own mode-allowlist set and duplicate the dispatch
   boilerplate.

Adding a new typed output (for example a typed `whoami` view, which today
uses the generic `emitView` primitive) requires editing the Renderer service.
This is the inversion of the dependency we want: domains should know how to
render themselves, and the Renderer should only own mode dispatch and IO.

## Goal

Move all domain-specific rendering knowledge out of `services/Renderer.ts`.
Each domain owns a first-class `View<T>` value that describes how to render
its data across the three structural output modes (`readable` / `llm` /
`envelope`). The Renderer service becomes thin and domain-agnostic: it
selects the mode, calls the view function, and writes the result.

## Non-goals

- Changing the public command surface (`mxs post get`, etc.) or the
  user-visible output format. Callers may need to update which method they
  call, but the rendered output should be identical for every existing test.
- Replacing the markdown renderer (`cli/help/markdown.ts`) or the syntax
  highlighter (`cli/help/codehighlight.ts`). They stay as is.
- Promoting the Lexical-to-LiteXML helper to a separate service. It stays
  inside Renderer territory (`services/Renderer/content.ts`).
- Introducing a plugin system or third-party view registration. Views are
  first-class values imported by their command; there is no runtime lookup
  table.

## Design

### Architecture

```
cli/<domain>/*.ts (commands; thin)
   │
   │  yield* renderer.emit(postView, data)
   ▼
services/Renderer/service.ts (mode dispatch + IO, kind-agnostic)
   │
   │  json / pretty-json  → JSON.stringify
   │  readable / llm / envelope → view.<mode>(data, ctx)
   ▼
cli/<kind>/view.ts (pure functions, per-kind data → string per mode)
   ↑
   │  reuse
cli/_view/ (yamlScalar, formatStateBadge, frontmatter, metadata block, ...)
```

Key properties:

- The Renderer service no longer enumerates kinds. It accepts any
  `View<T>` and dispatches by the view's declared modes.
- A `View<T>` is a plain object — a first-class value imported by the
  command that uses it. No registry, no string token, no runtime lookup.
- The shared helpers (`yamlScalar`, `formatStateBadge`, `relationLabel`,
  `publishState`, `frontmatter`, `renderMetadataBlock`) move out of
  `Renderer.ts` into `cli/_view/`. They are pure functions that any view
  can compose.

### View contract

```ts
// services/Renderer/view.ts
export interface ViewCtx {
  readonly color: boolean
  readonly verbose: boolean
}

export interface View<T> {
  readonly kind: string
  readonly modes: ReadonlySet<OutputMode>
  readonly readable: (data: T, ctx: ViewCtx) => string
  readonly llm?: (data: T) => string
  readonly envelope?: (data: T) => string
}
```

- `kind` is used only for error messages (`unsupported --output value for
  <kind>: <mode>`) and for human-readable debug output. It is not a lookup
  key.
- `modes` is the source of truth for which `--output` values this view
  supports. The `POST_LIST_OUTPUT_MODES` / `DOCUMENT_OUTPUT_MODES` hard-coded
  sets in the current Renderer go away.
- `readable` is required. `llm` and `envelope` are optional.
- `json` / `pretty-json` are handled uniformly by the service (they
  `JSON.stringify` the raw data and never call the view), so they do not
  appear in the view interface. The JSON envelope shape is the same as
  `emitSuccess` produces today: `{ ok: true, data: <payload> }`.
- `ViewCtx.verbose` is reserved for future per-view detail toggles (e.g. a
  `whoami --verbose` showing token expiry). View implementations may ignore
  it; the field is wired through now to avoid signature churn later.

### Mode dispatch rules

```ts
emit: <T>(view: View<T>, data: T) => Effect.sync(() => {
  const opts = currentOptions()
  const mode = opts.json ? 'json' : opts.output

  if (mode === 'json' || mode === 'pretty-json') {
    // Bypass the view entirely; JSON is structural and kind-agnostic.
    writeStdout(jsonEnvelope(data, mode === 'pretty-json'))
    return
  }

  if (!view.modes.has(mode)) {
    writeStderr(unsupportedModeError(view.kind, mode))
    return
  }

  let text: string
  if (mode === 'envelope' && view.envelope) text = view.envelope(data)
  else if (mode === 'llm' && view.llm)       text = view.llm(data)
  else if (mode === 'llm' /* fallback */)    text = view.readable(data, { color: false, verbose: opts.verbose })
  else                                       text = view.readable(data, { color: isColorEnabled(stdout), verbose: opts.verbose })

  writeStdout(text + '\n')
})
```

The fallback for `--output llm` when a view has no `llm` function: emit the
`readable` rendering with `color: false`. This preserves today's behavior for
kinds that have not been given a dedicated LLM rendering. View helpers
(`formatStateBadge`, `renderMetadataBlock`, `renderMarkdownToAnsi`) honor
the `color` flag, so passing `color: false` strips all ANSI escapes from the
output.

If `--output envelope` is requested but the view has no `envelope` function,
the service emits the "unsupported mode" error to stderr. (Envelope is
deliberately stricter than llm because it is a structured machine format
that downstream consumers expect to parse.)

### Renderer service surface

```ts
interface RendererService {
  readonly options: Effect.Effect<OutputOptions>

  // Typed view dispatch — the primary path.
  readonly emit: <T>(view: View<T>, data: T) => Effect.Effect<void>

  // Generic primitives for payloads without a schema.
  readonly emitSuccess: (data: unknown) => Effect.Effect<void>          // mutation responses
  readonly emitView: (data: unknown, view: (ctx: ViewCtx) => string) => Effect.Effect<void>     // ad-hoc inline view
  readonly emitMarkdown: (data: unknown, markdown: () => string) => Effect.Effect<void>         // ad-hoc markdown source
  readonly emitInfoBlock: (block: (ctx: ViewCtx) => string) => Effect.Effect<void>              // stderr block (banners)

  // stderr primitives — unchanged.
  readonly emitInfo: (msg: string) => Effect.Effect<void>
  readonly emitWarn: (msg: string) => Effect.Effect<void>
  readonly emitError: (err: CliError) => Effect.Effect<void>
}
```

Methods removed: `emitDocument`, `emitPostList`, `emitProfileShow`,
`emitProfileList`. Their call sites move to `renderer.emit(view, data)`.

Mutation responses (the result of `post create`, `note update`, etc.)
continue to use `emitSuccess` — they intentionally render as generic
key/value rather than a full document view because the user is acting on
the resource, not consuming it. Upgrading mutation responses to use the
typed views is a separate UX change, out of scope here.

Methods retained as primitives because they describe data without a stable
schema — login device-code box, update banner, etc:

- `emitView` — ad-hoc inline view function (login banner, update banner)
- `emitMarkdown` — caller supplies the markdown source directly
- `emitInfoBlock` — stderr-targeted block (suppressed by `--quiet` / `--json`)
- `emitSuccess` — generic readable rendering for mutation responses

### File layout

```
src/services/Renderer/
  index.ts          — barrel + Layer + Context.Tag (public surface)
  options.ts        — OutputOptions, FiberRef, defaults
  view.ts           — View<T> interface, ViewCtx
  service.ts        — makeService(), emit/emitSuccess/emitView/...
  primitives.ts     — writeStdout/writeStderr/color/isTTY
  errors.ts         — emitErrorSync, formatDetails, formatIssue
  content.ts        — tryLexicalToLitexml, renderContent (content-format adapter)

src/cli/_view/
  index.ts          — barrel
  helpers.ts        — yamlScalar/yamlValue, formatStateBadge, relationLabel,
                      publishState, formatScalar
  frontmatter.ts    — YAML frontmatter builder for llm mode
  metadata-block.ts — title + rule + key-value lines builder (ANSI)
  envelope.ts       — XML envelope builder

src/cli/<kind>/view.ts
  cli/post/view.ts     — postView, postListView
  cli/note/view.ts     — noteView
  cli/page/view.ts     — pageView
  cli/auth/view.ts     — whoamiView, statusView
  cli/profile/view.ts  — profileShowView, profileListView
```

The shared view helpers live under `cli/_view/`. The `_` prefix signals
"module-internal to the CLI"; it is not part of the public package API. The
existing `cli/help/markdown.ts` and `cli/help/codehighlight.ts` continue to
exist as the markdown renderer and syntax highlighter respectively; views
import them when they need to render markdown content.

The Renderer module itself moves from a single 876-line file to a directory
of seven files, each under ~200 lines. `services/Renderer.ts` is replaced by
`services/Renderer/index.ts` which re-exports the public surface; downstream
imports do not need to change.

### Example view: post

```ts
// cli/post/view.ts
import type { View } from '@/services/Renderer'
import {
  frontmatter,
  publishState,
  relationLabel,
  renderEnvelope,
  renderMetadataBlock,
} from '@/cli/_view'

interface PostData {
  id: string
  title: string
  slug: string
  is_published?: boolean
  category?: { name: string; slug: string } | null
  tags?: string[]
  summary?: string
  content?: string
  content_format?: 'markdown' | 'lexical' | 'text'
  // ...other backend fields
}

const collectFields = (post: PostData): Array<[string, unknown]> => [
  ['id', post.id],
  ['slug', post.slug],
  ['state', publishState(post)],
  ['category', relationLabel(post.category)],
  ['tags', post.tags],
  // ...
]

export const postView: View<PostData> = {
  kind: 'post',
  modes: new Set(['readable', 'llm', 'envelope']),
  readable: (post, ctx) =>
    renderMetadataBlock(
      {
        title: post.title,
        fields: collectFields(post),
        body: post.content,
        bodyFormat: post.content_format,
        summary: post.summary,
      },
      ctx,
    ),
  llm: (post) =>
    frontmatter({ title: post.title, fields: collectFields(post) }) +
    (post.content ? '\n\n' + post.content : ''),
  envelope: (post) =>
    renderEnvelope('mxpost', collectEnvelopeMeta(post), post.content ?? ''),
}
```

A view file is typically under 100 lines. The same `collectFields` powers
all three modes; only the surrounding shape (ANSI block / YAML frontmatter /
XML envelope) differs.

## Migration plan

The work is staged so each step compiles, every test continues to pass, and
each step can be committed independently. The implementation plan (produced
by `writing-plans` after this spec is approved) will expand each step into
discrete tasks.

1. **Split the Renderer module without behavior changes.**
   - Create `src/services/Renderer/` directory.
   - Move pieces of `Renderer.ts` into `options.ts`, `view.ts` (initially
     just types), `service.ts`, `primitives.ts`, `errors.ts`, `content.ts`.
   - Add `index.ts` as a barrel that re-exports the previous public surface.
   - All existing call sites and tests continue to work unchanged.

2. **Extract shared view helpers into `cli/_view/`.**
   - Move `yamlScalar` / `yamlValue` / `formatStateBadge` / `publishState` /
     `relationLabel` / `formatScalar` to `cli/_view/helpers.ts`.
   - Extract the YAML-frontmatter rendering (currently inline in
     `renderReadableDocument`'s `llm` branch) into
     `cli/_view/frontmatter.ts`.
   - Extract the ANSI metadata block (title + rule + aligned key-value
     lines) into `cli/_view/metadata-block.ts`.
   - Extract the XML envelope builder into `cli/_view/envelope.ts`.
   - Renderer functions internally start calling the helpers from `_view/`;
     external behavior unchanged.

3. **Add the `View<T>` contract and the new `emit` method.**
   - Define `View<T>` in `services/Renderer/view.ts`.
   - Add `emit: <T>(view, data) => Effect<void>` to `RendererService`.
   - Keep the existing methods (`emitDocument`, etc.) operational.

4. **Build views and migrate call sites one kind at a time.**
   - Order: `post` → `note` → `page` → `post-list` → `whoami` / `status` →
     `profile-show` / `profile-list`.
   - For each kind: write `cli/<kind>/view.ts`, add `cli/<kind>/view.test.ts`,
     switch the command to call `renderer.emit(<kind>View, data)`.
   - After each kind, both the new path and the old path render identical
     output (verified by snapshot tests).

5. **Remove deprecated methods and dead code.**
   - Drop `emitDocument`, `emitPostList`, `emitProfileShow`,
     `emitProfileList` from the service.
   - Drop the `DocumentKind` type, the `POST_LIST_OUTPUT_MODES` and
     `DOCUMENT_OUTPUT_MODES` sets, the `collectReadableFields` /
     `collectEnvelopeMeta` / `renderReadableDocument` /
     `renderDocumentEnvelope` / `renderPostList` functions (now lives in the
     views).
   - Trim `Renderer.test.ts` — domain-specific assertions move to
     `cli/<kind>/view.test.ts`. The service test focuses on mode dispatch,
     JSON envelopes, and primitive behavior.

## Testing strategy

Three layers:

- **View tests** (`cli/<kind>/view.test.ts`): pure functions. Snapshot the
  output of `view.readable` / `view.llm` / `view.envelope` for representative
  inputs. These take over the bulk of what `Renderer.test.ts` currently
  asserts (rendering correctness per kind).

- **Renderer service tests** (`test/services/Renderer.test.ts`, slimmed
  down): mode dispatch is correct (`emit(view, data)` routes to the right
  branch); JSON / pretty-json envelopes have the expected shape; primitives
  (`emitInfo` / `emitWarn` / `emitError` / `emitInfoBlock` / `emitSuccess`)
  respect `--quiet` / `--json` suppression rules.

- **Helper tests** (`cli/_view/*.test.ts`): YAML quoting edge cases (special
  characters, type-confusable strings like `"true"` / `"null"`); metadata
  block alignment with mixed-width labels; envelope XML escaping.

Today's `Renderer.test.ts` runs 513 assertions, of which roughly half cover
post / note / page rendering. Those move to `cli/<kind>/view.test.ts`. Total
assertion count should stay roughly constant after the migration.

## Risks and mitigations

- **Risk:** Snapshot drift between old and new rendering paths for
  post / note / page. The output is character-sensitive (alignment widths,
  separator dashes, ANSI sequences).
  **Mitigation:** Step 4 of the migration runs both paths in parallel until
  the view is byte-identical to the legacy rendering. Snapshot tests guard
  every existing assertion.

- **Risk:** Circular imports. `cli/<kind>/view.ts` imports `View` from
  `services/Renderer`, and `services/Renderer/service.ts` imports view types
  but not view values.
  **Mitigation:** Keep `View<T>` and `ViewCtx` in a leaf module
  (`services/Renderer/view.ts`) that imports nothing from the rest of the
  service. Views import this leaf, never the service.

- **Risk:** Lexical-to-LiteXML helper is needed both by the Renderer
  internals (current behavior, content rendering inside views) and by the
  Lexical service (which already exists).
  **Mitigation:** The helper stays in `services/Renderer/content.ts` for
  this refactor. If a future change wants to consolidate it with the Lexical
  service, that is a separate decision.

- **Risk:** Migration steps 1 and 2 enlarge the diff before any user-visible
  benefit lands. A long-lived branch could accumulate conflicts with other
  CLI work.
  **Mitigation:** Each migration step is a self-contained commit. Land them
  on master as they finish; do not batch the entire refactor into one PR.

## Open questions

None at design time. Implementation may surface ergonomic details (helper
signatures, exact field-ordering rules) that will be resolved during the
writing-plans phase.
