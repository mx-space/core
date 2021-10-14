#!/bin/bash

MAX_RETRIES=60

node -v

if [[ $? -ne 0 ]]; then
  echo "failed to run node"
  exit 1
fi

nohup node out/index.js 1>/dev/null &
p=$!
echo "started server with pid $p"

if [[ $? -ne 0 ]]; then
  echo "failed to run node index.js"
  exit 1
fi

RETRY=3
curl -m 10 localhost:2333/api/v2

while [[ $? -ne 0 ]] && [[ $RETRY -lt $MAX_RETRIES ]]; do
  sleep 5
  ((RETRY++))
  echo "RETRY: ${RETRY}"
  curl -m 10 localhost:2333/api/v2
done

if [[ $RETRY -gt $MAX_RETRIES ]]; then
  echo "Unable to run, aborted"
  kill -9 $p
  exit 1
else
  echo -e "\nSuccessfully acquire homepage, passing"
  kill -9 $p
  exit 0
fi
