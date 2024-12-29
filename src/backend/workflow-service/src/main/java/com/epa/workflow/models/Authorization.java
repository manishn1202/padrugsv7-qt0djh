package com.epa.workflow.models;

import javax.persistence.*;  // v2.2
import javax.validation.constraints.Valid; // v2.0.1
import com.fasterxml.jackson.annotation.JsonManagedReference; // v2.15.2
import org.hibernate.envers.Audited; // v6.2.6
import com.epa.security.annotation.Encrypted; // v1.0.0
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.HashSet;
import java.util.Set;

/**
 * JPA entity representing a prior authorization request with comprehensive security and compliance features.
 * Implements HIPAA-compliant data handling with field-level encryption and complete audit trail.
 *
 * @author EPA System
 * @version 1.0
 */
@Entity
@Table(name = "authorizations", indexes = {
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_created_at", columnList = "created_at")
})
@Audited
@EntityListeners(AuditingEntityListener.class)
public class Authorization {

    @Id
    @Column(name = "authorization_id")
    private UUID authorizationId;

    @Version
    @Column(name = "version")
    private Long version;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private AuthorizationStatus status;

    @Embedded
    @Valid
    @Encrypted
    private PatientInfo patientInfo;

    @Embedded
    @Valid
    @Encrypted
    private InsuranceInfo insuranceInfo;

    @Embedded
    @Valid
    private MedicationInfo medicationInfo;

    @Embedded
    @Valid
    private ClinicalInfo clinicalInfo;

    @Embedded
    @Valid
    @Encrypted
    private ProviderInfo providerInfo;

    @Embedded
    private WorkflowInfo workflowInfo;

    @Embedded
    private AIAnalysis aiAnalysis;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "last_modified_by")
    private String lastModifiedBy;

    @OneToMany(mappedBy = "authorization", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private Set<Document> documents = new HashSet<>();

    /**
     * Default constructor with enhanced initialization
     */
    public Authorization() {
        this.authorizationId = UUID.randomUUID();
        this.status = AuthorizationStatus.DRAFT;
        this.createdAt = LocalDateTime.now();
        this.documents = new HashSet<>();
        this.version = 0L;
    }

    /**
     * Retrieves the authorization ID
     * @return UUID The unique identifier
     */
    public UUID getAuthorizationId() {
        return this.authorizationId;
    }

    /**
     * Gets current authorization status
     * @return AuthorizationStatus Current status
     */
    public AuthorizationStatus getStatus() {
        return this.status;
    }

    /**
     * Updates authorization status with validation and audit trail
     * @param newStatus The new status to transition to
     * @param reason The reason for status change
     * @throws IllegalStateException if status transition is invalid
     */
    public void updateStatus(AuthorizationStatus newStatus, String reason) {
        if (!this.status.canTransitionTo(newStatus)) {
            throw new IllegalStateException(
                String.format("Invalid status transition from %s to %s", this.status, newStatus)
            );
        }

        this.status = newStatus;
        this.updatedAt = LocalDateTime.now();
        this.workflowInfo.addStatusHistory(newStatus, reason);
    }

    // Getters and setters for all fields with appropriate validation

    public PatientInfo getPatientInfo() {
        return this.patientInfo;
    }

    public void setPatientInfo(@Valid PatientInfo patientInfo) {
        this.patientInfo = patientInfo;
    }

    public InsuranceInfo getInsuranceInfo() {
        return this.insuranceInfo;
    }

    public void setInsuranceInfo(@Valid InsuranceInfo insuranceInfo) {
        this.insuranceInfo = insuranceInfo;
    }

    public MedicationInfo getMedicationInfo() {
        return this.medicationInfo;
    }

    public void setMedicationInfo(@Valid MedicationInfo medicationInfo) {
        this.medicationInfo = medicationInfo;
    }

    public ClinicalInfo getClinicalInfo() {
        return this.clinicalInfo;
    }

    public void setClinicalInfo(@Valid ClinicalInfo clinicalInfo) {
        this.clinicalInfo = clinicalInfo;
    }

    public ProviderInfo getProviderInfo() {
        return this.providerInfo;
    }

    public void setProviderInfo(@Valid ProviderInfo providerInfo) {
        this.providerInfo = providerInfo;
    }

    public WorkflowInfo getWorkflowInfo() {
        return this.workflowInfo;
    }

    public void setWorkflowInfo(WorkflowInfo workflowInfo) {
        this.workflowInfo = workflowInfo;
    }

    public AIAnalysis getAiAnalysis() {
        return this.aiAnalysis;
    }

    public void setAiAnalysis(AIAnalysis aiAnalysis) {
        this.aiAnalysis = aiAnalysis;
    }

    public Set<Document> getDocuments() {
        return this.documents;
    }

    public void addDocument(Document document) {
        documents.add(document);
        document.setAuthorization(this);
    }

    public void removeDocument(Document document) {
        documents.remove(document);
        document.setAuthorization(null);
    }

    public LocalDateTime getCreatedAt() {
        return this.createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return this.updatedAt;
    }

    public String getCreatedBy() {
        return this.createdBy;
    }

    public String getLastModifiedBy() {
        return this.lastModifiedBy;
    }
}

/**
 * Enumeration of possible authorization statuses with transition rules
 */
enum AuthorizationStatus {
    DRAFT,
    SUBMITTED,
    PENDING_DOCUMENTS,
    UNDER_REVIEW,
    APPROVED,
    DENIED,
    CANCELLED;

    /**
     * Validates if status transition is allowed based on business rules
     * @param newStatus The target status
     * @return boolean Whether transition is allowed
     */
    public boolean canTransitionTo(AuthorizationStatus newStatus) {
        switch (this) {
            case DRAFT:
                return newStatus == SUBMITTED || newStatus == CANCELLED;
            case SUBMITTED:
                return newStatus == PENDING_DOCUMENTS || newStatus == UNDER_REVIEW || 
                       newStatus == CANCELLED;
            case PENDING_DOCUMENTS:
                return newStatus == UNDER_REVIEW || newStatus == CANCELLED;
            case UNDER_REVIEW:
                return newStatus == APPROVED || newStatus == DENIED || 
                       newStatus == PENDING_DOCUMENTS || newStatus == CANCELLED;
            case APPROVED:
            case DENIED:
            case CANCELLED:
                return false;
            default:
                return false;
        }
    }
}