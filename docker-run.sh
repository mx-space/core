#!/bin/bash

command="node index.js \
  --redis_host=redis --db_host=mongo \
  --allowed_origins=${ALLOWED_ORIGINS} \
  --jwt_secret=${JWT_SECRET} \
  --color \
  "

if [ -n "$MONGO_CONNECTION" ]; then
  command+=" --db_connection_string=${MONGO_CONNECTION}"
fi

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

if [ -n "$THROTTLE_TTL" ]; then
  command+=" --throttle_ttl=${THROTTLE_TTL}"
fi

if [ -n "$THROTTLE_LIMIT" ]; then
  command+=" --throttle_limit=${THROTTLE_LIMIT}"
fi

exec $command
