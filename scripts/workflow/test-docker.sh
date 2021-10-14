#!/bin/bash

MAX_RETRIES=60
# Try running the docker and get the output
# then try getting homepage in 3 mins

docker -v

if [[ $? -ne 0 ]]; then
  echo "failed to run docker"
  exit 1
fi

docker-compose -v

if [[ $? -ne 0 ]]; then
  echo "failed to run docker-compose"
  exit 1
fi

curl https://cdn.jsdelivr.net/gh/mx-space/server-next@master/docker-compose.yml >docker-compose.yml

docker-compose up -d

if [[ $? -ne 0 ]]; then
  echo "failed to run docker-compose instance"
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
  exit 1
else
  echo -e "\nSuccessfully acquire homepage, passing"
  exit 0
fi
