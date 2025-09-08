FROM node:22-bookworm

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

COPY start.sh ./start.sh
COPY bin/ ./bin/
COPY extensions/ ./extensions/
COPY configs/ ./configs/
COPY workers/ ./workers/

COPY packages/ ./packages/

# Make start script runable
RUN chmod +x /app/start.sh

ENTRYPOINT ["/app/start.sh"]
