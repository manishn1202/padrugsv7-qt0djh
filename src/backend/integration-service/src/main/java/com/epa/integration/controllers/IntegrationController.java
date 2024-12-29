package com.epa.integration.controllers;

import com.epa.integration.services.EhrIntegrationService;
import com.epa.integration.services.InsuranceIntegrationService;
import com.epa.integration.services.PharmacyIntegrationService;
import com.epa.shared.schemas.AuthorizationSchema;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.micrometer.core.annotation.Timed;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.security.SecuritySchemes;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.util.UUID;

/**
 * Enhanced REST controller managing external system integrations for the Prior Authorization system.
 * Implements comprehensive security, caching, monitoring, and error handling.
 *
 * @version 1.0
 * @since 2024-01
 */
@RestController
@RequestMapping("/api/v1/integration")
@Validated
@SecurityScheme(
    name = "bearerAuth",
    type = SecuritySchemeType.HTTP,
    scheme = "bearer",
    bearerFormat = "JWT"
)
public class IntegrationController {

    private static final Logger logger = LoggerFactory.getLogger(IntegrationController.class);
    private static final String CIRCUIT_BREAKER_NAME = "integrationService";

    private final EhrIntegrationService ehrService;
    private final InsuranceIntegrationService insuranceService;
    private final PharmacyIntegrationService pharmacyService;
    private final MetricsService metricsService;
    private final SecurityAuditService auditService;

    /**
     * Initializes the integration controller with required services.
     */
    @Autowired
    public IntegrationController(
            EhrIntegrationService ehrService,
            InsuranceIntegrationService insuranceService,
            PharmacyIntegrationService pharmacyService,
            MetricsService metricsService,
            SecurityAuditService auditService) {
        this.ehrService = ehrService;
        this.insuranceService = insuranceService;
        this.pharmacyService = pharmacyService;
        this.metricsService = metricsService;
        this.auditService = auditService;
        
        logger.info("Initializing Integration Controller with enhanced security and monitoring");
    }

    /**
     * Retrieves patient clinical data with enhanced security and caching.
     *
     * @param patientId Unique identifier for the patient
     * @return ResponseEntity containing patient clinical data
     */
    @GetMapping("/ehr/patient/{patientId}")
    @PreAuthorize("hasRole('ROLE_HEALTHCARE_PROVIDER')")
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME)
    @RateLimiter(name = "ehrEndpoint")
    @Cacheable(value = "patientData", key = "#patientId")
    @Timed(value = "integration.ehr.getPatientData", percentiles = {0.5, 0.95, 0.99})
    public ResponseEntity<?> getPatientClinicalData(
            @PathVariable @NotBlank String patientId,
            @RequestHeader("X-Request-ID") String requestId) {
        
        String maskedPatientId = maskSensitiveData(patientId);
        logger.info("Processing patient data request for ID: {}, requestId: {}", 
                   maskedPatientId, requestId);

        try {
            metricsService.startTimer("patient.data.retrieval");
            
            // Create request context with security info
            RequestContext context = RequestContext.builder()
                .requestId(requestId)
                .patientId(patientId)
                .build();

            // Retrieve patient data with security context
            Patient patientData = ehrService.getPatientData(patientId, context);

            // Audit the access
            auditService.logAccess("PATIENT_DATA_ACCESS", context);

            metricsService.stopTimer("patient.data.retrieval");
            
            return ResponseEntity.ok()
                .header("X-Request-ID", requestId)
                .header("X-Correlation-ID", UUID.randomUUID().toString())
                .body(patientData);

        } catch (Exception e) {
            logger.error("Error retrieving patient data: {}", e.getMessage(), e);
            metricsService.incrementCounter("patient.data.error");
            throw new IntegrationException("Failed to retrieve patient data", e);
        }
    }

    /**
     * Verifies insurance coverage with enhanced error handling.
     */
    @PostMapping("/insurance/verify")
    @PreAuthorize("hasAnyRole('ROLE_HEALTHCARE_PROVIDER', 'ROLE_PHARMACY_STAFF')")
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME)
    @RateLimiter(name = "insuranceEndpoint")
    @Timed(value = "integration.insurance.verifyCoverage")
    public ResponseEntity<?> verifyInsurance(
            @Valid @RequestBody CoverageRequest request,
            @RequestHeader("X-Request-ID") String requestId) {
        
        logger.info("Processing insurance verification request: {}", requestId);

        try {
            metricsService.startTimer("insurance.verification");
            
            CoverageResponse coverage = insuranceService.verifyInsuranceCoverage(request);
            
            metricsService.stopTimer("insurance.verification");
            
            return ResponseEntity.ok()
                .header("X-Request-ID", requestId)
                .body(coverage);

        } catch (Exception e) {
            logger.error("Insurance verification failed: {}", e.getMessage(), e);
            metricsService.incrementCounter("insurance.verification.error");
            throw new IntegrationException("Insurance verification failed", e);
        }
    }

    /**
     * Submits prior authorization request to pharmacy system.
     */
    @PostMapping("/pharmacy/submit")
    @PreAuthorize("hasRole('ROLE_HEALTHCARE_PROVIDER')")
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME)
    @RateLimiter(name = "pharmacyEndpoint")
    @Timed(value = "integration.pharmacy.submitAuthorization")
    public ResponseEntity<?> submitAuthorization(
            @Valid @RequestBody AuthorizationRequest request,
            @RequestHeader("X-Request-ID") String requestId) {
        
        logger.info("Processing pharmacy authorization submission: {}", requestId);

        try {
            metricsService.startTimer("pharmacy.submission");
            
            SubmissionResponse response = pharmacyService.sendPriorAuthorizationRequest(request);
            
            metricsService.stopTimer("pharmacy.submission");
            
            return ResponseEntity.ok()
                .header("X-Request-ID", requestId)
                .body(response);

        } catch (Exception e) {
            logger.error("Authorization submission failed: {}", e.getMessage(), e);
            metricsService.incrementCounter("pharmacy.submission.error");
            throw new IntegrationException("Authorization submission failed", e);
        }
    }

    /**
     * Checks authorization status with caching.
     */
    @GetMapping("/status/{authorizationId}")
    @PreAuthorize("hasAnyRole('ROLE_HEALTHCARE_PROVIDER', 'ROLE_PHARMACY_STAFF')")
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME)
    @Cacheable(value = "authStatus", key = "#authorizationId", unless = "#result.status == 'PENDING'")
    @Timed(value = "integration.status.check")
    public ResponseEntity<?> checkStatus(
            @PathVariable @NotBlank String authorizationId,
            @RequestHeader("X-Request-ID") String requestId) {
        
        logger.info("Checking authorization status: {}", authorizationId);

        try {
            StatusResponse status = pharmacyService.checkAuthorizationStatus(authorizationId);
            
            return ResponseEntity.ok()
                .header("X-Request-ID", requestId)
                .body(status);

        } catch (Exception e) {
            logger.error("Status check failed: {}", e.getMessage(), e);
            metricsService.incrementCounter("status.check.error");
            throw new IntegrationException("Status check failed", e);
        }
    }

    // Private helper methods

    private String maskSensitiveData(String data) {
        if (data == null || data.length() < 4) {
            return "****";
        }
        return "****" + data.substring(Math.max(0, data.length() - 4));
    }
}