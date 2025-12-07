#!/usr/bin/env bash

# Steamcmd likes to randomly fail, so retry a few times if it does
i=0
while test $i -lt 3; do
  i=$((i + 1))
  echo "Attempt $i"

  ./steamcmd.sh \
    +force_install_dir /gamedata \
    +login anonymous \
    +app_update 4940 validate \
    +exit

  test -f /gamedata/x64/server_linux && break
  echo "Attempt failed, trying again..."
  sleep 5
done
