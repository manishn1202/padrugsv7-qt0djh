import React from 'react';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import StatusSummary from '../../../../src/components/dashboard/StatusSummary';
import { useRequest } from '../../../../src/hooks/useRequest';
import { AuthorizationStatus } from '../../../../src/types/request.types';

// Mock the useRequest hook
jest.mock('../../../../src/hooks/useRequest', () => ({
  useRequest: jest.fn()
}));

// Mock data for testing
const mockMetrics = {
  data: {
    totalItems: 0,
    items: []
  }
};

describe('StatusSummary Component', () => {
  // Set up mock implementation before each test
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock implementation for useRequest
    (useRequest as jest.Mock).mockReturnValue({
      searchRequests: jest.fn().mockResolvedValue(mockMetrics),
      loading: false,
      error: null
    });
  });

  it('should render status metrics correctly', async () => {
    // Mock successful API responses with test data
    const mockSearchRequests = jest.fn()
      .mockResolvedValueOnce({ data: { totalItems: 12 } }) // Pending Documents
      .mockResolvedValueOnce({ data: { totalItems: 8 } })  // Under Review
      .mockResolvedValueOnce({ data: { totalItems: 25 } }); // Approved

    (useRequest as jest.Mock).mockReturnValue({
      searchRequests: mockSearchRequests,
      loading: false,
      error: null
    });

    render(<StatusSummary />);

    // Wait for all metrics to load
    await waitFor(() => {
      expect(screen.getByTestId('status-card-pending_documents')).toBeInTheDocument();
      expect(screen.getByTestId('status-card-under_review')).toBeInTheDocument();
      expect(screen.getByTestId('status-card-approved')).toBeInTheDocument();
    });

    // Verify metric cards content
    const pendingCard = screen.getByTestId('status-card-pending_documents');
    const reviewCard = screen.getByTestId('status-card-under_review');
    const approvedCard = screen.getByTestId('status-card-approved');

    // Check metric values
    expect(within(pendingCard).getByText('12')).toBeInTheDocument();
    expect(within(reviewCard).getByText('8')).toBeInTheDocument();
    expect(within(approvedCard).getByText('25')).toBeInTheDocument();

    // Verify progress indicators
    expect(within(pendingCard).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
    expect(within(reviewCard).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(within(approvedCard).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '83');
  });

  it('should handle loading state correctly', () => {
    // Mock loading state
    (useRequest as jest.Mock).mockReturnValue({
      searchRequests: jest.fn(),
      loading: true,
      error: null
    });

    render(<StatusSummary />);

    // Verify loading indicator
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    // Verify metric cards are not displayed during loading
    expect(screen.queryByTestId('status-card-pending_documents')).not.toBeInTheDocument();
    expect(screen.queryByTestId('status-card-under_review')).not.toBeInTheDocument();
    expect(screen.queryByTestId('status-card-approved')).not.toBeInTheDocument();
  });

  it('should handle error state correctly', async () => {
    // Mock error state
    const mockError = new Error('Failed to fetch metrics');
    (useRequest as jest.Mock).mockReturnValue({
      searchRequests: jest.fn().mockRejectedValue(mockError),
      loading: false,
      error: mockError
    });

    render(<StatusSummary />);

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(/Error loading status metrics/i)).toBeInTheDocument();
    });

    // Verify error message accessibility
    const errorMessage = screen.getByText(/Error loading status metrics/i);
    expect(errorMessage).toHaveAttribute('role', 'alert');
  });

  it('should refresh metrics at regular intervals', async () => {
    // Mock timer and search requests
    jest.useFakeTimers();
    const mockSearchRequests = jest.fn().mockResolvedValue({ data: { totalItems: 0 } });
    
    (useRequest as jest.Mock).mockReturnValue({
      searchRequests: mockSearchRequests,
      loading: false,
      error: null
    });

    render(<StatusSummary />);

    // Initial load
    expect(mockSearchRequests).toHaveBeenCalledTimes(3); // One call for each status

    // Fast-forward 30 seconds
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    // Verify refresh calls
    expect(mockSearchRequests).toHaveBeenCalledTimes(6); // Additional calls after refresh

    jest.useRealTimers();
  });

  it('should be keyboard navigable', async () => {
    const user = userEvent.setup();
    
    render(<StatusSummary />);

    // Wait for metrics to load
    await waitFor(() => {
      expect(screen.getByTestId('status-card-pending_documents')).toBeInTheDocument();
    });

    // Tab through metric cards
    await user.tab();
    expect(screen.getByTestId('status-card-pending_documents')).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('status-card-under_review')).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('status-card-approved')).toHaveFocus();
  });

  it('should retry failed requests', async () => {
    // Mock failed request with retry
    const mockSearchRequests = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: { totalItems: 12 } });

    (useRequest as jest.Mock).mockReturnValue({
      searchRequests: mockSearchRequests,
      loading: false,
      error: null
    });

    render(<StatusSummary />);

    // Wait for retry attempt
    await waitFor(() => {
      expect(mockSearchRequests).toHaveBeenCalledTimes(2);
    });

    // Verify successful retry
    expect(screen.queryByText(/Error loading status metrics/i)).not.toBeInTheDocument();
  });

  it('should maintain ARIA live regions for updates', async () => {
    render(<StatusSummary />);

    // Verify ARIA live regions
    const liveRegion = screen.getByRole('region', { name: /status metrics/i });
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    // Verify individual metric accessibility
    await waitFor(() => {
      const metrics = screen.getAllByRole('progressbar');
      metrics.forEach(metric => {
        expect(metric).toHaveAttribute('aria-valuemin', '0');
        expect(metric).toHaveAttribute('aria-valuemax', '100');
        expect(metric).toHaveAttribute('aria-valuenow');
      });
    });
  });
});