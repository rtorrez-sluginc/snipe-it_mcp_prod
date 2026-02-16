FROM node:20-slim AS build

WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.http.json ./
COPY src-http ./src-http
RUN npm run build:http

FROM node:20-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/build-http ./build-http

# Run as non-root user
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

CMD ["node", "build-http/index.js"]
