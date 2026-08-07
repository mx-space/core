#!/usr/bin/env bash
# Stands in for the operator approving a pairing code in a browser: signs in as
# the owner, waits for a pending device code, and approves it.
#
#   SPACE_SERVER=http://127.0.0.1:2444 \
#   SPACE_USERNAME=innei SPACE_PASSWORD=... \
#   PG_CONTAINER=mx-pg-dev PG_DATABASE=mx_ios_verify \
#   ./scripts/approve-device.sh
set -euo pipefail

SERVER=${SPACE_SERVER:?SPACE_SERVER is required}
USERNAME=${SPACE_USERNAME:?SPACE_USERNAME is required}
PASSWORD=${SPACE_PASSWORD:?SPACE_PASSWORD is required}
PG_CONTAINER=${PG_CONTAINER:-mx-pg-dev}
PG_DATABASE=${PG_DATABASE:-mx_ios_verify}
PG_USER=${PG_USER:-mx}
DEADLINE=$((SECONDS + ${TIMEOUT_SECONDS:-90}))

cookie_jar=$(mktemp)
trap 'rm -f "$cookie_jar"' EXIT

curl -sS -c "$cookie_jar" -X POST "$SERVER/api/v3/auth/sign-in/username" \
  -H 'content-type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" >/dev/null

echo "approver: signed in as $USERNAME"

while [ $SECONDS -lt $DEADLINE ]; do
  user_code=$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DATABASE" -tAc \
    "SELECT user_code FROM device_codes
     WHERE status = 'pending' AND client_id = 'space-ios' AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1" 2>/dev/null | tr -d '[:space:]')

  if [ -n "$user_code" ]; then
    # The server only accepts an approval from a session that has already
    # opened the verification page for that code, mirroring the browser flow.
    curl -sS -b "$cookie_jar" -c "$cookie_jar" \
      "$SERVER/api/v3/device?user_code=$user_code" >/dev/null

    echo "approver: approving $user_code"
    response=$(curl -sS -b "$cookie_jar" -X POST "$SERVER/api/v3/device/verify" \
      -H 'content-type: application/json' \
      -d "{\"userCode\":\"$user_code\",\"action\":\"approve\"}")
    echo "approver: $response"
    exit 0
  fi
  sleep 1
done

echo "approver: no pending space-ios code appeared before the deadline" >&2
exit 1
