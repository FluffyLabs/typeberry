FROM node:22
WORKDIR /app
COPY package.json package-lock.json ./
COPY . .
RUN npm ci
RUN npm install -g ts-node typescript
WORKDIR /app/tools/codec-api
CMD [ "ts-node", "src/index.ts" ]
