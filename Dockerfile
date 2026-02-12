FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY server.js ./
COPY api/ ./api/
COPY lib/ ./lib/
COPY skills/ ./skills/

EXPOSE 8080

ENV PORT=8080
COPY serve.js ./

CMD ["node", "serve.js"]
