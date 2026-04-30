---
name: release-core
description: Use when releasing mx-core server (apps/core) or @mx-space/api-client package — version bump, changelog, git tag, Docker build, GitHub Release, and Dokploy redeploy. Triggers on "发版", "release a new version", "cut a release", "bump version", "publish api-client".
---

# mx-core Release (Agent-native)

## Why this skill skips `bump`

The repo has historically used `bump` (nbump) — an interactive CLI that bundles ~6 steps behind a single prompt. It's great for humans, hostile for agents: every step is hidden, prompts must be fed via stdin, and a mid-run error leaves the working tree in an unknown state.

This skill replicates the **same end state** (commit, tag, changelog, assets push) by driving the underlying git/file operations directly. Each step is observable, individually verifiable, and individually retryable.

If a teammate insists on `bump`, fall back to it — but it's not needed for any agent-driven release.

## Two pipelines (confirm which one with the user)

| Pipeline | Where | What ships | What auto-fires after `git push` |
|----------|-------|------------|-----------------------------------|
| **A. Server** | `apps/core` | DockerHub `innei/mx-server` + GitHub Release zip + Dokploy redeploy | `release.yml` triggers on tag `v*` |
| **B. api-client** | `packages/api-client` | npm package `@mx-space/api-client` | `api-client.yml` runs CI only (no publish); the agent runs `npm publish` locally |

## Pre-flight (BOTH pipelines)

Run all of these. Stop and confirm with the user on any red.

```bash
# In repo root
git status                       # working tree must be clean
git fetch origin && git status   # confirm relationship with origin/master (ahead = will publish; behind/diverged = stop)
pnpm lint
pnpm typecheck
pnpm test                        # full suite, or scope to changed area with user's call
```

For the server pipeline, also enumerate what's about to ship:

```bash
CURRENT=$(node -p "require('./apps/core/package.json').version")
git log v${CURRENT}..HEAD --no-merges --pretty='%h %s'
```

Sanity-check the commit list before deciding the version bump.

## A. Server Release (`apps/core`)

### Step 1 — Decide the version

Read current version: `node -p "require('./apps/core/package.json').version"`.

Inspect the unreleased commits (above) and choose:

| Bump | Trigger |
|------|---------|
| `patch` (X.Y.**Z+1**) | only `fix:` / `docs:` / `chore:` / `refactor:` / `test:` |
| `minor` (X.**Y+1**.0) | any `feat:` |
| `major` (**X+1**.0.0) | any `BREAKING CHANGE:` or `feat!:` / `fix!:` — **always confirm with user** |
| `prerelease` (X.Y.Z-**N**) | RC / canary; appends/increments numeric suffix |

State the chosen version explicitly to the user before running step 2.

### Step 2 — Sync with origin

```bash
git pull --rebase
pnpm i                           # only if pnpm-lock.yaml changed since last release; harmless to skip
```

### Step 3 — Sync mx-admin version

```bash
node apps/core/get-latest-admin-version.js
```

Effect: queries `https://api.github.com/repos/mx-space/mx-admin/releases/latest` and writes the latest tag into `apps/core/package.json` → `dashboard.version`. Needs a GitHub token (env `GH_TOKEN`/`GITHUB_TOKEN`, falls back to `gh auth token`).

Verify: `git diff apps/core/package.json` shows only `dashboard.version` changing (or no diff if already current).

### Step 4 — Push admin assets

```bash
bash apps/core/assets-push.sh
```

Effect: enters `assets/` (a sibling working copy of `mx-space/assets`), commits any changes, force-pushes to its `master`. **Force push** is intentional — it tracks DB-derived snapshots, not curated history.

Verify: script ends with `Everything up-to-date` or a successful `master -> master` push.

### Step 5 — Bump version in package.json

Use the Edit tool (do **not** use `npm version`, which would create its own commit/tag).

```jsonc
// apps/core/package.json
"version": "11.4.8",  // → "11.4.9"
```

Verify: `git diff apps/core/package.json` shows only the `version` field (and possibly `dashboard.version` from step 3).

### Step 6 — Generate the CHANGELOG entry

Format used by the existing CHANGELOG.md is **conventional-changelog / Angular preset**. Reproduce it with one command:

```bash
npx -y conventional-changelog-cli@5 -p angular \
  -i apps/core/CHANGELOG.md -s -r 0 --commit-path apps/core
```

`-s` writes in place. `-r 0` regenerates only the unreleased section (since the last `release: v*` tag). `--commit-path apps/core` scopes commits to the server app, matching nbump's behaviour.

Then **read the diff** and sanity-check it:

```bash
git diff apps/core/CHANGELOG.md
```

The new block should:
- Start with `## [X.Y.Z](https://github.com/mx-space/core/compare/v<prev>...vX.Y.Z) (YYYY-MM-DD)`
- Group entries under `### Bug Fixes` / `### Features` / `### BREAKING CHANGES`
- List only `feat`/`fix`/breaking commits — `docs`/`chore`/`refactor`/`test`/`style` are skipped (this matches nbump)
- Each entry: `* **scope:** subject ([sha7](commit-link))`

If the block looks wrong, `git checkout -- apps/core/CHANGELOG.md` and either re-run with corrected flags or write the block manually.

### Step 7 — Commit

```bash
git add apps/core/package.json apps/core/CHANGELOG.md
git commit -m "release: vX.Y.Z" --no-verify
```

`--no-verify` skips the lint-staged pre-commit hook — release commits don't need it (CHANGELOG isn't lintable, package.json change is mechanical), and matches the historical commit pattern.

Verify: `git log -1 --stat` shows exactly two files changed.

### Step 8 — Tag

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

Annotated tag (`-a`) — `release.yml` trigger condition is just `tags: v*`, but annotated matches history.

Verify: `git tag -l vX.Y.Z` returns the tag.

### Step 9 — Push

```bash
git push                         # commit
git push origin vX.Y.Z           # tag — this is what triggers release.yml
```

Both are required. Pushing the commit alone does nothing visible; pushing the tag without the commit gets a tag pointing at a sha that origin doesn't have yet.

### Step 10 — Watch CI

```bash
gh run list --workflow=release.yml --limit 1
gh run watch <run-id>            # blocks until the run finishes; or omit and check periodically
```

`release.yml` runs:
1. **quality** — lint + typecheck
2. **build** — `pnpm bundle` → `scripts/workflow/test-server.sh` → zip → upload as GitHub Release asset → `npx changelogithub` populates the Release notes
3. **docker** (matrix `linux/amd64` + `linux/arm64`) — build, `scripts/workflow/test-docker.sh`, push by digest to DockerHub `innei/mx-server`
4. **merge** — combine digests into multi-arch manifest, tag `latest` / `vX.Y.Z` / `X.Y` / `X` / sha
5. **dokploy** — POST to `secrets.DOKPLOY_WEBHOOK_URL` (silently skipped if unset) — this is what redeploys production

If quality/build fails: fix forward, bump again with the next patch number. **Never** delete or move the published tag.

## B. api-client Release (`packages/api-client`)

Simpler — no tag, no changelog file, just bump → commit → push → publish.

### Step 1 — Decide the version

```bash
node -p "require('./packages/api-client/package.json').version"
git log --pretty='%h %s' -- packages/api-client | head -30
```

Same conventional-commits rules as the server.

### Step 2 — Sync + rebuild

```bash
git pull --rebase
pnpm i                           # if needed
pnpm -C packages/api-client run package
```

`package` is `rm -rf dist && tsdown` — rebuilds `dist/` (gitignored) so the upcoming `npm publish` ships fresh artifacts.

Verify: `ls packages/api-client/dist` lists `.cjs` / `.mjs` / `.d.mts` files.

### Step 3 — Bump version

Edit `packages/api-client/package.json` `version` field.

### Step 4 — Commit + push

```bash
git add packages/api-client/package.json
git commit -m "chore(release): bump @mx-space/api-client to vX.Y.Z" --no-verify
git push
```

**No git tag.** The api-client pipeline does not use the `v*` namespace (which is server-only). `api-client.yml` runs `pnpm test && pnpm run package` on the push as a sanity check — it does **not** publish.

### Step 5 — Publish to npm

```bash
cd packages/api-client
npm publish --access=public
```

Requires `npm login` with publish rights on `@mx-space/api-client` (org `mx-space`). If `npm whoami` shows nothing, ask the user to log in — don't try to bypass.

Verify: `npm view @mx-space/api-client version` returns the new version (may take 30–60s to propagate).

### Step 6 — Notify consumers (optional, with user's call)

`@mx-space/api-client` is consumed by Yohaku (`apps/web/package.json`) and admin-vue3 by pinned version. Bumping those is a separate change and only needed if consumers depend on the new behaviour. Don't do it as part of this skill unless the user asks.

## Rollback / recovery

| Situation | Action |
|-----------|--------|
| Failed before `git push` | `git reset --hard HEAD~1` (after confirming nothing else uncommitted), `git tag -d vX.Y.Z`. Confirm with user before resetting. |
| Pushed commit but tag push failed | Push the tag: `git push origin vX.Y.Z`. The commit alone won't trigger CI. |
| Tag pushed, CI quality/build failed | Fix forward with a new patch release. Don't delete the published tag. |
| Tag pushed, Docker built, but bug critical | Cut a new patch with the fix. Don't re-tag the same version. |
| api-client `npm publish` failed after commit/push | Re-run `npm publish --access=public` once the issue is resolved. The commit already records the intent. |
| Wrong version published to npm | npm allows `npm unpublish` only within 72h, only if no one depends on it. Usually faster to publish a corrected next version. |

**Never** force-push `master` and **never** delete a published tag without explicit user approval — release tags are referenced by Docker manifests and changelog tooling.

## Red flags — STOP and confirm

- Working tree dirty before step 1
- `pnpm lint` / `pnpm typecheck` / `pnpm test` failing
- Asked to bump `major` (breaking) — confirm scope
- On a non-`master` branch
- `node get-latest-admin-version.js` fails (likely missing `gh auth` / token)
- `assets-push.sh` reports a real conflict (not just "nothing to commit")
- `npm whoami` empty when about to publish api-client
- Two pipelines mixed up (e.g. tagging `v*` for an api-client-only change)

## File reference

- `apps/core/package.json` — server version + `dashboard.version` (mx-admin pin)
- `apps/core/CHANGELOG.md` — server changelog (Angular preset)
- `apps/core/get-latest-admin-version.js` — fetches latest mx-admin release tag
- `apps/core/assets-push.sh` — force-pushes `assets/` to `mx-space/assets`
- `packages/api-client/package.json` — npm package version
- `.github/workflows/release.yml` — server tag → Docker + GitHub Release + Dokploy
- `.github/workflows/api-client.yml` — api-client CI (test/build only, no publish)
- `scripts/workflow/test-server.sh` / `test-docker.sh` — smoke tests CI runs

## Manual `bump` fallback

If for some reason this flow can't proceed (e.g. CHANGELOG generator failing), the historical interactive path still works:

```bash
cd apps/core
yes "" | pnpm exec bump patch    # nbump prompts Continue? — yes "" auto-accepts
```

This collapses steps 2–9 into one opaque run. Use only as a last resort; the agent-native flow above is preferred because each step is observable.
