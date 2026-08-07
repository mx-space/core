#!/usr/bin/env bash
# Gives the verification instance the minimum content the UI test asserts on:
# a recently entry whose link owns its own paragraph, which is the only shape
# `UrlExtractorService.extractFromMarkdown` turns into a media card.
set -euo pipefail

SERVER=${SPACE_SERVER:?SPACE_SERVER is required}
USERNAME=${SPACE_USERNAME:?SPACE_USERNAME is required}
PASSWORD=${SPACE_PASSWORD:?SPACE_PASSWORD is required}
LINK=${SEED_LINK:-https://bgm.tv/subject/265}

cookie_jar=$(mktemp)
trap 'rm -f "$cookie_jar"' EXIT

curl -sS -c "$cookie_jar" -X POST "$SERVER/api/v3/auth/sign-in/username" \
  -H 'content-type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" >/dev/null

curl -sS -b "$cookie_jar" -X POST "$SERVER/api/v3/recently" \
  -H 'content-type: application/json' \
  -d "{\"content\":\"seeded for verification\n\n$LINK\"}" >/dev/null

echo "seed: posted a recently entry linking $LINK"
