FROM node:22-bookworm-slim

RUN useradd -d /app -m typeberry

WORKDIR /app

# Copy package files
COPY package*.json ./

COPY tsconfig.json ./
COPY start.sh ./

COPY bin/ ./bin/
COPY packages/ ./packages/

RUN chown -R typeberry /app

USER typeberry

# Install dependencies
# Ideally this would be done only after copying package*.json files,
# but if we do that the workspace is fucked up and it can't find any packages.
# So until we have a proper TS->JS build, we probably need to live with that.
RUN npm ci

# Make sure that anyone can create a database
RUN mkdir ./database && chmod 777 ./database
# Make start script runable
RUN chmod +x /app/start.sh

ENTRYPOINT ["/app/start.sh"]
