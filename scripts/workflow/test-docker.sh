#!/bin/bash

MAX_RETRIES=20
# Try running the docker and get the output
# then try getting homepage in 3 mins

docker -v

if [[ $? -ne 0 ]]; then
  echo "failed to run docker"
  exit 1
fi

if [[ $? -ne 0 ]]; then
  echo "failed to run docker-compose"
  exit 1
fi

docker images

# Ensure the locally built image is tagged as latest so docker compose uses it
# instead of pulling an older remote image
docker tag innei/mx-server innei/mx-server:latest 2>/dev/null || true

(docker compose up &)

if [[ $? -ne 0 ]]; then
  echo "failed to run docker-compose instance"
  exit 1
fi

RETRY=0

do_request() {
  docker ps -a
  curl -f -m 10 localhost:2333/api/v2 -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36'

}

do_request

while [[ $? -ne 0 ]] && [[ $RETRY -lt $MAX_RETRIES ]]; do
  sleep 5
  ((RETRY++))
  echo -e "RETRY: ${RETRY}\n"
  do_request
done
request_exit_code=$?

echo -e "\nrequest code: ${request_exit_code}\n"

if [[ $RETRY -gt $MAX_RETRIES ]]; then
  echo -n "Unable to run, aborted"
  kill -9 $p
  exit 1

elif [[ $request_exit_code -ne 0 ]]; then
  echo -n "Request error"
  kill -9 $p
  exit 1

else
  echo -e "\nSuccessfully acquire homepage, passing"

  # Verify backup tools exist in the app container
  echo -e "\n=== Checking backup tools in mx-server container ==="
  docker exec mx-server sh -c "command -v pg_dump >/dev/null 2>&1 && echo 'pg_dump: OK' || echo 'pg_dump: MISSING'"
  docker exec mx-server sh -c "command -v pg_restore >/dev/null 2>&1 && echo 'pg_restore: OK' || echo 'pg_restore: MISSING'"
  docker exec mx-server sh -c "command -v zip >/dev/null 2>&1 && echo 'zip: OK' || echo 'zip: MISSING'"
  docker exec mx-server sh -c "command -v unzip >/dev/null 2>&1 && echo 'unzip: OK' || echo 'unzip: MISSING'"
  docker exec mx-server sh -c "command -v rsync >/dev/null 2>&1 && echo 'rsync: OK' || echo 'rsync: MISSING'"

  # Fail if critical backup tools are missing
  if ! docker exec mx-server sh -c "command -v pg_dump >/dev/null 2>&1 && command -v pg_restore >/dev/null 2>&1"; then
    echo -e "\nERROR: pg_dump or pg_restore is missing in the container. Backup/restore will not work."
    docker compose down
    exit 1
  fi

  docker compose down
  exit 0
fi
