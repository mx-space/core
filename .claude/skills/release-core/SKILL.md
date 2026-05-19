---
name: release-core
description: Use when releasing mx-core server (apps/core), @mx-space/api-client, or @mx-space/cli (mxs) — version bump, changelog, git tag, Docker build, GitHub Release, and Dokploy redeploy. Triggers on "发版", "release a new version", "cut a release", "bump version", "publish api-client", "publish cli", "release mxs".
---

# mx-core Release (Agent-native)

## Why this skill skips `bump`

The repo has historically used `bump` (nbump) — an interactive CLI that bundles ~6 steps behind a single prompt. It's great for humans, hostile for agents: every step is hidden, prompts must be fed via stdin, and a mid-run error leaves the working tree in an unknown state.

This skill replicates the **same end state** (commit, tag, changelog, assets push) by driving the underlying git/file operations directly. Each step is observable, individually verifiable, and individually retryable.

If a teammate insists on `bump`, fall back to it — but it's not needed for any agent-driven release.

## Three pipelines (confirm which one with the user)

| Pipeline | Where | What ships | What auto-fires after `git push` |
|----------|-------|------------|-----------------------------------|
| **A. Server** | `apps/core` | DockerHub `innei/mx-server` + GitHub Release zip + Dokploy redeploy | `release.yml` triggers on tag `v*` |
| **B. api-client** | `packages/api-client` | npm package `@mx-space/api-client` | `api-client.yml` runs CI only (no publish); the agent runs `npm publish` locally |
| **C. cli (mxs)** | `packages/cli` | npm package `@mx-space/cli` (binary `mxs`) | No dedicated workflow; the agent runs `npm publish` locally |

## Pre-flight (BOTH pipelines)

Run all of these. Stop and confirm with the user on any red.

```bash
# In repo root
git status                       # working tree must be clean
git fetch origin && git status   # confirm relationship with origin/master (ahead = will publish; behind/diverged = stop)
```

CI (`release.yml`'s `quality` + `build` jobs) runs lint, typecheck, the bundled-server smoke, and the Docker smoke. Don't re-run them locally before tagging — fix-forward via a follow-up patch if CI fails.

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

### Step 6.5 — Generate the user-facing release notes

`apps/core/CHANGELOG.md` (above) is for developers — Angular preset, commit-style. The GitHub Release body uses a different document: a human-narrative file at `apps/core/RELEASE_NOTES.md`, written by the agent and committed alongside the version bump. CI reads this file directly (no more `changelogithub`).

**Source material**:

```bash
git log v${CURRENT}..HEAD --no-merges --pretty='%H %s%n%b' -- apps/core
```

Use full subjects + bodies (the body surfaces `BREAKING CHANGE:` footers and PR refs).

**Selection rules**:

1. Always include: `feat:`, `fix:`, anything with `BREAKING CHANGE:` footer or `feat!:` / `fix!:` markers — same scope `changelogithub` used to ship.
2. Conditionally include: `refactor:`, `chore:`, `perf:`, `docs:` — only those whose subject/body indicates a **user-visible** effect (dependency major bump, behaviour change, performance improvement, public API tweak). Skip the rest.
3. Never include: pure formatting (`style:`), test-only (`test:`), tooling chores with no runtime impact.

**Structure auto-selection**:

| Condition | Use |
|-----------|-----|
| Any `feat:` OR any breaking change in selection | **full** |
| Else ≥ 4 entries selected | **full** |
| Else all selected entries are internal-only (chore/dep bump, no user effect) | **simple** with "Internal maintenance release" TL;DR (see rule 9 below) |
| Otherwise | **simple** |

**Full structure** (`apps/core/RELEASE_NOTES.md`):

```markdown
## TL;DR

<One sentence, 15–25 words, naming the headline change and its user impact.>

## Breaking Changes   ← only when present, rendered at top

- **<area>**: <what changed + why>. **Migration**: <concrete action operator must take>.

## Highlights

<2–3 prose paragraphs, ~40–80 words each. One topic per paragraph. Describe
user-visible behaviour and value — not commit subjects. Note constraints or
follow-ups.>

## Changes

### Features
- <Human description of what users can now do.> ([#PR] or [sha])

### Bug Fixes
- <Human description of what is fixed.> ([#PR] or [sha])

### Other   ← only when user-visible refactor/chore/perf was selected
- <Human description.> ([#PR] or [sha])

## Upgrade Notes   ← only when manual operator action is required

<env var / migration / config changes; cite exact commands or file paths>

---

**Full Changelog**: https://github.com/mx-space/core/compare/v<prev>...v<this>
```

**Simple structure**:

```markdown
## TL;DR

<One sentence.>

## Changes

- <Human description.> ([#PR] or [sha])

---

**Full Changelog**: https://github.com/mx-space/core/compare/v<prev>...v<this>
```

**Authoring rules** (self-discipline; verify each before showing the user):

1. Use user-facing language. Translate `refactor pool` → "Connection pool now reuses sockets across requests, reducing handshake latency."
2. Never copy a commit subject verbatim into an entry — rewrite it.
3. Link priority: PR number (`#2708`) > issue number > short sha (7 chars + commit URL). Prefer PR when commit message contains `(#NNNN)`.
4. Every `Breaking Changes` entry MUST include a `**Migration**:` clause with a concrete action — even if the action is "no action required, just observe the new behaviour".
5. TL;DR is exactly one sentence, 15–25 words, naming the headline change and its user impact.
6. Highlights paragraphs: 40–80 words each, 2–3 total in full structure.
7. (See structure selection table above.)
8. Empty sections are omitted entirely — do not render placeholder text like "No breaking changes."
9. If selection is internal-only, TL;DR is `Internal maintenance release; no user-facing changes.` Highlights is omitted; `Changes` (or `Other`) lists the chore items.

**Write**:

1. Write `apps/core/RELEASE_NOTES.md` (overwrite any previous content).
2. Print the full rendered file to chat as a status update — for visibility, not approval. Proceed directly to step 7 without asking.

The release flow runs unattended: if the agent has enough information to choose a version (step 1) and run the prior steps, it has enough to author the notes. Only stop and ask the user if a red flag in step 1 is unresolved (e.g. ambiguous breaking change scope).

Verify: `apps/core/RELEASE_NOTES.md` exists and is non-empty (`test -s apps/core/RELEASE_NOTES.md`).

### Step 7 — Commit

```bash
git add apps/core/package.json apps/core/CHANGELOG.md apps/core/RELEASE_NOTES.md
git commit -m "release: vX.Y.Z" --no-verify
```

`--no-verify` skips the lint-staged pre-commit hook — release commits don't need it (CHANGELOG/RELEASE_NOTES aren't lintable, package.json change is mechanical), and matches the historical commit pattern.

Verify: `git log -1 --stat` shows exactly three files changed.

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
2. **build** — verify `apps/core/RELEASE_NOTES.md` present → `pnpm bundle` → `scripts/workflow/test-server.sh` → zip → upload as GitHub Release asset with `body_path: apps/core/RELEASE_NOTES.md` (this is what populates the Release notes; `changelogithub` is no longer used)
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
cd packages/api-client && pnpm publish --access=public
```

Use `pnpm publish`, **not** `npm publish`. pnpm rewrites any `workspace:`
protocol dependency to a real version range in the published manifest;
`npm publish` ships `workspace:*` verbatim and the package breaks on install.
pnpm's git-checks abort the publish if the repo root has unrelated untracked
files — after confirming those files are unrelated to this release, re-run with
`--no-git-checks`.

Requires publish rights on `@mx-space/api-client` (org `mx-space`). If `npm whoami` shows nothing, ask the user to log in — don't try to bypass.

Verify: `npm view @mx-space/api-client version` returns the new version (may take 30–60s to propagate).

### Step 6 — Notify consumers (optional, with user's call)

`@mx-space/api-client` is consumed by Yohaku (`apps/web/package.json`) and admin-vue3 by pinned version. Bumping those is a separate change and only needed if consumers depend on the new behaviour. Don't do it as part of this skill unless the user asks.

## C. cli Release (`packages/cli`, binary `mxs`)

Same shape as api-client — no tag, no CHANGELOG file, just bump → commit → push → publish. Two extra cares: the `bin` field must remain executable, and the package was un-released until v0.1.x, so the first publish is a real first publish (not a re-publish).

### Step 1 — Decide the version

```bash
node -p "require('./packages/cli/package.json').version"
git log --pretty='%h %s' -- packages/cli | head -30
```

Same conventional-commits rules. Note: while in `0.y.z`, treat `feat:` as minor (`0.Y+1.0`) and breaking as minor too — `1.0.0` is reserved for the deliberate API freeze.

### Step 2 — Sync + rebuild

```bash
git pull --rebase
pnpm i                           # if needed
pnpm -C packages/cli run package
```

`package` is `rm -rf dist && tsdown` — same as api-client. Builds `dist/` (gitignored).

Verify:
- `ls packages/cli/dist` lists `.mjs` / `.d.mts` (CLI ships ESM; `bin/mxs.cjs` is a thin shim into the bundle).
- `node packages/cli/bin/mxs.cjs --version` prints the about-to-bump version (i.e. still the current one until step 3). Confirms the shim resolves `dist/` after a clean build.

### Step 3 — Bump version

Edit `packages/cli/package.json` `version` field. Do NOT touch the `bin` map — the `mxs` → `./bin/mxs.cjs` mapping is load-bearing.

### Step 4 — Sanity-check the publish surface

```bash
cd packages/cli && npm pack --dry-run 2>&1 | tail -40
```

Run from inside `packages/cli`, not the repo root with `-w @mx-space/cli` — in
this pnpm workspace the `-w` form resolves to pnpm and aborts with
`ERR_PNPM_PACKAGE_NAME_NOT_FOUND` (the root package.json has no `name`).

What to check in the output:
- `bin/mxs.cjs` present
- `dist/` present and non-empty (.mjs/.d.mts)
- `README.md` + `ROADMAP.md` present
- `src/` NOT present (would inflate tarball; `files` field already excludes it, just confirming)

Skip pack if the consumer trusts the `files` array — but for a first publish, run it.

### Step 5 — Commit + push

```bash
git add packages/cli/package.json
git commit -m "chore(release): bump @mx-space/cli to vX.Y.Z" --no-verify
git push
```

**No git tag.** Like api-client, CLI does not use the `v*` namespace (server-only). No CI workflow runs for CLI on push.

### Step 6 — Publish to npm

```bash
cd packages/cli && pnpm publish --access=public
```

Use `pnpm publish`, **not** `npm publish`. `@mx-space/cli` depends on
`@mx-space/api-client` via `workspace:*`; pnpm rewrites that to a real version
range when publishing, whereas `npm publish` ships `workspace:*` verbatim and
breaks the package on install.

- `npm whoami` returns a user with publish rights on the `mx-space` org (same as api-client).
- `--access=public` is required because `@mx-space/cli` is a scoped package; npm defaults scoped packages to private. (Already set in `publishConfig.access`, but passing the flag is belt-and-suspenders.)
- pnpm's git-checks abort the publish if the repo root has unrelated untracked files. After confirming those files are unrelated to this release, re-run with `--no-git-checks`.

If `npm whoami` is empty, ask the user to `npm login`. Don't attempt `--otp=...` guessing.

Verify:
- `npm view @mx-space/cli version` returns the new version (30–60s propagation).
- After propagation, smoke-test the published binary:
  ```bash
  npx --yes @mx-space/cli@X.Y.Z --version
  ```
  Should print `X.Y.Z`. If it errors with `command not found: mxs`, the `bin` field is broken in the published manifest — investigate `npm view @mx-space/cli bin` before publishing a fix.

### Step 7 — Notify consumers (optional)

CLI has no in-repo consumers (it's an end-user tool, not a workspace dep). Skip the consumer-bump step.

## Rollback / recovery

| Situation | Action |
|-----------|--------|
| Failed before `git push` | `git reset --hard HEAD~1` (after confirming nothing else uncommitted), `git tag -d vX.Y.Z`. Confirm with user before resetting. |
| Pushed commit but tag push failed | Push the tag: `git push origin vX.Y.Z`. The commit alone won't trigger CI. |
| Tag pushed, CI quality/build failed | Fix forward with a new patch release. Don't delete the published tag. |
| Tag pushed, Docker built, but bug critical | Cut a new patch with the fix. Don't re-tag the same version. |
| api-client `pnpm publish` failed after commit/push | Re-run `pnpm publish --access=public` once the issue is resolved. The commit already records the intent. |
| cli `pnpm publish` failed after commit/push | Re-run `pnpm publish --access=public` from `packages/cli`. If failure is missing `dist/`, re-run `pnpm -C packages/cli run package` first. |
| Published cli but `mxs` binary missing on install | The `bin` field was likely stripped or the shim path is wrong. Cut a new patch with `bin/mxs.cjs` restored — do **not** unpublish unless within 24h and no installs. |
| Wrong version published to npm | npm allows `npm unpublish` only within 72h, only if no one depends on it. Usually faster to publish a corrected next version. |
| Release notes need a fix after tag is published | `gh release edit vX.Y.Z --notes-file apps/core/RELEASE_NOTES.md` (or `--notes "..."`) — updates the Release body only. Tag and assets are untouched. |

**Never** force-push `master` and **never** delete a published tag without explicit user approval — release tags are referenced by Docker manifests and changelog tooling.

## Red flags — STOP and confirm

- Working tree dirty before step 1
- Asked to bump `major` (breaking) — confirm scope
- On a non-`master` branch
- `node get-latest-admin-version.js` fails (likely missing `gh auth` / token)
- `assets-push.sh` reports a real conflict (not just "nothing to commit")
- `npm whoami` empty when about to publish api-client or cli
- Pipelines mixed up (e.g. tagging `v*` for an api-client- or cli-only change, or bumping CLI version when only api-client changed)
- `packages/cli/dist` missing or stale before `pnpm publish` (skipped step 2 rebuild)
- `packages/cli/package.json` `bin` field accidentally removed or path renamed

## File reference

- `apps/core/package.json` — server version + `dashboard.version` (mx-admin pin)
- `apps/core/CHANGELOG.md` — server changelog (Angular preset, developer-facing, machine-generated)
- `apps/core/RELEASE_NOTES.md` — user-facing GitHub Release body (narrative, agent-authored, overwritten each release; CI reads via `body_path`)
- `apps/core/get-latest-admin-version.js` — fetches latest mx-admin release tag
- `apps/core/assets-push.sh` — force-pushes `assets/` to `mx-space/assets`
- `packages/api-client/package.json` — npm package version
- `packages/cli/package.json` — npm package version + `bin.mxs` map (do not edit `bin` during a release)
- `packages/cli/bin/mxs.cjs` — CommonJS shim that re-exports `dist/`; shipped in the tarball
- `.github/workflows/release.yml` — server tag → Docker + GitHub Release + Dokploy
- `.github/workflows/api-client.yml` — api-client CI (test/build only, no publish)
- (No dedicated workflow for `packages/cli` — root `ci.yml` covers typecheck/test.)
- `scripts/workflow/test-server.sh` / `test-docker.sh` — smoke tests CI runs

## Manual `bump` fallback

If for some reason this flow can't proceed (e.g. CHANGELOG generator failing), the historical interactive path still works:

```bash
cd apps/core
yes "" | pnpm exec bump patch    # nbump prompts Continue? — yes "" auto-accepts
```

This collapses steps 2–9 into one opaque run. Use only as a last resort; the agent-native flow above is preferred because each step is observable.
