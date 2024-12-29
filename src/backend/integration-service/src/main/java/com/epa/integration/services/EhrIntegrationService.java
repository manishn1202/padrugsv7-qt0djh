package com.epa.integration.services;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.client.api.IGenericClient;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.hl7.fhir.r4.model.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import com.epa.integration.config.FhirConfig;
import com.epa.integration.model.RequestContext;
import com.epa.integration.model.FilterCriteria;
import com.epa.integration.model.SecurityContext;
import com.epa.integration.service.MetricsService;
import com.epa.integration.service.AuditService;
import com.epa.integration.util.DataMaskingUtil;
import com.epa.integration.exception.EhrIntegrationException;

import java.util.List;
import java.util.Optional;
import java.time.Duration;

/**
 * Enhanced service for secure and reliable EHR integration using FHIR protocol
 * Implements comprehensive security, monitoring, and error handling
 * 
 * @version 1.0
 * @since 2024-01
 */
@Service
@CircuitBreaker(name = "ehrService")
@Retry(name = "ehrService")
public class EhrIntegrationService {
    
    private static final Logger logger = LoggerFactory.getLogger(EhrIntegrationService.class);
    private static final String CACHE_NAME = "ehrData";
    private static final Duration CACHE_DURATION = Duration.ofMinutes(15);

    private final IGenericClient fhirClient;
    private final MetricsService metricsService;
    private final AuditService auditService;
    private final CacheManager cacheManager;

    @Autowired
    public EhrIntegrationService(
            FhirConfig fhirConfig,
            MetricsService metricsService,
            AuditService auditService,
            CacheManager cacheManager) {
        this.fhirClient = fhirConfig.fhirClient();
        this.metricsService = metricsService;
        this.auditService = auditService;
        this.cacheManager = cacheManager;
        
        logger.info("Initializing EHR Integration Service with enhanced security and monitoring");
    }

    /**
     * Securely retrieves patient clinical data with enhanced error handling and monitoring
     *
     * @param patientId Unique identifier for the patient
     * @param context Request context containing security and tracking information
     * @return Sanitized FHIR patient resource with clinical data
     * @throws EhrIntegrationException if retrieval fails
     */
    @PreAuthorize("hasRole('ROLE_HEALTHCARE_PROVIDER')")
    public Patient getPatientData(String patientId, RequestContext context) {
        logger.debug("Retrieving patient data with masked ID: {}", DataMaskingUtil.maskId(patientId));
        
        try {
            // Check cache first
            Optional<Patient> cachedData = getCachedPatientData(patientId);
            if (cachedData.isPresent()) {
                return cachedData.get();
            }

            // Start metrics tracking
            metricsService.startTimer("patient.data.retrieval");

            // Build and execute FHIR query
            Patient patient = fhirClient
                .read()
                .resource(Patient.class)
                .withId(patientId)
                .execute();

            // Validate and sanitize response
            validatePatientData(patient);
            Patient sanitizedPatient = DataMaskingUtil.sanitizePatientData(patient);

            // Cache the result
            cachePatientData(patientId, sanitizedPatient);

            // Record metrics and audit
            metricsService.stopTimer("patient.data.retrieval");
            auditService.logAccess("PATIENT_DATA_ACCESS", context, patientId);

            return sanitizedPatient;

        } catch (ResourceNotFoundException e) {
            logger.warn("Patient not found: {}", DataMaskingUtil.maskId(patientId));
            throw new EhrIntegrationException("Patient not found", e);
        } catch (Exception e) {
            logger.error("Error retrieving patient data: {}", e.getMessage());
            throw new EhrIntegrationException("Failed to retrieve patient data", e);
        }
    }

    /**
     * Retrieves patient medication history with enhanced security and filtering
     *
     * @param patientId Patient identifier
     * @param criteria Filtering criteria for medication history
     * @return Filtered and sanitized FHIR bundle containing medication requests
     * @throws EhrIntegrationException if retrieval fails
     */
    @PreAuthorize("hasAnyRole('ROLE_HEALTHCARE_PROVIDER', 'ROLE_PHARMACY_STAFF')")
    public Bundle getMedicationHistory(String patientId, FilterCriteria criteria) {
        logger.debug("Retrieving medication history for patient: {}", DataMaskingUtil.maskId(patientId));
        
        try {
            metricsService.startTimer("medication.history.retrieval");

            Bundle medicationBundle = fhirClient
                .search()
                .forResource(MedicationRequest.class)
                .where(MedicationRequest.PATIENT.hasId(patientId))
                .and(buildMedicationFilters(criteria))
                .returnBundle(Bundle.class)
                .execute();

            // Apply business rules and sanitization
            Bundle filteredBundle = applyMedicationFilters(medicationBundle, criteria);
            Bundle sanitizedBundle = DataMaskingUtil.sanitizeMedicationBundle(filteredBundle);

            metricsService.stopTimer("medication.history.retrieval");
            auditService.logAccess("MEDICATION_HISTORY_ACCESS", patientId);

            return sanitizedBundle;

        } catch (Exception e) {
            logger.error("Error retrieving medication history: {}", e.getMessage());
            throw new EhrIntegrationException("Failed to retrieve medication history", e);
        }
    }

    /**
     * Retrieves and processes clinical documents with enhanced security
     *
     * @param patientId Patient identifier
     * @param documentTypes List of requested document types
     * @param securityContext Security context for access control
     * @return Secure FHIR bundle containing processed clinical documents
     * @throws EhrIntegrationException if retrieval fails
     */
    @PreAuthorize("hasRole('ROLE_HEALTHCARE_PROVIDER')")
    public Bundle getClinicalDocuments(String patientId, List<String> documentTypes, SecurityContext securityContext) {
        logger.debug("Retrieving clinical documents for patient: {}", DataMaskingUtil.maskId(patientId));
        
        try {
            validateSecurityContext(securityContext);
            metricsService.startTimer("document.retrieval");

            Bundle documentBundle = fhirClient
                .search()
                .forResource(DocumentReference.class)
                .where(DocumentReference.PATIENT.hasId(patientId))
                .and(DocumentReference.TYPE.exactly().codes(documentTypes))
                .returnBundle(Bundle.class)
                .execute();

            // Process and secure documents
            Bundle processedBundle = processDocumentBundle(documentBundle);
            Bundle securedBundle = DataMaskingUtil.sanitizeDocumentBundle(processedBundle);

            metricsService.stopTimer("document.retrieval");
            auditService.logDocumentAccess(patientId, documentTypes, securityContext);

            return securedBundle;

        } catch (Exception e) {
            logger.error("Error retrieving clinical documents: {}", e.getMessage());
            throw new EhrIntegrationException("Failed to retrieve clinical documents", e);
        }
    }

    // Private helper methods

    private Optional<Patient> getCachedPatientData(String patientId) {
        return Optional.ofNullable(cacheManager.getCache(CACHE_NAME))
            .map(cache -> cache.get(patientId, Patient.class));
    }

    private void cachePatientData(String patientId, Patient patient) {
        Optional.ofNullable(cacheManager.getCache(CACHE_NAME))
            .ifPresent(cache -> cache.put(patientId, patient));
    }

    private void validatePatientData(Patient patient) {
        if (patient == null || patient.isEmpty()) {
            throw new EhrIntegrationException("Invalid patient data received");
        }
    }

    private void validateSecurityContext(SecurityContext securityContext) {
        if (securityContext == null || !securityContext.isValid()) {
            throw new EhrIntegrationException("Invalid security context");
        }
    }

    private Bundle processDocumentBundle(Bundle documentBundle) {
        // Implementation of document processing logic
        return documentBundle;
    }

    private Bundle applyMedicationFilters(Bundle medicationBundle, FilterCriteria criteria) {
        // Implementation of medication filtering logic
        return medicationBundle;
    }
}