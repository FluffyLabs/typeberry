#!/usr/bin/env bash
#
# Shared helpers for the fuzz-target memory-leak harnesses (run.sh, run-blocks.sh).
#
# A caller is expected to set: ROOT, OUT, SOCK, SPEC, HEAP_MB, TARGET_LOG and
# (optionally) TARGET_FLAGS before sourcing this file, then call:
#   start_target ; wait_for_socket ; ... ; snapshot <label> ; ...
# Sets the global PID and installs an EXIT trap that stops the target.

PID=""

cleanup() {
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "[run] stopping fuzz-target (pid $PID)"
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Start the target as a real node process so SIGUSR2 reaches V8 directly (not a
# tsx wrapper). `--config=default` is tiny + in-memory; `.flavor=` matches SPEC.
# TARGET_FLAGS carries harness-specific flags (e.g. --init-genesis-from-ancestry).
start_target() {
  rm -f "$SOCK"
  echo "[run] starting fuzz-target (logs -> $TARGET_LOG)"
  cd "$ROOT"
  node --import tsx \
    --heapsnapshot-signal=SIGUSR2 \
    --max-old-space-size="$HEAP_MB" \
    "$ROOT/bin/jam/index.ts" fuzz-target ${TARGET_FLAGS:-} \
    --config=default --config=".flavor=\"$SPEC\"" \
    "$SOCK" \
    >"$TARGET_LOG" 2>&1 &
  PID=$!
}

wait_for_socket() {
  echo -n "[run] waiting for socket"
  for _ in $(seq 1 120); do
    if [ -S "$SOCK" ]; then echo " ok (pid $PID)"; return 0; fi
    if ! kill -0 "$PID" 2>/dev/null; then
      echo " FAILED: target exited early"; tail -n 40 "$TARGET_LOG"; exit 1
    fi
    echo -n "."; sleep 0.5
  done
  echo " FAILED: socket never appeared"; tail -n 40 "$TARGET_LOG"; exit 1
}

# Take a heap snapshot via SIGUSR2 and move the resulting file to
# $OUT/<label>.heapsnapshot. V8 runs a full GC before dumping, and writes
# "Heap.<...>.heapsnapshot" into the target's cwd ($ROOT); we wait until the
# file stops growing (large heaps take a while to flush) before moving it.
snapshot() { # snapshot <label>
  local label="$1"
  local existing new size1 size2
  existing="$(ls "$ROOT"/Heap.*.heapsnapshot 2>/dev/null || true)"
  echo "[run] dumping '$label' snapshot (SIGUSR2 -> GC + heapdump)"
  kill -USR2 "$PID"

  new=""
  for _ in $(seq 1 1200); do
    sleep 0.5
    for f in "$ROOT"/Heap.*.heapsnapshot; do
      [ -e "$f" ] || continue
      case "$existing" in *"$f"*) : ;; *) new="$f" ;; esac
    done
    [ -n "$new" ] && break
  done
  if [ -z "$new" ]; then echo "[run] FAILED: no snapshot produced for '$label'"; exit 1; fi

  size1=0
  while :; do
    sleep 0.5
    size2="$(wc -c <"$new")"
    if [ "$size2" = "$size1" ] && [ "$size2" != "0" ]; then break; fi
    size1="$size2"
  done

  mv "$new" "$OUT/$label.heapsnapshot"
  echo "[run]   -> $OUT/$label.heapsnapshot ($(du -h "$OUT/$label.heapsnapshot" | cut -f1))"
}
