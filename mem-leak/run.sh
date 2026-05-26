#!/usr/bin/env bash
#
# Memory-leak workflow for the typeberry fuzz-target, driven by a SINGLE
# isolated StateTransition trace replayed many times. See drive.ts for details.
#
#   1. start `jam fuzz-target` (with --init-genesis-from-ancestry) under V8's
#      --heapsnapshot-signal=SIGUSR2
#   2. warm it up so one-time lazy init is excluded from the baseline
#   3. BASELINE heap snapshot
#   4. drive N Initialize+ImportBlock iterations through the fuzz socket
#   5. AFTER heap snapshot
#   6. shut the target down
#
# Load the two .heapsnapshot files in Chrome DevTools -> Memory -> "Comparison"
# and sort by Delta / # New to see which constructors retained objects.
#
# Throwaway debug tool, NOT committed. Tune via env vars:
#   ITERATIONS=1000 WARMUP=5 SPEC=tiny SOCK=/tmp/jam_target.sock TRACE=... ./run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/mem-leak/snapshots"
mkdir -p "$OUT"

SOCK="${SOCK:-/tmp/jam_target.sock}"
SPEC="${SPEC:-tiny}"
WARMUP="${WARMUP:-5}"
ITERATIONS="${ITERATIONS:-1000}"
TRACE="${TRACE:-$ROOT/test-vectors-local/traces/00886505.bin}"
HEAP_MB="${HEAP_MB:-12288}"
TARGET_LOG="$OUT/target.log"
# the single-block trace must skip parent/state-root verification
TARGET_FLAGS="--init-genesis-from-ancestry"

TSX="$ROOT/node_modules/.bin/tsx"
# shellcheck source=lib.sh
source "$ROOT/mem-leak/lib.sh"

echo "== fuzz-target memory-leak run (single trace) =="
echo "   spec=$SPEC warmup=$WARMUP iterations=$ITERATIONS"
echo "   socket=$SOCK trace=$TRACE"
echo "   snapshots -> $OUT"
echo

drive() { # drive <iterations>
  "$TSX" "$ROOT/mem-leak/drive.ts" \
    --socket="$SOCK" --spec="$SPEC" --trace="$TRACE" --iterations="$1"
}

start_target
wait_for_socket

echo "[run] warmup: $WARMUP iteration(s)"
drive "$WARMUP"
snapshot baseline

echo "[run] main load: $ITERATIONS iteration(s)"
drive "$ITERATIONS"
snapshot after

echo
echo "== done =="
echo "baseline: $OUT/baseline.heapsnapshot"
echo "after:    $OUT/after.heapsnapshot"
echo "Open both in Chrome DevTools (Memory > Comparison) to find what grew."
