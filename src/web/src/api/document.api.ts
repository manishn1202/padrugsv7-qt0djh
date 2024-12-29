/**
 * Document API Client Module for Enhanced Prior Authorization System
 * @version 1.0.0
 * @description Handles document-related operations including upload, retrieval, and status tracking
 * with enhanced error handling, progress monitoring, and HIPAA compliance features
 */

import axios, { AxiosProgressEvent, CancelTokenSource } from 'axios'; // ^1.6.0
import apiClient from '../config/api.config';
import { ApiResponse } from '../types/common.types';
import { API_ENDPOINTS, API_HEADERS, API_TIMEOUT } from '../constants/api.constants';

// Document processing constants
const MAX_FILE_SIZE = 104857600; // 100MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/dicom',
  'text/plain'
] as const;

const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_POLLING_ATTEMPTS = 12; // 1 minute total polling time

// Document status types
type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Document metadata interface
interface DocumentMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadTimestamp: string;
  processingStatus: DocumentStatus;
  hipaaCompliant: boolean;
}

// Document upload progress callback type
type UploadProgressCallback = (progress: number) => void;

// Document status polling options
interface StatusPollingOptions {
  interval?: number;
  maxAttempts?: number;
  abortSignal?: AbortSignal;
}

/**
 * Validates file size before upload
 */
const validateFileSize = (file: File): void => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1048576}MB`);
  }
};

/**
 * Validates file type before upload
 */
const validateFileType = (file: File): void => {
  if (!ALLOWED_FILE_TYPES.includes(file.type as typeof ALLOWED_FILE_TYPES[number])) {
    throw new Error(`File type ${file.type} is not supported. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`);
  }
};

/**
 * Document Service class for handling all document-related operations
 */
export class DocumentService {
  private cancelTokenSource: CancelTokenSource;

  constructor() {
    this.cancelTokenSource = axios.CancelToken.source();
  }

  /**
   * Uploads a document for a specific prior authorization request
   * @param file The file to upload
   * @param authorizationId The associated authorization ID
   * @param onProgress Optional callback for upload progress
   * @returns Promise resolving to upload response
   */
  public async uploadDocument(
    file: File,
    authorizationId: string,
    onProgress?: UploadProgressCallback
  ): Promise<ApiResponse<DocumentMetadata>> {
    try {
      // Validate file before upload
      validateFileSize(file);
      validateFileType(file);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('authorizationId', authorizationId);
      formData.append('timestamp', new Date().toISOString());

      const response = await apiClient.post<ApiResponse<DocumentMetadata>>(
        API_ENDPOINTS.DOCUMENT.UPLOAD,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            [API_HEADERS.X_API_KEY]: process.env.VITE_API_KEY,
            'X-HIPAA-Compliance': 'true'
          },
          timeout: API_TIMEOUT.DOCUMENT_UPLOAD,
          cancelToken: this.cancelTokenSource.token,
          onUploadProgress: (progressEvent: AxiosProgressEvent) => {
            if (onProgress && progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(progress);
            }
          }
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isCancel(error)) {
        throw new Error('Document upload was cancelled');
      }
      throw error;
    }
  }

  /**
   * Retrieves the current status of a document
   * @param documentId The ID of the document to check
   * @param options Optional polling configuration
   * @returns Promise resolving to document status
   */
  public async getDocumentStatus(
    documentId: string,
    options: StatusPollingOptions = {}
  ): Promise<ApiResponse<DocumentMetadata>> {
    const {
      interval = POLLING_INTERVAL,
      maxAttempts = MAX_POLLING_ATTEMPTS,
      abortSignal
    } = options;

    let attempts = 0;

    const pollStatus = async (): Promise<ApiResponse<DocumentMetadata>> => {
      try {
        const response = await apiClient.get<ApiResponse<DocumentMetadata>>(
          `${API_ENDPOINTS.DOCUMENT.BASE}/${documentId}/status`,
          {
            headers: {
              [API_HEADERS.X_API_KEY]: process.env.VITE_API_KEY
            }
          }
        );

        const { data } = response;

        if (data.data.processingStatus === 'completed' || data.data.processingStatus === 'failed') {
          return data;
        }

        if (++attempts >= maxAttempts) {
          throw new Error('Document processing timeout exceeded');
        }

        if (abortSignal?.aborted) {
          throw new Error('Status polling was aborted');
        }

        await new Promise(resolve => setTimeout(resolve, interval));
        return pollStatus();
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new Error(`Failed to get document status: ${error.message}`);
        }
        throw error;
      }
    };

    return pollStatus();
  }

  /**
   * Deletes a document from the system
   * @param documentId The ID of the document to delete
   * @returns Promise resolving to deletion confirmation
   */
  public async deleteDocument(documentId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(
        `${API_ENDPOINTS.DOCUMENT.BASE}/${documentId}`,
        {
          headers: {
            [API_HEADERS.X_API_KEY]: process.env.VITE_API_KEY
          }
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to delete document: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Cancels any ongoing document operations
   */
  public cancelOperations(): void {
    this.cancelTokenSource.cancel('Operation cancelled by user');
    this.cancelTokenSource = axios.CancelToken.source();
  }
}

// Export singleton instance
export const documentService = new DocumentService();