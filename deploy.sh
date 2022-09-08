#!/bin/bash

git pull

sudo docker-compose build

sudo docker-compose up -d
