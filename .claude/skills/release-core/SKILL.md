---
name: release-core
description: Use when releasing mx-core server (apps/core) or @mx-space/api-client package — version bump, changelog, git tag, Docker build, GitHub Release, and Dokploy redeploy. Triggers on "发版", "release a new version", "cut a release", "bump version", "publish api-client".
---

# mx-core Release Process

mx-core has **two independent release pipelines** in this repo. Confirm with the user which one before doing anything.

| Pipeline | Where | What ships | Triggered by |
|----------|-------|------------|--------------|
| **A. Server** | `apps/core` | DockerHub `innei/mx-server` + GitHub Release zip + Dokploy redeploy | git tag `v*` (set by `bump`) |
| **B. api-client** | `packages/api-client` | npm package `@mx-space/api-client` | `npm publish` from local (run by `bump` after-hook) |

The `bump` CLI (Innei/bump-version, also aliased as `vv`) drives both. Each `package.json` has a `bump` block defining `before` / `after` / `changelog` / `tag` / `commit_message`.

## Pre-flight Checklist (apply to BOTH pipelines)

- [ ] On `master`, working tree clean (`git status`)
- [ ] In sync with `origin/master` (`git pull --rebase` — bump's `before` will run this anyway, but check first to spot conflicts)
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (or scoped to changed area, with the user's call)
- [ ] CHANGELOG sanity-check: review unreleased commits since last tag with `git log v$(node -p "require('./apps/core/package.json').version")..HEAD --oneline`
- [ ] No half-merged feature branches expected to ride this release

If anything is dirty/red, **stop and confirm with the user** — do not press through.

## A. Server Release (`apps/core`)

### Where the bump runs

The `apps/core/package.json` `bump` block:

```jsonc
{
  "before": [
    "git pull --rebase",
    "pnpm i",
    "node get-latest-admin-version.js"   // syncs latest mx-admin version into package.json
  ],
  "after": [
    "sh assets-push.sh"                  // pushes mx-admin static assets to mx-space/assets repo
  ],
  "changelog": true                       // updates CHANGELOG.md
}
```

**Hook ordering (nbump, not standard npm semantics):** `before` runs first as "leading hooks", then `after` runs as "tailing hooks" — **both before the version bump commit**. So `assets-push.sh` ships the admin assets *before* the `release: vX.Y.Z` commit + tag are made and pushed, not after.

Full sequence nbump performs:
1. `before` hooks (git pull, pnpm i, sync admin version)
2. `after` hooks (assets-push.sh)
3. Edit `apps/core/package.json` version → `git commit -a -m 'release: vX.Y.Z' --no-verify`
4. Generate `CHANGELOG.md` → `git commit --amend --no-verify --no-edit`
5. `git tag -a vX.Y.Z`
6. `git push` (master) + `git push origin vX.Y.Z`

### Commands

```bash
# Preview first (no write, no commit, no push)
pnpm -C apps/core exec bump --dry-run patch

# Then actually run it — pick ONE:
pnpm publish:core                              # from repo root; cd's into apps/core for you
cd apps/core && pnpm exec bump patch           # from apps/core directly
```

**Critical:** `bump` reads its config from the *current directory's* `package.json`. Repo root's `package.json` has no `bump` field, so `pnpm exec bump` from root throws `Error: package.json not found`. Stay inside `apps/core` (or use the `pnpm publish:core` shortcut).

`bump` is interactive even when you pass a version type — nbump 2.1.8 still asks `Continue? (Y/n)` to confirm. To run unattended, pipe `yes "" | …`. Version types you can pass:

| Type | Effect | When |
|------|--------|------|
| `patch` | `11.4.7 → 11.4.8` | bug fixes only |
| `minor` | `11.4.7 → 11.5.0` | backwards-compatible features |
| `major` | `11.4.7 → 12.0.0` | breaking change (rare; flag to user) |
| `prerelease` / `alpha` | `11.4.7 → 11.4.8-0` → `-1` → … | RC / canary builds |

### What CI does after the tag is pushed

`.github/workflows/release.yml` triggers on `push: tags: v*`:

1. **quality** — `pnpm lint` + `pnpm typecheck`
2. **build** — `pnpm bundle` → `bash scripts/workflow/test-server.sh` → `apps/core/zip-asset.sh` → uploads `release-linux.zip` as a GitHub Release asset → runs `npx changelogithub` to populate the release notes
3. **docker** (matrix: `linux/amd64` on `ubuntu-latest`, `linux/arm64` on `ubuntu-24.04-arm`) — builds, runs `bash ./scripts/workflow/test-docker.sh`, pushes by digest to DockerHub `innei/mx-server`
4. **merge** — combines digests into a single multi-arch manifest and tags it `latest`, `vX.Y.Z`, `X.Y`, `X`, plus the sha
5. **dokploy** — POSTs to `secrets.DOKPLOY_WEBHOOK_URL` to redeploy production (silently skipped if the secret is unset)

### Common follow-ups

- After CI is green, glance at the GitHub Release page to confirm the changelog rendered well and the zip asset attached.
- If Dokploy redeploy is the prod path, verify the running version on the server (e.g. `docker ps`/`/api/v2/health` or wherever the deployment exposes it).

## B. api-client Release (`packages/api-client`)

This package ships to npm, **not** through the tag pipeline. It uses its own `bump` block:

```jsonc
{
  "before": ["git pull --rebase", "pnpm i", "npm run package"],
  "after":  ["npm publish --access=public"],
  "tag":    false,
  "commit_message": "chore(release): bump @mx-space/api-client to v${NEW_VERSION}"
}
```

Notes:

- **No git tag** — the bump only commits + pushes a `chore(release): …` commit; there is no `v*` tag and the `release.yml` pipeline does NOT fire.
- The actual publish happens locally on whoever runs `bump` — they need an npm login with publish rights to `@mx-space/api-client`.
- `.github/workflows/api-client.yml` runs `pnpm test && pnpm run package` on every PR / push touching `packages/api-client/**`. It validates, but does **not** publish.

### Commands

```bash
cd packages/api-client

# Preview
pnpm exec bump --dry-run patch

# Real run
pnpm exec bump patch
# or pnpm exec bump minor / major / prerelease
```

### Yohaku consumer reminder

`@mx-space/api-client` is consumed by Yohaku web (`apps/web/package.json`) and admin-vue3 by pinned version. After publishing, if the bump introduced behavior the consumer needs, also bump the pin in those repos — but do NOT do that as part of this skill unless the user asks.

## Dry-run is cheap, use it

`bump --dry-run <type>` prints exactly what would happen (commands, version, commit message, tag) without touching anything. **Always run it first** if you're unsure which version segment to bump or whether the working tree is clean enough.

## Rollback / recovery

| Situation | Action |
|-----------|--------|
| `bump` failed mid-run, no tag pushed yet | `git status` → `git reset --hard HEAD` (after confirming nothing else was uncommitted) → fix → re-run. Confirm with user before resetting. |
| Tag pushed but CI failed at quality/build | Fix forward with a follow-up commit + new tag (`bump patch`). Don't try to delete the published tag. |
| Tag pushed, Docker built & published, but bug is critical | Cut a new patch release with the fix. Do **not** re-tag the same version. |
| api-client `npm publish` failed after commit pushed | `npm publish --access=public` manually from `packages/api-client` once the issue is resolved. The commit is already on master. |
| Wrong version published to npm | npm allows `npm unpublish` only within 72h and only if no one depends on it. Usually faster to publish a corrected next version. |

Never force-push to `master` or delete a published tag without user explicit approval — release tags are referenced by Docker manifests and changelog tooling.

## Red flags — STOP and confirm with user

- Working tree dirty before bump
- `pnpm typecheck` or `pnpm lint` failing
- Asked to bump `major` (breaking change — confirm scope)
- Asked to publish from a non-`master` branch
- `DOKPLOY_WEBHOOK_URL` secret missing yet user expects auto-redeploy
- Two pipelines being mixed up (e.g. tagging `v*` for an api-client-only change)

## File reference

- `apps/core/package.json` — `bump` config for server
- `packages/api-client/package.json` — `bump` config for npm package
- `apps/core/get-latest-admin-version.js` — pulls latest mx-admin release tag and writes it into `package.json` `dashboard.version`
- `apps/core/assets-push.sh` — force-pushes `assets/` submodule contents to `mx-space/assets`
- `.github/workflows/release.yml` — server tag → Docker + GitHub Release + Dokploy
- `.github/workflows/api-client.yml` — api-client CI (test/build only, no publish)
- `scripts/workflow/test-server.sh` / `test-docker.sh` — smoke tests CI runs against the bundle and image
