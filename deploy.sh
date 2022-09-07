#!/bin/bash

git pull

sudo docker build -t btcmap .

sudo docker container rm -f btcmap

sudo docker run -d -p 3333:3000 --name btcmap btcmap
