#!/bin/bash

MAX_RETRIES=20
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

docker images

(docker-compose up &)

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
  kill -9 $p
  exit 0
fi
