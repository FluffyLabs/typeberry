#!/bin/bash
set -ex

# This script compiles the project into "single" JS file (it's actually one per worker thread)
# using @vercel/ncc. The result is in `./dist/jam`

VERSION=$(node -p "require('./package.json').version")
DESCRIPTION=$(node -p "require('./package.json').description")

# Start from the top-level project directory
cd ../..

# These four are native/external modules that ncc can't bundle, so they ship as
# real prod deps and get installed by the `npm install` below. We read the
# versions from the packages that actually declare them instead of hardcoding,
# so the bundle never drifts from the rest of the workspace.
#
# @typeberry/native carries the bandersnatch native addon as platform-specific
# optionalDependencies. ncc can't bundle the runtime `require(<platformPkg>)`
# (the argument is computed at runtime), so shipping it as a dep lets npm pull
# the matching `.node` binary into dist/jam/node_modules. Otherwise the node
# falls back to the slower wasm impl.
#
# @fjall-js/fjall is the same story: a napi-rs native addon whose generated
# index.js uses CommonJS `__dirname` to locate its `.node` binary. Inlining it
# into the ESM bundle crashes at load with "__dirname is not defined", and even
# if it bundled it would freeze the build host's platform binary into the bundle
# (wrong for cross-platform deploys). Externalizing + shipping as a dep lets npm
# pull the matching platform binary, just like lmdb.
NATIVE_VERSION=$(node -p "require('./packages/core/crypto/package.json').dependencies['@typeberry/native']")
LMDB_VERSION=$(node -p "require('./packages/jam/database-lmdb/package.json').dependencies.lmdb")
QUIC_VERSION=$(node -p "require('./packages/core/networking/package.json').dependencies['@matrixai/quic']")
FJALL_VERSION=$(node -p "require('./packages/jam/database-fjall/package.json').dependencies['@fjall-js/fjall']")

# A missing/renamed dependency key makes `node -p` print the literal "undefined"
# and exit 0, so `set -e` won't catch it. Bail out here with a clear message
# instead of writing a broken "undefined" version into dist/jam/package.json.
for pair in "@typeberry/native=$NATIVE_VERSION" "lmdb=$LMDB_VERSION" "@matrixai/quic=$QUIC_VERSION" "@fjall-js/fjall=$FJALL_VERSION"; do
  name="${pair%%=*}"
  ver="${pair#*=}"
  if [ -z "$ver" ] || [ "$ver" = "undefined" ]; then
    echo "ERROR: could not resolve version for '$name' from its package.json" >&2
    exit 1
  fi
done

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
BUILD="npx @vercel/ncc build -a -s -e lmdb -e @matrixai/quic -e @fjall-js/fjall -e tsx/esm/api"
$BUILD ./bin/jam/index.ts -o $DIST_FOLDER

# Despite using `-a` flag, @vercel/ncc does not bundle the worker files,
# so they still point to some external files via `import` statements.
# To fix that, we manually build workers and move the files inside.

# NOTE: the entry MUST be `bootstrap-main.ts` (the file that actually calls
# `initWorker()` + `main()`), NOT `index.ts`. For some reason bundling
# `index.ts` produces a worker that does nothing on load so the app just
# hangs and does not do anything.
$BUILD ./packages/workers/importer/bootstrap-main.ts -o $DIST_FOLDER/importer
$BUILD ./packages/workers/jam-network/bootstrap-main.ts -o $DIST_FOLDER/jam-network
$BUILD ./packages/workers/block-authorship/bootstrap-main.ts -o $DIST_FOLDER/block-authorship

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
  # Portable in-place edit (BSD `sed -i` differs from GNU and breaks on macOS):
  # rewrite via a temp file instead of relying on `-i`.
  sed "\$ s|sourceMappingURL=index.js.map|sourceMappingURL=$2.mjs.map|" "$2.mjs" > "$2.mjs.tmp" && mv "$2.mjs.tmp" "$2.mjs"
  # Move the bundle up one level into $DIST_FOLDER. We can't use `mv * ../`:
  # workers that pull in telemetry also emit gRPC asset directories (proto/,
  # protoc-gen-validate/, xds/) that the main bundle - and earlier workers -
  # already created up there, and `mv` refuses to merge into a non-empty dir.
  tar cf - . | ( cd ../ && tar xf - )
  cd ../
  rm -rf "./$1"
}

# Flatten the workers structure
cd $DIST_FOLDER
flatten_worker importer bootstrap-importer
flatten_worker jam-network bootstrap-network
flatten_worker block-authorship bootstrap-generator

# copy worker wasm files
cp **/*.wasm ./ || true # ignore overwrite errors

# Make index.js executable and insert shebang with 7GB heap size limit
echo '#!/usr/bin/env -S node --max-old-space-size=7168' > ./temp.js && cat ./index.js >> ./temp.js && mv ./temp.js ./index.js
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
    "lmdb": "$LMDB_VERSION",
    "@matrixai/quic": "$QUIC_VERSION",
    "@fjall-js/fjall": "$FJALL_VERSION",
    "@typeberry/native": "$NATIVE_VERSION"
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
