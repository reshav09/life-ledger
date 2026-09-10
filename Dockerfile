# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
# npm ci is faster and deterministic (uses the lock file exactly). The retry/timeout
# flags make the build tolerate a slow or flaky connection instead of failing outright.
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-timeout=600000
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend that serves the API + built frontend ----
FROM node:20-alpine

# tini handles PID 1 responsibilities (signal forwarding, zombie reaping)
# so "docker stop" sends SIGTERM to Node instead of SIGKILL after 10s.
RUN apk add --no-cache tini wget openssl

WORKDIR /app

# Non-root user for security — if the app is compromised, the attacker
# can't write to /etc/shadow or install packages.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY backend/package*.json ./
RUN npm install --omit=dev --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-timeout=600000
COPY backend/ ./
COPY --from=frontend-build /frontend/dist ./public

# Directories the app writes to must be owned by the non-root user
RUN mkdir -p /app/backups /app/uploads/health-reports && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000

# Docker-native health check — used by Compose `depends_on.condition: service_healthy`
# and by Kubernetes readiness probes when running without a dedicated probe config.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]
