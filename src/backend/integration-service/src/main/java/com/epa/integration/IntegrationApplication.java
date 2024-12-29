package com.epa.integration;

import com.epa.integration.config.FhirConfig;
import com.epa.integration.services.EhrIntegrationService;
import com.epa.integration.services.InsuranceIntegrationService;
import io.micrometer.core.aop.TimedAspect;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;

import javax.net.ssl.SSLContext;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * Main Spring Boot application class for the Integration Service
 * Provides centralized configuration and bootstrapping for EHR, insurance, and pharmacy integrations
 * 
 * @version 1.0
 * @since 2024-01
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableRetry
@EnableAsync
@EnableWebSecurity
public class IntegrationApplication {

    private static final Logger LOGGER = LoggerFactory.getLogger(IntegrationApplication.class);
    private static final int CONNECT_TIMEOUT_MS = 5000;
    private static final int READ_TIMEOUT_MS = 30000;

    /**
     * Application entry point with enhanced error handling and monitoring
     */
    public static void main(String[] args) {
        LOGGER.info("Starting Enhanced Prior Authorization Integration Service");
        try {
            SpringApplication app = new SpringApplication(IntegrationApplication.class);
            app.run(args);
            LOGGER.info("Integration Service started successfully");
        } catch (Exception e) {
            LOGGER.error("Failed to start Integration Service", e);
            System.exit(1);
        }
    }

    /**
     * Configures secure RestTemplate with monitoring and circuit breaker
     */
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        LOGGER.info("Configuring RestTemplate with security and monitoring");
        
        return builder
            .setConnectTimeout(Duration.ofMillis(CONNECT_TIMEOUT_MS))
            .setReadTimeout(Duration.ofMillis(READ_TIMEOUT_MS))
            .additionalInterceptors((request, body, execution) -> {
                LOGGER.debug("Outbound request to: {}", request.getURI());
                return execution.execute(request, body);
            })
            .build();
    }

    /**
     * Configures metrics collection for service monitoring
     */
    @Bean
    public TimedAspect timedAspect(MeterRegistry registry) {
        return new TimedAspect(registry);
    }

    /**
     * Health indicator for service monitoring
     */
    @Bean
    public HealthIndicator integrationHealthIndicator(
            EhrIntegrationService ehrService,
            InsuranceIntegrationService insuranceService) {
        return () -> {
            try {
                // Verify critical service dependencies
                ehrService.getPatientData("test", null);
                insuranceService.verifyInsuranceCoverage(null);
                
                return Health.up()
                    .withDetail("ehrIntegration", "OK")
                    .withDetail("insuranceIntegration", "OK")
                    .build();
            } catch (Exception e) {
                LOGGER.error("Health check failed", e);
                return Health.down()
                    .withException(e)
                    .build();
            }
        };
    }

    /**
     * FHIR client configuration
     */
    @Bean
    public FhirConfig fhirConfig(MeterRegistry meterRegistry) {
        LOGGER.info("Initializing FHIR configuration");
        return new FhirConfig(meterRegistry);
    }

    /**
     * SSL context configuration for secure communications
     */
    @Bean
    public SSLContext sslContext() throws Exception {
        LOGGER.info("Configuring SSL context with TLS 1.3");
        SSLContext context = SSLContext.getInstance("TLSv1.3");
        context.init(null, null, null);
        return context;
    }
}