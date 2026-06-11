#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

TARGET=${1:-core}
fail=0

modified=$(git status --porcelain --untracked-files=no)
if [ -n "$modified" ]; then
  echo "RED modified/staged files:"
  echo "$modified"
  fail=1
fi

untracked=$(git ls-files --others --exclude-standard)
if [ -n "$untracked" ]; then
  echo "WARN untracked files (confirm unrelated to this release):"
  echo "$untracked"
fi

branch=$(git branch --show-current)
if [ "$branch" != "master" ]; then
  echo "RED on branch $branch (not master)"
  fail=1
fi

git fetch origin --quiet
read -r behind ahead <<<"$(git rev-list --left-right --count origin/master...HEAD)"
if [ "$behind" -gt 0 ]; then
  echo "RED behind origin/master by $behind"
  fail=1
else
  echo "OK ahead of origin/master by $ahead"
fi

case "$TARGET" in
  core)
    CURRENT=$(node -p "require('./apps/core/package.json').version")
    echo "core version: $CURRENT"
    echo "--- unreleased commits (apps/core) ---"
    git log "v$CURRENT"..HEAD --no-merges --pretty='%h %s%n%b' -- apps/core | sed '/^[[:space:]]*$/d'
    echo "--- apps/admin changed since v$CURRENT ---"
    admin_diff=$(git diff --stat "v$CURRENT" HEAD -- apps/admin | tail -1)
    echo "${admin_diff:-no changes}"
    ;;
  api-client|cli)
    DIR=packages/$TARGET
    CURRENT=$(node -p "require('./$DIR/package.json').version")
    NAME=$(node -p "require('./$DIR/package.json').name")
    echo "$TARGET version: $CURRENT"
    baseline=$(git log --all --grep="bump $NAME to v$CURRENT" --format=%H -n1 -- "$DIR/package.json" || true)
    if [ -z "$baseline" ]; then
      baseline=$(git log --all -G"\"version\": \"$CURRENT\"" --format=%H -n1 -- "$DIR/package.json" || true)
    fi
    if [ -n "$baseline" ]; then
      echo "--- unreleased commits ($DIR since ${baseline:0:7}) ---"
      git log "$baseline"..HEAD --no-merges --pretty='%h %s%n%b' -- "$DIR" | sed '/^[[:space:]]*$/d'
    else
      echo "WARN could not find release baseline for $NAME@$CURRENT; showing recent commits only"
      echo "--- recent commits ($DIR) ---"
      git log --no-merges --pretty='%h %s' -- "$DIR" | head -30
    fi
    ;;
  *)
    echo "usage: preflight.sh [core|api-client|cli]"
    exit 2
    ;;
esac

exit $fail
