# Stage 1: Security scanning of base images
FROM aquasec/trivy:latest AS security-scan
WORKDIR /scan
COPY --from=maven:3.9-amazoncorretto-17 /usr/share/maven /scan/maven
COPY --from=amazoncorretto:17-alpine /usr/lib/jvm/java-17-amazon-corretto /scan/jdk
RUN trivy filesystem --severity HIGH,CRITICAL --no-progress /scan/maven && \
    trivy filesystem --severity HIGH,CRITICAL --no-progress /scan/jdk

# Stage 2: Build environment with security scanning
FROM maven:3.9-amazoncorretto-17 AS builder
LABEL maintainer="DevOps Team <devops@example.com>"

# Set working directory
WORKDIR /build

# Copy Maven configuration and source code
COPY pom.xml .
COPY src ./src

# Security scanning for dependencies and build with tests
RUN mvn dependency-check:check verify -B -DskipTests=false \
    -Dcheckstyle.skip=false \
    -Dpmd.skip=false \
    -Dfindbugs.skip=false \
    -Djacoco.skip=false

# Build the application
RUN mvn clean package -DskipTests

# Stage 3: Production runtime with security hardening
FROM amazoncorretto:17-alpine AS runtime
LABEL maintainer="DevOps Team <devops@example.com>" \
      application="workflow-service" \
      version="${project.version}" \
      security.hipaa.compliant="true"

# Create non-root user for enhanced security
RUN addgroup -S -g 1000 workflow && \
    adduser -S -u 1000 -G workflow workflow && \
    mkdir -p /app/config /var/log/workflow-service /var/log/heap-dumps && \
    chown -R workflow:workflow /app /var/log/workflow-service /var/log/heap-dumps

# Install required packages and security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache tzdata curl jq && \
    rm -rf /var/cache/apk/*

# Set timezone
ENV TZ=UTC

# Copy application artifacts
COPY --from=builder /build/target/*.jar /app/app.jar
COPY src/main/resources/application.yml /app/config/
COPY src/main/resources/rules/ /app/rules/

# Download and verify Prometheus JMX exporter
RUN wget -O /app/jmx_prometheus_javaagent.jar https://repo1.maven.org/maven2/io/prometheus/jmx/jmx_prometheus_javaagent/0.17.2/jmx_prometheus_javaagent-0.17.2.jar && \
    echo "521d335b9b816b3e82b1d3a4a7688fb728c087bf  /app/jmx_prometheus_javaagent.jar" | sha1sum -c

# Set correct permissions
RUN chown -R workflow:workflow /app && \
    chmod 750 /app && \
    chmod 640 /app/app.jar /app/config/* && \
    chmod 760 /var/log/workflow-service /var/log/heap-dumps

# Switch to non-root user
USER workflow:workflow

# Set runtime environment variables
ENV JAVA_OPTS="-Xms4g -Xmx4g -XX:+UseG1GC -XX:+HeapDumpOnOutOfMemoryError \
    -XX:HeapDumpPath=/var/log/heap-dumps \
    -Dcom.sun.management.jmxremote \
    -Dcom.sun.management.jmxremote.port=9404 \
    -Dcom.sun.management.jmxremote.rmi.port=9404 \
    -Dcom.sun.management.jmxremote.ssl=false \
    -Dcom.sun.management.jmxremote.authenticate=false \
    -javaagent:/app/jmx_prometheus_javaagent.jar=9404:/app/config/prometheus-config.yml"

ENV SPRING_PROFILES_ACTIVE=prod

# Expose ports for application and monitoring
EXPOSE 8083 9404

# Define volumes for logs and heap dumps
VOLUME ["/var/log/workflow-service", "/var/log/heap-dumps"]

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8083/api/v1/actuator/health || exit 1

# Set resource limits
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0"

# Start the application
ENTRYPOINT ["java", "-jar", "/app/app.jar"]