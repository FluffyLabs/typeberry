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
# Tight cgroup cap so we can see whether the off-heap LMDB growth actually OOMs
# the process or just gets reclaimed. --memory-swap == --memory disables swap
# (set below), so the kernel can't paper over the limit -> a clean OOM signal.
# Override with MEM_LIMIT= (empty) to run uncapped again.
MEM_LIMIT="${MEM_LIMIT:-1g}"
RUN_MINUTES="${RUN_MINUTES:-}"      # empty = run until graymatter finishes NUM_BLOCKS

# Default to the locally-built, heap-constrained image (see build-local-image.sh):
# the published image bakes --max-old-space-size=4096 into its shebang, which is
# nonsense in a 1g container and can't be lowered via NODE_OPTIONS. Override with
# TARGET_IMAGE=ghcr.io/fluffylabs/typeberry:latest to use the stock image.
TARGET_IMAGE="${TARGET_IMAGE:-typeberry:memrss-local}"
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

# The heap-constrained local image must be built first; remote images are pulled
# on demand by `docker run`, so only hard-fail for the local tag.
if ! docker image inspect "$TARGET_IMAGE" >/dev/null 2>&1; then
  case "$TARGET_IMAGE" in
    typeberry:memrss-local)
      echo "FAILED: local image '$TARGET_IMAGE' not found. Build it first:"
      echo "    MAX_OLD_SPACE=512 ./mem-leak/build-local-image.sh"
      exit 1 ;;
    *) echo "[run] '$TARGET_IMAGE' not present locally; docker run will pull it" ;;
  esac
fi

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

# Off-heap capture artifacts (the in-process sampler can't see these):
#   native.csv  parsed /proc/1/smaps_rollup breakdown + on-disk LMDB size
#   native.log  full smaps_rollup + `ls -l /shared/data` per sample
NATIVE_CSV="$OUT/native.csv"
NATIVE_LOG="$OUT/native.log"
echo "ts,iso,tag,rss_kb,pss_kb,anon_kb,shared_clean_kb,shared_dirty_kb,private_clean_kb,private_dirty_kb,db_du_kb" >"$NATIVE_CSV"
: >"$NATIVE_LOG"

# --- 2. start typeberry (env-only fuzz mode + injected sampler) ---
MEM_ARGS=()
if [ -n "$MEM_LIMIT" ]; then
  MEM_ARGS=(--memory "$MEM_LIMIT" --memory-swap "$MEM_LIMIT")
fi

echo "[run] starting typeberry fuzz-target ($TB)"
# --cap-add SYS_PTRACE: capture_native reads PID 1's /proc/1/smaps_rollup from an
# exec'd process, which needs PTRACE_MODE_READ; Docker's default caps drop it, so
# without this the smaps capture comes back empty.
docker run -d --name "$TB" \
  --platform linux/amd64 \
  --network none \
  --cap-add SYS_PTRACE \
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

# --- target liveness / OOM helpers ---
target_running() { [ "$(docker inspect -f '{{.State.Running}}' "$TB" 2>/dev/null)" = "true" ]; }
report_target_exit() {
  local status oom code
  status="$(docker inspect -f '{{.State.Status}}' "$TB" 2>/dev/null || echo '?')"
  oom="$(docker inspect -f '{{.State.OOMKilled}}' "$TB" 2>/dev/null || echo '?')"
  code="$(docker inspect -f '{{.State.ExitCode}}' "$TB" 2>/dev/null || echo '?')"
  echo "[run] target state: status=$status OOMKilled=$oom exitCode=$code"
  if [ "$oom" = "true" ] || [ "$code" = "137" ]; then
    echo "[run] >>> fuzz-target was OOM-KILLED under mem_limit=$MEM_LIMIT <<<"
  fi
}

# --- native (off-heap) capture: smaps_rollup breakdown + on-disk LMDB size ---
# Runs from the host via `docker exec` (the in-process sampler can't read /proc
# or du the data dir). -u root so it works regardless of the image's run user.
# Parsing is done here (host awk) so the slim target image needs no extra tools.
capture_native() { # capture_native <tag>
  local tag="${1:-}" ts iso rollup du_kb
  target_running || return 0
  ts="$(date +%s)"
  iso="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  rollup="$(docker exec -u root "$TB" cat /proc/1/smaps_rollup 2>/dev/null || true)"
  if [ -z "$rollup" ]; then
    echo "=== $iso tag=$tag: smaps_rollup unreadable (missing --cap-add SYS_PTRACE? old kernel?) ===" >>"$NATIVE_LOG"
    return 0
  fi
  # `du -sk` = real on-disk blocks (not the sparse mmap apparent size).
  du_kb="$(docker exec -u root "$TB" du -sk /shared/data 2>/dev/null | awk '{print $1; exit}' || true)"
  {
    echo "=== $iso tag=$tag db_du_kb=${du_kb:-?} ==="
    echo "$rollup"
    docker exec -u root "$TB" sh -c 'ls -l /shared/data' 2>/dev/null || true
    echo
  } >>"$NATIVE_LOG"
  printf '%s\n' "$rollup" | awk -v ts="$ts" -v iso="$iso" -v tag="$tag" -v du="${du_kb:-}" '
    /^Rss:/{rss=$2} /^Pss:/{pss=$2} /^Anonymous:/{anon=$2}
    /^Shared_Clean:/{sc=$2} /^Shared_Dirty:/{sd=$2}
    /^Private_Clean:/{pc=$2} /^Private_Dirty:/{pd=$2}
    END{printf "%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n", ts,iso,tag,rss,pss,anon,sc,sd,pc,pd,du}
  ' >>"$NATIVE_CSV"
}

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
capture_native baseline

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
TARGET_DIED=0
i=0
while :; do
  # The OOM we are hunting kills the TARGET, so watch it first.
  if ! target_running; then
    echo "[run] target stopped running mid-session"
    report_target_exit
    echo "[run] last mem row: $(tail -n 1 "$OUT/mem.csv" 2>/dev/null)"
    TARGET_DIED=1
    docker stop -t 5 "$SRC" >/dev/null 2>&1 || true
    break
  fi
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
    capture_native loop
    echo "[run] ...running. mem: $(tail -n 1 "$OUT/mem.csv" 2>/dev/null)"
    echo "[run]            native: $(tail -n 1 "$NATIVE_CSV" 2>/dev/null)"
  fi
  sleep 5
done

src_exit="$(docker inspect -f '{{.State.ExitCode}}' "$SRC" 2>/dev/null || echo '?')"
echo "[run] graymatter source finished (exit code $src_exit)"

# --- 6. after snapshot (only if the target survived the run) ---
if [ "$TARGET_DIED" = "1" ] || ! target_running; then
  echo "[run] target not running -> skipping 'after' snapshot"
else
  capture_native after
  snapshot after
fi

# --- 7. summary ---
echo
echo "== done =="
echo "baseline: $OUT/baseline.heapsnapshot"
echo "after:    $OUT/after.heapsnapshot"
echo "mem csv:  $OUT/mem.csv"
echo "native:   $OUT/native.csv  $OUT/native.log"
echo "logs:     $OUT/target.log  $OUT/source.log"
echo
echo "-- target final state (mem_limit=${MEM_LIMIT:-none}) --"
report_target_exit
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
echo "-- off-heap: smaps_rollup + on-disk LMDB, first vs last (kB) --"
awk -F, 'NR==2{f=$0} END{
  if (NR < 2) { print "  (no native samples captured)"; exit }
  split(f,a,","); split($0,b,",");
  printf "                  first        last       delta\n";
  printf "rss          %10s %10s %10s\n", a[4], b[4], b[4]-a[4];
  printf "anon         %10s %10s %10s\n", a[6], b[6], b[6]-a[6];
  printf "priv_dirty   %10s %10s %10s\n", a[10], b[10], b[10]-a[10];
  printf "db_on_disk   %10s %10s %10s\n", a[11], b[11], b[11]-a[11];
}' "$NATIVE_CSV"
echo
echo "Reading the off-heap table:"
echo " - rss grows but it is ~all clean file-backed mmap (db_on_disk tracks it,"
echo "   anon/priv_dirty stay small) -> reclaimable page cache. A hard OOM then"
echo "   means the cgroup cap counted that cache, not true RAM exhaustion."
echo " - anon / priv_dirty grow with rss -> genuinely unreclaimable native growth."
echo
echo "If rss grew but heapUsed/rss-heap tells you it is non-heap, the snapshot"
echo "diff will be ~empty (expected). Otherwise compare the two snapshots in"
echo "Chrome DevTools > Memory > Comparison."
