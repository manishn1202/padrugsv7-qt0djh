package com.epa.workflow.controllers;

import com.epa.workflow.models.Authorization;
import com.epa.workflow.models.AuthorizationStatus;
import com.epa.workflow.services.WorkflowService;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.cache.CacheManager;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.hateoas.EntityModel;
import org.springframework.hateoas.Link;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;

import lombok.extern.slf4j.Slf4j;

import javax.validation.Valid;
import java.util.UUID;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import static org.springframework.hateoas.server.mvc.WebMvcLinkBuilder.*;

/**
 * REST controller for managing prior authorization requests with enhanced security,
 * performance optimization, and HIPAA compliance features.
 *
 * @author EPA System
 * @version 1.0
 */
@RestController
@RequestMapping("/api/v1/authorizations")
@SecurityRequirement(name = "bearer-jwt")
@Validated
@Tag(name = "Authorization Management", description = "APIs for managing prior authorization requests")
@Slf4j
public class AuthorizationController {

    private final WorkflowService workflowService;
    private final CacheManager cacheManager;

    /**
     * Constructs controller with required dependencies
     */
    public AuthorizationController(WorkflowService workflowService, CacheManager cacheManager) {
        this.workflowService = workflowService;
        this.cacheManager = cacheManager;
    }

    /**
     * Creates a new prior authorization request with enhanced validation and security
     */
    @PostMapping
    @Operation(summary = "Create new authorization request")
    @ApiResponse(responseCode = "201", description = "Authorization created successfully")
    @PreAuthorize("hasRole('PROVIDER')")
    @CircuitBreaker(name = "createAuth")
    @RateLimiter(name = "createAuth")
    public ResponseEntity<EntityModel<Authorization>> createAuthorization(
            @Valid @RequestBody Authorization authorization,
            @RequestHeader HttpHeaders headers) {
        
        log.info("Creating new authorization request");
        
        Authorization createdAuth = workflowService.createAuthorization(authorization);
        
        EntityModel<Authorization> resource = EntityModel.of(createdAuth,
            linkTo(methodOn(AuthorizationController.class).getAuthorization(createdAuth.getAuthorizationId(), headers)).withSelfRel(),
            linkTo(methodOn(AuthorizationController.class).updateAuthorizationStatus(createdAuth.getAuthorizationId(), null, headers)).withRel("update")
        );

        return ResponseEntity
            .status(HttpStatus.CREATED)
            .header("X-Authorization-Id", createdAuth.getAuthorizationId().toString())
            .body(resource);
    }

    /**
     * Retrieves authorization details with caching and security
     */
    @GetMapping("/{authorizationId}")
    @Operation(summary = "Get authorization details")
    @ApiResponse(responseCode = "200", description = "Authorization retrieved successfully")
    @PreAuthorize("hasAnyRole('PROVIDER', 'REVIEWER', 'ADMIN')")
    @CircuitBreaker(name = "getAuth")
    @Bulkhead(name = "getAuth")
    public ResponseEntity<EntityModel<Authorization>> getAuthorization(
            @PathVariable UUID authorizationId,
            @RequestHeader HttpHeaders headers) {
        
        log.info("Retrieving authorization: {}", authorizationId);
        
        Authorization auth = workflowService.getAuthorizationsByStatus(AuthorizationStatus.SUBMITTED)
            .stream()
            .filter(a -> a.getAuthorizationId().equals(authorizationId))
            .findFirst()
            .orElseThrow(() -> new ResourceNotFoundException("Authorization not found"));

        EntityModel<Authorization> resource = EntityModel.of(auth,
            linkTo(methodOn(AuthorizationController.class).getAuthorization(authorizationId, headers)).withSelfRel(),
            linkTo(methodOn(AuthorizationController.class).updateAuthorizationStatus(authorizationId, null, headers)).withRel("update")
        );

        return ResponseEntity.ok()
            .header("X-Resource-Version", auth.getVersion().toString())
            .body(resource);
    }

    /**
     * Updates authorization status with validation and notifications
     */
    @PatchMapping("/{authorizationId}/status")
    @Operation(summary = "Update authorization status")
    @ApiResponse(responseCode = "200", description = "Status updated successfully")
    @PreAuthorize("hasRole('REVIEWER')")
    @CircuitBreaker(name = "updateAuth")
    public ResponseEntity<EntityModel<Authorization>> updateAuthorizationStatus(
            @PathVariable UUID authorizationId,
            @Valid @RequestBody StatusUpdateRequest statusUpdate,
            @RequestHeader HttpHeaders headers) {
        
        log.info("Updating status for authorization: {} to {}", authorizationId, statusUpdate.getStatus());
        
        Authorization updatedAuth = workflowService.updateAuthorizationStatus(
            authorizationId, 
            statusUpdate.getStatus(), 
            statusUpdate.getReason()
        );

        EntityModel<Authorization> resource = EntityModel.of(updatedAuth,
            linkTo(methodOn(AuthorizationController.class).getAuthorization(authorizationId, headers)).withSelfRel()
        );

        return ResponseEntity.ok()
            .header("X-Resource-Version", updatedAuth.getVersion().toString())
            .body(resource);
    }

    /**
     * Retrieves authorizations by status with caching
     */
    @GetMapping
    @Operation(summary = "Get authorizations by status")
    @ApiResponse(responseCode = "200", description = "Authorizations retrieved successfully")
    @PreAuthorize("hasAnyRole('PROVIDER', 'REVIEWER', 'ADMIN')")
    @CircuitBreaker(name = "getAuths")
    @Bulkhead(name = "getAuths")
    public ResponseEntity<List<EntityModel<Authorization>>> getAuthorizationsByStatus(
            @RequestParam(required = false) AuthorizationStatus status,
            @RequestHeader HttpHeaders headers) {
        
        log.info("Retrieving authorizations with status: {}", status);
        
        List<Authorization> authorizations = workflowService.getAuthorizationsByStatus(status);
        
        List<EntityModel<Authorization>> resources = authorizations.stream()
            .map(auth -> EntityModel.of(auth,
                linkTo(methodOn(AuthorizationController.class).getAuthorization(auth.getAuthorizationId(), headers)).withSelfRel()
            ))
            .toList();

        return ResponseEntity.ok()
            .header("X-Total-Count", String.valueOf(resources.size()))
            .body(resources);
    }
}

/**
 * Request payload for status updates
 */
@Validated
class StatusUpdateRequest {
    @Schema(description = "New status for the authorization")
    private AuthorizationStatus status;
    
    @Schema(description = "Reason for the status change")
    private String reason;

    // Getters and setters
    public AuthorizationStatus getStatus() { return status; }
    public void setStatus(AuthorizationStatus status) { this.status = status; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}

/**
 * Custom exception for resource not found
 */
class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}