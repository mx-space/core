# Admin Monorepo Migration

## Overview

The MX Admin SPA (`@mx-admin/admin`) has been moved into this monorepo at
`apps/admin` and is now **built locally as part of the core build and release**.

Previously the core build downloaded a prebuilt admin release from GitHub
(`download-latest-admin-assets.js`, driven by the `dashboard` field in
`apps/core/package.json`). That download path is gone. The admin dashboard is
now compiled from source in this workspace with
`pnpm --filter @mx-admin/admin run build`, and its `dist/` output is placed
under `out/admin` so the server resolves it at runtime.

The asset layout contract is unchanged from the old download:
`out/admin/index.html` sits at the asset root, with `out/admin/assets/` and
`out/admin/js/` alongside it (the Vite `dist/` wrapper is flattened). In
production the server resolves `BUNDLED_ADMIN_ASSET_PATH = join(cwd, './admin')`,
i.e. `/app/admin/index.html` in the container.

## File-by-File Changes

### Build chain

- **`apps/core/zip-asset.sh`** — Replaced the
  `node ./apps/core/download-latest-admin-assets.js` step with a local build:
  `pnpm --filter @mx-admin/admin run build`, then
  `rm -rf out/admin && mkdir -p out/admin && cp -R ./apps/admin/dist/. out/admin/`.
  The `cp -R dist/.` form copies dist *contents* into `out/admin`, flattening the
  `dist/` wrapper. All other steps (copy `out`, copy `ecosystem.config.cjs`,
  `cd out && zip`, cleanup) are preserved. It then stamps `out/admin/version` with
  the admin package version
  (`node -p "require('./apps/admin/package.json').version"`) so the runtime can
  compare the built-in admin against runtime-downloaded copies.
- **`apps/core/download-latest-admin-assets.js`** — Deleted (`git rm`).
- **`apps/core/get-latest-admin-version.js`** — Deleted (`git rm`).
- **`apps/core/scripts/bump-admin-version.js`** — Created. See
  [Admin version auto-bump](#admin-version-auto-bump) below.
- **`apps/core/package.json`** — Removed the `dashboard` field entirely; in
  `bump.before`, replaced `node get-latest-admin-version.js` with
  `node scripts/bump-admin-version.js` (path relative to `apps/core`).

### Dockerfile

- **`dockerfile`** (builder stage) — Removed
  `RUN node apps/core/download-latest-admin-assets.js` and replaced it with a
  local build + flat copy after the server `out` is assembled:
  `RUN pnpm --filter @mx-admin/admin run build` then
  `RUN mkdir -p ./out/admin && cp -R apps/admin/dist/. ./out/admin/`, then stamps
  `./out/admin/version` with the admin package version.
  The root `pnpm install` is a full-workspace install, so `@mx-admin/admin` deps
  are already present.
- The **runner stage** is untouched: `COPY --from=builder /app/out .` carries the
  server bundle, `migrations`, and the new `admin/` dir into `/app`.
- **`docker-entrypoint.sh`** — No change needed; it never touched admin assets.

### CI workflows

- **`.github/workflows/release.yml`** — Added one step after `Zip Assets`,
  `Publish admin assets to S3 (reserved)`. See
  [Reserved S3 update channel](#reserved-s3-update-channel). The admin build
  itself happens inside `Zip Assets` (which runs `zip-asset.sh`), so no extra
  build step was added.
- **`.github/workflows/ci.yml`** — **No changes.** `ci.yml` produces no release
  asset, so the S3 channel belongs only in `release.yml`.

### Workspace config

- **`pnpm-workspace.yaml`** — Appended `overrides`:
  `lucide-react: 1.8.0`, `@codemirror/state: 6.6.0`, `@codemirror/view: 6.42.1`,
  `@codemirror/commands: 6.10.3`, `@codemirror/language: 6.12.3`; appended
  `publicHoistPattern: - "*@codemirror*"`.
- **`patches/@lexical__code@0.40.0.patch`** — Deleted. The patch targeted a
  package/version absent from the tree (admin uses `@lexical/*@^0.44.0`); nothing
  was wired into `patchedDependencies`.
- **Root `package.json` `scripts`** — Appended `dev:admin`, `build:admin`,
  `typecheck:admin`, `lint:admin`, each proxying `pnpm -C apps/admin run <task>`.

### Admin app

- **`apps/admin/`** — The full admin app was copied in. Two small edits were
  needed to typecheck cleanly inside this monorepo:
  - `tsconfig.json` — added `"ignoreDeprecations": "6.0"` (TS 6.0.3, forced by the
    workspace override, hard-errors on the deprecated `baseUrl` otherwise).
  - `package.json` — added `@babel/types: ^7.29.3` to `devDependencies`.
    `vite-plugins/admin-routes/meta-parser.ts` imports it directly; in the old repo
    it resolved via a `*types*` `publicHoistPattern`, which mx-core does not have,
    so it is now an explicit dep.
  Vite uses its default `outDir` (`dist`); `vite.config.mts` was not changed.
- **`apps/admin/.env.example`** — Created, documenting `VITE_APP_BASE_API`,
  `VITE_APP_WEB_URL`, `VITE_APP_GATEWAY`, `VITE_APP_PUBLIC_URL` (empty
  `VITE_APP_PUBLIC_URL` = relative paths, the safe default).
- **`apps/admin/CLAUDE.md`** — Created, adapted to the monorepo context (dev via
  `pnpm -C apps/admin`, backend is the sibling app `apps/core`, Tailwind v4).

### Runtime (reserve-only, non-breaking)

- **`apps/core/src/app.config.ts`** — Added a commander option
  `--admin_update_s3_base_url <string>` (auto-mapped to env
  `ADMIN_UPDATE_S3_BASE_URL`) and exported a typed `ADMIN_UPDATE` config block.
  Defaults to empty string (disabled). No consumer is wired up.
- **`apps/core/src/modules/pageproxy/admin-download.manager.ts`** — Added a
  `TODO(admin-update S3)` comment documenting the future electron-style flow.
  No logic changed; the GitHub upgrade path remains the active behavior, with the
  locally-built admin as the default served asset.

### Runtime — `dashboard` field removal fallout (fixed)

Removing the `dashboard` field from `apps/core/package.json` broke the runtime,
which read `PKG.dashboard!.repo` / `.version`. In particular a top-level
destructure in `update.service.ts` (`const { repo } = PKG.dashboard!`) would have
crashed the server **at import/boot**. Rewired:

- **`apps/core/src/constants/admin.constant.ts`** (new) — exports
  `ADMIN_DASHBOARD_REPO` (`process.env.ADMIN_DASHBOARD_REPO || 'mx-space/mx-admin'`),
  the legacy GitHub upgrade source, now env-configurable and the seam toward S3.
- **`update.service.ts`** / **`pageproxy.service.ts`** — use `ADMIN_DASHBOARD_REPO`
  instead of `PKG.dashboard!.repo`; dropped the now-unused `PKG` import. Fixes the
  boot crash.
- **`update.controller.ts`** — `currentVersion` defaults to `'0.0.0'` and is
  overridden by the admin `version` file (below); dropped the `PKG` import.
- **`path.constant.ts`** — the bundled-vs-local admin version comparison now reads
  the admin `version` file via a new `readBundledAdminVersion()` instead of
  `PKG.dashboard.version`.
- **`pkg.util.ts`** — dropped the obsolete `dashboard` field from the `PKG` type.
- The build stamps `out/admin/version` (admin package version) so the runtime has a
  real bundled version to compare — see the build-chain/Dockerfile changes above.
- **`apps/core/download-latest-admin-assets-dev.js`** — deleted (orphan dev variant
  that read the removed `dashboard` field).

## Admin Version Auto-Bump

`apps/core/scripts/bump-admin-version.js` runs from `bump.before` on a core
release. It is pure Node (no new deps):

1. Resolve repo root via `git rev-parse --show-toplevel` (fallback
   `resolve(__dirname, '../../..')`).
2. Find the previous release tag via `git tag --list "v*" --sort=-v:refname`
   (first entry).
3. Diff `apps/admin` against that tag (`git diff --quiet <tag> HEAD -- apps/admin`).
4. If `apps/admin` changed, bump the PATCH of `apps/admin/package.json` and write
   it back with a trailing newline.
5. If unchanged, log `admin unchanged since <tag>, no bump`. If no tag exists,
   log and skip. Never throws on the no-tag case.

Current admin version: `7.0.1`.

## Independent Admin Release

`apps/admin` can be released on its own cadence — without cutting a core release —
when an admin-only change (e.g. a dashboard bugfix) should ship without a new
server version.

**Local, one command (recommended):**

```sh
scripts/release-admin.sh [patch|minor|major]   # default: patch
scripts/release-admin.sh minor --dry-run       # bump+commit+tag locally, no push
```

It bumps `apps/admin/package.json` (via `apps/core/scripts/bump-admin-release.js`),
commits, creates an `admin-v<version>` tag, and pushes branch + tag. The pushed tag
triggers the **Admin Release** workflow, which builds and publishes — mirroring how
the core `v*` release is cut. Pre-flight: refuses to run unless `apps/admin` is
tracked and its `package.json` is clean.

**Workflow** (`.github/workflows/admin-release.yml`) runs on two triggers:

- **`push: admin-v*`** (what the local script does) — reads the version from the
  tag; does **not** re-bump.
- **`workflow_dispatch`** (GitHub UI) — inputs `bump` (patch/minor/major) and
  `dry_run`; bumps, then commits + pushes the `admin-v<version>` tag itself.

Either way the build path is identical: `pnpm --filter @mx-admin/admin run build` →
zip `admin-<version>.zip` (top-level `dist/` wrapper) + write `latest.json`
(`version`, `file`, `url`, `sha256`, `tag`) → upload a GitHub workflow artifact
(always) → publish to Cloudflare R2 (see [R2 Update Channel](#r2-update-channel)).

Notes:

- This is a **deliberate** release, so it always bumps (no diff-based skip). The
  diff-based auto-bump lives only in the core-coupled path
  (`bump-admin-version.js`).
- `admin-v*` is a separate tag namespace from core's `v*`; the two release channels
  do not collide.
- The version commit is pushed to the branch the workflow ran from — run it from a
  branch where the GitHub Actions bot can push (or relax branch protection).
- Both channels version the same `apps/admin/package.json`, so the admin version can
  PATCH-inflate (an independent release, then a core release that re-detects the
  change). This is harmless.

## R2 Update Channel

Admin assets are published to **Cloudflare R2** (S3-compatible) — an electron-style
update channel. Both `release.yml` (every core release) and `admin-release.yml`
(independent releases) upload to it.

Config is hardcoded in each workflow's top-level `env:` (per request, instead of
repo variables):

| Key | Value |
| --- | --- |
| `R2_BUCKET` | `admin-r2` |
| `R2_ENDPOINT` | `https://de7ecb0eaa0a328071255d557a6adb66.r2.cloudflarestorage.com` |
| `ADMIN_PUBLIC_BASE` | `https://admin-r2.innei.dev` (custom domain → bucket root) |

Credentials come from repo **secrets** (an R2 *S3 API* token):
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

Uploads use `aws s3 cp --endpoint-url "$R2_ENDPOINT"` with `AWS_DEFAULT_REGION=auto`.
The recent aws-cli default checksum (CRC64-NVME, which R2 rejects) is disabled via
`AWS_REQUEST_CHECKSUM_CALCULATION=when_required` /
`AWS_RESPONSE_CHECKSUM_VALIDATION=when_required`. The core-release step is
`continue-on-error: true`, so an R2 hiccup never blocks a server release.

Objects land at the bucket root (the bucket is admin-dedicated):

- `https://admin-r2.innei.dev/admin-<version>.zip`
- `https://admin-r2.innei.dev/latest.json` — the manifest a future updater polls
  (`version`, `file`, `url`, `sha256`, `tag`).

**Runtime consumer is still deferred.** `ADMIN_UPDATE.s3BaseUrl` (env
`ADMIN_UPDATE_S3_BASE_URL`, in `apps/core/src/app.config.ts`) defaults to empty; no
runtime code fetches from R2 yet. The server still serves the built-in admin and the
legacy GitHub upgrade path. The remaining work is wiring the runtime to poll
`https://admin-r2.innei.dev/latest.json` and install newer versions.

## Dev Workflow

Admin and core run **separately** — there is no combined dev server.

- **Admin**: `pnpm -C apps/admin dev` (or `pnpm dev:admin` from repo root).
  Requires `apps/admin/.env` — copy it from `apps/admin/.env.example` and set
  `VITE_APP_BASE_API` to your local core API.
- **Core**: `pnpm dev` (from `apps/core` or via the existing core scripts).
- Install once at the repo root: `pnpm install` (full-workspace install governs
  all apps).

## Build Verification

All checks pass on branch `feat/admin-monorepo`:

| Step | Result | Notes |
| --- | --- | --- |
| `pnpm install` (new overrides) | PASS | Needs `--no-frozen-lockfile` (lockfile updated for the new overrides + `@babel/types`) |
| `pnpm --filter @mx-admin/admin run build` | PASS | `apps/admin/dist/{index.html, assets/, js/}` present; warnings only (chunk size, ejs CJS-in-ESM) |
| `pnpm -C apps/admin run typecheck` (TS 6.0.3) | PASS | After `ignoreDeprecations: "6.0"` + the `@babel/types` dep |
| `pnpm -C apps/core run typecheck` (TS 6.0.3) | PASS | Confirms the `dashboard`-removal runtime rewire compiles |
| `pnpm -C apps/core run bundle` | PASS | `✓ built`; `out/{main,migrate,app-migrate}.mjs` produced; ejs CJS-in-ESM warning only (pre-existing) |

Notes:

- `corepack enable` fails locally (`EINVAL readlink`) because a standalone pnpm is
  already installed; non-fatal, pnpm works.
- `@codemirror/view` is overridden to `6.42.1`, which does not satisfy admin's
  declared `^6.43.0`. This mirrors the original admin-vue3 setup exactly (same
  override, same declared range); the build, both typechecks, and the core bundle
  all pass, so it is left as-is.
- Global overrides force `typescript@6.0.3` and `zod@4.4.3` onto admin (was
  `5.9.3` / `4.3.6`); everything compiles under them.

## Remaining Manual Steps

- [ ] Create `apps/admin/.env` (copy from `apps/admin/.env.example`, set
  `VITE_APP_BASE_API`).
- [x] R2 publish wired (bucket/endpoint/custom-domain hardcoded; `AWS_ACCESS_KEY_ID`
  / `AWS_SECRET_ACCESS_KEY` secrets filled). See [R2 Update Channel](#r2-update-channel).
- [ ] Confirm the R2 custom domain `admin-r2.innei.dev` is connected to the
  `admin-r2` bucket (so `latest.json` / zips are publicly readable).
- [ ] Review the full diff on branch `feat/admin-monorepo`, then commit. (Nothing
  is committed yet, per repo rules.)
- [ ] (Optional) Implement the R2 runtime consumer in `admin-download.manager.ts`:
  poll `https://admin-r2.innei.dev/latest.json` and install newer versions. Until
  then the GitHub upgrade path stays the default (`mx-space/mx-admin`, overridable
  via `ADMIN_DASHBOARD_REPO`).
- [ ] (Optional) Retire the standalone `admin-vue3` repo once this lands.
