# ---- Stage 1: build ----
FROM --platform=linux/amd64 node:25-bookworm-slim AS builder

# Short commit hash. Passed through to build-for-npm.sh as VERSION_SHA so the
# version is stamped with it (banner + manifest) and the image never looks like a
# clean release. Pass it at build time:
#   docker build --build-arg VERSION_SHA=$(git rev-parse --short HEAD) .
# If omitted, build-for-npm.sh produces a clean release version.
ARG VERSION_SHA=

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# build-for-npm.sh copies these into the bundle, so they must be in context.
COPY LICENSE README.md ./

COPY bin/ ./bin/
COPY packages/ ./packages/

# Install all dependencies
RUN npm ci

# Build the project. VERSION_SHA stamps the commit hash into the version (banner
# + manifest) and the worker sourcemap fixup happens inside the script too.
RUN cd bin/jam && VERSION_SHA="$VERSION_SHA" bash build-for-npm.sh

# Now inside dist install just prod deps
RUN cd dist/jam && npm install --omit=dev

# ---- Stage 2: runtime ----
FROM --platform=linux/amd64 node:25-bookworm-slim

RUN useradd -d /app -m typeberry

WORKDIR /app

# Only the bundle + its production node_modules. No source, no tsx, no devDeps.
COPY --from=builder --chown=typeberry:typeberry /app/dist/jam ./

# Make sure that anyone can create a database
RUN mkdir ./database && chmod 777 ./database

USER typeberry

# index.js has shebang with settings, so we can run directly
ENTRYPOINT ["./index.js"]
