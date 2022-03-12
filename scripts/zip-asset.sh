#!/bin/sh
set -e
git submodule update --init --recursive
cp -R assets out
cp ecosystem.config.js out
node scripts/download-latest-admin-assets.js
cd out
zip -r ../release.zip ./*
