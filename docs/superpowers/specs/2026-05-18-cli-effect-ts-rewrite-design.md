# `@mx-space/cli` Effect-TS Rewrite Design

**Date:** 2026-05-18
**Target version:** `@mx-space/cli@0.3.0`
**Author:** Innei
**Status:** Design

## 1. Motivation

`@mx-space/cli` (v0.2.x) is built on `commander` with hand-rolled async helpers (`api-client`, `auth`, `config-store`, `errors`, `output`, `profile`). The codebase is functional but has structural friction that compounds as v2/v3 commands (AI, comments, backup, observability) land:

- **Errors are runtime-only.** `MxsError` is a single class with a string `code` field; the type system cannot tell which errors a function may produce, and exhaustive handling is by convention.
- **Dependency wiring is manual.** `resolveContext` / `buildApiClient` thread state by hand through every command's `run()`. Mocking for tests is per-import and verbose.
- **Schema validation is ad-hoc.** Flag parsing in `commander.option()`, payload construction in `payload.ts`, and API response parsing each use bespoke logic.
- **Argv parsing is verbose.** Each subcommand is registered imperatively in `bin/mxs.ts` with hundreds of lines of repetitive `.command().option().action()`.

The rewrite consolidates these on **Effect-TS 3.x** + **`@effect/cli`** + **`@effect/platform-node`**, gaining:

- `Effect<A, E, R>` types make all errors visible at the function signature.
- `Layer` / `Context.Tag` services replace hand-passed context.
- `Schema` unifies flag parsing, payload construction, and response decoding.
- `@effect/cli` `Command` combinators replace `commander`.

## 2. Scope

### In scope (v0.3.0)

- Complete replacement of `src/` with an Effect-TS architecture.
- Behavioral parity with v0.2.x for **all** existing commands: `auth {login,logout,whoami,status}`, `profile {ls,show,use,mark,rm}`, `post {list,get,create,edit,update,delete,publish,unpublish}`, `note {...}`, `page {...}`, `category {...}`, `topic {...}`, `config {list,get,set,edit}`, `update`.
- All existing global flags: `--json`, `--output <mode>`, `--api-url`, `--token`, `--api-key`, `--lang`, `--quiet`, `--verbose`, `--dry-run`, `--profile`.
- All five output modes: `pretty-json`, `json`, `readable`, `llm`, `envelope`.
- All existing exit codes (`exitCodeForError` semantics preserved via tag→code mapping).
- Production write-gate, profile system, legacy migration, update notifier, self-update — all preserved.
- Service / Layer skeleton with **interface-only placeholders** for v2/v3 features (Ai, Backup, Cache).

### Out of scope (v0.3.0)

- Any v2 / v3 command implementation (commands stay as `// TODO(v2)` notes).
- Replacing `better-auth` with a hand-rolled OAuth/device-flow client.
- Replacing `@clack/prompts` with `@effect/cli` built-in prompts.
- Replacing `@haklex/rich-headless` / `@haklex/rich-litexml`.
- Streaming envelope output (`Stream`-based NDJSON).
- HTTP retry beyond the existing single 401 → refresh → retry.

### Minor surface adjustments permitted (per brainstorming Q3-b)

A small list of low-risk normalizations is allowed if needed during implementation; each must be documented in the PR's "behavior changes" section and is subject to review:

- Flag name normalization (e.g., consistent kebab-case if any camelCase slipped in).
- Error message wording (the wire-format `code` field MUST stay byte-equal; only the human `message` may be rephrased).
- Help text wording (`@effect/cli` generates help differently from `commander`).

Out-of-scope changes that would break existing tests' byte-level assertions on `code` strings, `--output envelope` shape, or exit codes are **not** permitted in v0.3.0.

## 3. Architecture

### 3.1 Dependencies

**Added:**
- `effect` — runtime, Schema, Layer, `Data.TaggedError`, Clock, Logger.
- `@effect/cli` — `Command`, `Options`, `Args`, prompts.
- `@effect/platform` + `@effect/platform-node` — `FileSystem`, `HttpClient`, `Terminal`, `CommandExecutor`, `Path`.

**Removed:**
- `commander`.

**Kept (wrapped as Services):**
- `@clack/prompts` — wrapped by `Editor` service.
- `better-auth` — wrapped by `Auth` service via `Effect.tryPromise`.
- `@haklex/rich-headless`, `@haklex/rich-litexml` — wrapped by `Lexical` service.
- `@mx-space/api-client` — used for type imports where helpful; not a runtime client.
- `semver`, `open` — used directly.

### 3.2 Directory layout (mirror of existing `src/core/*`)

```
packages/cli/
  bin/mxs.cjs              # shim, unchanged
  src/
    bin/mxs.ts             # NodeContext + AppLayer + runMain
    cli/                   # @effect/cli command tree
      _facade.ts           # thin re-exports of Command/Options/Args
      auth/{login,logout,whoami,status}.ts
      profile/{ls,show,use,mark,rm}.ts
      post/{list,get,create,edit,update,delete,publish,unpublish}.ts
      note/{...}.ts
      page/{...}.ts
      category/{...}.ts
      topic/{...}.ts
      config/{list,get,set,edit}.ts
      update.ts
    services/
      Api.ts
      Auth.ts
      Config.ts
      Editor.ts
      Lexical.ts
      Migration.ts
      Profile.ts
      Renderer.ts
      Resolver.ts
      UpdateNotifier.ts
      # v2/v3 placeholders (interface only)
      Ai.ts
      Backup.ts
      Cache.ts
    domain/
      errors.ts             # TaggedError tree + tag↔code map + exit code map
      gate.ts               # pure write-gate decision (no IO)
      payload.ts            # pure payload builders
      schema/
        post.ts
        note.ts
        page.ts
        category.ts
        topic.ts
        config.ts
        profile.ts
        api-envelope.ts     # wire-format error envelope
    layers/
      App.ts                # Layer.mergeAll of all services
```

### 3.3 Services

Each service is a `Context.Tag` with a `Default` `Layer`:

| Service | Provides | Depends on | Wraps |
|---|---|---|---|
| `Config` | `read`, `write`, `update` for `~/.config/mxs/profiles/<name>/{config,credentials}.json` | `FileSystem`, `Path` | direct FS |
| `Profile` | `current`, `use`, `mark`, `rm`, `ls`, `show`, `resolve(overrides)` | `Config` | current `core/profile.ts` |
| `Auth` | `ensureFresh`, `login`, `logout`, `whoami`, `status` | `Config`, `HttpClient`, `Console` | `better-auth` device flow (`Effect.tryPromise`) |
| `Api` | `request<A>(path, opts, schema)` | `Auth`, `HttpClient`, `Profile` (for write-gate) | replaces `ApiClient` class |
| `Resolver` | `resolveSlugOrId`, `resolveCategoryRefs` | `Api` | current `commands/internal/resolve-helpers.ts` |
| `Editor` | `openEditor`, `prompt`, `confirm`, `readFileOrStdin` | `Terminal`, `FileSystem` | `@clack/prompts` + `node:child_process` |
| `Renderer` | `emitSuccess`, `emitError`, `emitInfo`, plus typed `emitPostList`, `emitProfileShow`, … | `Console`, `Terminal` | current `output.ts` + `document-output.ts` |
| `Lexical` | `litexmlToPayload`, `payloadToLitexml`, `lexicalJsonToMarkdown` | — | `@haklex/*` |
| `UpdateNotifier` | `maybeNotify` (fire-and-forget), `runUpdate` | `Config`, `HttpClient`, `CommandExecutor`, `Clock` | current `self-update.ts` + `update-notifier.ts` |
| `Migration` | `runLegacyMigrationIfNeeded` | `FileSystem`, `Config` | current `core/migration.ts` |

`Gate` is a pure helper module (no IO) — not a service.

### 3.4 Commands

Each command file exports a `@effect/cli` `Command`:

```ts
// src/cli/post/list.ts
import { Command, Options } from '../_facade'
import { Effect } from 'effect'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { PostListResponse } from '../../domain/schema/post'

const page = Options.integer('page').pipe(Options.optional)
const size = Options.integer('size').pipe(Options.optional)
const state = Options.choice('state', ['draft', 'publish']).pipe(Options.optional)
const sort = Options.choice('sort', ['created', 'modified']).pipe(Options.optional)

export const list = Command.make(
  'list',
  { page, size, state, sort },
  ({ page, size, state, sort }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request('/posts', {
        query: { page, size, state, sortBy: sort },
        schema: PostListResponse,
      })
      yield* renderer.emitPostList(res)
    })
)
```

Subcommand groups (`src/cli/post.ts`, etc.) aggregate verbs via `Command.withSubcommands([list, get, create, ...])`.

### 3.5 Entry point

```ts
// src/bin/mxs.ts
#!/usr/bin/env node
import { NodeContext, NodeRuntime } from '@effect/platform-node'
import { Command } from '@effect/cli'
import { Effect } from 'effect'
import { AppLayer } from '../layers/App'
import { authCmd, profileCmd, postCmd, /* ... */ } from '../cli'
import { Renderer } from '../services/Renderer'
import { exitCodeForTag } from '../domain/errors'

const root = Command.make('mxs').pipe(
  Command.withSubcommands([
    authCmd, profileCmd, postCmd, noteCmd, pageCmd,
    categoryCmd, topicCmd, configCmd, updateCmd,
  ])
)

const program = root.pipe(
  Command.run({ name: 'mxs', version: CLI_VERSION })
)(process.argv)

program.pipe(
  Effect.tapError((err) =>
    Effect.flatMap(Renderer, (r) => r.emitError(err))
  ),
  Effect.catchAll((err) =>
    Effect.sync(() => process.exit(exitCodeForTag(err._tag)))
  ),
  Effect.catchAllDefect((defect) =>
    Effect.sync(() => {
      process.stderr.write(`mxs: internal error\n${defect}\n`)
      process.exit(1)
    })
  ),
  Effect.provide(AppLayer),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

## 4. Data flow

End-to-end trace of `mxs post create --file ./draft.litexml --state publish --profile prod`:

1. **`@effect/cli` parse** → `{ file, state }` + global flags `{ profile, json, output, ... }`. Schema decode failure → `ValidationFailed`.
2. **`Migration.runLegacyMigrationIfNeeded`** — `FileSystem.readFile(~/.config/mxs/config.json)`, migrate if old layout.
3. **`Profile.resolve({ override: "prod" })`** — read profile config, validate via `Schema.decode(ProfileConfigSchema)`. Failure → `ConfigMigrationFailed` or `ProfileNotFound`.
4. **`Editor.readFileOrStdin("./draft.litexml")`** — read content. FS failure → `ValidationFailed`.
5. **`Lexical.litexmlToPayload(xml)`** — parse via haklex. Failure → `ValidationXml`.
6. **`Resolver.resolveCategoryRefs(payload)`** — for each category slug, `Api.request("/categories?slug=...")`.
7. **`Api.request("/posts", { method: "POST", body: payload, schema: PostSchema })`**:
   - **Write gate** — `Gate.decide(ResolvedConfig, "POST")` runs inside `Api.request` (matches v0.2.x behavior where `decideWriteGate` is invoked by `ApiClient.request`). Production profile + no explicit override → fail `WriteRequiresExplicit` before any network call.
   - `Auth.ensureFresh` — if `exp - now < 60s`, refresh.
   - `HttpClient.post(url, headers, body)`.
   - On 401 once: `Auth.refresh`, retry.
   - On 4xx/5xx: map to `AuthExpired`/`AuthDenied`/`ResourceNotFound`/`ValidationFailed`/`ServerError`.
   - `Schema.decode(PostSchema)` on response. Failure → `ServerError(status=200, message="response shape mismatch")`.
8. **`Renderer.emitSuccess(post)`** — switch on `--output` mode: `pretty-json` / `json` / `readable` / `llm` / `envelope`.
9. **`Effect.fork(UpdateNotifier.maybeNotify)`** — non-blocking, errors swallowed.

The handler's inferred type:

```ts
Effect.Effect<
  void,
  | AuthExpired | AuthDenied | WriteRequiresExplicit
  | ValidationFailed | ValidationXml
  | ServerError | ResourceNotFound
  | ProfileNotFound | ConfigMigrationFailed,
  Api | Renderer | Editor | Resolver | Lexical | Migration | Profile
>
```

## 5. Errors

### 5.1 TaggedError tree

`domain/errors.ts` replaces `MxsError` with one `Data.TaggedError` class per current `MxsErrorCode`. Tags use PascalCase (e.g. `AuthExpired`), wire codes stay dotted (e.g. `auth.expired`).

```ts
import { Data } from 'effect'

export class AuthMissing extends Data.TaggedError('AuthMissing')<{ hint?: string }> {}
export class AuthExpired extends Data.TaggedError('AuthExpired')<{ hint?: string }> {}
export class AuthDenied extends Data.TaggedError('AuthDenied')<{ details?: unknown }> {}
export class AuthProbe extends Data.TaggedError('AuthProbe')<{ cause?: unknown }> {}

export class NetworkTimeout extends Data.TaggedError('NetworkTimeout')<{ url: string }> {}
export class NetworkDns extends Data.TaggedError('NetworkDns')<{ host: string }> {}
export class NetworkRefused extends Data.TaggedError('NetworkRefused')<{ url: string }> {}

export class ValidationFailed extends Data.TaggedError('ValidationFailed')<{
  message: string
  details?: unknown
}> {}
export class ValidationXml extends Data.TaggedError('ValidationXml')<{
  message: string
  line?: number
}> {}

export class ServerError extends Data.TaggedError('ServerError')<{
  status: number
  message: string
  details?: unknown
}> {}
export class ResourceNotFound extends Data.TaggedError('ResourceNotFound')<{
  kind: string
  ref: string
}> {}

export class ConfigMissingApiUrl extends Data.TaggedError('ConfigMissingApiUrl')<{}> {}
export class ConfigMissingToken extends Data.TaggedError('ConfigMissingToken')<{}> {}
export class ConfigMigrationFailed extends Data.TaggedError('ConfigMigrationFailed')<{
  cause: unknown
}> {}

export class ProfileNotFound extends Data.TaggedError('ProfileNotFound')<{ name: string }> {}
export class ProfileNoneActive extends Data.TaggedError('ProfileNoneActive')<{}> {}
export class ProfileInvalidName extends Data.TaggedError('ProfileInvalidName')<{ name: string }> {}
export class WriteRequiresExplicit extends Data.TaggedError('WriteRequiresExplicit')<{
  profile: string
  apiUrl: string
}> {}

// Update* mirror the existing MxsErrorCode.Update* set: UpdateDevEnvironment,
// UpdateTransientInstall, UpdatePmUnknown, UpdateRegistryUnreachable,
// UpdateNodeIncompatible, UpdateSpawnFailed, UpdatePermissionDenied.

export class ArgvParse extends Data.TaggedError('ArgvParse')<{ message: string }> {}
export class Generic extends Data.TaggedError('Generic')<{ message: string }> {}

export type CliError =
  | AuthMissing | AuthExpired | AuthDenied | AuthProbe
  | NetworkTimeout | NetworkDns | NetworkRefused
  | ValidationFailed | ValidationXml
  | ServerError | ResourceNotFound
  | ConfigMissingApiUrl | ConfigMissingToken | ConfigMigrationFailed
  | ProfileNotFound | ProfileNoneActive | ProfileInvalidName | WriteRequiresExplicit
  | UpdateDevEnvironment | UpdateTransientInstall | UpdatePmUnknown
  | UpdateRegistryUnreachable | UpdateNodeIncompatible | UpdateSpawnFailed
  | UpdatePermissionDenied
  | ArgvParse | Generic
```

### 5.2 Tag ↔ code bijection

A pure function preserves the wire-format `code` strings (`auth.expired`, `profile.write_requires_explicit`, etc.) so envelope output and test assertions stay byte-equal:

```ts
const tagToCode: Record<CliError['_tag'], string> = {
  AuthMissing: 'auth.missing',
  AuthExpired: 'auth.expired',
  // ... full mapping of MxsErrorCode entries
}

export const tagToCodeOf = (tag: CliError['_tag']): string => tagToCode[tag]
```

### 5.3 Exit codes

`exitCodeForTag` mirrors current `exitCodeForError`:

| Tag(s) | Exit code |
|---|---|
| `ArgvParse` | 2 |
| `AuthMissing`, `AuthExpired`, `AuthDenied`, `AuthProbe` | 3 |
| `NetworkTimeout`, `NetworkDns`, `NetworkRefused`, `WriteRequiresExplicit`, `ProfileNoneActive` | 4 |
| `ValidationFailed`, `ValidationXml`, `ProfileInvalidName`, `ConfigMissingApiUrl`, `ConfigMissingToken` | 5 |
| `ServerError` | 6 |
| `ResourceNotFound` | 7 |
| `UpdatePmUnknown` | 70 |
| `UpdatePermissionDenied` | 73 |
| `UpdateRegistryUnreachable` | 75 |
| everything else | 1 |

### 5.4 Error envelope (wire format)

`Renderer.emitError` produces the same JSON shape as today (`MxsError.toJSON`):

```ts
const toErrorEnvelope = (err: CliError) => ({
  ok: false as const,
  code: tagToCodeOf(err._tag),
  message: err.message ?? defaultMessageFor(err._tag),
  ...('details' in err && err.details !== undefined ? { details: err.details } : {}),
  ...('hint' in err && err.hint !== undefined ? { hint: err.hint } : {}),
})
```

### 5.5 Error source mapping

| Source | TaggedError |
|---|---|
| `Schema.decode` failure on flag input | `ValidationFailed` |
| `Schema.decode` failure on API response | `ServerError` (status=200, "response shape mismatch") |
| `HttpClient` network error | `NetworkTimeout` / `NetworkDns` / `NetworkRefused` (catchTag in service) |
| HTTP 401 | `AuthExpired` |
| HTTP 403 | `AuthDenied` |
| HTTP 404 | `ResourceNotFound` |
| HTTP 4xx (other) | `ValidationFailed` |
| HTTP 5xx | `ServerError` |
| `Effect.tryPromise(() => betterAuth.*)` | `AuthProbe` (with `cause`) |
| `Effect.tryPromise(() => haklex.parseLitexml)` | `ValidationXml` |
| `FileSystem.readFile` for profile config | `ProfileNotFound` |
| `FileSystem.readFile` for user `--file` | `ValidationFailed` |

## 6. Testing

### 6.1 Runner

- Vitest stays.
- Add `@effect/vitest` for `it.effect` / `it.scoped` — lets test bodies be Effect programs with automatic runtime + Test layer.

### 6.2 Test layers

| Layer | Tier | Example |
|---|---|---|
| Pure unit | Gate decision, payload builder, exit code map, tag↔code bijection, schema decode | `test/domain/gate.test.ts`, `errors.test.ts` |
| Service unit | Single service with in-memory `FileSystem` and mock `HttpClient` | `test/services/Profile.test.ts`, `Config.test.ts` |
| Handler integration | Run command handler with `TestAppLayer` | `test/cli/post/create.test.ts` |
| E2E bin | `spawn` `tsx src/bin/mxs.ts`, assert stdout/exit | `test/bin/mxs.test.ts` (unchanged) |

### 6.3 Test layer helper

```ts
// test/helper/test-layers.ts
import { FileSystem, Path } from '@effect/platform'
import { HttpClient } from '@effect/platform'
import { Layer, Effect } from 'effect'

export const memoryFs = new Map<string, string>()

export const TestFileSystemLayer = FileSystem.layerNoop({
  readFileString: (p) =>
    memoryFs.has(p)
      ? Effect.succeed(memoryFs.get(p)!)
      : Effect.fail(new Error(`ENOENT: ${p}`)),
  writeFileString: (p, s) => Effect.sync(() => memoryFs.set(p, s)),
  // ...
})

export const TestHttpClientLayer = /* mock HttpClient */

export const TestAppLayer = Layer.mergeAll(
  TestFileSystemLayer,
  TestHttpClientLayer,
  Path.layer,
  Config.Default,
  Profile.Default,
  Auth.Default,
  Api.Default,
  Renderer.Default,
  Editor.Default,
  // ...
)
```

### 6.4 TestClock for time-sensitive tests

- `UpdateNotifier` 24h cache → `TestClock.adjust(Duration.hours(25))`.
- `Auth.ensureFresh` exp check → inject `Clock`.

### 6.5 Migration of existing tests

Existing test files (`test/core/*.test.ts`, `test/commands/*.test.ts`, `test/bin/mxs.test.ts`) keep their **assertion surface** (exit codes, stdout JSON shape, error code strings) as regression oracles. Implementation-layer imports change (`../../src/core/...` → service/handler paths), but assertions stay byte-equal.

Any assertion that breaks signals an intentional behavior change per Q3-b — these must be enumerated in the PR's "behavior changes" section for review.

### 6.6 Coverage

CI gate: `vitest --coverage`. New code coverage must be **≥ current ~70% line coverage**. Drop blocks merge.

## 7. Build & migration

### 7.1 Build

`tsdown` stays. Update `tsdown.config.ts`:

```ts
export default defineConfig({
  entry: { index: 'src/index.ts', mxs: 'src/bin/mxs.ts' },
  format: 'esm',
  target: 'node22',
  platform: 'node',
  dts: { entry: 'src/index.ts' },
  external: ['better-auth', '@haklex/rich-headless', '@haklex/rich-litexml'],
  // effect + @effect/* are inlined
})
```

`bin/mxs.cjs` shim (the `createRequire`-based launcher) is unchanged.

Expected bundle size: ~280 KB → ~430 KB (+150 KB Effect runtime). Cold start: +~30 ms. Both acceptable for a user-operated CLI.

### 7.2 Version

- `@mx-space/cli` jumps to **v0.3.0**.
- 0.2.x line is marked deprecated in README and CHANGELOG.
- CLI surface (commands, flags, exit codes, output modes) is preserved per Q3-b — users upgrade transparently.

### 7.3 In-PR commit sequence

The rewrite ships as one PR. Within the PR, commits are sequenced for incremental review:

1. `chore(cli): add Effect-TS deps; tsdown config tweak; new src-next/ scaffold`
2. `feat(cli): domain errors — TaggedError tree + tag↔code bijection + envelope adapter`
3. `feat(cli): Config + Profile + Migration services + Layers + unit tests`
4. `feat(cli): Api + Auth + Gate + 401-refresh + write-gate + integration tests`
5. `feat(cli): Editor + Renderer + Lexical + 5 output modes + spec tests`
6. `feat(cli): UpdateNotifier + self-update + commands/update via Effect`
7. `feat(cli): @effect/cli command tree — auth/profile/post/note/page/category/topic/config`
8. `feat(cli): v2/v3 service placeholders (Ai/Backup/Cache interfaces only)`
9. `feat(cli): bin/mxs.ts wire-up; AppLayer; top-level catchAll + exit codes`
10. `chore(cli): drop old src/; rename src-next/ → src/; full test suite green`
11. `docs(cli): README rewrite — v0.3 note + behavior-changes appendix`

Every commit must keep `pnpm test`, `pnpm lint`, `pnpm typecheck` green. Step 10 is a pure rename, no logic change.

### 7.4 Rollback

Main branch is `master`. If a regression surfaces post-publish:

1. Cherry-pick the relevant fix onto a `0.2.4` patch from the pre-rewrite SHA, publish with dist-tag `latest`.
2. Move `0.3.x` to dist-tag `next` temporarily.
3. After fixing, restore: `npm dist-tag add @mx-space/cli@0.3.x latest`.

`mxs update` follows `latest`, so rollback requires no CLI code changes.

### 7.5 Documentation

- `README.md` — command table preserved; add a "v0.3 internal rewrite on Effect-TS" note up top.
- `ROADMAP.md` — v2/v3 sections annotated "framework reserved, impl pending".
- New (optional) `docs/architecture.md` — Layer dependency diagram + "how to add a new command" walkthrough.

## 8. Risks & open items

### 8.1 Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | `@effect/cli` is pre-1.0; API may shift | Effect minor upgrade can break command tree | Pin tilde (`~`), dedicated upgrade PRs; isolate `Command`/`Options`/`Args` via `cli/_facade.ts` so breaking changes land in one file |
| 2 | Effect learning curve | Higher maintenance cost; contributor friction | `docs/architecture.md` covers the five core patterns (`Tag`, `Layer.mergeAll`, `Effect.gen`, `tryPromise`, `catchTag`); add `templates/new-command.ts` |
| 3 | Bundle size +54% | Slower `npm install`, +30 ms cold start | Accepted — user-operated CLI, not lambda; enable `tsdown` treeshaking |
| 4 | `Schema` types duplicate `@mx-space/api-client` types | Two-sync maintenance | Prefer importing types from `api-client`; only define schemas for shapes the CLI parses; fall back to `Schema.Any` + dev-only warn when a schema is missing |
| 5 | `better-auth` device-flow internals are opaque under `Effect.tryPromise` | Lost cancellation / retry semantics | Accepted — same as today; future work can replace device-flow but not in v0.3 |
| 6 | Existing tests' byte-level assertions break | Loss of regression oracle | Lock tag↔code bijection + envelope adapter at commit 2; any break enters PR's "behavior changes" appendix with explicit review |
| 7 | `NodeRuntime.runMain` signal handling differs from current `process.exit` timing | stdout flush race; wrong exit code on signal | E2E spawn tests assert stdout-flushed-before-exit |

### 8.2 Open items (decide during implementation)

1. **HTTP retry** — Effect `Schedule.exponential` is one line away. v0.3 recommendation: **off** (match current behavior). Revisit in v2.
2. **Logger** — Effect `Logger` vs current `process.stderr.write`. `--verbose` could go via `Logger.withMinimumLogLevel(LogLevel.Debug)`, but the current verbose format (`METHOD URL → STATUS (Xms)`) requires a custom formatter. Decide during commit 4.
3. **Envelope streaming** — Effect `Stream` supports NDJSON. v0.3 recommendation: **off** (keep buffered output).
4. **`profile current` symlink vs JSON pointer** — current symlink behavior is Windows-fragile. v0.3 recommendation: **keep symlink semantics**, port via `FileSystem.symlink`.
5. **Dev default profile** — `shouldUseDevDefaultProfile` logic must port; place in `Profile.resolve` rather than at the entry point.

### 8.3 Explicit non-goals

- No `better-auth` reimplementation.
- No `@clack/prompts` replacement.
- No `@effect/typeclass` / `@effect/printer-ansi` (YAGNI).
- No v2/v3 commands (interface placeholders only).
- No CLI surface changes (commands, flags, output modes, exit codes).

## 9. Acceptance criteria

The rewrite is done when:

1. Every command listed in §2 "In scope" runs and produces output byte-equal to v0.2.x for the same input (assertion oracle = existing tests).
2. Every existing exit code is preserved per the mapping in §5.3.
3. `vitest --coverage` line coverage ≥ 70%.
4. `pnpm test`, `pnpm lint`, `pnpm typecheck` all green on each commit in the PR.
5. Bundle size and cold start are within the budgets in §7.1.
6. `docs/architecture.md` exists with the five core patterns and the "add a new command" walkthrough.
7. PR description lists any "behavior changes" (per Q3-b) with explicit per-item rationale.
