#!/bin/bash

curl --output data.json "https://raw.githubusercontent.com/bubelov/btcmap-data/main/data.json"

rsync              \
  --checksum       \
  --recursive      \
  --verbose        \
  --exclude=".*/"  \
  --delete         \
  . root@bubelov.com:/var/www/btcmap.org

if [ $? != 0 ]; then
  echo 'Failed to deploy website'
  exit 1
fi
