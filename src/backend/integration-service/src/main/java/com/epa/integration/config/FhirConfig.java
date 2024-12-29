package com.epa.integration.config;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.client.api.IGenericClient;
import ca.uhn.fhir.rest.client.api.IRestfulClientFactory;
import ca.uhn.fhir.rest.client.interceptor.BearerTokenAuthInterceptor;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.micrometer.core.instrument.MetricRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.Retryable;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * Enhanced FHIR Configuration for EPA Integration Service
 * Provides robust FHIR client setup with advanced monitoring, security, and reliability features
 * 
 * @version 1.0
 * @since 2024-01
 */
@Configuration
@Slf4j
public class FhirConfig {

    @Value("${fhir.server.url}")
    private String fhirServerUrl;

    @Value("${fhir.auth.client-id}")
    private String clientId;

    @Value("${fhir.auth.client-secret}")
    private String clientSecret;

    @Value("${fhir.client.connection-timeout:30000}")
    private Integer connectionTimeout;

    @Value("${fhir.client.socket-timeout:30000}")
    private Integer socketTimeout;

    @Value("${fhir.client.max-connections:20}")
    private Integer maxConnections;

    @Value("${fhir.client.retry-attempts:3}")
    private Integer retryAttempts;

    @Value("${fhir.monitoring.metrics-enabled:true}")
    private Boolean enableMetrics;

    @Value("${fhir.monitoring.audit-logging:true}")
    private Boolean enableAuditLogging;

    private final MetricRegistry metricRegistry;
    private final CircuitBreaker circuitBreaker;

    /**
     * Constructor initializing monitoring and reliability components
     * @param metricRegistry Registry for metrics collection
     */
    public FhirConfig(MetricRegistry metricRegistry) {
        this.metricRegistry = metricRegistry;
        this.circuitBreaker = configureCircuitBreaker();
        log.info("Initializing FHIR configuration with enhanced monitoring");
    }

    /**
     * Configures and provides FHIR context with monitoring capabilities
     * @return Configured FhirContext instance
     */
    @Bean
    public FhirContext fhirContext() {
        FhirContext context = FhirContext.forR4();
        
        // Configure performance settings
        context.getRestfulClientFactory().setSocketTimeout(socketTimeout);
        context.getRestfulClientFactory().setConnectTimeout(connectionTimeout);
        context.getRestfulClientFactory().setConnectionRequestTimeout(connectionTimeout);
        context.getRestfulClientFactory().setPoolMaxTotal(maxConnections);
        
        if (enableAuditLogging) {
            context.setLogger(new CustomFhirLogger());
        }

        log.info("FHIR Context initialized with R4 version and enhanced monitoring");
        return context;
    }

    /**
     * Creates and configures FHIR client with advanced features
     * @param fhirContext The FHIR context to use
     * @return Configured IGenericClient instance
     */
    @Bean
    @Retryable(maxAttempts = 3)
    public IGenericClient fhirClient(FhirContext fhirContext) {
        IRestfulClientFactory clientFactory = fhirContext.getRestfulClientFactory();
        configureClientFactory(clientFactory);

        IGenericClient client = fhirContext.newRestfulGenericClient(fhirServerUrl);
        
        // Configure authentication
        client.registerInterceptor(new BearerTokenAuthInterceptor(getOAuth2Token()));
        
        // Add monitoring interceptors
        if (enableMetrics) {
            client.registerInterceptor(new MetricsInterceptor(metricRegistry));
        }
        
        // Add circuit breaker wrapper
        return new CircuitBreakerWrappedClient(client, circuitBreaker);
    }

    /**
     * Provides health check indicator for FHIR client
     * @param fhirClient The FHIR client to monitor
     * @return HealthIndicator for the FHIR client
     */
    @Bean
    public HealthIndicator healthCheck(IGenericClient fhirClient) {
        return () -> {
            try {
                // Perform capability statement check
                fhirClient.capabilities();
                return Health.up()
                    .withDetail("fhirServer", fhirServerUrl)
                    .withDetail("status", "Connected")
                    .build();
            } catch (Exception e) {
                log.error("FHIR server health check failed", e);
                return Health.down()
                    .withDetail("fhirServer", fhirServerUrl)
                    .withDetail("error", e.getMessage())
                    .build();
            }
        };
    }

    private CircuitBreaker configureCircuitBreaker() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
            .failureRateThreshold(50)
            .waitDurationInOpenState(Duration.ofSeconds(60))
            .slidingWindowSize(10)
            .build();
        
        return CircuitBreaker.of("fhirClient", config);
    }

    private void configureClientFactory(IRestfulClientFactory factory) {
        factory.setSocketTimeout(socketTimeout);
        factory.setConnectTimeout(connectionTimeout);
        factory.setConnectionRequestTimeout(connectionTimeout);
        factory.setPoolMaxTotal(maxConnections);
        factory.setPoolMaxPerRoute(maxConnections);
        
        log.info("Configured FHIR client factory with connection pool size: {}", maxConnections);
    }

    private String getOAuth2Token() {
        // Implementation of OAuth2 token acquisition
        // This would typically involve a token service call
        return "oauth-token";
    }

    /**
     * Custom FHIR logger for audit purposes
     */
    private class CustomFhirLogger implements ca.uhn.fhir.rest.api.RequestLogger {
        @Override
        public void logRequest(String line) {
            log.info("FHIR Request: {}", line);
        }

        @Override
        public void logResponse(String line) {
            log.info("FHIR Response: {}", line);
        }
    }

    /**
     * Custom metrics interceptor for FHIR client monitoring
     */
    private class MetricsInterceptor extends ca.uhn.fhir.rest.client.interceptor.InterceptorAdapter {
        private final Timer requestTimer;

        public MetricsInterceptor(MetricRegistry registry) {
            this.requestTimer = registry.timer("fhir.client.request.duration");
        }

        @Override
        public void interceptRequest(String theRequestUri) {
            requestTimer.record(Duration.ofMillis(System.currentTimeMillis()));
        }
    }
}