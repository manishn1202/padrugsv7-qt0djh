# -----------------------------
# Stage 1: Builder
# -----------------------------
FROM node:18-alpine AS builder

# Set working directory with proper permissions
WORKDIR /app
RUN chown -R node:node /app

# Install build dependencies and security tools
RUN apk add --no-cache python3 make g++ curl git

# Copy package files with ownership setting
COPY --chown=node:node package*.json ./
COPY --chown=node:node tsconfig*.json ./

# Switch to non-root user for build
USER node

# Install dependencies with strict security and cache optimization
RUN npm ci --ignore-scripts \
    && npm cache clean --force

# Copy source code with proper ownership
COPY --chown=node:node . .

# Build TypeScript code
RUN npm run build \
    && npm run test \
    && npm audit \
    && npm prune --production

# -----------------------------
# Stage 2: Production
# -----------------------------
FROM node:18-alpine

# Set production environment
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=2048" \
    TZ=UTC

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1000 gateway \
    && adduser -u 1000 -G gateway -s /bin/sh -D gateway \
    && mkdir -p /app \
    && chown gateway:gateway /app

# Set working directory
WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder --chown=gateway:gateway /app/dist ./dist
COPY --from=builder --chown=gateway:gateway /app/node_modules ./node_modules
COPY --from=builder --chown=gateway:gateway /app/package.json ./package.json

# Switch to non-root user
USER gateway

# Security hardening
RUN npm config set ignore-scripts true \
    && npm config set audit true \
    && npm config set fund false

# Healthcheck configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose API Gateway port
EXPOSE 3000

# Set resource limits and security options
LABEL org.opencontainers.image.source="https://github.com/org/epa-system" \
      org.opencontainers.image.description="API Gateway for Enhanced Prior Authorization System" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}"

# Configure Node.js for production
ENV NODE_OPTIONS="--max-old-space-size=2048 \
    --no-deprecation \
    --max-http-header-size=16384 \
    --heapsnapshot-near-heap-limit=3 \
    --dns-result-order=ipv4first"

# Set security-related environment variables
ENV NODE_TLS_REJECT_UNAUTHORIZED=1 \
    NPM_CONFIG_AUDIT=true \
    NPM_CONFIG_AUDIT_LEVEL=high \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_IGNORE_SCRIPTS=true

# Start API Gateway service
CMD ["node", "dist/index.js"]

# Define stop signal for graceful shutdown
STOPSIGNAL SIGTERM