#!/usr/bin/env bash
#
# Memory-leak workflow for the typeberry fuzz-target, driven by a CONCATENATED
# dump of consecutive real blocks (e.g. ../typeberry-testing/block-dumps/fallback.bin).
# See drive-blocks.ts for details.
#
#   1. start `jam fuzz-target` (NO --init-genesis-from-ancestry: these are real
#      chained blocks, parent-hash + state-root are checked) under V8's
#      --heapsnapshot-signal=SIGUSR2
#   2. warm it up with a few full passes so one-time lazy init is excluded
#   3. BASELINE heap snapshot
#   4. replay the whole block sequence PASSES times through the fuzz socket
#      (each pass re-Initializes to genesis, i.e. resetState on the target)
#   5. AFTER heap snapshot
#   6. shut the target down
#
# Load the two .heapsnapshot files in Chrome DevTools -> Memory -> "Comparison"
# and sort by Delta / # New to see which constructors retained objects.
#
# Throwaway debug tool, NOT committed. Tune via env vars:
#   PASSES=50 WARMUP=1 SPEC=tiny BLOCKS=... CHAINSPEC=... ./run-blocks.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/mem-leak/snapshots-blocks"
mkdir -p "$OUT"

SOCK="${SOCK:-/tmp/jam_target.sock}"
SPEC="${SPEC:-tiny}"
WARMUP="${WARMUP:-1}"
PASSES="${PASSES:-50}"
BLOCKS="${BLOCKS:-$ROOT/../typeberry-testing/block-dumps/fallback.bin}"
CHAINSPEC="${CHAINSPEC:-$ROOT/../typeberry-testing/block-dumps/chain-spec.json}"
HEAP_MB="${HEAP_MB:-12288}"
TARGET_LOG="$OUT/target.log"
# real chained blocks -> let the importer do full parent/state-root verification
TARGET_FLAGS=""

TSX="$ROOT/node_modules/.bin/tsx"
# shellcheck source=lib.sh
source "$ROOT/mem-leak/lib.sh"

echo "== fuzz-target memory-leak run (block dump) =="
echo "   spec=$SPEC warmup-passes=$WARMUP passes=$PASSES"
echo "   socket=$SOCK"
echo "   blocks=$BLOCKS"
echo "   chainspec=$CHAINSPEC"
echo "   snapshots -> $OUT"
echo

drive() { # drive <passes>
  "$TSX" "$ROOT/mem-leak/drive-blocks.ts" \
    --socket="$SOCK" --spec="$SPEC" --blocks="$BLOCKS" --chainspec="$CHAINSPEC" --passes="$1"
}

start_target
wait_for_socket

echo "[run] warmup: $WARMUP pass(es)"
drive "$WARMUP"
snapshot baseline

echo "[run] main load: $PASSES pass(es)"
drive "$PASSES"
snapshot after

echo
echo "== done =="
echo "baseline: $OUT/baseline.heapsnapshot"
echo "after:    $OUT/after.heapsnapshot"
echo "Open both in Chrome DevTools (Memory > Comparison) to find what grew."
