package com.epa.workflow;

import com.epa.workflow.services.WorkflowService;
import com.epa.workflow.models.Authorization;
import com.epa.workflow.models.AuthorizationStatus;
import com.epa.workflow.repositories.AuthorizationRepository;
import com.epa.security.SecurityService;
import com.epa.audit.AuditService;
import com.epa.notification.NotificationService;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.util.StopWatch;
import org.kie.api.runtime.KieSession;

import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.time.Duration;
import java.util.Arrays;

/**
 * Comprehensive test suite for WorkflowService validating core functionalities,
 * performance metrics, and compliance requirements.
 * 
 * @version 1.0
 */
@SpringBootTest
@ExtendWith(SpringExtension.class)
@TestMethodOrder(OrderAnnotation.class)
public class WorkflowServiceTest {

    private static final UUID TEST_AUTHORIZATION_ID = UUID.randomUUID();
    private static final UUID TEST_PATIENT_ID = UUID.randomUUID();
    private static final Duration PERFORMANCE_THRESHOLD = Duration.ofMillis(100);
    private static final double ERROR_RATE_THRESHOLD = 0.01;

    @MockBean
    private AuthorizationRepository authorizationRepository;

    @MockBean
    private KieSession kieSession;

    @MockBean
    private SecurityService securityService;

    @MockBean
    private AuditService auditService;

    @MockBean
    private NotificationService notificationService;

    private WorkflowService workflowService;
    private StopWatch stopWatch;

    @BeforeEach
    void setUp() {
        // Initialize service with mocked dependencies
        workflowService = new WorkflowService(
            authorizationRepository,
            kieSession,
            null, // CacheManager not needed for tests
            securityService,
            auditService,
            notificationService,
            null  // CircuitBreakerFactory not needed for tests
        );
        
        stopWatch = new StopWatch();
        reset(authorizationRepository, kieSession, securityService, auditService, notificationService);
    }

    @Test
    @Order(1)
    @WithMockUser(roles = "PROVIDER")
    void testCreateAuthorizationWithSecurity() {
        // Arrange
        Authorization testAuth = new Authorization();
        testAuth.setPatientInfo(mock(PatientInfo.class));
        when(authorizationRepository.save(any(Authorization.class))).thenReturn(testAuth);

        // Act
        Authorization result = workflowService.createAuthorization(testAuth);

        // Assert
        assertNotNull(result, "Created authorization should not be null");
        assertEquals(AuthorizationStatus.DRAFT, result.getStatus(), "Initial status should be DRAFT");
        
        // Verify security validations
        verify(securityService).validateRequest(testAuth);
        verify(securityService).encryptSensitiveData(testAuth);
        
        // Verify audit trail
        verify(auditService).logEvent(eq("AUTHORIZATION_CREATED"), any(UUID.class));
        
        // Verify notifications
        verify(notificationService).sendCreationNotification(testAuth);
    }

    @Test
    @Order(2)
    void testProcessAuthorizationPerformance() throws Exception {
        // Arrange
        Authorization testAuth = new Authorization();
        testAuth.setAuthorizationId(TEST_AUTHORIZATION_ID);
        when(authorizationRepository.findByAuthorizationId(TEST_AUTHORIZATION_ID))
            .thenReturn(Optional.of(testAuth));
        when(authorizationRepository.save(any(Authorization.class))).thenReturn(testAuth);

        // Act
        stopWatch.start();
        CompletableFuture<Authorization> future = workflowService.processAuthorization(TEST_AUTHORIZATION_ID);
        Authorization result = future.get();
        stopWatch.stop();

        // Assert
        assertNotNull(result, "Processed authorization should not be null");
        assertTrue(stopWatch.getTotalTimeMillis() < PERFORMANCE_THRESHOLD.toMillis(),
            "Processing time should be under threshold");
        
        // Verify rule execution
        verify(kieSession).insert(testAuth);
        verify(kieSession).fireAllRules();
        
        // Verify audit and notifications
        verify(auditService).logEvent(eq("AUTHORIZATION_PROCESSED"), eq(TEST_AUTHORIZATION_ID));
        verify(notificationService).sendStatusUpdateNotification(testAuth);
    }

    @Test
    @Order(3)
    void testClinicalCriteriaAccuracy() {
        // Arrange
        List<Authorization> testBatch = createTestAuthorizationBatch(100);
        int errorCount = 0;

        // Act
        for (Authorization auth : testBatch) {
            when(authorizationRepository.findByAuthorizationId(auth.getAuthorizationId()))
                .thenReturn(Optional.of(auth));
            
            try {
                CompletableFuture<Authorization> future = workflowService.processAuthorization(auth.getAuthorizationId());
                Authorization result = future.get();
                
                if (!validateClinicalCriteria(result)) {
                    errorCount++;
                }
            } catch (Exception e) {
                errorCount++;
            }
        }

        // Assert
        double errorRate = (double) errorCount / testBatch.size();
        assertTrue(errorRate < ERROR_RATE_THRESHOLD,
            String.format("Error rate %.2f%% exceeds threshold of %.2f%%", errorRate * 100, ERROR_RATE_THRESHOLD * 100));
    }

    @Test
    @Order(4)
    @WithMockUser(roles = "REVIEWER")
    void testUpdateAuthorizationStatus() {
        // Arrange
        Authorization testAuth = new Authorization();
        testAuth.setAuthorizationId(TEST_AUTHORIZATION_ID);
        when(authorizationRepository.findByAuthorizationId(TEST_AUTHORIZATION_ID))
            .thenReturn(Optional.of(testAuth));
        when(authorizationRepository.save(any(Authorization.class))).thenReturn(testAuth);

        // Act
        Authorization result = workflowService.updateAuthorizationStatus(
            TEST_AUTHORIZATION_ID,
            AuthorizationStatus.APPROVED,
            "Criteria met"
        );

        // Assert
        assertNotNull(result, "Updated authorization should not be null");
        assertEquals(AuthorizationStatus.APPROVED, result.getStatus(), "Status should be updated to APPROVED");
        
        // Verify security validation
        verify(securityService).validateStatusChange(eq(testAuth), eq(AuthorizationStatus.APPROVED));
        
        // Verify audit and notifications
        verify(auditService).logEvent(eq("STATUS_UPDATED"), eq(TEST_AUTHORIZATION_ID), anyString());
        verify(notificationService).sendStatusUpdateNotification(testAuth);
    }

    @Test
    @Order(5)
    @WithMockUser(roles = "PROVIDER")
    void testGetAuthorizationsByStatus() {
        // Arrange
        List<Authorization> testAuths = Arrays.asList(new Authorization(), new Authorization());
        when(authorizationRepository.findByStatus(AuthorizationStatus.PENDING_DOCUMENTS))
            .thenReturn(testAuths);

        // Act
        List<Authorization> results = workflowService.getAuthorizationsByStatus(AuthorizationStatus.PENDING_DOCUMENTS);

        // Assert
        assertNotNull(results, "Result list should not be null");
        assertEquals(2, results.size(), "Should return correct number of authorizations");
        verify(authorizationRepository).findByStatus(AuthorizationStatus.PENDING_DOCUMENTS);
    }

    // Helper methods
    private List<Authorization> createTestAuthorizationBatch(int size) {
        List<Authorization> batch = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            Authorization auth = new Authorization();
            auth.setAuthorizationId(UUID.randomUUID());
            batch.add(auth);
        }
        return batch;
    }

    private boolean validateClinicalCriteria(Authorization auth) {
        return auth != null && 
               auth.getClinicalInfo() != null && 
               (auth.getStatus() == AuthorizationStatus.APPROVED || 
                auth.getStatus() == AuthorizationStatus.PENDING_DOCUMENTS);
    }
}