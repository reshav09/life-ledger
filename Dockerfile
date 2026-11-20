# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-timeout=600000
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend that serves API + built frontend ----
FROM node:20-alpine

RUN apk add --no-cache tini wget openssl

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY backend/package*.json ./
RUN npm install --omit=dev --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-timeout=600000
COPY backend/ ./
COPY --from=frontend-build /frontend/dist ./public

RUN mkdir -p /app/backups /app/uploads && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]
