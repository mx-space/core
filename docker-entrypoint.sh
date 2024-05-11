#!/bin/bash

command="node index.js"

# ======= Script Variables =======
SV_FINAL_REDIS_URL=""
SV_FINAL_MONGO_URL=""
SV_FINAL_ENCRYPT_ENABLE=""

# ======= Helper Functions =======

get_boolean_str() {
  if [ "$1" = "true" ]; then
    echo "true"
  else
    echo "false"
  fi
}

is_in_cmd_with_value() {
  CMD_ARG=$1
  for arg in "${@:1}"
  do
    if [[ "$arg" == "$CMD_ARG"* ]] && [ -n "${arg#*=}" ]; then
      echo "true"
      return
    fi
  done

  echo "false"
}

set_value() {
  VAR_NAME=$1
  CMD_ARG=$2
  DEFAULT_VALUE=$3

  # if command line argument is preset, use it
  if [ "$(is_in_cmd_with_value "$CMD_ARG" ${@:3})" = "true" ]; then
    command+=" $CMD_ARG$(get_cmd_value "$CMD_ARG" ${@:3})"
    return
  fi
  
  # if environment variable is preset, use it
  if [ -n "${!VAR_NAME}" ]; then
    command+=" $CMD_ARG${!VAR_NAME}"
    return
  fi

  # if default value is not '@@NULL@@', use it
  if [ "$DEFAULT_VALUE" != "@@NULL@@" ]; then
    command+=" $CMD_ARG$DEFAULT_VALUE"
  fi
}

is_in_cmd() {
  CMD_ARG=$1
  for arg in "${@:2}"
  do
    if [[ "$arg" == "$CMD_ARG" ]]; then
      echo "true"
      return
    fi
  done

  echo "false"
}

set_switch() {
    VAR_NAME=$1
    CMD_ARG=$2
    DEFAULT_VALUE=$3

    # if command line argument is preset, use it
    if [ "$(is_in_cmd "$CMD_ARG" ${@:3})" = "true" ]; then
        command+=" $CMD_ARG"
        return
    fi
  
    # if environment variable is preset, use it
    if [ -n "${!VAR_NAME}" ]; then
      if [ "${!VAR_NAME}" = "true" ]; then
        command+=" $CMD_ARG"
      fi

      return
    fi

    # use default value
    if [ "$DEFAULT_VALUE" = "true" ]; then
      command+=" $CMD_ARG"
    fi
}

get_cmd_value() {
  CMD_ARG=$1
  for arg in "${@:2}"
  do
    if [[ "$arg" == "$CMD_ARG"* ]]; then
      echo "${arg#*=}"
      return
    fi
  done

  echo ""
}

# ================================

# ======= Environment Variables =======

declare -A valueMap=(
  [PORT]="value,--port=,2333"
  [DEMO]="switch,--demo,false"
  [ALLOWED_ORIGINS]="value,--allowed_origins=,@@NULL@@"
  [CONFIG_PATH]="value,--config_path=,@@NULL@@"

  # DB
  [DB_COLLECTION_NAME]="value,--db_collection_name=,@@NULL@@"
  [DB_HOST]="value,--db_host=,@@NULL@@"
  [DB_PORT]="value,--db_port=,@@NULL@@"
  [DB_USER]="value,--db_user=,@@NULL@@"
  [DB_PASSWORD]="value,--db_password=,@@NULL@@"
  [DB_OPTIONS]="value,--db_options=,@@NULL@@"
  [DB_CONNECTION_STRING]="value,--db_connection_string=,@@NULL@@"

  # Redis
  [REDIS_HOST]="value,--redis_host=,@@NULL@@"
  [REDIS_PORT]="value,--redis_port=,@@NULL@@"
  [REDIS_PASSWORD]="value,--redis_password=,@@NULL@@"
  [DISABLE_CACHE]="switch,--disable_cache,false"
 
  # JWT
  [JWT_SECRET]="value,--jwt_secret=,@@NULL@@"
  [JWT_EXPIRE]="value,--jwt_expire=,@@NULL@@"

  # Cluster
  [CLUSTER]="switch,--cluster,false"
  [CLUSTER_WORKERS]="value,--cluster_workers=,@@NULL@@"

  # Debug
  [DEBUG]="switch,--http_request_verbose,false"
  [DEBUG_MEMORY_DUMP]="switch,--debug_memory_dump,false"

  # Cache
  [CACHE_TTL]="value,--http_cache_ttl=,@@NULL@@"
  [CACHE_CDN_HEADER]="switch,--http_cache_enable_cdn_header=,false"
  [CACHE_FORCE_HEADER]="switch,--http_cache_enable_force_cache_header,false"

  # Security
  [ENCRYPT_ENABLE]="switch,--encrypt_enable,false"
  [ENCRYPT_KEY]="value,--encrypt_key=,@@NULL@@"
  [ENCRYPT_ALGORITHM]="value,--encrypt_algorithm=,@@NULL@@"

  # Throttle
  [THROTTLE_TTL]="value,--throttle_ttl=,@@NULL@@"
  [THROTTLE_LIMIT]="value,--throttle_limit=,@@NULL@@"

  # Color
  [COLOR]="switch,--color,true"
)

for key in "${!valueMap[@]}"; do
  IFS=',' read -ra tuple <<< "${valueMap[$key]}"
  TYPE=${tuple[0]}
  CMD_ARG=${tuple[1]}
  DEFAULT=${tuple[2]}

  if [ "$TYPE" = "value" ]; then
    set_value $key $CMD_ARG $DEFAULT $@
  elif [ "$TYPE" = "switch" ]; then
    set_switch $key $CMD_ARG $DEFAULT $@
  fi

done

# ====================================

echo "Starting Mix Space"

exec $command
