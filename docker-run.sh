#!/bin/bash

command="node index.js --redis_host=redis --db_host=mongo \
  --allowed_origins=${ALLOWED_ORIGINS} \
  --jwt_secret=${JWT_SECRET} \
  --color"

if [ -n "$ENCRYPT_KEY" ]; then
  command+=" --encrypt_key=${ENCRYPT_KEY}"
fi

if [ "$ENCRYPT_ENABLE" = "true" ]; then
  command+=" --encrypt_enable=${ENCRYPT_ENABLE}"
fi

exec $command
