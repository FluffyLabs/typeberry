#!/bin/bash
set -ex

# This script compiles the project into "single" JS file (it's actually one per worker thread)
# using @vercel/ncc. The result is in `./dist/jam`

VERSION=$(node -p "require('./package.json').version")
DESCRIPTION=$(node -p "require('./package.json').description")

# Start from the top-level project directory
cd ../..

DIST_FOLDER=./dist/jam

# clean dist file
mkdir $DIST_FOLDER || true
rm -rf $DIST_FOLDER/*


# Build the main binary
BUILD="npx @vercel/ncc build -a -s -e lmdb -e @matrixai/quic -e tsx/esm/api"
$BUILD ./bin/jam/index.ts -o $DIST_FOLDER

# Fix un-compiled worker files to point to the ones we will compile manually.
#
# Despite using `-a` flag, @vercel/ncc does not bundle the worker files,
# so they still point to some external files via `import` statements.
# To fix that, we manually build workers and move the files inside.

# Build all workers separately and then the main binary
$BUILD ./packages/workers/importer/index.ts -o $DIST_FOLDER/importer
$BUILD ./packages/workers/jam-network/index.ts -o $DIST_FOLDER/jam-network
$BUILD ./packages/workers/block-generator/index.ts -o $DIST_FOLDER/block-generator

# copy some files that should be there
cp ./LICENSE $DIST_FOLDER/
cp ./README.md $DIST_FOLDER/

# Flatten the workers structure
cd $DIST_FOLDER

cd ./importer
rm *.mjs || true
mv index.js bootstrap-importer.mjs
mv index.js.map bootstrap-importer.mjs.map
mv * ../
cd ../jam-network
rm *.mjs || true
mv index.js bootstrap-network.mjs
mv index.js.map bootstrap-network.mjs.map
mv * ../
cd ../block-generator
rm *.mjs || true
mv index.js bootstrap-generator.mjs
mv index.js.map bootstrap-generator.mjs.map
mv * ../
cd ../

# copy worker wasm files
cp **/*.wasm ./ || true # ignore overwrite errors

# Make index.js executable and insert shebang
echo '#!/usr/bin/env node' > ./temp.js && cat ./index.js >> ./temp.js && mv ./temp.js ./index.js
chmod +x ./index.js

if [ -z "$IS_RELEASE" ]; then
  SHA=$(git rev-parse --short HEAD)
  VERSION="$VERSION-$SHA"
fi

# build package.json file
cat > ./package.json << EOF
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
    "@matrixai/quic": "2.0.9"
  },
  "homepage": "https://typeberry.dev",
  "author": "Fluffy Labs <hello@fluffylabs.dev>",
  "license": "MPL-2.0",
  "type": "module"
}
EOF
