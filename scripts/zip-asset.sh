#!/bin/sh
set -e
cp -R assets out
cp ecosystem.config.js out
node scripts/download-latest-admin-assets.js
cd out
zip -r ../release.zip ./*
