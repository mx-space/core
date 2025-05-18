#!/bin/bash

set -e
# Add node_modules/.bin to PATH
export PATH="$(pwd)/node_modules/.bin:$(pwd)/../../node_modules/.bin:$PATH"

rimraf out
npm run build

# Check if RELEASE environment variable is set to true
if [ "$RELEASE" = "true" ]; then
  ncc build dist/src/main.js -o $(pwd)/out --minify -s
else
  ncc build dist/src/main.js -o $(pwd)/out -s
fi

chmod +x out/index.js
node scripts/after-bundle.js
