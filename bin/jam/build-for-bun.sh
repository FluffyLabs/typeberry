#!/bin/bash
set -ex

# Platform must be provided (e.g. darwin-arm64, linux-x64)
: "${PLATFORM:?Set PLATFORM (e.g. darwin-arm64, linux-x64)}"
# PLATFORM_GNU adds -gnu suffix for linux native packages (e.g. linux-x64-gnu)
: "${PLATFORM_GNU:=$PLATFORM}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
VERSION="$(cd "$SCRIPT_DIR" && bun -e 'console.log(require("./package.json").version)')"

DIST_FOLDER="$ROOT_DIR/dist/jam-bun"
rm -rf "${DIST_FOLDER:?}" "$ROOT_DIR/dist/jam-${PLATFORM}.zip"
mkdir -p "$DIST_FOLDER"

# Build the main binary. No --external flags — all JS is bundled.
# Native .node loading is intercepted by bun-entry.ts which patches both
# Module._resolveFilename and process.dlopen to redirect to sibling files.
bun build --compile \
  --target="bun-${PLATFORM}" \
  --outfile "$DIST_FOLDER/jam" \
  "$ROOT_DIR/bin/jam/bun-entry.ts"

# Copy platform-specific native addons next to the binary.
# lmdb uses node-gyp-build which looks for prebuilds/<platform>/ next to execPath.
# Filename includes the libc tag on linux (glibc/musl); darwin has no tag.
# We target glibc — the bun targets are linked against glibc.
case "${PLATFORM}" in
  linux-*) LMDB_PREBUILD="node.napi.glibc.node" ;;
  *)       LMDB_PREBUILD="node.napi.node" ;;
esac
mkdir -p "$DIST_FOLDER/prebuilds/${PLATFORM}"
cp "$(bun -e "console.log(require.resolve('@lmdb/lmdb-${PLATFORM}/${LMDB_PREBUILD}'))")" \
  "$DIST_FOLDER/prebuilds/${PLATFORM}/${LMDB_PREBUILD}"
# quic and bandersnatch are resolved via Module._resolveFilename patch.
cp "$(bun -e "console.log(require.resolve('@matrixai/quic-${PLATFORM}/node.napi.node'))")" \
  "$DIST_FOLDER/quic.node"

# Bandersnatch native package uses a different naming convention.
# The .node filename uses PLATFORM_GNU (so the linux file is
# bandersnatch.linux-x64-gnu.node, while darwin reuses PLATFORM_GNU=PLATFORM).
cp "$(bun -e "console.log(require.resolve('@typeberry/bandersnatch-native-${PLATFORM_GNU}/bandersnatch.${PLATFORM_GNU}.node'))")" \
  "$DIST_FOLDER/bandersnatch.node"

# Version stamp
if [ -z "$IS_RELEASE" ]; then
  SHA=$(git rev-parse --short HEAD)
  VERSION="$VERSION-$SHA"
fi
echo "$VERSION" > "$DIST_FOLDER/VERSION"

# Include a minimal README
cat > "$DIST_FOLDER/README.txt" << 'HEREDOC'
@typeberry/jam - Standalone Binary

Usage:
  ./jam --help              Show help
  ./jam --config=dev dev 1  Start dev node #1

All .node files must remain in the same directory as the jam binary.
The prebuilds/ directory is also required.

More info: https://github.com/FluffyLabs/typeberry
HEREDOC

# Package into a zip
cd "$DIST_FOLDER"
zip -r "../jam-${PLATFORM}.zip" .

echo "Built jam-${PLATFORM}.zip (version $VERSION)"
ls -lh "../jam-${PLATFORM}.zip"
