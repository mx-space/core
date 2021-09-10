#!/bin/sh
pnpm run bundle
cp -R assets out
cd out
zip -r ../release.zip ./*