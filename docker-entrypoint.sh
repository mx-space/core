#!/bin/bash

command_args=""

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
    command_args+=" $CMD_ARG$(get_cmd_value "$CMD_ARG" ${@:3})"
    return
  fi
  
  # if environment variable is preset, use it
  if [ -n "${!VAR_NAME}" ]; then
    command_args+=" $CMD_ARG${!VAR_NAME}"
    return
  fi

  # if default value is not '@@NULL@@', use it
  if [ "$DEFAULT_VALUE" != "@@NULL@@" ]; then
    command_args+=" $CMD_ARG$DEFAULT_VALUE"
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
        command_args+=" $CMD_ARG"
        return
    fi
  
    # if environment variable is preset, use it
    if [ -n "${!VAR_NAME}" ]; then
      if [ "${!VAR_NAME}" = "true" ]; then
        command_args+=" $CMD_ARG"
      fi

      return
    fi

    # use default value
    if [ "$DEFAULT_VALUE" = "true" ]; then
      command_args+=" $CMD_ARG"
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

get_mongodb_configuration() {
  CMD=$@
  CONNECTION_STRING="mongodb://"

  if [ "$(is_in_cmd_with_value "--db_connection_string=" $CMD)" = "true" ]; then
    CONNECTION_STRING=$(get_cmd_value "--db_connection_string=" $CMD)
  else
    if [ "$(is_in_cmd_with_value "--db_user=" $CMD)" = "true" ]; then
      CONNECTION_STRING+="$(get_cmd_value "--db_user=" $CMD):************@"
    fi
    CONNECTION_STRING+="$(get_cmd_value "--db_host=" $CMD):$(get_cmd_value "--db_port=" $CMD)/$(get_cmd_value "--collection_name=" $CMD)"
    if [ "$(is_in_cmd_with_value "--db_options=" $CMD)" = "true" ]; then
      CONNECTION_STRING+="?$(get_cmd_value "--db_options=" $CMD)"
    fi
  fi

  echo $CONNECTION_STRING
}

# ================================

# ======= Environment Variables =======

declare -A valueMap=(
  [PORT]="value,--port=,2333"
  [DEMO]="switch,--demo,false"
  [ALLOWED_ORIGINS]="value,--allowed_origins=,localhost"
  [CONFIG_PATH]="value,--config_path=,@@NULL@@"

  # DB
  [DB_COLLECTION_NAME]="value,--collection_name=,mx-space"
  [DB_HOST]="value,--db_host=,127.0.0.1"
  [DB_PORT]="value,--db_port=,27017"
  [DB_USER]="value,--db_user=,@@NULL@@"
  [DB_PASSWORD]="value,--db_password=,@@NULL@@"
  [DB_OPTIONS]="value,--db_options=,@@NULL@@"
  [DB_CONNECTION_STRING]="value,--db_connection_string=,@@NULL@@"

  # Redis
  [REDIS_HOST]="value,--redis_host=,127.0.0.1"
  [REDIS_PORT]="value,--redis_port=,6379"
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


echo "============== Configurations =============="
echo "Listen Port: $(get_cmd_value "--port=" $command_args)"
echo "MongoDB: $(get_mongodb_configuration $command_args)"
echo "Redis: $(get_cmd_value "--redis_host=" $command_args):$(get_cmd_value "--redis_port=" $command_args)"
echo "Allowed Origins: $(get_cmd_value "--allowed_origins=" $command_args)"
echo "Config Path: $(if [ -z "$(get_cmd_value "--config_path=" $command_args)" ]; then echo "NULL"; else echo "$(get_cmd_value "--config_path=" $command_args)"; fi)"
echo "Encryption: $(get_boolean_str $(is_in_cmd "--encrypt_enable" $command_args))"
echo "Cluster: $(get_boolean_str $(is_in_cmd "--cluster" $command_args))"
echo "============================================"

command="node index.js $command_args"

exec $command
