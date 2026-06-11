#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

NEW=${1:?usage: finalize-server.sh <version>}

if ! test -s apps/core/RELEASE_NOTES.md; then
  echo "RED apps/core/RELEASE_NOTES.md missing or empty"
  exit 1
fi

git add apps/core/package.json apps/core/CHANGELOG.md apps/core/RELEASE_NOTES.md apps/admin/package.json
git commit -m "release: v$NEW" --no-verify
git tag -a "v$NEW" -m "Release v$NEW"
git push
git push origin "v$NEW"

echo "--- release commit ---"
git log -1 --stat | head -20
echo "--- release workflow for v$NEW ---"
for _ in 1 2 3 4 5 6; do
  if gh run list --workflow=release.yml --event push --branch "v$NEW" --limit 1 2>/dev/null | grep -q "v$NEW"; then
    break
  fi
  sleep 5
done
gh run list --workflow=release.yml --event push --branch "v$NEW" --limit 1 || true
