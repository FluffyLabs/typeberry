# syntax=docker/dockerfile:1.7

# ----- Build stage -----
# Compiles the standalone jam binary with `bun build --compile --bytecode`.
# Uses the full bun image (not slim) so we have apt available for `zip`,
# which is invoked by build-for-bun.sh to package the artifact.
FROM oven/bun:1.3.13 AS builder

WORKDIR /build

RUN apt-get update \
  && apt-get install -y --no-install-recommends zip \
  && rm -rf /var/lib/apt/lists/*

# Copy source. node_modules/ and dist/ are excluded via .dockerignore.
COPY package.json ./
COPY bun.lock ./
COPY tsconfig.json ./
COPY bunfig.toml ./
COPY patches/ ./patches/
COPY bin/ ./bin/
COPY packages/ ./packages/
COPY benchmarks/ ./benchmarks/

RUN bun install --frozen-lockfile

# Map Docker's TARGETPLATFORM (linux/amd64, linux/arm64) to the platform
# names expected by build-for-bun.sh. IS_RELEASE=1 skips the git-sha suffix
# in VERSION (we don't have .git in the build context).
ARG TARGETPLATFORM
ARG IS_RELEASE=1
RUN case "${TARGETPLATFORM:-linux/amd64}" in \
      "linux/amd64") export PLATFORM=linux-x64 PLATFORM_GNU=linux-x64-gnu ;; \
      "linux/arm64") export PLATFORM=linux-arm64 PLATFORM_GNU=linux-arm64-gnu ;; \
      *) echo "Unsupported TARGETPLATFORM: ${TARGETPLATFORM}" >&2; exit 1 ;; \
    esac \
    && cd bin/jam \
    && IS_RELEASE="${IS_RELEASE}" ./build-for-bun.sh

# ----- Runtime stage -----
# Minimal Debian image. The compiled bun binary is mostly self-contained but
# the .node native addons (lmdb, quic, bandersnatch) are dynamically linked
# against glibc — bookworm-slim provides that.
FROM debian:bookworm-slim AS runtime

RUN useradd -d /app -m typeberry

WORKDIR /app

# Copy only the built artifact: jam binary + native .node files + prebuilds/.
COPY --from=builder --chown=typeberry:typeberry /build/dist/jam-bun/ /app/

# Make sure that anyone can create a database
RUN mkdir ./database && chmod 777 ./database

USER typeberry

ENTRYPOINT ["/app/jam"]
