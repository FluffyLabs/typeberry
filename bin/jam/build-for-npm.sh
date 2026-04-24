#!/bin/bash
set -ex

# This script bundles the project into JS files using bun build (targeting node).
# The result is in ./dist/jam — a self-contained npm package.

VERSION=$(bun -e "console.log(require('./package.json').version)")
DESCRIPTION=$(bun -e "console.log(require('./package.json').description)")

# Resolve the top-level project directory (two levels up from bin/jam)
ROOT=$(cd ../.. && pwd)
DIST_FOLDER="$ROOT/dist/jam"

# clean dist folder
rm -rf "$DIST_FOLDER"
mkdir -p "$DIST_FOLDER"

# Common externals: native deps that must be installed at runtime
EXTERNALS="--external lmdb --external @matrixai/quic --external @typeberry/native"

# Build the main entry point
bun build --target=node $EXTERNALS \
  --outfile "$DIST_FOLDER/index.js" \
  "$ROOT/bin/jam/index.ts"

# Build workers separately (they run in worker_threads, referenced via new URL())
bun build --target=node $EXTERNALS \
  --outfile "$DIST_FOLDER/bootstrap-importer.ts" \
  "$ROOT/packages/workers/importer/bootstrap-importer.ts"

bun build --target=node $EXTERNALS \
  --outfile "$DIST_FOLDER/bootstrap-network.ts" \
  "$ROOT/packages/workers/jam-network/bootstrap-network.ts"

bun build --target=node $EXTERNALS \
  --outfile "$DIST_FOLDER/bootstrap-generator.ts" \
  "$ROOT/packages/workers/block-authorship/bootstrap-generator.ts"

# Copy repo files
cp "$ROOT/LICENSE" "$DIST_FOLDER/"
cp "$ROOT/README.md" "$DIST_FOLDER/"

# Make index.js executable and insert shebang with 8GB heap size
TEMP="$DIST_FOLDER/temp.js"
echo '#!/usr/bin/env -S node --max-old-space-size=8192' > "$TEMP"
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
  "name": "@typeberry/jam",
  "version": "$VERSION",
  "description": "$DESCRIPTION",
  "main": "./index.js",
  "bin": {
    "jam": "./index.js"
  },
  "dependencies": {
    "lmdb": "3.1.3",
    "@matrixai/quic": "2.0.9",
    "@typeberry/native": "0.2.0-74dd7d7"
  },
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
