# =====================================
# Stage 1: Builder
# =====================================
FROM node:18-alpine AS builder

# Security hardening
RUN apk add --no-cache --update \
    python3 \
    make \
    g++ \
    && addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory and ownership
WORKDIR /app
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Set build arguments and environment variables
ARG VITE_API_BASE_URL
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_CSP_POLICY
ARG VITE_SECURITY_HEADERS

ENV NODE_ENV=production \
    VITE_APP_ENV=production \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_AUTH0_DOMAIN=${VITE_AUTH0_DOMAIN} \
    VITE_AUTH0_CLIENT_ID=${VITE_AUTH0_CLIENT_ID} \
    VITE_AUTH0_AUDIENCE=${VITE_AUTH0_AUDIENCE} \
    VITE_CSP_POLICY=${VITE_CSP_POLICY} \
    VITE_SECURITY_HEADERS=${VITE_SECURITY_HEADERS}

# Copy package files with integrity verification
COPY --chown=appuser:appgroup package*.json yarn.lock ./

# Install dependencies with exact versions
RUN yarn install --frozen-lockfile --production=false \
    && yarn cache clean

# Copy source code with correct permissions
COPY --chown=appuser:appgroup . .

# Type checking and build
RUN yarn type-check \
    && yarn build \
    && yarn install --frozen-lockfile --production=true

# =====================================
# Stage 2: Production
# =====================================
FROM nginx:1.25-alpine

# Security hardening
RUN apk add --no-cache --update curl wget \
    && rm -rf /var/cache/apk/* \
    && addgroup -S appgroup && adduser -S appuser -G appgroup

# Custom nginx configuration with security headers
COPY --chown=appuser:appgroup nginx.conf /etc/nginx/nginx.conf
COPY --chown=appuser:appgroup security-headers.conf /etc/nginx/security-headers.conf

# Copy built assets from builder stage
COPY --from=builder --chown=appuser:appgroup /app/dist /usr/share/nginx/html

# Set correct permissions
RUN chown -R appuser:appgroup /usr/share/nginx/html \
    && chmod -R 644 /usr/share/nginx/html \
    && find /usr/share/nginx/html -type d -exec chmod 755 {} \; \
    && chown -R appuser:appgroup /var/cache/nginx \
    && chown -R appuser:appgroup /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown -R appuser:appgroup /var/run/nginx.pid

# Create required directories with correct permissions
RUN mkdir -p /usr/share/nginx/html \
    /var/cache/nginx \
    /var/log/nginx \
    && chown -R appuser:appgroup /usr/share/nginx/html \
    /var/cache/nginx \
    /var/log/nginx

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 80

# Configure healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Set security options
LABEL security.protocol="HIPAA" \
      security.compliance="healthcare-grade" \
      security.headers="enhanced"

# Define volumes
VOLUME ["/var/cache/nginx", "/var/log/nginx"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Security labels
LABEL org.opencontainers.image.source="https://github.com/organization/epa-system" \
      org.opencontainers.image.description="Enhanced Prior Authorization Web Application" \
      org.opencontainers.image.vendor="Healthcare Organization" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="Private" \
      security.capabilities="no-new-privileges:true"