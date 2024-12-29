/**
 * @fileoverview Type definitions for prior authorization requests and related data structures
 * @version 1.0.0
 * @license MIT
 */

/**
 * Enumeration of possible authorization request statuses
 */
export enum AuthorizationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PENDING_DOCUMENTS = 'PENDING_DOCUMENTS',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  CANCELLED = 'CANCELLED'
}

/**
 * Interface for patient demographic and contact information
 */
export interface PatientInfo {
  patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  contact: {
    phone: string;
    email: string;
  };
}

/**
 * Interface for insurance and coverage details
 */
export interface InsuranceInfo {
  payer_id: string;
  plan_id: string;
  member_id: string;
  group_number: string;
  coverage_type: string;
  formulary_id: string;
}

/**
 * Interface for medication and prescription information
 */
export interface MedicationInfo {
  drug_name: string;
  strength: string;
  dosage_form: string;
  quantity: number;
  days_supply: number;
  directions: string;
  ndc_code: string;
}

/**
 * Interface for laboratory test results
 */
export interface LabResult {
  test_name: string;
  value: number;
  unit: string;
  date: string;
  reference_range: {
    min: number;
    max: number;
  };
  is_abnormal: boolean;
}

/**
 * Interface for clinical document metadata
 */
export interface DocumentInfo {
  document_id: string;
  type: string;
  upload_date: string;
  file_name: string;
  mime_type: string;
  size: number;
}

/**
 * Interface for previous treatment information
 */
export interface TreatmentHistory {
  medication: string;
  start_date: string;
  end_date: string;
  outcome: string;
  side_effects: string[];
  prescriber: string;
}

/**
 * Interface for clinical criteria evaluation
 */
export interface ClinicalCriteria {
  criteria_met: boolean;
  evaluation_date: string;
  notes: string;
}

/**
 * Interface for AI-generated clinical insights
 */
export interface ClinicalInsight {
  category: string;
  description: string;
  relevance_score: number;
  evidence_sources: string[];
  recommendation_impact: string;
}

/**
 * Comprehensive interface for clinical information and documentation
 */
export interface ClinicalInfo {
  diagnosis_codes: string[];
  lab_results: LabResult[];
  documents: DocumentInfo[];
  clinical_criteria: ClinicalCriteria;
  treatment_history: TreatmentHistory[];
}

/**
 * Interface for AI-generated analysis results and insights
 */
export interface AIAnalysis {
  criteria_match_score: number;
  recommendation: string;
  confidence_score: number;
  analysis_timestamp: string;
  clinical_insights: ClinicalInsight[];
}