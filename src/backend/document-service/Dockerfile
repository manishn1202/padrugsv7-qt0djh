# Stage 1: Builder
FROM python:3.11-slim AS builder

# Set build arguments and environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies and security updates
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        curl \
        build-essential \
        libmagic1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create app directory and set working directory
WORKDIR /build

# Copy requirements file
COPY requirements.txt .

# Install Python packages
RUN python -m venv /opt/venv \
    && . /opt/venv/bin/activate \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Compile Python bytecode
RUN python -m compileall .

# Stage 2: Final runtime image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    WORKERS=4 \
    MAX_REQUESTS=1000 \
    PATH="/opt/venv/bin:$PATH"

# Install runtime system dependencies
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        curl \
        libmagic1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    # Create non-root user and group
    && groupadd -g 10001 docservice \
    && useradd -u 10001 -g docservice -s /bin/bash -m docservice

# Create necessary directories
RUN mkdir -p /app/documents /tmp/uploads \
    && chown -R docservice:docservice /app /tmp/uploads

# Copy virtual environment from builder
COPY --from=builder --chown=docservice:docservice /opt/venv /opt/venv

# Copy application code
COPY --from=builder --chown=docservice:docservice /build /app

# Set working directory
WORKDIR /app

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

# Create volume mount points
VOLUME ["/app/documents", "/tmp/uploads"]

# Expose port
EXPOSE 8000

# Switch to non-root user
USER docservice

# Start Gunicorn server
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "50", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--config", "gunicorn.conf.py", \
     "app.main:app"]