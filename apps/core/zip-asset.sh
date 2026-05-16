#!/bin/sh
set -e
# Copy core/out to $root/out
cp -r ./apps/core/out ./out

# Copy core ecosystem.config.cjs to $root/out
cp ./apps/core/ecosystem.config.cjs out
node ./apps/core/download-latest-admin-assets.js
cd out
zip -r ../release.zip ./*

rm -rf out
