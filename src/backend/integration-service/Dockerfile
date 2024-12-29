# Stage 1: Build stage with security scanning
FROM maven:3.9.3-amazoncorretto-17 AS builder
LABEL maintainer="EPA System Team <devops@epa.com>"
LABEL description="Integration Service builder stage for EPA System"
LABEL version="1.0.0"

# Set working directory
WORKDIR /build

# Copy Maven configuration
COPY pom.xml .
COPY .mvn/ .mvn/

# Download dependencies and verify checksums
RUN mvn dependency:go-offline -B \
    && mvn verify --fail-at-end

# Copy source code
COPY src/ src/

# Security scan dependencies
RUN mvn dependency-check:check

# Build application with tests
RUN mvn clean package -DskipTests=false

# Verify build artifacts
RUN ls -la target/*.jar

# Stage 2: Production runtime with security hardening
FROM amazoncorretto:17-alpine AS final
LABEL maintainer="EPA System Team <devops@epa.com>"
LABEL description="Integration Service runtime for EPA System"
LABEL version="1.0.0"

# Install required packages and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    tzdata \
    tini \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -S integration-svc && \
    adduser -S -G integration-svc integration-svc

# Set working directory
WORKDIR /app

# Create necessary directories with proper permissions
RUN mkdir -p /app/config /app/secrets /app/logs /app/dumps && \
    chown -R integration-svc:integration-svc /app && \
    chmod -R 750 /app

# Copy application artifacts from builder
COPY --from=builder --chown=integration-svc:integration-svc /build/target/*.jar app.jar

# Verify artifact integrity
RUN sha256sum app.jar > app.jar.sha256

# Configure JVM security properties
RUN echo "networkaddress.cache.ttl=60" >> /opt/java/openjdk/conf/security/java.security && \
    echo "networkaddress.cache.negative.ttl=10" >> /opt/java/openjdk/conf/security/java.security

# Set environment variables
ENV SERVER_PORT=8083 \
    SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-Dcom.sun.management.jmxremote \
    -Dcom.sun.management.jmxremote.port=9010 \
    -Dcom.sun.management.jmxremote.ssl=true \
    -Dcom.sun.management.jmxremote.authenticate=true \
    -Djavax.net.ssl.trustStore=/app/secrets/truststore.p12 \
    -Djavax.net.ssl.trustStorePassword=${SSL_TRUST_STORE_PASSWORD} \
    -Djavax.net.ssl.keyStore=/app/secrets/keystore.p12 \
    -Djavax.net.ssl.keyStorePassword=${SSL_KEY_STORE_PASSWORD}" \
    JAVA_OPTS="-XX:+UseG1GC \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:HeapDumpPath=/app/dumps \
    -XX:+ExitOnOutOfMemoryError \
    -XX:+UseContainerSupport \
    -XX:MaxRAMPercentage=75.0 \
    -Djava.security.egd=file:/dev/urandom \
    -Djava.awt.headless=true"

# Expose ports
EXPOSE 8083 9010

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8083/actuator/health || exit 1

# Switch to non-root user
USER integration-svc

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Set the application startup command
CMD ["java", \
     "-jar", \
     "app.jar"]

# Set read-only root filesystem
VOLUME ["/app/config", "/app/secrets", "/app/logs", "/app/dumps"]