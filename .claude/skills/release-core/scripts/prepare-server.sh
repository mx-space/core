#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

NEW=${1:?usage: prepare-server.sh <new-version>}

tracked=$(git status --porcelain --untracked-files=no)
if [ -n "$tracked" ]; then
  echo "RED tracked files already changed; inspect and preserve them before preparing a release:"
  echo "$tracked"
  exit 1
fi

git fetch origin --quiet
read -r behind ahead <<<"$(git rev-list --left-right --count origin/master...HEAD)"
if [ "$behind" -gt 0 ]; then
  echo "RED origin/master moved by $behind commit(s); rerun preflight and reselect the release version/notes"
  exit 1
fi
echo "OK release base still current; local branch ahead of origin/master by $ahead"

node apps/core/scripts/bump-admin-version.js
(cd apps/core && npm pkg set version="$NEW")
npx -y conventional-changelog-cli@5 -p angular \
  -i apps/core/CHANGELOG.md -s -r 0 --commit-path apps/core
if [ -f apps/core/RELEASE_NOTES.md ]; then
  backup=$(mktemp -t mx-core-release-notes.XXXXXX.md)
  cp apps/core/RELEASE_NOTES.md "$backup"
  echo "previous RELEASE_NOTES.md backed up to $backup"
fi
: > apps/core/RELEASE_NOTES.md

echo "--- changed files ---"
git status --porcelain --untracked-files=no
echo "--- version diffs ---"
git diff apps/core/package.json apps/admin/package.json
echo "--- new changelog block ---"
git diff apps/core/CHANGELOG.md | head -60
