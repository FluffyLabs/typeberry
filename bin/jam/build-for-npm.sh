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

# When VERSION_SHA is set (e.g. Docker builds) append it to the version. The
# banner version is inlined by ncc from packages/core/utils/package.json: the
# `../../../package.json` import in that package resolves there through the
# workspace symlink, NOT to the repo root, so we must stamp utils (not root).
if [ -n "$VERSION_SHA" ]; then
  VERSION="$VERSION-$VERSION_SHA"
  npm pkg set version="$VERSION" -w packages/core/utils
fi

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
$BUILD ./packages/workers/block-authorship/index.ts -o $DIST_FOLDER/block-authorship

# copy some files that should be there
cp ./LICENSE $DIST_FOLDER/
cp ./README.md $DIST_FOLDER/

# Flatten one worker build into dist/jam: rename its index.js -> $2.mjs (and map),
# repoint the trailing sourceMappingURL (last line, via the `$` address) at the
# renamed map so worker crash traces resolve to the right TS source, then move
# everything up a level. $1 = worker subdir, $2 = bootstrap file basename.
flatten_worker() {
  cd "./$1"
  rm *.mjs || true
  mv index.js "$2.mjs"
  mv index.js.map "$2.mjs.map"
  sed -i "\$ s|sourceMappingURL=index.js.map|sourceMappingURL=$2.mjs.map|" "$2.mjs"
  mv * ../
  cd ../
}

# Flatten the workers structure
cd $DIST_FOLDER
flatten_worker importer bootstrap-importer
flatten_worker jam-network bootstrap-network
flatten_worker block-authorship bootstrap-generator

# copy worker wasm files
cp **/*.wasm ./ || true # ignore overwrite errors

# Make index.js executable and insert shebang with 6GB heap size (leaves headroom on an 8GB box)
echo '#!/usr/bin/env -S node --max-old-space-size=6144' > ./temp.js && cat ./index.js >> ./temp.js && mv ./temp.js ./index.js
chmod +x ./index.js

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
  "repository": {
    "type": "git",
    "url": "https://github.com/FluffyLabs/typeberry"
  },
  "author": "Fluffy Labs <hello@fluffylabs.dev>",
  "license": "MPL-2.0",
  "type": "module"
}
EOF
