#!/bin/bash
set -ex

# This script compiles the project into "single" JS file
# using @vercel/ncc. The result is in `./dist/convert`

VERSION=$(node -p "require('./package.json').version")
DESCRIPTION=$(node -p "require('./package.json').description")

# Start from the top-level project directory
cd ../..

DIST_FOLDER=./dist/convert

# clean dist dir
mkdir -p "${DIST_FOLDER}"
rm -rf "${DIST_FOLDER:?}"/*
# Build the main binary
BUILD="npx @vercel/ncc build -s -d"
$BUILD ./bin/convert/index.ts -o $DIST_FOLDER

cp ./LICENSE $DIST_FOLDER/
cp ./README.md $DIST_FOLDER/

# Make index.js executable and insert shebang
echo '#!/usr/bin/env node' > $DIST_FOLDER/temp.js && cat $DIST_FOLDER/index.js >> $DIST_FOLDER/temp.js && mv $DIST_FOLDER/temp.js $DIST_FOLDER/index.js
chmod +x $DIST_FOLDER/index.js

if [ -z "$IS_RELEASE" ]; then
  SHA=$(git rev-parse --short HEAD)
  VERSION="$VERSION-$SHA"
fi

# build package.json file
cat > $DIST_FOLDER/package.json << EOF
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
  "author": "Fluffy Labs <hello@fluffylabs.dev>",
  "license": "MPL-2.0",
  "type": "module"
}
EOF
