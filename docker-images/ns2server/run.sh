#!/usr/bin/env bash

_error() {
  echo "Aborting due to error"
  exit 1
}

trap _error ERR

NAME="$1"
MAP="$2"
PASSWORD="$3"
LAUNCH_CONFIG="$4"

echo "Fetching configs..."
# Fetch config from s3 (mods, configs, etc.)
BUCKET_NAME="$(aws ssm get-parameter --name "/NS2Arena/ConfigBucket/Name" | jq -r .Parameter.Value)"
aws s3 sync s3://$BUCKET_NAME/$LAUNCH_CONFIG /server
PLAYER_LIMIT="$(cat /server/config.json | jq -r .PlayerLimit)"
SPEC_LIMIT="$(cat /server/config.json | jq -r .SpecLimit)"

echo "Retrieving TaskArn"
TASK_ARN="$(curl ${ECS_CONTAINER_METADATA_URI_V4}/task | jq -r .TaskARN)"
echo "$TASK_ARN"
echo "Sending task success token"
aws stepfunctions send-task-success --task-token "${TASK_TOKEN}" --task-output "{\"TaskARN\": \"$TASK_ARN\"}"

_term() {
  echo "Caught SIGTERM, killing server"
  kill -TERM "$child" 2>/dev/null
}

trap _term SIGTERM

echo "Starting server"
/gamedata/x64/server_linux \
  -limit "$PLAYER_LIMIT" \
  -speclimit "$SPEC_LIMIT" \
  -password "$PASSWORD" \
  -name "$NAME" \
  -config_path /server/configs \
  -logdir /server/logs \
  -modstorage /server/modstore \
  -port 27015 \
  -map "$MAP" \
  -startmodserver \
  &
child="$!"
wait "$child"

echo "Server terminated"
