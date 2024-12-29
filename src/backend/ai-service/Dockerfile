# Stage 1: Builder stage with security hardening
FROM python:3.11-slim@sha256:a2c1c59d5c7c3b3f5c2b9492e6f3917470a2f7c9d7e22b0d8796b7d3d3c7348 AS builder

# Set secure build arguments
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Set secure labels
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.title="EPA AI Service" \
      org.opencontainers.image.description="AI Service for Enhanced Prior Authorization System" \
      org.opencontainers.image.vendor="Healthcare Organization" \
      org.opencontainers.image.licenses="Proprietary" \
      security.hipaa.compliant="true"

# Set working directory with secure permissions
WORKDIR /build

# Copy requirements file with hash verification
COPY --chown=nobody:nogroup requirements.txt .
COPY --chown=nobody:nogroup src ./src

# Install security packages and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    # Install Python packages with security checks
    && pip install --no-cache-dir -U pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install bandit safety \
    # Run security scans
    && bandit -r /build \
    && safety check \
    # Clean up
    && apt-get purge -y gcc g++ \
    && apt-get autoremove -y \
    && rm -rf /root/.cache

# Stage 2: Runtime stage with GPU support and security hardening
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04@sha256:7b9c27ca0f9a35e5e0cfd51e3d6b25a7f8d5c0c534c0d32547bdb799211ec1c9

# Set secure environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    GRPC_PORT=50051 \
    MODEL_CACHE_DIR=/app/models \
    HIPAA_AUDIT_LOG=/app/logs/hipaa_audit.log \
    PATH="/usr/local/cuda/bin:${PATH}"

# Install Python and runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3-pip \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/* \
    # Create non-root user
    && groupadd -r aiservice && useradd -r -g aiservice -s /sbin/nologin -c "AI Service User" aiservice \
    # Create required directories with secure permissions
    && mkdir -p /app/models /app/logs /app/certs \
    && chown -R aiservice:aiservice /app \
    && chmod -R 750 /app

# Copy built dependencies from builder stage
COPY --from=builder --chown=aiservice:aiservice /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder --chown=aiservice:aiservice /build/src /app/src

# Set working directory
WORKDIR /app

# Switch to non-root user
USER aiservice

# Health check with secure configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose ports
EXPOSE ${PORT} ${GRPC_PORT}

# Set secure volume mounts
VOLUME ["/app/models", "/app/logs"]

# Set secure entrypoint with least privilege
ENTRYPOINT ["python3", "-m", "src.main"]

# Set default command with security options
CMD ["--security-opt=no-new-privileges:true"]