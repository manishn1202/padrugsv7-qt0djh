package com.epa.workflow.services;

import com.epa.workflow.models.Authorization;
import com.epa.workflow.models.AuthorizationStatus;
import com.epa.workflow.repositories.AuthorizationRepository;
import com.epa.security.SecurityService;
import com.epa.audit.AuditService;
import com.epa.notification.NotificationService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Async;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.CacheManager;
import org.springframework.cloud.client.circuitbreaker.CircuitBreaker;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.retry.annotation.Retryable;
import org.springframework.security.access.prepost.PreAuthorize;

import org.kie.api.runtime.KieSession;
import lombok.extern.slf4j.Slf4j;

import java.util.UUID;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;

/**
 * Core service implementing prior authorization workflow with enhanced security,
 * performance optimization, and compliance features.
 *
 * @author EPA System
 * @version 1.0
 */
@Service
@Transactional
@Slf4j
public class WorkflowService {

    private final AuthorizationRepository authorizationRepository;
    private final KieSession kieSession;
    private final CacheManager cacheManager;
    private final SecurityService securityService;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final CircuitBreakerFactory circuitBreakerFactory;

    /**
     * Constructs WorkflowService with required dependencies
     */
    public WorkflowService(
            AuthorizationRepository authorizationRepository,
            KieSession kieSession,
            CacheManager cacheManager,
            SecurityService securityService,
            AuditService auditService,
            NotificationService notificationService,
            CircuitBreakerFactory circuitBreakerFactory) {
        this.authorizationRepository = authorizationRepository;
        this.kieSession = kieSession;
        this.cacheManager = cacheManager;
        this.securityService = securityService;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.circuitBreakerFactory = circuitBreakerFactory;
    }

    /**
     * Creates a new prior authorization request with security validation
     *
     * @param authorization The authorization request to create
     * @return Authorization Created authorization with ID and security context
     */
    @PreAuthorize("hasRole('PROVIDER') or hasRole('ADMIN')")
    @Transactional
    public Authorization createAuthorization(Authorization authorization) {
        log.info("Creating new authorization request");
        
        // Validate and secure request
        securityService.validateRequest(authorization);
        securityService.encryptSensitiveData(authorization);

        // Set initial state
        authorization.updateStatus(AuthorizationStatus.DRAFT, "Initial creation");
        
        // Persist and audit
        Authorization savedAuth = authorizationRepository.save(authorization);
        auditService.logEvent("AUTHORIZATION_CREATED", savedAuth.getAuthorizationId());
        
        // Notify stakeholders
        notificationService.sendCreationNotification(savedAuth);
        
        log.info("Created authorization with ID: {}", savedAuth.getAuthorizationId());
        return savedAuth;
    }

    /**
     * Processes authorization request with optimized performance and error handling
     *
     * @param authorizationId The ID of the authorization to process
     * @return Authorization Updated authorization with processing results
     */
    @Async
    @Retryable(maxAttempts = 3)
    @Transactional
    public CompletableFuture<Authorization> processAuthorization(UUID authorizationId) {
        log.info("Processing authorization: {}", authorizationId);
        
        CircuitBreaker circuitBreaker = circuitBreakerFactory.create("process-auth");
        
        return CompletableFuture.supplyAsync(() -> circuitBreaker.run(() -> {
            // Retrieve authorization
            Authorization auth = authorizationRepository.findByAuthorizationId(authorizationId)
                .orElseThrow(() -> new IllegalArgumentException("Authorization not found"));
            
            // Security validation
            securityService.validateAccess(auth);
            
            try {
                // Execute clinical rules
                kieSession.insert(auth);
                kieSession.fireAllRules();
                
                // Update status based on rules outcome
                if (auth.getClinicalInfo().isCriteriaMet()) {
                    auth.updateStatus(AuthorizationStatus.APPROVED, "Clinical criteria met");
                } else {
                    auth.updateStatus(AuthorizationStatus.PENDING_DOCUMENTS, "Additional documentation required");
                }
                
                // Persist changes
                Authorization updatedAuth = authorizationRepository.save(auth);
                
                // Audit and notify
                auditService.logEvent("AUTHORIZATION_PROCESSED", authorizationId);
                notificationService.sendStatusUpdateNotification(updatedAuth);
                
                return updatedAuth;
            } catch (Exception e) {
                log.error("Error processing authorization: {}", authorizationId, e);
                throw e;
            }
        }));
    }

    /**
     * Updates authorization status with validation and notifications
     *
     * @param authorizationId The ID of the authorization to update
     * @param newStatus The new status to set
     * @param reason The reason for the status change
     * @return Authorization Updated authorization
     */
    @PreAuthorize("hasRole('REVIEWER') or hasRole('ADMIN')")
    @Transactional
    @CacheEvict(value = "authorizations", key = "#authorizationId")
    public Authorization updateAuthorizationStatus(UUID authorizationId, AuthorizationStatus newStatus, String reason) {
        log.info("Updating status for authorization: {} to {}", authorizationId, newStatus);
        
        Authorization auth = authorizationRepository.findByAuthorizationId(authorizationId)
            .orElseThrow(() -> new IllegalArgumentException("Authorization not found"));
        
        securityService.validateStatusChange(auth, newStatus);
        
        auth.updateStatus(newStatus, reason);
        Authorization updatedAuth = authorizationRepository.save(auth);
        
        auditService.logEvent("STATUS_UPDATED", authorizationId, 
            String.format("Status changed to %s: %s", newStatus, reason));
        notificationService.sendStatusUpdateNotification(updatedAuth);
        
        return updatedAuth;
    }

    /**
     * Retrieves authorizations by status with caching
     *
     * @param status The status to filter by
     * @return List<Authorization> List of matching authorizations
     */
    @PreAuthorize("hasAnyRole('PROVIDER', 'REVIEWER', 'ADMIN')")
    @Cacheable(value = "authorizations-by-status", key = "#status")
    @Transactional(readOnly = true)
    public List<Authorization> getAuthorizationsByStatus(AuthorizationStatus status) {
        log.info("Retrieving authorizations with status: {}", status);
        return authorizationRepository.findByStatus(status);
    }

    /**
     * Retrieves pending authorizations requiring review
     *
     * @return List<Authorization> List of pending authorizations
     */
    @PreAuthorize("hasRole('REVIEWER') or hasRole('ADMIN')")
    @Cacheable(value = "pending-authorizations")
    @Transactional(readOnly = true)
    public List<Authorization> getPendingAuthorizations() {
        log.info("Retrieving pending authorizations");
        return authorizationRepository.findPendingAuthorizations();
    }
}