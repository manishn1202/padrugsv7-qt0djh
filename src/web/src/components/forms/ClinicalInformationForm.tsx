import React, { useCallback, useState } from 'react';
import { 
  Box, 
  Grid, 
  TextField, 
  Typography,
  FormHelperText,
  Autocomplete
} from '@mui/material';
import CryptoJS from 'crypto-js'; // v4.1.1
import * as yup from 'yup'; // v1.0.0
import { Form } from '../common/Form';
import Button from '../common/Button';
import Loading from '../common/Loading';
import { validateICD10 } from '../../utils/validation.utils';
import { VALIDATION_PATTERNS, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../../constants/validation.constants';

// Encryption key should be stored securely in environment variables
const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || '';

// Types for clinical information
interface ClinicalInfo {
  diagnosisCodes: string[];
  clinicalHistory: string;
  labResults?: EncryptedLabResult[];
  documents: EncryptedFile[];
  notes?: string;
}

interface EncryptedLabResult {
  id: string;
  type: string;
  value: string;
  date: string;
  encryptedData: string;
}

interface EncryptedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  encryptedData: string;
  checksum: string;
}

interface ClinicalInformationFormProps {
  initialValues?: ClinicalInfo;
  onSubmit: (values: ClinicalInfo, files: EncryptedFile[]) => Promise<void>;
  onError: (error: ValidationError | SecurityError) => void;
  auditLogger: AuditLogger;
}

// Validation schema using yup with healthcare-specific rules
const validationSchema = yup.object().shape({
  diagnosisCodes: yup
    .array()
    .of(yup.string().matches(VALIDATION_PATTERNS.ICD10))
    .min(1, 'At least one diagnosis code is required')
    .required('Diagnosis codes are required'),
  clinicalHistory: yup
    .string()
    .required('Clinical history is required')
    .min(10, 'Clinical history must be detailed')
    .max(5000, 'Clinical history is too long'),
  documents: yup
    .array()
    .of(
      yup.object().shape({
        type: yup.string().oneOf(ALLOWED_FILE_TYPES),
        size: yup.number().max(MAX_FILE_SIZE),
        checksum: yup.string().required()
      })
    )
    .min(1, 'At least one supporting document is required')
});

/**
 * Secure clinical information form component with HIPAA compliance
 * and enhanced validation features
 */
export const ClinicalInformationForm: React.FC<ClinicalInformationFormProps> = ({
  initialValues,
  onSubmit,
  onError,
  auditLogger
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Encrypt sensitive data before storage or transmission
  const encryptData = useCallback((data: string): string => {
    try {
      return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
    } catch (error) {
      auditLogger.logSecurityEvent('encryption_failure', { error });
      throw new SecurityError('Data encryption failed');
    }
  }, [auditLogger]);

  // Handle secure document upload with encryption and validation
  const handleSecureDocumentUpload = useCallback(async (
    files: FileList
  ): Promise<EncryptedFile[]> => {
    const encryptedFiles: EncryptedFile[] = [];
    const totalFiles = files.length;

    try {
      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        
        // Validate file type and size
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
          throw new ValidationError(`Invalid file type: ${file.type}`);
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new ValidationError(`File too large: ${file.name}`);
        }

        // Read and encrypt file data
        const fileData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        // Generate checksum for integrity verification
        const checksum = CryptoJS.SHA256(fileData).toString();
        
        // Encrypt file data
        const encryptedData = encryptData(fileData);

        encryptedFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          encryptedData,
          checksum
        });

        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      auditLogger.logActivityEvent('documents_uploaded', { 
        count: totalFiles,
        types: encryptedFiles.map(f => f.type)
      });

      return encryptedFiles;
    } catch (error) {
      auditLogger.logSecurityEvent('document_upload_failure', { error });
      throw error;
    }
  }, [encryptData, auditLogger]);

  // Handle form submission with validation and encryption
  const handleSubmit = useCallback(async (
    values: ClinicalInfo
  ): Promise<void> => {
    setIsProcessing(true);
    try {
      // Validate diagnosis codes
      const diagnosisValidations = await Promise.all(
        values.diagnosisCodes.map(code => validateICD10(code))
      );
      
      if (diagnosisValidations.some(v => !v.isValid)) {
        throw new ValidationError('Invalid diagnosis codes detected');
      }

      // Encrypt sensitive data
      const encryptedValues: ClinicalInfo = {
        ...values,
        clinicalHistory: encryptData(values.clinicalHistory),
        notes: values.notes ? encryptData(values.notes) : undefined
      };

      await onSubmit(encryptedValues, values.documents);
      
      auditLogger.logActivityEvent('clinical_info_submitted', {
        diagnosisCount: values.diagnosisCodes.length,
        documentsCount: values.documents.length
      });
    } catch (error) {
      onError(error as ValidationError | SecurityError);
      auditLogger.logSecurityEvent('submission_failure', { error });
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  }, [encryptData, onSubmit, onError, auditLogger]);

  return (
    <Form
      initialValues={initialValues || {
        diagnosisCodes: [],
        clinicalHistory: '',
        documents: []
      }}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      encryptData={true}
    >
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Clinical Information
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Autocomplete
            multiple
            options={[]} // ICD-10 codes would be fetched from API
            renderInput={(params) => (
              <TextField
                {...params}
                label="Diagnosis Codes (ICD-10)"
                required
                helperText="Enter valid ICD-10 diagnosis codes"
              />
            )}
            onChange={(_, value) => value}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            multiline
            rows={4}
            fullWidth
            label="Clinical History"
            required
            helperText="Provide detailed clinical history and justification"
          />
        </Grid>

        <Grid item xs={12}>
          <Box>
            <input
              type="file"
              multiple
              accept={ALLOWED_FILE_TYPES.join(',')}
              onChange={(e) => handleSecureDocumentUpload(e.target.files!)}
              style={{ display: 'none' }}
              id="document-upload"
            />
            <label htmlFor="document-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<span>📎</span>}
                disabled={isProcessing}
              >
                Upload Supporting Documents
              </Button>
            </label>
            {uploadProgress > 0 && (
              <Box mt={1}>
                <Loading size="small" />
                <FormHelperText>
                  Uploading documents: {uploadProgress.toFixed(0)}%
                </FormHelperText>
              </Box>
            )}
          </Box>
        </Grid>

        <Grid item xs={12}>
          <TextField
            multiline
            rows={2}
            fullWidth
            label="Additional Notes"
            helperText="Optional additional information"
          />
        </Grid>
      </Grid>
    </Form>
  );
};

export default ClinicalInformationForm;