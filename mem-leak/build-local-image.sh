#!/usr/bin/env bash
#
# Build a local typeberry fuzz-target image whose V8 heap ceiling fits a
# memory-constrained container (fuzz-rss.sh runs it under --memory 1g).
#
# Why this is needed
# ------------------
# The published image bakes `--max-old-space-size=4096` straight into the
# entrypoint shebang (see bin/jam/build-for-npm.sh:77). In a 1GB container that
# 4GB old-space ceiling is nonsense: V8 believes it has 4GB of headroom, defers
# GC, and can grow well past the cgroup limit before it ever collects -> the
# kernel OOM-kills it for the wrong reason. We want the heap bounded *below* the
# container so that V8 is NOT the variable, and whatever OOM we observe is the
# off-heap LMDB mmap growth we are actually probing.
#
# Note: setting NODE_OPTIONS=--max-old-space-size=... at `docker run` time does
# NOT work -- the shebang flag is a command-line arg and command-line wins over
# NODE_OPTIONS. That's the whole reason we rebuild the image instead.
#
# This is a thin overlay on top of the published image (no full source rebuild),
# so it ships whatever PVM backend that image was built with.
#
# Tune via env:
#   MAX_OLD_SPACE=512 \
#   BASE_IMAGE=ghcr.io/fluffylabs/typeberry:latest \
#   LOCAL_IMAGE=typeberry:memrss-local \
#   ./mem-leak/build-local-image.sh
set -euo pipefail

BASE_IMAGE="${BASE_IMAGE:-ghcr.io/fluffylabs/typeberry:latest}"
LOCAL_IMAGE="${LOCAL_IMAGE:-typeberry:memrss-local}"
# MB. heapUsed was observed ~27MB / heapTotal ~38MB during the runs, so 512MB is
# ~13x headroom for the heap while still being half the 1g container -> leaves
# ~500MB for the off-heap mmap before the cgroup OOMs.
MAX_OLD_SPACE="${MAX_OLD_SPACE:-512}"

echo "== build heap-constrained local image =="
echo "   base=$BASE_IMAGE"
echo "   tag =$LOCAL_IMAGE"
echo "   --max-old-space-size=${MAX_OLD_SPACE}MB (was 4096 in the stock image)"
echo

docker version >/dev/null 2>&1 || { echo "FAILED: docker daemon not reachable (start Docker Desktop)"; exit 1; }

# Pull the base first so we rewrite the *current* published shebang.
echo "[build] pulling base image"
docker pull --platform linux/amd64 "$BASE_IMAGE" >/dev/null

# Thin overlay, empty build context (Dockerfile from stdin via `-`).
echo "[build] building $LOCAL_IMAGE"
docker build --platform linux/amd64 -t "$LOCAL_IMAGE" \
  --build-arg BASE_IMAGE="$BASE_IMAGE" \
  --build-arg MAX_OLD_SPACE="$MAX_OLD_SPACE" - <<'DOCKERFILE'
ARG BASE_IMAGE=ghcr.io/fluffylabs/typeberry:latest
FROM ${BASE_IMAGE}
ARG MAX_OLD_SPACE=512
USER root
# Rewrite the baked-in heap ceiling on the entrypoint shebang (line 1 only).
RUN sed -i "1 s/--max-old-space-size=[0-9]\+/--max-old-space-size=${MAX_OLD_SPACE}/" /app/index.js \
 && echo "[build] new shebang -> $(head -1 /app/index.js)"
USER typeberry
DOCKERFILE

echo
echo "== verify =="
docker run --rm --entrypoint head "$LOCAL_IMAGE" -1 /app/index.js
echo
echo "built: $LOCAL_IMAGE"
echo "next:  MEM_LIMIT=1g TARGET_IMAGE=$LOCAL_IMAGE ./mem-leak/fuzz-rss.sh"
echo "       (fuzz-rss.sh already defaults to both of those)"
