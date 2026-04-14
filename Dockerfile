FROM oven/bun:1.2-slim

RUN useradd -d /app -m typeberry

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lock ./

COPY tsconfig.json ./
COPY bunfig.toml ./
COPY start.sh ./

COPY patches/ ./patches/
COPY bin/ ./bin/
COPY packages/ ./packages/
COPY benchmarks/ ./benchmarks/

RUN chown -R typeberry /app

USER typeberry

# Install dependencies
RUN bun install --frozen-lockfile

# Make sure that anyone can create a database
RUN mkdir ./database && chmod 777 ./database
# Make start script runable
RUN chmod +x /app/start.sh

ENTRYPOINT ["/app/start.sh"]
