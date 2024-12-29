import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { axe } from '@axe-core/react';
import { jest, expect, describe, beforeEach, afterEach } from '@jest/globals';

// Component imports
import Dashboard from '../../src/pages/Dashboard';
import { useRequest } from '../../src/hooks/useRequest';
import { AuthorizationStatus } from '../../src/types/request.types';

// Mock hooks and components
jest.mock('../../src/hooks/useRequest');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

// Mock data
const mockStatusMetrics = {
  pending: { current: 12, total: 15 },
  underReview: { current: 8, total: 20 },
  approved: { current: 25, total: 30 }
};

const mockActivityData = [
  {
    id: '1',
    type: 'status_change',
    timestamp: new Date().toISOString(),
    requestId: 'PA-2024-001',
    description: 'Request approved',
    status: AuthorizationStatus.APPROVED
  },
  {
    id: '2',
    type: 'document_upload',
    timestamp: new Date().toISOString(),
    requestId: 'PA-2024-002',
    description: 'Clinical documents uploaded'
  }
];

describe('Dashboard', () => {
  // Setup before each test
  beforeEach(() => {
    // Mock useRequest hook
    (useRequest as jest.Mock).mockImplementation(() => ({
      searchRequests: jest.fn().mockResolvedValue({
        success: true,
        data: {
          activities: mockActivityData,
          metrics: mockStatusMetrics
        }
      }),
      loading: false,
      error: null,
      clearError: jest.fn()
    }));

    // Reset all timers
    jest.useFakeTimers();
  });

  // Cleanup after each test
  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  test('renders all dashboard components correctly', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Verify StatusSummary component
    expect(screen.getByTestId('status-card-pending-documents')).toBeInTheDocument();
    expect(screen.getByTestId('status-card-under-review')).toBeInTheDocument();
    expect(screen.getByTestId('status-card-approved')).toBeInTheDocument();

    // Verify metrics display
    expect(screen.getByText('12/15')).toBeInTheDocument();
    expect(screen.getByText('8/20')).toBeInTheDocument();
    expect(screen.getByText('25/30')).toBeInTheDocument();

    // Verify ActivityFeed component
    const activityFeed = screen.getByRole('region', { name: /Activity Feed/i });
    expect(activityFeed).toBeInTheDocument();
    expect(within(activityFeed).getByText('Request approved')).toBeInTheDocument();

    // Verify QuickActions component
    const quickActions = screen.getByTestId('quick-actions');
    expect(quickActions).toBeInTheDocument();
    expect(within(quickActions).getByText('Start New Request')).toBeInTheDocument();
  });

  test('handles real-time updates correctly', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Simulate real-time update
    const updatedActivityData = [
      {
        id: '3',
        type: 'status_change',
        timestamp: new Date().toISOString(),
        requestId: 'PA-2024-003',
        description: 'New request submitted',
        status: AuthorizationStatus.SUBMITTED
      },
      ...mockActivityData
    ];

    (useRequest as jest.Mock).mockImplementation(() => ({
      searchRequests: jest.fn().mockResolvedValue({
        success: true,
        data: {
          activities: updatedActivityData,
          metrics: mockStatusMetrics
        }
      }),
      loading: false,
      error: null,
      clearError: jest.fn()
    }));

    // Fast-forward timers to trigger update
    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(screen.getByText('New request submitted')).toBeInTheDocument();
    });
  });

  test('handles error states appropriately', async () => {
    // Mock error state
    (useRequest as jest.Mock).mockImplementation(() => ({
      searchRequests: jest.fn().mockRejectedValue(new Error('Failed to fetch data')),
      loading: false,
      error: { message: 'Failed to fetch data' },
      clearError: jest.fn()
    }));

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch data/i)).toBeInTheDocument();
    });
  });

  test('meets accessibility requirements', async () => {
    const { container } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA landmarks
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Activity Feed/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Quick Actions/i })).toBeInTheDocument();
  });

  test('handles quick action interactions correctly', async () => {
    const navigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Test new request button
    const newRequestButton = screen.getByTestId('new-request-button');
    fireEvent.click(newRequestButton);
    expect(navigate).toHaveBeenCalledWith('/requests/new');

    // Test search button
    const searchButton = screen.getByTestId('search-button');
    fireEvent.click(searchButton);
    expect(navigate).toHaveBeenCalledWith('/search');

    // Test analytics button
    const analyticsButton = screen.getByTestId('analytics-button');
    fireEvent.click(analyticsButton);
    expect(navigate).toHaveBeenCalledWith('/analytics');
  });

  test('handles responsive layout correctly', async () => {
    // Mock different viewport sizes
    const { rerender } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Test mobile layout
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));
    rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Verify mobile-specific elements
    expect(screen.getByTestId('quick-actions')).toHaveStyle({
      position: 'static'
    });

    // Test desktop layout
    window.innerWidth = 1440;
    window.dispatchEvent(new Event('resize'));
    rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Verify desktop-specific elements
    expect(screen.getByTestId('quick-actions')).toHaveStyle({
      position: 'sticky'
    });
  });
});