FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=5678 \
    ROOMS_FILE=/data/chessquestia-rooms.json \
    AUTH_FILE=/data/chessquestia-auth.json

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /data && chown -R node:node /data /app

USER node
EXPOSE 5678

CMD ["node", "server.js"]
