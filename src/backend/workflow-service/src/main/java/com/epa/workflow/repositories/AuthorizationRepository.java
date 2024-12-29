package com.epa.workflow.repositories;

import com.epa.workflow.models.Authorization;
import com.epa.workflow.models.AuthorizationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * High-performance repository interface for Authorization entity operations with caching support.
 * Implements optimized queries and caching strategies to achieve 80% reduction in processing time.
 *
 * @author EPA System
 * @version 1.0
 */
@Repository
public interface AuthorizationRepository extends JpaRepository<Authorization, UUID> {

    /**
     * Retrieves a cached authorization by its unique identifier.
     * Uses Spring Cache abstraction for high-performance data access.
     *
     * @param authorizationId The unique identifier of the authorization
     * @return Optional<Authorization> containing the authorization if found
     */
    @Cacheable(value = "authorizations", key = "#authorizationId", unless = "#result == null")
    Optional<Authorization> findByAuthorizationId(UUID authorizationId);

    /**
     * Finds all authorizations with the specified status using cached results.
     * Implements optimized query with eager loading of essential relationships.
     *
     * @param status The authorization status to filter by
     * @return List<Authorization> List of authorizations matching the status
     */
    @Query("SELECT DISTINCT a FROM Authorization a " +
           "LEFT JOIN FETCH a.documents " +
           "WHERE a.status = :status " +
           "ORDER BY a.updatedAt DESC")
    @Cacheable(value = "authorizations-by-status", key = "#status")
    List<Authorization> findByStatus(@Param("status") AuthorizationStatus status);

    /**
     * Retrieves authorizations for a specific patient with optimized query.
     * Uses join fetch for efficient loading of related entities.
     *
     * @param patientId The unique identifier of the patient
     * @return List<Authorization> List of authorizations for the patient
     */
    @Query("SELECT DISTINCT a FROM Authorization a " +
           "LEFT JOIN FETCH a.documents " +
           "WHERE a.patientInfo.id = :patientId " +
           "ORDER BY a.createdAt DESC")
    List<Authorization> findByPatientInfoId(@Param("patientId") UUID patientId);

    /**
     * Retrieves authorizations submitted by a specific provider with optimized query.
     * Implements efficient loading strategy for related entities.
     *
     * @param providerId The unique identifier of the provider
     * @return List<Authorization> List of authorizations from the provider
     */
    @Query("SELECT DISTINCT a FROM Authorization a " +
           "LEFT JOIN FETCH a.documents " +
           "WHERE a.providerInfo.id = :providerId " +
           "ORDER BY a.createdAt DESC")
    List<Authorization> findByProviderInfoId(@Param("providerId") UUID providerId);

    /**
     * Counts authorizations in a specific status with cached results.
     * Implements caching for frequently accessed metrics.
     *
     * @param status The authorization status to count
     * @return Long Count of authorizations in the status
     */
    @Cacheable(value = "authorization-counts", key = "#status")
    Long countByStatus(@Param("status") AuthorizationStatus status);

    /**
     * Finds pending authorizations requiring review with optimized query.
     * Implements specific business logic for workflow processing.
     *
     * @return List<Authorization> List of authorizations pending review
     */
    @Query("SELECT DISTINCT a FROM Authorization a " +
           "LEFT JOIN FETCH a.documents " +
           "WHERE a.status IN ('SUBMITTED', 'PENDING_DOCUMENTS', 'UNDER_REVIEW') " +
           "ORDER BY a.createdAt ASC")
    @Cacheable(value = "pending-authorizations")
    List<Authorization> findPendingAuthorizations();

    /**
     * Retrieves authorizations updated within a specific time window.
     * Supports audit and compliance requirements.
     *
     * @param hours Number of hours to look back
     * @return List<Authorization> Recently updated authorizations
     */
    @Query("SELECT a FROM Authorization a " +
           "WHERE a.updatedAt >= (CURRENT_TIMESTAMP - :hours * 3600 * 1000) " +
           "ORDER BY a.updatedAt DESC")
    List<Authorization> findRecentlyUpdated(@Param("hours") Integer hours);
}