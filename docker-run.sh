#!/bin/bash

command="node index.js --redis_host=redis --db_host=mongo \
  --allowed_origins=${ALLOWED_ORIGINS} \
  --jwt_secret=${JWT_SECRET} \
  --color \
  --http_cache_enable_cdn_header=${CDN_CACHE_HEADER} \
  --http_cache_enable_force_cache_header=${FORCE_CACHE_HEADER} \
  "

if [ -n "$ENCRYPT_KEY" ]; then
  command+=" --encrypt_key=${ENCRYPT_KEY}"
fi

if [ "$ENCRYPT_ENABLE" = "true" ]; then
  command+=" --encrypt_enable "
fi

exec $command
