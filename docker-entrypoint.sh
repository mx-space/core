#!/bin/bash

set -euo pipefail

# Keep this entrypoint tiny:
# - `apps/core/src/app.config.ts` already supports argv + env fallback.
# - Here we only provide backward-compatible env aliases, a masked config summary,
#   and then exec the real command.

log_kv() {
  # log_kv "Key" "Value" ["Source"]
  local k="$1"
  local v="${2:-}"
  local src="${3:-}"
  if [ -n "$src" ]; then
    echo "- ${k}: ${v} (${src})"
  else
    echo "- ${k}: ${v}"
  fi
}

env_source() {
  # env_source VAR_NAME DEFAULT_VALUE
  local name="$1"
  local def="${2:-}"
  if [ -n "${!name:-}" ]; then
    echo "env"
  else
    echo "default:${def}"
  fi
}

mask_secret_hint() {
  # mask_secret_hint "secret" -> "<empty>" | "<set,len=...>"
  local raw="${1:-}"
  if [ -z "$raw" ]; then
    echo "<empty>"
  else
    echo "<set,len=${#raw}>"
  fi
}

apply_env_alias() {
  # apply_env_alias TARGET_VAR FALLBACK_VAR
  # If TARGET_VAR is empty and FALLBACK_VAR is set, copy it.
  local TARGET_VAR=$1
  local FALLBACK_VAR=$2
  if [ -z "${!TARGET_VAR:-}" ] && [ -n "${!FALLBACK_VAR:-}" ]; then
    export "$TARGET_VAR"="${!FALLBACK_VAR}"
  fi
}

parse_booleanish() {
  # returns: true | false | empty (unknown)
  case "${1:-}" in
  true | TRUE | 1 | yes | YES | on | ON) echo "true" ;;
  false | FALSE | 0 | no | NO | off | OFF) echo "false" ;;
  *) echo "" ;;
  esac
}

mask_mongo_password() {
  # mongodb://user:pass@host -> mongodb://user:************@host
  # mongodb+srv://user:pass@host -> mongodb+srv://user:************@host
  echo "${1:-}" | sed -E 's/(mongodb(\+srv)?:\/\/)([^:]+):([^@]+)@/\1\3:************@/'
}

mask_redis_password() {
  # redis://user:pass@host -> redis://user:************@host
  # rediss://user:pass@host -> rediss://user:************@host
  echo "${1:-}" | sed -E 's/(redis(s)?:\/\/)([^:\/]+):([^@]+)@/\1\3:************@/'
}

# Backward-compatible aliases (old env -> new env).
# NOTE: app.config.ts uses env fallback based on commander option names:
# - `--config` -> CONFIG
# - `--collection_name` -> COLLECTION_NAME
# - `--http_request_verbose` -> HTTP_REQUEST_VERBOSE
#
# Keep a tiny bit of provenance for logs.
REDIS_CONNECTION_STRING_ORIG="${REDIS_CONNECTION_STRING:-}"
apply_env_alias CONFIG CONFIG_PATH
apply_env_alias COLLECTION_NAME DB_COLLECTION_NAME
apply_env_alias HTTP_REQUEST_VERBOSE DEBUG
# Redis env compatibility: keep consistent with DB's `MONGO_CONNECTION` handling.
apply_env_alias REDIS_CONNECTION_STRING REDIS_CONNECTION

echo "Starting Mix Space"
echo "============== Entrypoint =============="
echo "- PWD: $(pwd)"
echo "- User: uid=$(id -u) gid=$(id -g)"
echo "- Node: $(node -v 2>/dev/null || echo '<node not found>')"
echo "- Args: ${*:-<none>}"
echo "============== Configurations =============="

log_kv "Listen Port" "${PORT:-2333}" "$(env_source PORT 2333)"
log_kv "Allowed Origins" "${ALLOWED_ORIGINS:-localhost}" "$(env_source ALLOWED_ORIGINS localhost)"
log_kv "Config Path" "${CONFIG:-NULL}" "$(env_source CONFIG NULL)"

# Mongo summary (prefer connection strings if present)
if [ -n "${MONGO_CONNECTION:-}" ]; then
  log_kv "MongoDB" "$(mask_mongo_password "$MONGO_CONNECTION")" "env:MONGO_CONNECTION"
elif [ -n "${DB_CONNECTION_STRING:-}" ]; then
  log_kv "MongoDB" "$(mask_mongo_password "$DB_CONNECTION_STRING")" "env:DB_CONNECTION_STRING"
else
  mongo_db="${COLLECTION_NAME:-mx-space}"
  mongo_host="${DB_HOST:-127.0.0.1}"
  mongo_port="${DB_PORT:-27017}"
  mongo_user="${DB_USER:-}"
  mongo_pass="${DB_PASSWORD:-}"
  mongo_options="${DB_OPTIONS:-}"

  mongo_auth=""
  if [ -n "$mongo_user" ] && [ -n "$mongo_pass" ]; then
    mongo_auth="${mongo_user}:************@"
  elif [ -n "$mongo_user" ]; then
    mongo_auth="${mongo_user}@"
  fi

  mongo_uri="mongodb://${mongo_auth}${mongo_host}:${mongo_port}/${mongo_db}"
  if [ -n "$mongo_options" ]; then
    mongo_uri="${mongo_uri}?${mongo_options}"
  fi

  log_kv "MongoDB" "$mongo_uri" "env:DB_*"
fi

# Redis summary
if [ -n "${REDIS_CONNECTION_STRING:-}" ]; then
  redis_conn_source="env:REDIS_CONNECTION_STRING"
  if [ -z "$REDIS_CONNECTION_STRING_ORIG" ] && [ -n "${REDIS_CONNECTION:-}" ]; then
    redis_conn_source="env:REDIS_CONNECTION (aliased to REDIS_CONNECTION_STRING)"
  fi
  log_kv "Redis" "$(mask_redis_password "$REDIS_CONNECTION_STRING")" "$redis_conn_source"
else
  redis_host="${REDIS_HOST:-127.0.0.1}"
  redis_port="${REDIS_PORT:-6379}"
  redis_pass="${REDIS_PASSWORD:-}"
  if [ -n "$redis_pass" ]; then
    log_kv "Redis" "redis://:************@${redis_host}:${redis_port}" "env:REDIS_*"
  else
    log_kv "Redis" "redis://${redis_host}:${redis_port}" "env:REDIS_*"
  fi
fi

encrypt_enable="$(parse_booleanish "${MX_ENCRYPT_ENABLE:-${ENCRYPT_ENABLE:-}}")"
if [ -z "$encrypt_enable" ] && [ -n "${MX_ENCRYPT_KEY:-${ENCRYPT_KEY:-}}" ]; then
  encrypt_enable="true"
fi
log_kv "Encryption" "${encrypt_enable:-false}" "env:MX_ENCRYPT_ENABLE/ENCRYPT_ENABLE (+key implies true)"
log_kv "Encrypt Key" "$(mask_secret_hint "${MX_ENCRYPT_KEY:-${ENCRYPT_KEY:-}}")" "env:MX_ENCRYPT_KEY/ENCRYPT_KEY"
log_kv "Encrypt Algorithm" "${ENCRYPT_ALGORITHM:-<default>}" "$(env_source ENCRYPT_ALGORITHM '<default>')"

cluster_enable="$(parse_booleanish "${CLUSTER:-}")"
log_kv "Cluster" "${cluster_enable:-false}" "$(env_source CLUSTER false)"
log_kv "Cluster Workers" "${CLUSTER_WORKERS:-<auto>}" "$(env_source CLUSTER_WORKERS '<auto>')"

log_kv "Disable Cache" "$(parse_booleanish "${DISABLE_CACHE:-}")" "$(env_source DISABLE_CACHE false)"

log_kv "HTTP Request Verbose" "$(parse_booleanish "${HTTP_REQUEST_VERBOSE:-}")" "$(env_source HTTP_REQUEST_VERBOSE false)"
log_kv "Debug Memory Dump" "$(parse_booleanish "${DEBUG_MEMORY_DUMP:-${MX_DEBUG_MEMORY_DUMP:-}}")" "env:DEBUG_MEMORY_DUMP/MX_DEBUG_MEMORY_DUMP"

log_kv "JWT Secret" "$(mask_secret_hint "${JWT_SECRET:-${JWTSECRET:-}}")" "env:JWT_SECRET/JWTSECRET"
log_kv "JWT Expire(d)" "${JWT_EXPIRE:-<default>}" "$(env_source JWT_EXPIRE '<default>')"

log_kv "Throttle TTL" "${THROTTLE_TTL:-<default>}" "$(env_source THROTTLE_TTL '<default>')"
log_kv "Throttle Limit" "${THROTTLE_LIMIT:-<default>}" "$(env_source THROTTLE_LIMIT '<default>')"

log_kv "HTTP Cache TTL" "${CACHE_TTL:-<default>}" "$(env_source CACHE_TTL '<default>')"
log_kv "CDN Cache Header" "${CDN_CACHE_HEADER:-<unset>}" "$(env_source CDN_CACHE_HEADER '<unset>')"
log_kv "Force Cache Header" "${FORCE_CACHE_HEADER:-<unset>}" "$(env_source FORCE_CACHE_HEADER '<unset>')"

log_kv "Disable Telemetry" "$(parse_booleanish "${MX_DISABLE_TELEMETRY:-}")" "$(env_source MX_DISABLE_TELEMETRY false)"

echo "============================================"

# Allow overriding the container command, e.g. `docker run ... bash`
if [ "${1:-}" != "" ] && [[ "${1:-}" != -* ]]; then
  echo "Exec: $*"
  exec "$@"
fi

echo "Exec: node main.mjs ${*:-<none>}"
exec node main.mjs "$@"
