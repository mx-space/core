# `@mx-space/cli` Architecture (v0.3)

`@mx-space/cli` is implemented on top of [`@effect/cli`](https://effect.website/docs/cli/introduction) and [`@effect/platform`](https://effect.website/docs/platform/introduction). All effects are composed in [Effect-TS](https://effect.website) — there is no commander, no global mutable state, no ad-hoc Promise handling.

This document covers the five patterns that recur throughout the codebase, plus a short walkthrough for adding a new command.

## 1. `Context.Tag` + `Layer` — service definition and wiring

Every service is a `Context.Tag` paired with a `Layer` that builds it from its dependencies. The `Default` layer is the one consumed by application code; test code substitutes alternative layers.

The most representative example is `Config` (`src/services/Config.ts`). The contract is a `ConfigService` interface, the tag binds the interface to an implementation, and `Default` declares the dependencies it needs (the platform `FileSystem` and `Path` services from `@effect/platform`):

```ts
// src/services/Config.ts
export interface ConfigService {
  readonly resolveConfig: (
    overrides?: StoreOverrides,
  ) => Effect.Effect<ResolvedConfig, ConfigMissingApiUrl | ProfileNotFound>
  // ...
}

export class Config extends Context.Tag('Config')<Config, ConfigService>() {
  static Default: Layer.Layer<
    Config,
    never,
    FileSystem.FileSystem | Path.Path
  > = Layer.effect(
    Config,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      return makeService(fs, path)
    }),
  )
}
```

Layer composition for the whole application lives in `src/layers/App.ts`. Services that depend on per-invocation flags (`Api`, `Resolver`) are constructed in `src/bin/mxs.ts` after global flags are parsed, then merged into the application layer via `Layer.provideMerge`.

## 2. `Effect.gen` — composing service calls in handlers

CLI handlers are small `Effect.gen` blocks that pull the services they need with `yield*` and call their methods. `src/cli/post/list.ts` is the canonical short example:

```ts
// src/cli/post/list.ts
import { postListView } from './view'

export const list = Command.make(
  'list',
  { page, size, state, sort },
  ({ page, size, state, sort }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request('/posts', {
        query: {
          page: unwrap(page),
          size: unwrap(size),
          state: unwrap(state),
          sortBy: unwrap(sort),
        },
      })
      yield* renderer.emit(postListView, res)
    }),
).pipe(Command.withDescription('list posts'))
```

The handler does not import the concrete implementations of `Api` or `Renderer` — it depends on the tags. Layer wiring at the program entry point resolves them. This makes every handler trivially testable: provide an in-memory layer for either service and observe behaviour.

The renderer call is intentionally generic. `emit(view, data)` accepts any `View<T>` value defined by the resource and dispatches across the structural output modes (`readable` / `llm` / `xml`). The view itself is a plain value imported by the command — see §6 for the contract.

## 3. `Effect.tryPromise` — wrapping Promise-based libraries

Most external integrations (the file system, the editor, package-manager subprocesses, the lexical JSON-to-markdown bridge) expose Promise-based APIs. The Effect way to bring them in is `Effect.tryPromise`, which captures rejections into the typed error channel:

```ts
// src/services/Editor.ts
openEditor: (opts) =>
  Effect.tryPromise({
    try: async () => {
      const editor = opts.editor ?? process.env.EDITOR ?? process.env.VISUAL
      if (!editor) {
        throw new Error('$EDITOR not set; ...')
      }
      // ... spawn editor, await exit ...
      return await readFile(tmpPath, 'utf8')
    },
    catch: (err) =>
      new Generic({
        message: messageOf(err),
        cause: err,
      }),
  })
```

For synchronous throwing code (e.g. parsing LiteXML), the parallel constructor is `Effect.try`. See `src/services/Lexical.ts#litexmlToPayload`:

```ts
litexmlToPayload: (xml) =>
  Effect.try({
    try: () => deserializeFromXml(wrapped, getRegistry()) as LexicalState,
    catch: (err) =>
      new ValidationXml({
        message: `failed to parse LiteXML: ${messageOf(err)}`,
        cause: err,
      }),
  })
```

## 4. `catchTag` / `catchAll` — typed error handling

Errors are tagged classes that extend `Data.TaggedError` — see `src/domain/errors.ts` for the full tree. The compiler tracks which tags can escape an effect, so failure handling is exhaustive without coupling handlers to discriminator strings.

The CLI bin wires the top-level error renderer and exit-code mapping with `tapError` + `catchAll`:

```ts
// src/bin/mxs.ts (top-level error path)
const core = preflight(flags).pipe(
  Effect.zipRight(cli(parsed.rest)),
  Effect.tapError((err) =>
    isCliError(err)
      ? Effect.flatMap(Renderer, (r) => r.emitError(err))
      : Effect.sync(() => undefined),
  ),
  Effect.catchAll((err) =>
    Effect.sync(() => {
      const tag = isCliError(err) ? err._tag : 'Generic'
      process.exit(exitCodeForTag(tag))
    }),
  ),
)
```

For tag-specific recovery in handlers, prefer `Effect.catchTag('Foo', ...)` over `catchAll` — it narrows the residual error type so unrelated failures still bubble.

`src/domain/errors.ts#exitCodeForTag` is the single source of truth for the documented exit-code table (1, 2, 3, 4, 5, 6, 7, plus `sysexits` 70/73/75 for self-update errors).

## 5. `@effect/vitest` + test layers — writing tests

Tests use `it.effect` from `@effect/vitest` to run an effect directly and provide service layers via `Effect.provide`. The two custom helpers under `test/helper/` cover the two most common substitutions:

- **`test/helper/test-fs.ts`** exposes an in-memory `FileSystem` layer (`TestFs.make`) — used wherever a service writes to or reads from disk (`Config`, `Profile`, `Migration`).
- **`test/helper/test-http.ts`** exposes a canned-response `HttpClient` layer — used by `Api` and `Resolver` tests to drive request/response cycles without real network I/O.

Pattern:

```ts
import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { TestFs } from '../helper/test-fs'
import { Config } from '../../src/services/Config'

const testLayer = Config.Default.pipe(Layer.provide(TestFs.make({ /* seeded files */ })))

it.effect('resolves an active profile', () =>
  Effect.gen(function* () {
    const config = yield* Config
    const resolved = yield* config.resolveConfig()
    expect(resolved.profileName).toBe('prod')
  }).pipe(Effect.provide(testLayer)),
)
```

Integration tests under `test/integration/` spawn the actual binary via `child_process.spawn(BIN, ...)` and assert on stdout/stderr/exit code — these cover the cli surface end-to-end. See `test/integration/cli-error-envelope.test.ts` for the canonical example.

## 6. `View<T>` — domain-owned rendering, generic dispatch

Output rendering is split across two boundaries: a domain-agnostic dispatcher in `src/services/Renderer/`, and per-resource view modules in `src/cli/<kind>/view.ts` that own all schema knowledge.

The view contract (`src/services/Renderer/view.ts`):

```ts
export interface ViewCtx {
  readonly color: boolean
  readonly verbose: boolean
}

export interface View<T> {
  readonly kind: string                              // used only in error messages
  readonly modes: ReadonlySet<OutputMode>            // which --output values are valid
  readonly readable: (data: T, ctx: ViewCtx) => string
  readonly llm?: (data: T) => string                 // missing → readable with color=false
  readonly xml?: (data: T) => string                 // missing → "unsupported mode" error
}
```

Dispatch rules implemented in `src/services/Renderer/service.ts#emit`:

- `--json` / `--output json` / `--output pretty-json` bypass the view entirely and emit `{ ok: true, data }` envelopes (or pretty-printed raw payloads). The view is never called for JSON.
- `--output <mode>` where `view.modes` does not include the mode emits the `unsupported --output value for <kind>: <mode>` error to stderr.
- `--output llm` with no `view.llm` falls back to `view.readable(data, { color: false, verbose })`. Helpers in `src/cli/render/` honour the `color` flag, so passing `false` strips ANSI.
- `--output xml` with no `view.xml` is a hard error (xml is a machine format; silent fallback would corrupt downstream parsers).

Layout:

```
src/services/Renderer/
  index.ts          — Context.Tag, Layer, public surface re-exports
  view.ts           — View<T>, ViewCtx (leaf module; no service imports)
  options.ts        — OutputMode, OutputOptions, currentOutputOptions FiberRef
  service.ts        — makeService(): emit, emitSuccess, emitView, emitMarkdown,
                       emitInfo/Warn/Error/InfoBlock
  primitives.ts     — writeStdout/writeStderr/color
  errors.ts         — emitErrorSync, error envelope formatting
  content.ts        — Lexical → LiteXML adapter, document field helpers
                       (publishState, relationLabel, formatScalar, ...)
  lists.ts          — renderReadableGeneric (used by emitSuccess fallback)

src/cli/render/      — shared view helpers: frontmatter, metadata-block,
                       envelope, markdown→ANSI renderer, codehighlight
src/cli/ui/          — bespoke TTY primitives (badges, rounded box)
src/cli/<kind>/view.ts — per-resource View<T> values
```

A view file composes domain-specific `collectFields` against shared rendering helpers. `cli/post/view.ts` shows the full pattern — the same field list powers `readable` (ANSI metadata block), `llm` (YAML frontmatter + body), and `envelope` (`<mxpost>` LiteXML). View files are typically under 150 lines.

When to add a view vs use a primitive:

- **Add a `View<T>`** for any read command whose output has a stable shape across `readable` / `llm` / `envelope`. The view lives next to the verbs in `cli/<kind>/view.ts`.
- **Use `emitSuccess`** for mutation responses (`post create`, `note update`, etc.) — they render as generic key/value because the user is acting on the resource, not consuming it. `emitSuccess` honours `--json` / `--output json` (envelope) and `--output readable` (generic key/value via `renderReadableGeneric`).
- **Use `emitView` / `emitMarkdown`** for ad-hoc one-off blocks without a reusable schema (login device-code banner, update-available notice).

Test layering follows the same split:

- View tests under `test/cli/<kind>/view.test.ts` snapshot `view.readable` / `view.llm` / `view.envelope` for representative inputs — these are pure functions with no Effect machinery.
- `test/services/Renderer.test.ts` covers mode dispatch, JSON-envelope shape, and the suppression rules of `emitInfo` / `emitWarn` / `emitInfoBlock` under `--quiet` / `--json`.
- Helper tests under `test/cli/render/*.test.ts` cover YAML quoting, alignment, XML escaping.

---

# How to add a new command

Each command lives in its own file under `src/cli/<resource>/<verb>.ts`. The aggregator file `src/cli/<resource>.ts` wires the verbs into a `Command.withSubcommands` group.

1. **Create the verb.** Define options with `Options.*`, then `Command.make` with a handler that yields the services it needs. Keep it small — most logic should live in services. Mutation verbs use `emitSuccess`; typed-read verbs use `emit(view, data)` (see step 2).

   ```ts
   // src/cli/post/archive.ts
   export const archive = Command.make(
     'archive',
     { slugOrId: Args.text({ name: 'slugOrId' }) },
     ({ slugOrId }) =>
       Effect.gen(function* () {
         const api = yield* Api
         const renderer = yield* Renderer
         const res = yield* api.request(`/posts/${slugOrId}/archive`, {
           method: 'POST',
         })
         yield* renderer.emitSuccess(res)
       }),
   ).pipe(Command.withDescription('archive a post'))
   ```

2. **(For typed read verbs) Add or reuse a `View<T>`.** If the verb returns a document or list and you need `readable` / `llm` / `envelope` rendering, define the view in `src/cli/<kind>/view.ts` (one file per resource — `postView`, `postListView`, `noteView`, etc.). Compose shared helpers from `src/cli/render/` and document helpers from `src/services/Renderer/content.ts`. Handlers then call `renderer.emit(theView, data)`.

3. **Register the verb.** Add it to the resource aggregator (`src/cli/post/index.ts`):

   ```ts
   import { archive } from './archive'
   // ...
   export const postCmd = Command.make('post').pipe(
     Command.withSubcommands([list, get, create, edit, update, delete_, publish, unpublish, archive]),
   )
   ```

   If the new verb is observable in `mxs post --help`, also register a `CommandHelp` entry via `registerCommandHelp` in `src/cli/help/registry.ts`-callers (the side-effect import in `src/cli/help/index.ts` loads each resource module once).

4. **(Optional) Add a service.** If the verb needs a new capability, define it in `src/services/<Service>.ts` using the `Context.Tag + Layer` pattern from §1, add it to `src/layers/App.ts` so the application layer can build it, and wire any required platform services. If the service depends on per-invocation global flags (`--api-url`, `--token`, `--profile`, ...), construct it in `src/bin/mxs.ts` after `parseGlobalFlags` instead — `Api` and `Resolver` are the existing examples.

5. **Write tests.** Most verbs need a unit-level test under `test/cli/<resource>/<verb>.test.ts` (using `it.effect` + canned layers) and — if the verb has user-visible output — an entry in the relevant integration test under `test/integration/`. New views also get a `test/cli/<kind>/view.test.ts` with snapshots for each declared mode.

6. **Run typecheck + vitest scoped to the changed files** before opening a PR. Both `pnpm typecheck` and `pnpm test` are file-cheap.

The six patterns above (Tag/Layer, Effect.gen, tryPromise, catchTag, test layers, View<T>) are sufficient to implement every command in v0.3. Anything that doesn't fit one of them is a sign that the abstraction is wrong; revisit the service boundary rather than reaching for `unsafeRun*` escape hatches.
