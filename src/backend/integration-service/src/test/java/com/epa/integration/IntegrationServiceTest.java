package com.epa.integration;

import com.epa.integration.services.EhrIntegrationService;
import com.epa.integration.model.RequestContext;
import com.epa.integration.model.FilterCriteria;
import com.epa.integration.model.SecurityContext;
import com.epa.integration.exception.EhrIntegrationException;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.beans.factory.annotation.Autowired;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.DisplayName;
import org.mockito.Mock;

import org.hl7.fhir.r4.model.Patient;
import org.hl7.fhir.r4.model.Bundle;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Comprehensive test suite for Integration Service
 * Validates EHR, Insurance, and Pharmacy integrations with security, performance, and compliance checks
 * 
 * @version 1.0
 * @since 2024-01
 */
@SpringBootTest
@ExtendWith(SpringExtension.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class IntegrationServiceTest {

    @Autowired
    private EhrIntegrationService ehrIntegrationService;

    @Autowired
    private MeterRegistry metricsRegistry;

    @Mock
    private SecurityContext securityContext;

    private static final String TEST_PATIENT_ID = "test-patient-123";
    private Timer ehrRequestTimer;

    @BeforeEach
    void setUp() {
        // Setup security context with healthcare provider role
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "test-provider",
                "password",
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_HEALTHCARE_PROVIDER"))
            )
        );

        // Initialize metrics timer
        ehrRequestTimer = metricsRegistry.timer("integration.test.ehr.request");

        // Configure mock security context
        when(securityContext.isValid()).thenReturn(true);
        when(securityContext.getUserId()).thenReturn("test-user");
    }

    @Test
    @DisplayName("Test EHR Integration with Security Context")
    void testEhrIntegrationWithSecurity() {
        // Setup test context
        RequestContext requestContext = new RequestContext();
        requestContext.setRequestId(UUID.randomUUID().toString());
        requestContext.setSecurityContext(securityContext);

        Timer.Sample timer = Timer.start(metricsRegistry);

        try {
            // Test patient data retrieval
            Patient patient = ehrIntegrationService.getPatientData(TEST_PATIENT_ID, requestContext);

            // Verify patient data
            assertNotNull(patient, "Patient data should not be null");
            assertFalse(patient.isEmpty(), "Patient data should not be empty");

            // Verify security context was validated
            verify(securityContext, times(1)).isValid();

            // Record timing metrics
            timer.stop(ehrRequestTimer);

        } catch (EhrIntegrationException e) {
            fail("EHR integration test failed: " + e.getMessage());
        }
    }

    @Test
    @DisplayName("Test Protocol Compliance")
    void testProtocolCompliance() {
        // Setup filter criteria for medication history
        FilterCriteria criteria = new FilterCriteria();
        criteria.setStartDate("2024-01-01");
        criteria.setEndDate("2024-01-31");
        criteria.setMedicationTypes(List.of("prescription", "administration"));

        try {
            // Test medication history retrieval
            Bundle medicationHistory = ehrIntegrationService.getMedicationHistory(TEST_PATIENT_ID, criteria);

            // Verify FHIR compliance
            assertNotNull(medicationHistory, "Medication history should not be null");
            assertEquals("Bundle", medicationHistory.getResourceType().name(), 
                "Response should be a FHIR Bundle");
            
            // Verify bundle content
            assertNotNull(medicationHistory.getEntry(), "Bundle should contain entries");
            assertTrue(medicationHistory.getEntry().size() > 0, "Bundle should not be empty");

            // Verify metadata compliance
            assertNotNull(medicationHistory.getMeta(), "Bundle should have metadata");
            assertNotNull(medicationHistory.getMeta().getLastUpdated(), 
                "Bundle should have last updated timestamp");

        } catch (EhrIntegrationException e) {
            fail("Protocol compliance test failed: " + e.getMessage());
        }
    }

    @Test
    @DisplayName("Test Error Handling and Circuit Breaker")
    void testErrorHandling() {
        // Setup invalid patient ID to trigger error
        String invalidPatientId = "invalid-id";
        RequestContext requestContext = new RequestContext();
        requestContext.setRequestId(UUID.randomUUID().toString());
        requestContext.setSecurityContext(securityContext);

        // Test error handling
        EhrIntegrationException thrown = assertThrows(
            EhrIntegrationException.class,
            () -> ehrIntegrationService.getPatientData(invalidPatientId, requestContext),
            "Should throw EhrIntegrationException for invalid patient ID"
        );

        // Verify error details
        assertNotNull(thrown.getMessage(), "Exception should have a message");
        assertTrue(thrown.getMessage().contains("Patient not found"), 
            "Exception should indicate patient not found");

        // Verify metrics recorded the error
        assertTrue(
            metricsRegistry.counter("integration.errors", "type", "patient_not_found")
                .count() > 0,
            "Error metrics should be recorded"
        );
    }

    @Test
    @DisplayName("Test Clinical Document Retrieval with Security")
    void testClinicalDocumentRetrieval() {
        // Setup document types for retrieval
        List<String> documentTypes = List.of("Clinical Note", "Discharge Summary");

        try {
            // Test document retrieval
            Bundle documentBundle = ehrIntegrationService.getClinicalDocuments(
                TEST_PATIENT_ID,
                documentTypes,
                securityContext
            );

            // Verify document bundle
            assertNotNull(documentBundle, "Document bundle should not be null");
            assertTrue(documentBundle.getEntry().size() > 0, 
                "Document bundle should contain entries");

            // Verify security headers
            verify(securityContext, times(1)).isValid();
            verify(securityContext, times(1)).getUserId();

        } catch (EhrIntegrationException e) {
            fail("Clinical document retrieval test failed: " + e.getMessage());
        }
    }

    @Test
    @DisplayName("Test Performance Metrics Collection")
    void testPerformanceMetrics() {
        Timer.Sample timer = Timer.start(metricsRegistry);
        RequestContext requestContext = new RequestContext();
        requestContext.setRequestId(UUID.randomUUID().toString());
        requestContext.setSecurityContext(securityContext);

        try {
            // Execute integration call
            ehrIntegrationService.getPatientData(TEST_PATIENT_ID, requestContext);

            // Record timing
            timer.stop(ehrRequestTimer);

            // Verify metrics
            assertTrue(
                ehrRequestTimer.count() > 0,
                "Request timer should record requests"
            );
            assertTrue(
                ehrRequestTimer.mean() < 5.0,
                "Average request time should be under 5 seconds"
            );

        } catch (EhrIntegrationException e) {
            fail("Performance metrics test failed: " + e.getMessage());
        }
    }
}