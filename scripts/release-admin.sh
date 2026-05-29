#!/usr/bin/env bash
# One-shot independent admin release.
#
# Bumps apps/admin's version, commits it, creates an `admin-v<version>` tag, and
# pushes branch + tag. Pushing the tag triggers .github/workflows/admin-release.yml,
# which builds, packages and publishes the admin assets (S3 when configured).
#
# Usage:
#   scripts/release-admin.sh [patch|minor|major]   # default: patch — bump, commit, tag, push
#   scripts/release-admin.sh minor --dry-run       # bump, commit, tag locally; do NOT push
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

LEVEL="patch"
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    patch | minor | major) LEVEL="$arg" ;;
    --dry-run | -n) DRY_RUN=1 ;;
    *)
      echo "Unknown argument: $arg (expected patch|minor|major [--dry-run])" >&2
      exit 1
      ;;
  esac
done

# Admin must be committed (the migration landed) before cutting a release, and its
# package.json must be clean so the release commit contains only the version bump.
if ! git ls-files --error-unmatch apps/admin/package.json >/dev/null 2>&1; then
  echo "apps/admin is not tracked yet — commit the admin app first." >&2
  exit 1
fi
if ! git diff --quiet -- apps/admin/package.json; then
  echo "apps/admin/package.json has uncommitted changes — commit or stash first." >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" = "HEAD" ]; then
  echo "Detached HEAD — checkout a branch first." >&2
  exit 1
fi

# Peek the next version (no write) so we can validate the tag before committing.
VERSION="$(node apps/core/scripts/bump-admin-release.js "$LEVEL" --dry)"
TAG="admin-v${VERSION}"
if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "Tag ${TAG} already exists — bump a different level or delete the tag." >&2
  exit 1
fi

CURRENT="$(node -p "require('./apps/admin/package.json').version")"
echo "→ admin ${LEVEL} release: ${CURRENT} -> ${VERSION} on ${BRANCH}"

node apps/core/scripts/bump-admin-release.js "$LEVEL" >/dev/null
git add apps/admin/package.json
git commit -m "chore(admin): release v${VERSION}"
git tag "$TAG"

if [ "$DRY_RUN" = "1" ]; then
  echo "✔ committed + tagged ${TAG} locally (dry-run; not pushed)."
  echo "  push when ready:  git push origin ${BRANCH} && git push origin ${TAG}"
  exit 0
fi

git push origin "$BRANCH"
git push origin "$TAG"
echo "✔ pushed ${TAG} → CI (admin-release.yml) builds & publishes."
