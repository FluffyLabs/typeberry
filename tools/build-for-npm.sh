#!/bin/sh
set -ex

# This script compiles the project into "single" JS file (it's actually one per worker thread)
# using @vercel/ncc. The result is in `./dist

DIST_FOLDER=./dist

# clean dist file
rm -rf $DIST_FOLDER/*

export RUNTIME=bundle
BUILD="npx @vercel/ncc build -a -s -e lmdb -e tsx/esm/api"

# Build the main binary
$BUILD ./bin/jam/index.ts -o $DIST_FOLDER

# Fix un-compiled worker files to point to the ones we will compile manually.
#
# Despite using `-a` flag, @vercel/ncc does not bundle the worker files,
# so they still point to some external files via `import` statements.
# To fix that, we manually build workers and create symlinks.

cd $DIST_FOLDER
rm ./bootstrap-importer.mjs && ln -s ./importer/index.js bootstrap-importer.mjs
rm ./bootstrap-network.mjs && ln -s ./jam-network/index.js bootstrap-network.mjs
rm ./bootstrap-generator.mjs && ln -s ./block-generator/index.js bootstrap-generator.mjs
cd -

# Build all workers separately and then the main binary
$BUILD ./workers/importer/index.ts -o $DIST_FOLDER/importer
cd $DIST_FOLDER/importer && rm bootstrap-bandersnatch.mjs && ln -s ../bandersnatch/index.js bootstrap-bandersnatch.mjs && cd -

$BUILD ./workers/jam-network/index.ts -o $DIST_FOLDER/jam-network
$BUILD ./workers/block-generator/index.ts -o $DIST_FOLDER/block-generator
$BUILD ./packages/jam/safrole/bandersnatch-wasm/bootstrap-bandersnatch.ts -o $DIST_FOLDER/bandersnatch

# copy worker wasm files
cp $DIST_FOLDER/**/*.wasm $DIST_FOLDER/
cp ./LICENSE $DIST_FOLDER/
cp ./README.md $DIST_FOLDER/

# build package.json file
echo '{
  "name": "@typeberry/jam",
  "version": "0.0.1",
  "description": "Typeberry - Typescript JAM implementation by Fluffy Labs team.",
  "main": "./index.js",
  "dependencies": {
    "lmdb": "3.1.3"
  },
  "homepage": "https://typeberry.dev",
  "author": "Fluffy Labs <hello@fluffylabs.dev>",
  "license": "MPL-2.0",
  "type": "module"
}' > $DIST_FOLDER/package.json
