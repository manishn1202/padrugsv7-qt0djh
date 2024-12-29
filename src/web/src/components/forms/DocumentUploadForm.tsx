import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, Alert, LinearProgress, Button } from '@mui/material'; // v5.0.0
import { FileUpload, FileUploadProps } from '../common/FileUpload';
import useForm from '../../hooks/useForm';
import { documentService } from '../../api/document.api';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../../constants/validation.constants';
import { LoadingState } from '../../types/common.types';

/**
 * Props interface for DocumentUploadForm component with HIPAA compliance requirements
 */
interface DocumentUploadFormProps {
  authorizationId: string;
  onUploadComplete: (documentIds: string[]) => void;
  onError: (error: Error) => void;
}

/**
 * DocumentUploadForm Component
 * 
 * A HIPAA-compliant form component for handling clinical document uploads in the Enhanced PA System.
 * Supports multiple file uploads, progress tracking, and comprehensive validation.
 * 
 * @component
 * @version 1.0.0
 */
export const DocumentUploadForm: React.FC<DocumentUploadFormProps> = ({
  authorizationId,
  onUploadComplete,
  onError
}) => {
  // State management
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');

  // Form handling with validation
  const { validateField } = useForm();

  /**
   * Handles file upload process with progress tracking and validation
   */
  const handleFileUpload = useCallback(async (files: File[]) => {
    setIsUploading(true);
    setLoadingState('loading');
    setError(null);
    
    try {
      const uploadPromises = files.map(async (file) => {
        try {
          const response = await documentService.uploadDocument(
            file,
            authorizationId,
            (progress: number) => {
              setUploadProgress((prevProgress) => {
                const newProgress = (prevProgress + progress) / 2;
                return Math.min(newProgress, 99); // Reserve 100% for completion
              });
            }
          );

          // Start polling for document processing status
          const processedDoc = await documentService.getDocumentStatus(
            response.data.fileName,
            {
              interval: 5000,
              maxAttempts: 12,
              abortSignal: new AbortController().signal
            }
          );

          return processedDoc.data.fileName;
        } catch (error) {
          throw new Error(`Failed to upload ${file.name}: ${error.message}`);
        }
      });

      const documentIds = await Promise.all(uploadPromises);
      setUploadedFiles((prev) => [...prev, ...documentIds]);
      setUploadProgress(100);
      setLoadingState('succeeded');
      onUploadComplete(documentIds);

    } catch (error) {
      handleError(error);
    } finally {
      setIsUploading(false);
    }
  }, [authorizationId, onUploadComplete]);

  /**
   * Enhanced error handling with detailed user feedback
   */
  const handleError = useCallback((error: Error) => {
    setError(error.message);
    setLoadingState('failed');
    onError(error);
    setUploadProgress(0);
  }, [onError]);

  /**
   * Cleanup function for component unmount
   */
  useEffect(() => {
    return () => {
      documentService.cancelOperations();
    };
  }, []);

  /**
   * File upload configuration
   */
  const uploadConfig: Partial<FileUploadProps> = {
    accept: ALLOWED_FILE_TYPES.join(','),
    multiple: true,
    maxSize: MAX_FILE_SIZE,
    onUpload: handleFileUpload,
    onError: handleError
  };

  return (
    <Box
      component="form"
      sx={{
        width: '100%',
        maxWidth: 600,
        margin: '0 auto',
        padding: 3,
        borderRadius: 1,
        backgroundColor: 'background.paper'
      }}
    >
      <Typography variant="h6" gutterBottom>
        Upload Clinical Documents
      </Typography>
      
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Please upload relevant clinical documentation to support this prior authorization request.
        Supported formats: PDF, JPEG, PNG
      </Typography>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <FileUpload {...uploadConfig} />

      {isUploading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress 
            variant="determinate" 
            value={uploadProgress}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography 
            variant="body2" 
            color="textSecondary" 
            align="center" 
            sx={{ mt: 1 }}
          >
            Uploading... {Math.round(uploadProgress)}%
          </Typography>
          <Button
            variant="text"
            color="primary"
            onClick={() => documentService.cancelOperations()}
            disabled={loadingState === 'succeeded'}
            sx={{ mt: 1 }}
          >
            Cancel Upload
          </Button>
        </Box>
      )}

      {uploadedFiles.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Uploaded Documents:
          </Typography>
          {uploadedFiles.map((fileId, index) => (
            <Typography 
              key={fileId} 
              variant="body2" 
              color="textSecondary"
              sx={{ ml: 2 }}
            >
              {index + 1}. Document ID: {fileId}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
};

export type { DocumentUploadFormProps };