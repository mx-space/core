#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PKG=${1:?usage: release-package.sh <api-client|cli> <new-version>}
NEW=${2:?usage: release-package.sh <api-client|cli> <new-version>}
DIR=packages/$PKG
test -d "$DIR" || { echo "unknown package $PKG"; exit 2; }
NAME=$(node -p "require('./$DIR/package.json').name")

npm whoami >/dev/null 2>&1 || { echo "RED not logged in to npm"; exit 1; }

tracked=$(git status --porcelain --untracked-files=no)
if [ -n "$tracked" ]; then
  echo "RED tracked files already changed; inspect and preserve them before releasing a package:"
  echo "$tracked"
  exit 1
fi

git fetch origin --quiet
read -r behind ahead <<<"$(git rev-list --left-right --count origin/master...HEAD)"
if [ "$behind" -gt 0 ]; then
  echo "RED origin/master moved by $behind commit(s); rerun preflight and reselect the package version"
  exit 1
fi
echo "OK package release base still current; local branch ahead of origin/master by $ahead"

pnpm -C "$DIR" run typecheck
CI=true pnpm -C "$DIR" run test
pnpm -C "$DIR" run package

if [ "$PKG" = "cli" ]; then
  node packages/cli/bin/mxs.cjs --version
fi

(cd "$DIR" && npm pkg set version="$NEW")

if [ "$PKG" = "cli" ]; then
  pack_out=$(cd "$DIR" && npm pack --dry-run 2>&1)
  echo "--- npm pack --dry-run ---"
  echo "$pack_out" | tail -40
  echo "$pack_out" | grep -q 'bin/mxs.cjs' || { echo "RED bin/mxs.cjs missing from tarball"; exit 1; }
fi

git add "$DIR/package.json"
git commit -m "chore(release): bump $NAME to v$NEW" --no-verify
git push

(cd "$DIR" && pnpm publish --access=public --no-git-checks)
sleep 10
echo "npm view version: $(npm view "$NAME" version 2>/dev/null || echo 'not yet propagated')"
