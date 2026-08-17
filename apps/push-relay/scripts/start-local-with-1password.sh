#!/usr/bin/env bash
# Start Push Relay locally with the Yohaku sandbox APNs key from 1Password.
# Requires: op CLI signed in, jq, and a local Postgres URL.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

ACCOUNT="${OP_ACCOUNT:-inneioss.1password.com}"
VAULT="${OP_VAULT:-Apple Developer}"
ITEM="${OP_ITEM:-Yohaku APNs Sandbox}"
KEY_ID="${YOHAKU_APNS_KEY_ID:-VUQAGR3F6U}"
TEAM_ID="${YOHAKU_APNS_TEAM_ID:-KAMM5N88X3}"
BUNDLE_ID="${YOHAKU_BUNDLE_ID:-in.innei}"
APP_ID="${YOHAKU_PUSH_APP_ID:-yohaku}"
PORT="${PUSH_RELAY_PORT:-8787}"
PUBLIC_URL="${PUSH_RELAY_PUBLIC_URL:-http://127.0.0.1:${PORT}}"

if [[ -f "$ROOT/apps/push-relay/.env.local" ]]; then
  # shellcheck disable=SC1091
  set -a
  source "$ROOT/apps/push-relay/.env.local"
  set +a
fi

: "${PUSH_RELAY_DATABASE_URL:?Set PUSH_RELAY_DATABASE_URL (e.g. in apps/push-relay/.env.local)}"
: "${PUSH_RELAY_DATA_KEY:?Set PUSH_RELAY_DATA_KEY (32-byte hex or base64, e.g. in .env.local)}"

if ! command -v op >/dev/null; then
  echo "1Password CLI (op) is required. Install with: brew install --cask 1password-cli" >&2
  exit 1
fi
if ! command -v jq >/dev/null; then
  echo "jq is required" >&2
  exit 1
fi

KEY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/yohaku-apns.XXXXXX")"
cleanup() {
  rm -rf "$KEY_DIR"
}
trap cleanup EXIT

KEY_PATH="$KEY_DIR/AuthKey_${KEY_ID}.p8"
op document get "$ITEM" \
  --vault "$VAULT" \
  --account "$ACCOUNT" \
  --out-file "$KEY_PATH"
chmod 600 "$KEY_PATH"

export PUSH_RELAY_PORT="$PORT"
export PUSH_RELAY_PUBLIC_URL="$PUBLIC_URL"
export PUSH_RELAY_DATABASE_URL
export PUSH_RELAY_DATA_KEY
export PUSH_RELAY_APPS_JSON
PUSH_RELAY_APPS_JSON="$(
  jq -nc \
    --arg id "$APP_ID" \
    --arg bundleId "$BUNDLE_ID" \
    --arg teamId "$TEAM_ID" \
    --arg keyId "$KEY_ID" \
    --arg privateKeyPath "$KEY_PATH" \
    '[{
      id: $id,
      bundleId: $bundleId,
      teamId: $teamId,
      keys: {
        development: {
          keyId: $keyId,
          privateKeyPath: $privateKeyPath
        }
      }
    }]'
)"

echo "Starting Push Relay for ${APP_ID} (${BUNDLE_ID}) on ${PUBLIC_URL}"
echo "APNs key loaded from op://${VAULT}/${ITEM}"

pnpm --filter @mx-space/push-relay db:migrate
exec pnpm --filter @mx-space/push-relay dev
