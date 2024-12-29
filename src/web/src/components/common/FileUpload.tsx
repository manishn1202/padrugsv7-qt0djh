import React, { useCallback, useState, useRef } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material'; // v5.0.0
import { CloudUpload } from '@mui/icons-material'; // v5.0.0
import { useDropzone } from 'react-dropzone'; // v14.2.0
import { useForm } from '../../hooks/useForm';
import { uploadDocument } from '../../api/document.api';
import { styled } from '@mui/material/styles';

// Constants for file validation
const MAX_FILE_SIZE = 104857600; // 100MB
const CHUNK_SIZE = 2097152; // 2MB chunks for large file handling
const ALLOWED_FILE_TYPES = ['.pdf', '.doc', '.docx', '.jpg', '.png'];

// Styled components
const UploadContainer = styled(Box)(({ theme }) => ({
  border: `2px dashed ${theme.palette.primary.main}`,
  borderRadius: '8px',
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  outline: 'none',
  position: 'relative',
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    borderColor: theme.palette.primary.dark,
    backgroundColor: theme.palette.action.hover,
  },
  '&.dragActive': {
    borderColor: theme.palette.success.main,
    backgroundColor: theme.palette.success.light,
  },
  '&.error': {
    borderColor: theme.palette.error.main,
    backgroundColor: theme.palette.error.light,
  },
}));

// Type definitions
interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  chunkSize?: number;
  onUpload: (files: File[]) => Promise<void>;
  onProgress?: (progress: number) => void;
  onError: (error: UploadError) => void;
}

interface UploadError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface FileWithProgress extends File {
  progress?: number;
}

/**
 * HIPAA-compliant file upload component with comprehensive features
 * Supports drag-and-drop, multi-file selection, chunked uploads, and progress tracking
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  accept = ALLOWED_FILE_TYPES.join(','),
  multiple = true,
  maxSize = MAX_FILE_SIZE,
  maxFiles = 10,
  chunkSize = CHUNK_SIZE,
  onUpload,
  onProgress,
  onError,
}) => {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const uploadAbortController = useRef<AbortController>();

  const { validateField } = useForm();

  /**
   * Validates individual file against security and compliance requirements
   */
  const validateFile = async (file: File): Promise<boolean> => {
    try {
      // Size validation
      if (file.size > maxSize) {
        onError({
          code: 'FILE_SIZE_EXCEEDED',
          message: `File ${file.name} exceeds maximum size of ${maxSize / 1048576}MB`,
        });
        return false;
      }

      // Type validation
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
        onError({
          code: 'INVALID_FILE_TYPE',
          message: `File type ${fileExtension} is not supported. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`,
        });
        return false;
      }

      // Additional HIPAA compliance validation
      const isCompliant = await validateField('fileUpload', file);
      if (isCompliant !== undefined) {
        onError({
          code: 'HIPAA_COMPLIANCE_ERROR',
          message: isCompliant,
        });
        return false;
      }

      return true;
    } catch (error) {
      onError({
        code: 'VALIDATION_ERROR',
        message: 'File validation failed',
        details: { error },
      });
      return false;
    }
  };

  /**
   * Handles chunked file upload with progress tracking
   */
  const uploadFileInChunks = async (file: File): Promise<void> => {
    const chunks = Math.ceil(file.size / chunkSize);
    let uploadedChunks = 0;

    uploadAbortController.current = new AbortController();

    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      try {
        await uploadDocument(chunk, {
          fileName: file.name,
          chunkIndex: i,
          totalChunks: chunks,
          signal: uploadAbortController.current.signal,
        });

        uploadedChunks++;
        const progress = Math.round((uploadedChunks / chunks) * 100);
        
        setFiles(prevFiles =>
          prevFiles.map(f =>
            f.name === file.name ? { ...f, progress } : f
          )
        );

        if (onProgress) {
          onProgress(progress);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('Upload cancelled');
        }
        throw error;
      }
    }
  };

  /**
   * Handles file drop and selection
   */
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      setIsUploading(true);

      if (acceptedFiles.length > maxFiles) {
        onError({
          code: 'MAX_FILES_EXCEEDED',
          message: `Maximum of ${maxFiles} files allowed`,
        });
        return;
      }

      const validFiles: File[] = [];
      for (const file of acceptedFiles) {
        const isValid = await validateFile(file);
        if (isValid) {
          validFiles.push(file);
        }
      }

      if (validFiles.length > 0) {
        setFiles(validFiles.map(file => ({ ...file, progress: 0 })));
        await Promise.all(validFiles.map(uploadFileInChunks));
        await onUpload(validFiles);
      }
    } catch (error) {
      onError({
        code: 'UPLOAD_ERROR',
        message: 'File upload failed',
        details: { error },
      });
    } finally {
      setIsUploading(false);
    }
  }, [maxFiles, onUpload, onError, validateFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.split(',').reduce((acc, curr) => ({
      ...acc,
      [curr]: [],
    }), {}),
    multiple,
    disabled: isUploading,
    maxSize,
  });

  /**
   * Cancels ongoing upload
   */
  const cancelUpload = useCallback(() => {
    if (uploadAbortController.current) {
      uploadAbortController.current.abort();
      setIsUploading(false);
      setFiles([]);
    }
  }, []);

  return (
    <UploadContainer
      {...getRootProps()}
      className={`${isDragActive ? 'dragActive' : ''} ${files.some(f => f.progress === 100) ? 'success' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="File upload area"
    >
      <input {...getInputProps()} aria-label="File input" />
      
      <CloudUpload color="primary" sx={{ fontSize: 40 }} />
      
      <Typography variant="h6" color="textPrimary">
        {isDragActive
          ? 'Drop files here'
          : 'Drag and drop files or click to select'}
      </Typography>
      
      <Typography variant="body2" color="textSecondary">
        Supported formats: {ALLOWED_FILE_TYPES.join(', ')}
      </Typography>
      
      {files.length > 0 && (
        <Box sx={{ width: '100%', mt: 2 }}>
          {files.map((file, index) => (
            <Box
              key={`${file.name}-${index}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                mb: 1,
              }}
            >
              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                {file.name}
              </Typography>
              
              <CircularProgress
                variant="determinate"
                value={file.progress || 0}
                size={24}
                sx={{ ml: 2 }}
              />
            </Box>
          ))}
        </Box>
      )}

      {isUploading && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="primary">
            Uploading files...
          </Typography>
          <button onClick={cancelUpload} type="button">
            Cancel Upload
          </button>
        </Box>
      )}
    </UploadContainer>
  );
};

export type { FileUploadProps, UploadError };