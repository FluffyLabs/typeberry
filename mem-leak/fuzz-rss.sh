#!/usr/bin/env bash
#
# Long graymatter fuzz session against the typeberry fuzz-target, with RSS/heap
# capture. Both run as Docker containers (matches CI topology, and is the only
# way the socket works on macOS where the container lives in a Linux VM).
#
#   1. (re)create a shared docker volume for the IPC socket + on-disk LMDB
#   2. start typeberry (env-only fuzz mode) with the sampler injected via
#      NODE_OPTIONS, so it logs memoryUsage to mem.csv and dumps heap snapshots
#      on SIGUSR2
#   3. wait for readiness, chmod the socket, take a BASELINE snapshot
#   4. start the real graymatter fuzz source (--num-blocks NUM_BLOCKS)
#   5. let it run the whole session (mem.csv fills the entire time)
#   6. take an AFTER snapshot, tear everything down, print artifacts + a summary
#
# Read mem.csv FIRST. If rss climbs but heapUsed is flat, the growth is NOT in
# the JS heap (LMDB mmap / native / WASM) and the snapshot diff will show ~nothing
# -- that is itself the answer. If heapUsed climbs, open baseline.heapsnapshot +
# after.heapsnapshot in Chrome DevTools > Memory > Comparison.
#
# Throwaway debug tool, mirrors mem-leak/run.sh. NOT committed. Tune via env:
#   NUM_BLOCKS=100000 SPEC=tiny SAMPLE_SEC=5 MEM_LIMIT=2048m RUN_MINUTES=60 ./fuzz-rss.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/mem-leak/out"

SPEC="${SPEC:-tiny}"
NUM_BLOCKS="${NUM_BLOCKS:-100000}"
SAMPLE_SEC="${SAMPLE_SEC:-5}"
MEM_LIMIT="${MEM_LIMIT:-}"          # empty = no docker --memory limit (CI uses 2048m)
RUN_MINUTES="${RUN_MINUTES:-}"      # empty = run until graymatter finishes NUM_BLOCKS

TARGET_IMAGE="${TARGET_IMAGE:-ghcr.io/fluffylabs/typeberry:latest}"
SOURCE_IMAGE="${SOURCE_IMAGE:-ghcr.io/jambrains/graymatter/gm:conformance-fuzzer-latest}"

VOLUME="${VOLUME:-jam-memrss-vol}"
TB="tb-memrss-target"
SRC="tb-memrss-source"
SOCK="/shared/jam_target.sock"

echo "== typeberry fuzz-target RSS/heap run =="
echo "   spec=$SPEC num_blocks=$NUM_BLOCKS sample=${SAMPLE_SEC}s mem_limit=${MEM_LIMIT:-none} run_minutes=${RUN_MINUTES:-(until done)}"
echo "   target=$TARGET_IMAGE"
echo "   source=$SOURCE_IMAGE"
echo "   out -> $OUT"
echo "   NOTE: both images are linux/amd64; on Apple Silicon they run under"
echo "         emulation, so 100k blocks can be slow. Lower NUM_BLOCKS or use a"
echo "         Linux host if you need speed."
echo

cleanup() {
  echo "[run] cleanup"
  docker rm -f "$SRC" >/dev/null 2>&1 || true
  docker rm -f "$TB" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# --- 0. preflight ---
docker version >/dev/null 2>&1 || { echo "FAILED: docker daemon not reachable (start Docker Desktop)"; exit 1; }

# --- 1. shared volume + output dir ---
docker rm -f "$TB" "$SRC" >/dev/null 2>&1 || true
docker volume rm "$VOLUME" >/dev/null 2>&1 || true
docker volume create "$VOLUME" >/dev/null
# init /shared + the LMDB data dir with permissive perms (matches tests/common.ts)
docker run --rm --network none -v "$VOLUME:/shared" alpine \
  sh -c 'mkdir -p /shared/data && chmod 777 /shared /shared/data' >/dev/null

rm -rf "$OUT"
mkdir -p "$OUT"
cp "$ROOT/mem-leak/sampler.mjs" "$OUT/sampler.mjs"
chmod -R 777 "$OUT"   # so the in-container 'typeberry' user can write here

# --- 2. start typeberry (env-only fuzz mode + injected sampler) ---
MEM_ARGS=()
if [ -n "$MEM_LIMIT" ]; then
  MEM_ARGS=(--memory "$MEM_LIMIT" --memory-swap "$MEM_LIMIT")
fi

echo "[run] starting typeberry fuzz-target ($TB)"
docker run -d --name "$TB" \
  --network none \
  ${MEM_ARGS[@]+"${MEM_ARGS[@]}"} \
  -e JAM_FUZZ=1 \
  -e JAM_FUZZ_SPEC="$SPEC" \
  -e JAM_FUZZ_SOCK_PATH="$SOCK" \
  -e JAM_FUZZ_DATA_PATH=/shared/data \
  -e JAM_FUZZ_LOG_LEVEL=debug \
  -e JAM_LOG=log \
  -e MEM_OUT_DIR=/out \
  -e SAMPLE_SEC="$SAMPLE_SEC" \
  -e NODE_OPTIONS="--import=file:///out/sampler.mjs --expose-gc" \
  -v "$VOLUME:/shared" \
  -v "$OUT:/out" \
  "$TARGET_IMAGE" >/dev/null

# stream target logs to a file for debugging
docker logs -f "$TB" >"$OUT/target.log" 2>&1 &

# --- 3a. wait for readiness ("PVM Backend") and the socket to appear ---
echo -n "[run] waiting for target readiness"
for _ in $(seq 1 240); do
  if ! [ "$(docker inspect -f '{{.State.Running}}' "$TB" 2>/dev/null)" = "true" ]; then
    echo " FAILED: target exited early"; tail -n 60 "$OUT/target.log"; exit 1
  fi
  if grep -q "PVM Backend" "$OUT/target.log" 2>/dev/null &&
     docker run --rm --network none -v "$VOLUME:/shared" alpine test -S "$SOCK" 2>/dev/null; then
    echo " ok"; break
  fi
  echo -n "."; sleep 0.5
done
docker run --rm --network none -v "$VOLUME:/shared" alpine test -S "$SOCK" 2>/dev/null \
  || { echo " FAILED: socket never appeared"; tail -n 60 "$OUT/target.log"; exit 1; }

# graymatter connects as root; make the socket world-usable (matches CI chmodSocket)
docker run --rm --network none -v "$VOLUME:/shared" alpine chmod 777 "$SOCK" >/dev/null

# wait until the sampler has installed (so SIGUSR2 has a handler)
for _ in $(seq 1 40); do
  grep -q "\[sampler\] installed" "$OUT/target.log" 2>/dev/null && break
  sleep 0.5
done

# --- snapshot helper: signal target, wait for <label>.heapsnapshot to settle ---
snapshot() { # snapshot <label>
  local label="$1" f="$OUT/$1.heapsnapshot" s1 s2
  rm -f "$f"
  echo "[run] requesting '$label' snapshot (SIGUSR2 -> GC + heapdump)"
  docker kill --signal=USR2 "$TB" >/dev/null
  for _ in $(seq 1 1200); do sleep 0.5; [ -e "$f" ] && break; done
  [ -e "$f" ] || { echo "[run] FAILED: no '$label' snapshot produced"; tail -n 40 "$OUT/target.log"; exit 1; }
  s1=0
  while :; do
    sleep 0.5
    s2="$(wc -c <"$f" | tr -d ' ')"
    [ "$s2" = "$s1" ] && [ "$s2" != "0" ] && break
    s1="$s2"
  done
  echo "[run]   -> $f ($(du -h "$f" | cut -f1))"
}

# --- 3b. baseline snapshot (just-initialised target, before the load) ---
snapshot baseline

# --- 4. start the graymatter fuzz source ---
echo "[run] starting graymatter source ($SRC): $NUM_BLOCKS blocks, spec=$SPEC"
docker run -d --name "$SRC" \
  --network none \
  -v "$VOLUME:/shared" \
  --platform linux/amd64 \
  "$SOURCE_IMAGE" \
  fuzz-m1-source --spec "$SPEC" --num-blocks "$NUM_BLOCKS" --target "$SOCK" >/dev/null
docker logs -f "$SRC" >"$OUT/source.log" 2>&1 &

# --- 5. let the session run (heartbeat from mem.csv; honour RUN_MINUTES) ---
deadline=0
[ -n "$RUN_MINUTES" ] && deadline=$(( $(date +%s) + RUN_MINUTES * 60 ))
i=0
while :; do
  if ! [ "$(docker inspect -f '{{.State.Running}}' "$SRC" 2>/dev/null)" = "true" ]; then
    break
  fi
  if [ "$deadline" -ne 0 ] && [ "$(date +%s)" -ge "$deadline" ]; then
    echo "[run] RUN_MINUTES reached -> stopping source"
    docker stop -t 5 "$SRC" >/dev/null 2>&1 || true
    break
  fi
  i=$((i + 1))
  if [ $((i % 6)) -eq 0 ]; then   # ~every 30s
    echo "[run] ...running. last mem row: $(tail -n 1 "$OUT/mem.csv" 2>/dev/null)"
  fi
  sleep 5
done

src_exit="$(docker inspect -f '{{.State.ExitCode}}' "$SRC" 2>/dev/null || echo '?')"
echo "[run] graymatter source finished (exit code $src_exit)"

# --- 6. after snapshot (target still running) ---
snapshot after

# --- 7. summary ---
echo
echo "== done =="
echo "baseline: $OUT/baseline.heapsnapshot"
echo "after:    $OUT/after.heapsnapshot"
echo "mem csv:  $OUT/mem.csv"
echo "logs:     $OUT/target.log  $OUT/source.log"
echo
echo "-- memoryUsage delta (MB) --"
awk -F, 'NR==2{first=$0} END{
  split(first,a,","); split($0,b,",");
  printf "                 first        last       delta\n";
  printf "rss        %10.1f %10.1f %10.1f\n", a[3]/1048576, b[3]/1048576, (b[3]-a[3])/1048576;
  printf "heapUsed   %10.1f %10.1f %10.1f\n", a[5]/1048576, b[5]/1048576, (b[5]-a[5])/1048576;
  printf "external   %10.1f %10.1f %10.1f\n", a[6]/1048576, b[6]/1048576, (b[6]-a[6])/1048576;
  printf "rss-heap   %10.1f %10.1f %10.1f   <- non-heap (LMDB mmap / native)\n", (a[3]-a[5])/1048576, (b[3]-b[5])/1048576, ((b[3]-b[5])-(a[3]-a[5]))/1048576;
}' "$OUT/mem.csv"
echo
echo "If rss grew but heapUsed/rss-heap tells you it is non-heap, the snapshot"
echo "diff will be ~empty (expected). Otherwise compare the two snapshots in"
echo "Chrome DevTools > Memory > Comparison."
