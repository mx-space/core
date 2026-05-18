# @mx-space/cli — `mxs update` (Self-Update) Design

Status: approved
Owner: Innei
Date: 2026-05-18
Target package: `packages/cli` (`@mx-space/cli`, binary `mxs`)

## 1. Motivation

`@mx-space/cli` ships through npm and is installed globally via `npm`, `pnpm`, `yarn`, or `bun`. Today users have no in-CLI way to discover or apply new releases. We need:

- A **passive update notifier** that surfaces new versions without interrupting normal workflow.
- An **explicit `mxs update` command** that detects how the binary was installed and runs the appropriate global-install command for the user.

Both pieces must stay quiet in automation contexts (CI, JSON output, non-TTY).

## 2. User-facing surface

### 2.1 Command

```
mxs update                       # detect PM, run global upgrade
  --check                        # compare versions only, do not install
  --prerelease                   # use the `next` dist-tag channel
  --pm <npm|pnpm|yarn|bun>       # force the package manager (skip detection)
  --force                        # bypass the 24h notifier cache; always query the registry
  --yes                          # skip the confirmation prompt
  --dry-run                      # print the spawn command without executing
```

`--dry-run` reuses the existing global `--dry-run` flag and scopes its effect to this command.

### 2.2 Environment variables

| Variable | Effect |
|---|---|
| `MXS_NO_UPDATE_CHECK=1` | Disables passive notifier entirely (still allows explicit `mxs update`). |
| `MXS_UPDATE_CHANNEL=stable\|next` | Channel honored by the passive notifier (default `stable`). |

### 2.3 Exit codes

| Code | Meaning |
|---|---|
| `0` | Already up to date, or upgrade succeeded |
| `1` | Generic failure (dev env, spawn non-zero, Node incompat) |
| `70` | Package manager detection failed and no `--pm` provided |
| `73` | Permission denied (EACCES) — sudo hint emitted |
| `75` | Network / registry unreachable |

### 2.4 Notification format

Single stderr line, emitted on the *next* run after a new version was discovered:

```
mxs update available: 0.2.0 → 0.3.0   run 'mxs update' to upgrade
```

## 3. Module layout

```
packages/cli/src/
  core/
    self-update.ts         # PM detection, registry query, semver compare, command builder
    update-notifier.ts     # passive notifier: cache, throttle, async fire-and-forget
  commands/
    update/
      run.ts               # `mxs update` action
  bin/
    mxs.ts                 # register command + preAction hook calls maybeNotify()
```

New dependency: **`semver`** (small, battle-tested, used for compare + engines.node satisfies).

Registry access: native `fetch` (Node ≥22 has it).

### 3.1 `self-update.ts` API

```ts
export const PACKAGE_NAME = '@mx-space/cli'

export type PmKind = 'npm' | 'pnpm' | 'yarn' | 'bun'

export type PmDetection =
  | { kind: 'global'; pm: PmKind; realPath: string }
  | { kind: 'dev'; reason: 'monorepo-source' | 'monorepo-dist'; realPath: string }
  | { kind: 'transient'; cache: 'npx' | 'pnpm-dlx' | 'bunx'; realPath: string }
  | { kind: 'unknown'; realPath: string }

export function detectPackageManager(argv1: string): PmDetection

export interface RegistryHit {
  version: string
  engines?: { node?: string }
  tarball?: string
  etag?: string
}

export function fetchLatestVersion(
  channel: 'stable' | 'next',
  opts?: { etag?: string; signal?: AbortSignal; registry?: string },
): Promise<RegistryHit | { notModified: true; etag?: string }>

export function compareSemver(current: string, latest: string): -1 | 0 | 1

export function buildUpgradeCommand(
  pm: PmKind,
  channel: 'stable' | 'next',
): { cmd: string; args: string[] }

export function spawnUpgrade(
  cmd: string,
  args: string[],
  opts?: { cwd?: string },
): Promise<{ status: number; stderr: string }>
```

Implementation notes:

- `detectPackageManager` resolves `argv1` with `fs.realpathSync`, normalizes the path (lowercase on Windows), and matches known fragments:
  - **dev**: contains `packages/cli/src` or `packages/cli/dist`
  - **transient**: contains `/_npx/`, `/.pnpm-store/dlx/`, `/.bun/install/cache/`
  - **global**:
    - `/pnpm/global/` or `Library/pnpm/global/` → pnpm
    - `/.bun/install/global/` → bun
    - `/.config/yarn/global/` or `/yarn/global/` → yarn
    - everything else under a `node_modules/@mx-space/cli/` path → npm (default)
  - **unknown**: none matched
- `buildUpgradeCommand` returns:
  - `npm`: `npm`, `['install', '-g', '@mx-space/cli@latest']`
  - `pnpm`: `pnpm`, `['add', '-g', '@mx-space/cli@latest']`
  - `yarn`: `yarn`, `['global', 'add', '@mx-space/cli@latest']`
  - `bun`: `bun`, `['add', '-g', '@mx-space/cli@latest']`
  - For `--prerelease`, `@latest` is replaced with `@next`.
- On Windows, `spawnUpgrade` uses `shell: true` to resolve `.cmd` shims.
- `fetchLatestVersion` queries `https://registry.npmjs.org/<package>/<dist-tag>` with `If-None-Match`. Returns the 304 sentinel when the etag matches.

### 3.2 `update-notifier.ts` API

```ts
export interface CachedState {
  last_check_ts: number
  latest_version?: string
  etag?: string
}

export function readCache(): CachedState | null
export function writeCacheAtomic(state: CachedState): void

export function shouldSkipNotify(ctx: NotifyContext): boolean

export function maybeNotify(ctx: NotifyContext): Promise<void>
//                                                ^ never throws; fire-and-forget
```

`NotifyContext` includes `quiet`, `json`, `output`, `commandName`, `parentName`, plus injected `now()` and `fetchImpl` for testing.

Cache path: `path.join(getConfigDir(), 'update-check.json')` — same root as the existing `config-store.ts`.

## 4. `mxs update` flow

```
1. realPath = fs.realpathSync(process.argv[1])
2. det = detectPackageManager(realPath)
   - dev       → throw MxsError('update.dev_environment')
   - transient → throw MxsError('update.transient_install')
   - unknown   → if --pm given, accept; else throw MxsError('update.pm_unknown')
   - global    → continue with det.pm

3. pm = --pm ?? det.pm
   channel = --prerelease ? 'next' : 'stable'

4. hit = await fetchLatestVersion(channel)
   - fetch error / non-2xx / timeout → throw MxsError('update.registry_unreachable')

5. cmp = compareSemver(currentVersion, hit.version)
   - cmp >= 0 → emitInfo('already up to date'), exit 0
   - cmp <  0 → continue

6. if hit.engines?.node and !semver.satisfies(process.version, hit.engines.node):
     throw MxsError('update.node_incompatible')

7. emitInfo(`${current} → ${latest}`)

8. if --check → exit 0

9. confirmation:
   - if --yes or non-TTY → skip
   - else @clack/prompts.confirm()

10. cmd, args = buildUpgradeCommand(pm, channel)
    - if --dry-run → print cmd + args, exit 0
    - spawn with stdio: 'inherit'
      - EACCES in stderr → MxsError('update.permission_denied') with sudo hint
      - status !== 0     → MxsError('update.spawn_failed')
      - status === 0     → emitSuccess(`upgraded to ${latest}; restart any long-running mxs process`), exit 0
```

The running process intentionally does **not** re-exec the new binary. The next invocation picks up the new code naturally; a message tells the user to restart any long-running mxs process.

## 5. Passive notifier flow

`bin/mxs.ts` preAction hook appends one line at the end:

```ts
void maybeNotify({ ... })
```

`maybeNotify` logic:

```
1. Silence gates — return immediately if any:
   - opts.quiet
   - opts.json
   - opts.output === 'json'
   - process.env.CI truthy
   - process.env.MXS_NO_UPDATE_CHECK === '1'
   - !process.stderr.isTTY
   - actionCommand.name() === 'update' (parent === 'update' too)

2. cache = readCache()

3. if cache and now - cache.last_check_ts < 24h and !--force:
     if cache.latest_version and compareSemver(current, cache.latest_version) < 0:
       print notification line
     return

4. Async fetch (AbortSignal.timeout(3000), unrefed):
     - failure → silently swallow, but still writeCacheAtomic({ last_check_ts: now, ...cache })
     - 304     → writeCacheAtomic({ last_check_ts: now, latest_version, etag })
     - 200     → writeCacheAtomic({ last_check_ts: now, latest_version: hit.version, etag: hit.etag })
     - if new version > current → defer notification to next run (do not print now)
```

Rationale:

- **No-print-on-fetch**: avoids interleaving the notification with the command's own output, especially for streamed/long-running commands.
- **Fire-and-forget**: the promise is not awaited; the fetch socket uses `AbortSignal.timeout(3000)` and `.unref()` so the process can exit cleanly even if the request is still in-flight.
- **Atomic write**: write to `update-check.json.tmp`, then `rename`.

Registry endpoint is the public npm registry. Private registry mirrors are out of scope for v1; users on mirrors should set `MXS_NO_UPDATE_CHECK=1`.

## 6. Error matrix

New `MxsErrorCode` entries:

| Code | Trigger | Hint | Exit |
|---|---|---|---|
| `update.dev_environment` | realPath inside `packages/cli/src` or `dist` | "dev install detected; pull git instead" | 1 |
| `update.transient_install` | realPath in npx/dlx/bunx cache | "transient run; install globally first: `<pm> i -g @mx-space/cli`" | 1 |
| `update.pm_unknown` | unknown realPath without `--pm` | "unable to detect package manager; pass --pm <npm\|pnpm\|yarn\|bun>" | 70 |
| `update.registry_unreachable` | fetch throws / non-2xx / timeout | "check network or set MXS_NO_UPDATE_CHECK=1" | 75 |
| `update.node_incompatible` | latest engines.node not satisfied | "upgrade Node to <required> first" | 1 |
| `update.spawn_failed` | child status !== 0 (no EACCES) | "rerun with --dry-run to inspect the command" | 1 |
| `update.permission_denied` | child stderr contains EACCES | "rerun with sudo: `sudo <cmd>`" | 73 |

## 7. Cross-cutting concerns

- **Windows**: detect paths via `path.normalize` + lowercase. Use `shell: true` for spawn so `pnpm.cmd` resolves.
- **Node version managers** (nvm/Volta/fnm/asdf): heuristics catch the standard PM prefixes; fall through to `update.pm_unknown` if the layout is exotic — user passes `--pm` to override.
- **Private registries / mirrors**: v1 hard-codes `https://registry.npmjs.org`. README notes the `MXS_NO_UPDATE_CHECK` opt-out.
- **Concurrent `mxs update`**: not locked at the CLI level; downstream PM (`pnpm`, `npm`) tolerates or locks itself.
- **Cache corruption**: `JSON.parse` failure → treat as no cache, re-query, overwrite.
- **Profile orthogonality**: `mxs update` does not read or write any profile data.

## 8. Testing

All Vitest unit tests. No real spawn, no real registry calls.

`test/self-update.spec.ts`:

- `detectPackageManager` fixtures:
  - npm Linux: `/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs` → `{ kind:'global', pm:'npm' }`
  - npm macOS Apple Silicon: `/opt/homebrew/lib/node_modules/@mx-space/cli/...`
  - pnpm macOS: `/Users/x/Library/pnpm/global/5/node_modules/@mx-space/cli/...`
  - pnpm Linux: `/home/x/.local/share/pnpm/global/5/node_modules/@mx-space/cli/...`
  - bun: `/Users/x/.bun/install/global/node_modules/@mx-space/cli/...`
  - yarn: `/Users/x/.config/yarn/global/node_modules/@mx-space/cli/...`
  - dev source: `/repo/packages/cli/src/bin/mxs.ts`
  - dev dist: `/repo/packages/cli/dist/bin/mxs.mjs`
  - npx cache: `/Users/x/.npm/_npx/abc/node_modules/@mx-space/cli/...`
  - Windows npm: `C:\Users\x\AppData\Roaming\npm\node_modules\@mx-space\cli\...`
- `compareSemver` covers stable vs prerelease ordering.
- `buildUpgradeCommand` snapshot per `(pm × channel)`.

`test/update-notifier.spec.ts`:

- 24h throttle: mock `now()`, assert no fetch within window.
- Silence gates: each of CI / isTTY=false / quiet / json / `MXS_NO_UPDATE_CHECK` independently suppresses.
- Atomic write: mocked fs, assert `.tmp` write + rename order.
- Corruption recovery: planted invalid JSON triggers re-query.
- 304 path: `last_check_ts` updated, `latest_version` preserved.

Mocks:

- `globalThis.fetch` replaced with `vi.fn`.
- `node:child_process` mocked via `vi.mock`.
- fs via `vi.mock('node:fs')` or `memfs`.

Manual smoke (documented in README): `mxs update --dry-run`, `mxs update --check`, `MXS_NO_UPDATE_CHECK=1 mxs post list`.

## 9. Out of scope (v1)

- Self-replacing single-file binary (only npm-based install supported).
- Private registry / mirror configuration.
- Automatic re-exec of the upgraded binary inside the same process.
- Rollback on partial install (delegated to PM).
- Lock files for concurrent `mxs update` invocations.

## 10. Open follow-ups (after ship)

- Optional `npm_config_registry` honoring once mirror users surface.
- `mxs update --to <version>` for pinning to a specific release.
- Telemetry for opt-in update success rate (only if a broader telemetry policy is added; not part of this design).
