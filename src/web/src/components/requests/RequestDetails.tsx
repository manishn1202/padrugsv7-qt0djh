/**
 * @fileoverview A comprehensive React component for displaying and managing prior authorization request details
 * with enhanced security, accessibility, and real-time updates.
 * @version 1.0.0
 * @license MIT
 */

import React, { useEffect, useState, useCallback } from 'react'; // ^18.2.0
import { useParams } from 'react-router-dom'; // ^6.0.0
import { 
  Grid, 
  Card, 
  CardContent, 
  Typography,
  Divider,
  Box,
  Button,
  CircularProgress,
  Alert
} from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0

// Internal imports
import { useRequest } from '../../hooks/useRequest';
import { AuthorizationRequest, AuthorizationStatus } from '../../types/request.types';
import StatusBadge from '../common/StatusBadge';

// Styled components for enhanced accessibility and responsiveness
const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  '&:focus-within': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(2),
  color: theme.palette.text.primary,
}));

/**
 * Props interface for RequestDetails component
 */
interface RequestDetailsProps {
  className?: string;
  ariaLabel?: string;
  role?: string;
}

/**
 * RequestDetails component displays comprehensive information about a prior authorization request
 * with real-time updates and accessibility features
 */
const RequestDetails: React.FC<RequestDetailsProps> = ({
  className,
  ariaLabel = 'Prior Authorization Request Details',
  role = 'main',
}) => {
  // State management
  const [request, setRequest] = useState<AuthorizationRequest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const { id } = useParams<{ id: string }>();
  const { getRequest, updateStatus } = useRequest();

  /**
   * Fetches request details with error handling and retry mechanism
   */
  const fetchRequestDetails = useCallback(async () => {
    if (!id) {
      setError('Request ID is missing');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getRequest(id);
      
      if (response.success && response.data) {
        setRequest(response.data);
      } else {
        setError(response.error?.message || 'Failed to fetch request details');
      }
    } catch (err) {
      setError('An unexpected error occurred while fetching request details');
      console.error('Request details fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, getRequest]);

  /**
   * Handles status updates with audit logging and error handling
   */
  const handleStatusUpdate = useCallback(async (newStatus: AuthorizationStatus) => {
    if (!id || !request) return;

    try {
      const response = await updateStatus(id, newStatus);
      
      if (response.success && response.data) {
        setRequest(prev => prev ? { ...prev, status: newStatus } : null);
      } else {
        setError(response.error?.message || 'Failed to update status');
      }
    } catch (err) {
      setError('An unexpected error occurred while updating status');
      console.error('Status update error:', err);
    }
  }, [id, request, updateStatus]);

  // Initial data fetch
  useEffect(() => {
    fetchRequestDetails();
  }, [fetchRequestDetails]);

  // Loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress aria-label="Loading request details" />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert 
        severity="error" 
        aria-live="polite"
        action={
          <Button color="inherit" onClick={fetchRequestDetails}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  // No data state
  if (!request) {
    return (
      <Alert severity="info" aria-live="polite">
        No request details found
      </Alert>
    );
  }

  return (
    <div 
      className={className} 
      role={role}
      aria-label={ariaLabel}
    >
      {/* Header Section */}
      <StyledCard>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <Typography variant="h5" component="h1">
                Request #{request.authorization_id}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} sx={{ textAlign: 'right' }}>
              <StatusBadge 
                status={request.status} 
                ariaLabel={`Current status: ${request.status}`}
              />
            </Grid>
          </Grid>
        </CardContent>
      </StyledCard>

      {/* Patient Information */}
      <StyledCard tabIndex={0}>
        <CardContent>
          <SectionTitle variant="h6" component="h2">
            Patient Information
          </SectionTitle>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography>
                <strong>Name:</strong> {request.patientInfo?.first_name} {request.patientInfo?.last_name}
              </Typography>
              <Typography>
                <strong>DOB:</strong> {request.patientInfo?.date_of_birth}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography>
                <strong>Phone:</strong> {request.patientInfo?.contact.phone}
              </Typography>
              <Typography>
                <strong>Email:</strong> {request.patientInfo?.contact.email}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </StyledCard>

      {/* Insurance Information */}
      <StyledCard tabIndex={0}>
        <CardContent>
          <SectionTitle variant="h6" component="h2">
            Insurance Information
          </SectionTitle>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography>
                <strong>Plan ID:</strong> {request.insuranceInfo?.plan_id}
              </Typography>
              <Typography>
                <strong>Member ID:</strong> {request.insuranceInfo?.member_id}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography>
                <strong>Group Number:</strong> {request.insuranceInfo?.group_number}
              </Typography>
              <Typography>
                <strong>Coverage Type:</strong> {request.insuranceInfo?.coverage_type}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </StyledCard>

      {/* Action Buttons */}
      <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={() => handleStatusUpdate(AuthorizationStatus.CANCELLED)}
          aria-label="Cancel request"
          disabled={request.status === AuthorizationStatus.CANCELLED}
        >
          Cancel Request
        </Button>
        <Button
          variant="contained"
          onClick={() => handleStatusUpdate(AuthorizationStatus.APPROVED)}
          aria-label="Approve request"
          disabled={request.status === AuthorizationStatus.APPROVED}
          color="primary"
        >
          Approve Request
        </Button>
      </Box>
    </div>
  );
};

export default RequestDetails;