# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package

`@mx-space/cli` — the `mxs` binary. Command-line interface for managing a deployed `mx-core` instance (auth, content, configuration). User-facing surface and behavior are documented in `README.md`; internal architecture is documented in `docs/architecture.md`. Forward roadmap is in `ROADMAP.md`.

The implementation language is **Effect-TS** on top of `@effect/cli` + `@effect/platform`. There is intentionally no Commander, no global mutable state, and no ad-hoc Promise handling — see "Architectural conventions" below.

## Commands

All commands run from this package directory (`packages/cli`). Node 22+, pnpm via Corepack.

| Task | Command |
| --- | --- |
| Run from source (live) | `pnpm dev -- <args>` — `tsx src/bin/mxs.ts` |
| Run locally via PATH | `mxs <args>` — `.envrc` puts `node_modules/.bin` on PATH; `pnpm install` runs `setup-local-bin.cjs` and symlinks `mxs` to `bin/mxs.cjs` |
| Typecheck | `pnpm typecheck` — `tsc -p tsconfig.json --noEmit` |
| Test (all) | `pnpm test` — Vitest, single run |
| Test (watch) | `pnpm test:watch` |
| Test (one file) | `pnpm test -- test/cli/post/list.test.ts` |
| Test (pattern) | `pnpm test -- -t "resolves an active profile"` |
| Bundle for publish | `pnpm package` / `pnpm build` — `tsdown` → `dist/` |

Lint/format are not wired at the package level — the workspace root runs them. Per the global rule, only check files you actually modified.

After implementing or changing **user-facing CLI behavior** (commands, flags, output modes, auth, configuration, file formats), update `README.md` in the same change set. This is enforced by `agents.md`. Internal refactors, test-only diffs, or bug fixes with no observable surface change do not need README updates.

## Architecture

Read `docs/architecture.md` for the full walkthrough. The minimum mental model:

- **Services** live in `src/services/*.ts` as `Context.Tag` + `Layer` pairs. The `.Default` layer is the production wiring; tests substitute alternatives. Most services are wired in `src/layers/App.ts`. **Two exceptions** — `Api` and `Resolver` depend on per-invocation global flags (`--api-url`, `--token`, `--api-key`, `--profile`, `--dry-run`, `--lang`) and are constructed inside `src/bin/mxs.ts` *after* `parseGlobalFlags`, then merged in via `Layer.provideMerge`.
- **Commands** live in `src/cli/<resource>/<verb>.ts` as small `Command.make` + `Effect.gen` blocks that `yield*` the services they need. The aggregator file `src/cli/<resource>/index.ts` wires verbs together with `Command.withSubcommands` and is registered on the root command in `src/bin/mxs.ts`. Keep handlers thin — non-trivial logic belongs in services.
- **Errors** are `Data.TaggedError` classes in `src/domain/errors.ts`. Exit-code mapping is `exitCodeForTag` (single source of truth). Use `Effect.catchTag('Foo', ...)` for narrow recovery; reserve `catchAll` for the top-level shim in `bin/mxs.ts`.
- **External Promise APIs** (fs beyond `@effect/platform`, editor subprocess, package-manager spawn, lexical bridges) are wrapped with `Effect.tryPromise` (or `Effect.try` for sync throws). Do not reach for `Effect.runPromise`/`unsafeRun*` inside handlers — if a service boundary feels wrong, fix the service, not the call site.
- **Global flags are pre-parsed.** `src/domain/runtime-flags.ts#parseGlobalFlags` strips global flags from argv *before* `@effect/cli` sees them, then propagates them via `FiberRef`s (`currentOutputOptions`, `currentDryRun`). `@effect/cli` does not know about `--api-url`, `--json`, etc. — do not declare them on subcommands.
- **Help rendering is overridden** at the root and group levels (`src/cli/help/`). Bare `mxs`, `mxs --help`, `mxs <group>`, and `mxs <group> --help` are intercepted in `bin/mxs.ts#detectHelpTarget` and rendered by our code; verb-level help (`mxs post create --help`) is left to `@effect/cli`. When adding a new top-level group, register it in the help data builders too.
- **Output is centralized** in `src/services/Renderer/` (`emit` for typed views, `emitSuccess`/`emitError`/`emitInfo`/`emitWarn`/`emitInfoBlock`). Modes: `pretty-json`, `json` (envelope `{ ok, data }`), `readable`, `llm`, `envelope`. The renderer reads the `OutputOptions` FiberRef — don't pass options into handlers.
- **Lexical content** is processed through `@haklex/rich-headless` and `@haklex/rich-litexml` via `src/services/Lexical.ts`. LiteXML `<mxpost>`/`<mxnote>` envelopes are parsed to Lexical JSON before sending to the server.

## Tests

Vitest with `@effect/vitest`. Use `it.effect` to run an `Effect` directly and provide layers with `Effect.provide`. Two custom helpers cover the common substitutions:

- `test/helper/test-fs.ts` — in-memory `FileSystem` (used wherever a service reads/writes disk: `Config`, `Profile`, `Migration`).
- `test/helper/test-http.ts` — canned-response `HttpClient` (used by `Api`, `Resolver`, `Auth`).

Integration tests under `test/integration/` spawn the actual binary via `child_process.spawn` and assert on stdout/stderr/exit code — these cover the CLI surface end-to-end. See `cli-error-envelope.test.ts` for the canonical pattern.

## Local development notes

- `.envrc` adds `node_modules/.bin` to PATH via direnv — `mxs` typed at the prompt then resolves to the local shim which loads `src/bin/mxs.ts` via `tsx`, **not** the published dist build. This requires `direnv allow` once.
- Running from source automatically opts into the `local-dev` default profile (see `LOCAL_DEV_ENV` in `src/services/Config.ts`), so a bare invocation does not need an active profile.
- The published JavaScript API surface is intentionally minimal — `src/index.ts` re-exports only `run` plus the error-tag table. Do not export internal services.

## When adding a new command

1. New verb file `src/cli/<resource>/<verb>.ts` — `Command.make` + small `Effect.gen` handler that `yield*`s services.
2. Register in `src/cli/<resource>/index.ts` aggregator's `Command.withSubcommands`.
3. If a new resource group: register in `src/bin/mxs.ts#rootCmd` and in `src/cli/help/` (group metadata + help data).
4. If a new capability: add a service under `src/services/`, register its layer in `src/layers/App.ts` (or in `bin/mxs.ts` if it depends on flags).
5. Add a unit test under `test/cli/<resource>/<verb>.test.ts` using `it.effect` + canned layers, plus an integration test entry if there is observable output.
6. Update `README.md` per the documentation rule.
