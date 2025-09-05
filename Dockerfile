# Build stage
FROM node:22-bookworm AS build

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bin/ ./bin/
COPY packages/ ./packages/
COPY extensions/ ./extensions/
COPY configs/ ./configs/
COPY tools/ ./tools/
COPY workers/ ./workers/

# Install dependencies
RUN npm ci

# Runtime stage
FROM node:22-bookworm

WORKDIR /app

# Copy from build stage
COPY --from=build /app /app

# Copy start script
COPY docker-start.sh /app/start.sh
RUN chmod +x /app/start.sh

ENTRYPOINT ["/app/start.sh"]
