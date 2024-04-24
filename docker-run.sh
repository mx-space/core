#!/bin/bash

command="node index.js \
  --redis_host=${redis_host} \
  --redis_port=${redis_port} \
  --redis_password=${redis_password} \
  --db_host=${db_host} \
  --db_password=${db_password} \
  --db_user=${db_user} \
  --db_port=${db_port} \
  --allowed_origins=${ALLOWED_ORIGINS} \
  --jwt_secret=${JWT_SECRET} \
  --color \
  "

if [ -n "$CDN_CACHE_HEADER" ]; then
  command+=" --http_cache_enable_cdn_header"
fi

if [ -n "$FORCE_CACHE_HEADER" ]; then
  command+=" --http_cache_enable_force_cache_header"
fi

if [ -n "$ENCRYPT_KEY" ]; then
  command+=" --encrypt_key=${ENCRYPT_KEY}"
fi

if [ "$ENCRYPT_ENABLE" = "true" ]; then
  command+=" --encrypt_enable "
fi

exec $command
