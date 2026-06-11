---
name: release-core
description: Use when releasing mx-core server (apps/core), @mx-space/api-client, or @mx-space/cli (mxs) — version bump, changelog, git tag, Docker build, GitHub Release, and Dokploy redeploy. Triggers on "发版", "release a new version", "cut a release", "bump version", "publish api-client", "publish cli", "release mxs".
---

# mx-core Release (Agent-native)

Helper scripts live in `.claude/skills/release-core/scripts/` (each `cd`s to repo root, runs fine from anywhere). They print compact, verifiable output — read it instead of re-deriving state with ad-hoc commands.

## Three pipelines (confirm which one with the user)

| Pipeline | Where | What ships | After `git push` |
|----------|-------|------------|------------------|
| **A. Server** | `apps/core` | DockerHub `innei/mx-server` + GitHub Release zip + Dokploy redeploy | `release.yml` triggers on tag `v*` |
| **B. api-client** | `packages/api-client` | npm `@mx-space/api-client` | `api-client.yml` runs CI only; agent publishes locally |
| **C. cli** | `packages/cli` | npm `@mx-space/cli` (binary `mxs`) | no workflow; agent publishes locally |

CI runs lint, typecheck, and smoke tests on the tag — don't re-run them locally before tagging; fix forward via a follow-up patch if CI fails.

Safety invariant: never use `git reset --hard`, `git checkout --`, `git restore`, force-push, or any destructive equivalent in this release flow. If recovery is needed, inspect the working tree, preserve diffs, and ask the user before touching existing files.

## A. Server release

### Step 1 — Preflight + decide version

```bash
bash .claude/skills/release-core/scripts/preflight.sh core
```

Prints tree/branch/origin checks, current version, the unreleased commit list (subjects + bodies — this is also the source material for step 3), and whether `apps/admin` changed. Any `RED` line → stop and confirm with the user.

Choose the bump from the commit list:

| Bump | Trigger |
|------|---------|
| `patch` | only `fix:` / `docs:` / `chore:` / `refactor:` / `test:` |
| `minor` | any `feat:` |
| `major` | `BREAKING CHANGE:` or `feat!:` / `fix!:` — **always confirm with user** |
| `prerelease` | RC / canary numeric suffix |

State the chosen version explicitly to the user, then continue.

### Step 2 — Prepare

```bash
bash .claude/skills/release-core/scripts/prepare-server.sh X.Y.Z
```

Does, in order: verifies no tracked files are already changed → fetches origin and aborts if `origin/master` moved since preflight → `node apps/core/scripts/bump-admin-version.js` (patch-bumps `apps/admin/package.json` iff admin changed since the last `v*` tag — mandatory, otherwise R2 silently overwrites the published `admin-X.Y.Z.zip` with different content) → sets core version → regenerates `apps/core/CHANGELOG.md` (conventional-changelog, Angular preset, scoped to `apps/core`) → backs up old release notes to `/tmp` and empties `apps/core/RELEASE_NOTES.md`. Prints changed files, version diffs, and the head of the new changelog block.

Check the printed changelog block: header `## [X.Y.Z](compare-link) (YYYY-MM-DD)`, entries grouped under `### Bug Fixes` / `### Features`, only feat/fix/breaking commits, each `* **scope:** subject ([sha7](link))`. If wrong: stop, inspect `git diff apps/core/CHANGELOG.md`, then edit the changelog manually while preserving unrelated hunks.

If preflight showed `apps/admin` changed but the script logged `admin unchanged`, stop and fix before tagging.

### Step 3 — Author `apps/core/RELEASE_NOTES.md`

This file becomes the GitHub Release body (CI reads it via `body_path`). Step 2 empties the file after copying the old content to `/tmp`; write the new content fresh and do not reuse the previous release body.

**Select** from the commit list preflight printed:

1. Always: `feat:`, `fix:`, anything breaking (`BREAKING CHANGE:` footer, `feat!:` / `fix!:`).
2. Only if user-visible: `refactor:` / `chore:` / `perf:` / `docs:` (dependency major, behaviour change, performance, public API). Skip the rest.
3. Never: `style:`, `test:`, tooling with no runtime impact.

**Structure**: any feat or breaking, or ≥4 selected entries → **full**. All selected entries internal-only → **simple** with TL;DR `Internal maintenance release; no user-facing changes.` Otherwise → **simple**.

**Full**:

```markdown
## TL;DR

<one sentence>

## Breaking Changes   <!-- only when present -->

- **<area>**: <what + why>. **Migration**: <concrete operator action>.

## Highlights

<2–3 prose paragraphs, one topic each — user-visible behaviour and value>

## Changes

### Features
- <what users can now do> ([#PR] or [sha])

### Bug Fixes
- <what is fixed> ([#PR] or [sha])

### Other   <!-- only for selected user-visible refactor/chore/perf -->

## Upgrade Notes   <!-- only when manual operator action is required -->

---

**Full Changelog**: https://github.com/mx-space/core/compare/v<prev>...v<this>
```

**Simple**: just `## TL;DR` + `## Changes` (flat list) + the Full Changelog link.

**Rules**: rewrite in user-facing language, never copy a commit subject verbatim; link priority PR `#NNNN` > issue > 7-char sha with commit URL; every Breaking entry MUST carry a `**Migration**:` clause; TL;DR is one sentence, 15–25 words; Highlights paragraphs 40–80 words; omit empty sections entirely.

Print the rendered file to chat as a status update (visibility, not approval) and proceed — the flow runs unattended; only stop if a step 1 red flag is unresolved.

### Step 4 — Finalize + watch CI

```bash
bash .claude/skills/release-core/scripts/finalize-server.sh X.Y.Z
```

Does: assert notes non-empty → commit `release: vX.Y.Z` with `--no-verify` → annotated tag `vX.Y.Z` → push commit + tag (the tag push triggers `release.yml`) → print the commit stat and the matching tag-triggered run.

Verify the printed stat shows exactly 3 files (4 when admin was bumped). Then:

```bash
gh run watch <run-id>
```

`release.yml`: quality → build (GitHub Release with the notes; admin zip to R2) → docker (multi-arch to DockerHub) → dokploy redeploy. If it fails: fix forward with the next patch; **never** delete or move a published tag.

## B/C. npm package release (api-client / cli)

No tag, no changelog file. Decide the version via `preflight.sh api-client` or `preflight.sh cli` — same conventional rules, except cli is `0.y.z`: treat `feat:` AND breaking both as minor; `1.0.0` is reserved for the deliberate API freeze. Preflight uses the package's current version commit as the baseline; if it prints a baseline warning, inspect the recent commits manually before choosing. State the version to the user, then:

```bash
bash .claude/skills/release-core/scripts/release-package.sh api-client X.Y.Z
# or
bash .claude/skills/release-core/scripts/release-package.sh cli X.Y.Z
```

Does: assert `npm whoami` (if not logged in, ask the user to `npm login` — don't bypass) → verify no tracked files are already changed → fetch origin and abort if `origin/master` moved since preflight → run package `typecheck` and `test` → rebuild `dist/` → (cli only) smoke-test `bin/mxs.cjs --version` and `npm pack --dry-run` with a hard check that `bin/mxs.cjs` is in the tarball → set version → commit `chore(release): bump <name> to vX.Y.Z` → push → `pnpm publish --access=public --no-git-checks` → `npm view <name> version`.

Why those flags: `pnpm publish` (not npm) rewrites `workspace:*` deps to real ranges — npm ships them verbatim and the package breaks on install. `--no-git-checks` because unrelated untracked files (surfaced as `WARN` in preflight — confirm they're unrelated before running) would abort the publish.

cli extras: never edit the `bin` map (`mxs` → `./bin/mxs.cjs` is load-bearing). After ~60s propagation, `npx --yes @mx-space/cli@X.Y.Z --version` should print `X.Y.Z`; if `command not found: mxs`, inspect `npm view @mx-space/cli bin` before publishing a fix.

Consumer bumps (Yohaku pins `@mx-space/api-client`) are out of scope unless the user asks.

## Rollback / recovery

| Situation | Action |
|-----------|--------|
| Failed before `git push` | stop; show `git status` and `git diff`; preserve release edits for inspection; ask the user before manually reversing release-only hunks or deleting a local-only tag |
| Commit pushed, tag push failed | `git push origin vX.Y.Z` |
| Tag pushed, CI failed or critical bug shipped | fix forward with the next patch — never re-tag or delete |
| npm publish failed after commit/push | resolve, re-run `pnpm publish --access=public --no-git-checks` from the package dir (rebuild `dist/` first if missing) |
| Wrong version on npm | publish a corrected next version; do not use `npm unpublish` without explicit user approval and package-impact verification |
| Release notes wrong after publish | `gh release edit vX.Y.Z --notes-file apps/core/RELEASE_NOTES.md` — tag and assets untouched |

**Never** force-push `master`, reset the branch, restore files destructively, or delete a published tag without explicit user approval — tags are referenced by Docker manifests and changelog tooling.

## Red flags — STOP and confirm

- Any `RED` from preflight
- Major bump — confirm breaking scope with the user
- `apps/admin` changed but its version didn't move
- `npm whoami` empty before a package publish
- Pipelines mixed up (e.g. `v*` tag for a package-only change)

## Fallback

If the script flow cannot proceed, stop with the current `git status` and `git diff` visible. Do not fall back to opaque interactive release tooling unless the user explicitly asks for it after reviewing the working tree.
