/**
 * @fileoverview Enhanced RequestStatus component for managing prior authorization request statuses
 * with comprehensive validation, accessibility, and error handling.
 * @version 1.0.0
 * @license MIT
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Box, Button, CircularProgress } from '@mui/material'; // ^5.0.0
import { debounce } from 'lodash'; // ^4.17.21
import { AuthorizationStatus } from '../../types/request.types';
import { StatusBadge } from '../common/StatusBadge';
import { useRequest } from '../../hooks/useRequest';

/**
 * Props interface for RequestStatus component
 */
interface RequestStatusProps {
  /** Unique identifier for the authorization request */
  requestId: string;
  /** Current status of the authorization request */
  currentStatus: AuthorizationStatus;
  /** Flag indicating if user has permission to update status */
  canUpdateStatus?: boolean;
  /** Callback function triggered on successful status change */
  onStatusChange?: (newStatus: AuthorizationStatus) => void;
  /** Flag for enhanced accessibility features */
  isAccessible?: boolean;
}

/**
 * Allowed status transitions mapping based on business rules
 */
const ALLOWED_STATUS_TRANSITIONS: Record<AuthorizationStatus, AuthorizationStatus[]> = {
  [AuthorizationStatus.DRAFT]: [AuthorizationStatus.SUBMITTED, AuthorizationStatus.CANCELLED],
  [AuthorizationStatus.SUBMITTED]: [
    AuthorizationStatus.PENDING_DOCUMENTS,
    AuthorizationStatus.UNDER_REVIEW,
    AuthorizationStatus.CANCELLED
  ],
  [AuthorizationStatus.PENDING_DOCUMENTS]: [
    AuthorizationStatus.UNDER_REVIEW,
    AuthorizationStatus.CANCELLED
  ],
  [AuthorizationStatus.UNDER_REVIEW]: [
    AuthorizationStatus.APPROVED,
    AuthorizationStatus.DENIED,
    AuthorizationStatus.PENDING_DOCUMENTS
  ],
  [AuthorizationStatus.APPROVED]: [],
  [AuthorizationStatus.DENIED]: [AuthorizationStatus.UNDER_REVIEW],
  [AuthorizationStatus.CANCELLED]: []
};

/**
 * Status-specific messages for user feedback
 */
const STATUS_MESSAGES = {
  INVALID_TRANSITION: 'Invalid status transition attempted',
  PERMISSION_DENIED: "You don't have permission to update this status",
  UPDATE_ERROR: 'Failed to update status. Please try again',
  UPDATE_SUCCESS: 'Status updated successfully'
};

/**
 * RequestStatus component for displaying and managing authorization request status
 */
export const RequestStatus: React.FC<RequestStatusProps> = React.memo(({
  requestId,
  currentStatus,
  canUpdateStatus = false,
  onStatusChange,
  isAccessible = true
}) => {
  // Custom hook for request operations
  const { updateStatus, loading, error, clearError } = useRequest();

  // Ref for status announcement
  const announcementRef = useRef<HTMLDivElement>(null);

  /**
   * Announces status changes for screen readers
   */
  const announceStatusChange = useCallback((status: AuthorizationStatus) => {
    if (announcementRef.current) {
      announcementRef.current.textContent = `Status updated to ${status}`;
    }
  }, []);

  /**
   * Validates if a status transition is allowed
   */
  const isValidTransition = useCallback((newStatus: AuthorizationStatus): boolean => {
    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus];
    return allowedTransitions.includes(newStatus);
  }, [currentStatus]);

  /**
   * Handles status update with validation and error handling
   */
  const handleStatusUpdate = useCallback(
    debounce(async (newStatus: AuthorizationStatus) => {
      try {
        // Validate permissions
        if (!canUpdateStatus) {
          throw new Error(STATUS_MESSAGES.PERMISSION_DENIED);
        }

        // Validate status transition
        if (!isValidTransition(newStatus)) {
          throw new Error(STATUS_MESSAGES.INVALID_TRANSITION);
        }

        // Update status
        const result = await updateStatus(requestId, newStatus);

        if (result.success) {
          // Announce status change
          announceStatusChange(newStatus);
          
          // Trigger callback
          onStatusChange?.(newStatus);
        } else {
          throw new Error(STATUS_MESSAGES.UPDATE_ERROR);
        }
      } catch (err) {
        console.error('Status update failed:', err);
        // Error will be handled by useRequest hook
      }
    }, 300),
    [requestId, canUpdateStatus, isValidTransition, updateStatus, onStatusChange, announceStatusChange]
  );

  /**
   * Effect to clear error state on unmount
   */
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  /**
   * Renders status update buttons based on allowed transitions
   */
  const renderStatusButtons = () => {
    if (!canUpdateStatus) return null;

    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus];
    
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          gap: 1, 
          mt: 2,
          flexWrap: 'wrap'
        }}
      >
        {allowedTransitions.map((status) => (
          <Button
            key={status}
            variant="outlined"
            size="small"
            onClick={() => handleStatusUpdate(status)}
            disabled={loading}
            aria-disabled={loading}
            sx={{ minWidth: 120 }}
          >
            {status}
          </Button>
        ))}
      </Box>
    );
  };

  return (
    <Box
      role="region"
      aria-label="Authorization Status"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        position: 'relative'
      }}
    >
      {/* Status Badge */}
      <StatusBadge
        status={currentStatus}
        ariaLabel={`Current status: ${currentStatus}`}
      />

      {/* Loading Indicator */}
      {loading && (
        <CircularProgress
          size={24}
          sx={{
            position: 'absolute',
            right: -32,
            top: 0
          }}
          aria-label="Updating status"
        />
      )}

      {/* Error Message */}
      {error && (
        <Box
          role="alert"
          aria-live="polite"
          sx={{
            color: 'error.main',
            mt: 1,
            fontSize: '0.875rem'
          }}
        >
          {error.message}
        </Box>
      )}

      {/* Status Update Buttons */}
      {renderStatusButtons()}

      {/* Screen Reader Announcements */}
      <div
        ref={announcementRef}
        role="status"
        aria-live="polite"
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          border: 0
        }}
      />
    </Box>
  );
});

// Display name for debugging
RequestStatus.displayName = 'RequestStatus';

// Default export
export default RequestStatus;