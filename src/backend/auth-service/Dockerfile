# ===== Builder Stage =====
FROM node:18-alpine AS builder

# Install build dependencies and security tools
RUN apk add --no-cache python3 make g++ git curl \
    && curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Security audit
RUN npm audit

# Copy source code and config files
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Run security scan on built artifacts
RUN trivy filesystem --severity HIGH,CRITICAL --no-progress /usr/src/app

# Remove devDependencies
RUN npm prune --production

# ===== Production Stage =====
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init openssl openssl-dev

# Configure OpenSSL for FIPS mode
RUN echo "openssl_conf = openssl_init" > /etc/ssl/openssl.cnf \
    && echo "" >> /etc/ssl/openssl.cnf \
    && echo "[openssl_init]" >> /etc/ssl/openssl.cnf \
    && echo "providers = provider_sect" >> /etc/ssl/openssl.cnf \
    && echo "fips_mode = yes" >> /etc/ssl/openssl.cnf \
    && echo "" >> /etc/ssl/openssl.cnf \
    && echo "[provider_sect]" >> /etc/ssl/openssl.cnf \
    && echo "fips = fips_sect" >> /etc/ssl/openssl.cnf \
    && echo "" >> /etc/ssl/openssl.cnf \
    && echo "[fips_sect]" >> /etc/ssl/openssl.cnf \
    && echo "activate = 1" >> /etc/ssl/openssl.cnf

# Create non-root user/group
RUN addgroup -g 1001 -S node && adduser -u 1001 -S node -G node

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built artifacts from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Set security-related environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    OPENSSL_FIPS=1 \
    NODE_OPTIONS="--use-openssl-ca"

# Configure health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Set container metadata labels
LABEL maintainer="DevOps Team" \
    com.example.service="auth-service" \
    com.example.version="${BUILD_VERSION}" \
    com.example.build-date="${BUILD_DATE}" \
    com.example.fips-compliant="true"

# Expose service port
EXPOSE 3001

# Set directory permissions
RUN chown -R node:node /usr/src/app && \
    chmod -R 550 /usr/src/app && \
    chmod -R 550 /usr/src/app/dist

# Switch to non-root user
USER node

# Set resource limits
LIMIT nofile=1024
LIMIT nproc=100
LIMIT as=4G

# Configure security options
SECURITY_OPT no-new-privileges=true
SECURITY_OPT seccomp=unconfined

# Drop all capabilities
DROP_CAPS ALL

# Set entry point with dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]