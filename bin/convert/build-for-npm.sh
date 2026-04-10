#!/bin/bash
set -ex

# This script bundles the project into a single JS file using bun build.
# The result is in ./dist/convert

VERSION=$(bun -e "console.log(require('./package.json').version)")
DESCRIPTION=$(bun -e "console.log(require('./package.json').description)")

# Resolve the top-level project directory (two levels up from bin/convert)
ROOT=$(cd ../.. && pwd)
DIST_FOLDER="$ROOT/dist/convert"

# clean dist dir
rm -rf "$DIST_FOLDER"
mkdir -p "$DIST_FOLDER"

# Build the main binary
bun build --target=node \
  --outfile "$DIST_FOLDER/index.js" \
  "$ROOT/bin/convert/index.ts"

cp "$ROOT/LICENSE" "$DIST_FOLDER/"
cp "$ROOT/README.md" "$DIST_FOLDER/"

# Make index.js executable and insert shebang
TEMP="$DIST_FOLDER/temp.js"
echo '#!/usr/bin/env node' > "$TEMP"
cat "$DIST_FOLDER/index.js" >> "$TEMP"
mv "$TEMP" "$DIST_FOLDER/index.js"
chmod +x "$DIST_FOLDER/index.js"

if [ -z "$IS_RELEASE" ]; then
  SHA=$(git rev-parse --short HEAD)
  VERSION="$VERSION-$SHA"
fi

# build package.json file
cat > "$DIST_FOLDER/package.json" << EOF
{
  "name": "@typeberry/convert",
  "version": "$VERSION",
  "description": "$DESCRIPTION",
  "main": "./index.js",
  "bin": {
    "convert": "./index.js"
  },
  "dependencies": {},
  "homepage": "https://typeberry.dev",
  "repository": {
    "type": "git",
    "url": "https://github.com/FluffyLabs/typeberry"
  },
  "author": "Fluffy Labs <hello@fluffylabs.dev>",
  "license": "MPL-2.0",
  "type": "module"
}
EOF
