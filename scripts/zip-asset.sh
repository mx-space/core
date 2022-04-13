#!/bin/sh
set -e
git clone https://github.com/mx-space/assets.git --depth=1
rm -rf assets/.git
cp -R assets out
cp ecosystem.config.js out
node scripts/download-latest-admin-assets.js
cd out
zip -r ../release.zip ./*
