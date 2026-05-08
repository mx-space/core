#!/bin/bash

MAX_RETRIES=10

node -v

if [[ $? -ne 0 ]]; then
  echo "failed to run node"
  exit 1
fi

# Apply schema migrations as a release-phase step before booting the server.
# The app boot guard refuses to start if the schema is behind.
echo "Running database migrations..."
node apps/core/out/migrate.mjs
if [[ $? -ne 0 ]]; then
  echo "migrate.mjs failed"
  exit 1
fi

nohup node apps/core/out/main.mjs >/tmp/mx-server.log 2>&1 &
p=$!
echo "started server with pid $p"

if [[ $? -ne 0 ]]; then
  echo "failed to run node index.js"
  exit 1
fi

RETRY=0

do_request() {
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
  echo -e "\n--- ps check ---"
  ps -p $p -o pid,stat,etime,cmd || echo "process $p not running"
  echo -e "\n--- pid map ($p) ---"
  ls -la /proc/$p/fd 2>/dev/null | head -20 || true
  kill $p 2>/dev/null || true
  sleep 2
  echo -e "\n--- server log (/tmp/mx-server.log, tail 200) ---"
  tail -200 /tmp/mx-server.log || true
  kill -9 $p 2>/dev/null || true
  exit 1

else
  echo -e "\nSuccessfully acquire homepage, passing"
  kill -9 $p
  exit 0
fi
