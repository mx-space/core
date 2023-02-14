#!/bin/sh
set -e
rm -rf assets/.git
cp -R assets out
cp ecosystem.config.js out
node scripts/download-latest-admin-assets.js
cd out
zip -r ../release.zip ./*
