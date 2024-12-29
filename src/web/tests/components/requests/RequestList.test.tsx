import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../../assets/styles/theme';
import RequestList from '../../../components/requests/RequestList';
import { LoadingState, ApiResponse } from '../../../types/common.types';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
vi.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({ theme })
}));

// Test data generator
const generateTestRequests = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: `req-${index}`,
    patientName: `Patient ${index}`,
    patientId: `PAT-${index}`,
    medicationName: `Medication ${index}`,
    status: index % 3 === 0 ? 'Approved' : index % 3 === 1 ? 'Pending' : 'Denied',
    submittedDate: new Date(2024, 0, index + 1).toISOString(),
    priority: index % 2 === 0 ? 'High' : 'Normal',
    providerName: `Dr. Provider ${index}`,
    insurancePlan: `Insurance Plan ${index}`
  }));
};

// Test setup helper
const setupTest = (props = {}) => {
  const user = userEvent.setup();
  const defaultProps = {
    onRequestSelect: vi.fn(),
    defaultFilters: {},
    defaultPageSize: 25,
    onError: vi.fn(),
    accessibilityLabel: 'Test Request List'
  };

  const utils = render(
    <ThemeProvider theme={theme}>
      <RequestList {...defaultProps} {...props} />
    </ThemeProvider>
  );

  return {
    user,
    ...utils,
    defaultProps
  };
};

describe('RequestList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Rendering and Display', () => {
    it('should render initial state with loading indicator', () => {
      setupTest();
      expect(screen.getByLabelText(/loading authorization requests/i)).toBeInTheDocument();
    });

    it('should render data grid with requests when data is loaded', async () => {
      const testData = generateTestRequests(5);
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: testData })
      });

      setupTest();

      await waitFor(() => {
        testData.forEach(request => {
          expect(screen.getByText(request.patientName)).toBeInTheDocument();
        });
      });
    });

    it('should handle empty state gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: [] })
      });

      setupTest();

      await waitFor(() => {
        expect(screen.getByText(/no data available/i)).toBeInTheDocument();
      });
    });

    it('should maintain performance with large datasets', async () => {
      const largeDataset = generateTestRequests(1000);
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: largeDataset })
      });

      const { container } = setupTest();
      
      await waitFor(() => {
        const virtualRows = container.querySelectorAll('.MuiDataGrid-row');
        expect(virtualRows.length).toBeLessThan(largeDataset.length);
      });
    });
  });

  describe('Data Grid Features', () => {
    it('should handle column sorting', async () => {
      const testData = generateTestRequests(10);
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: testData })
      });

      const { user } = setupTest();

      await waitFor(() => {
        const patientNameHeader = screen.getByRole('columnheader', { name: /patient name/i });
        user.click(patientNameHeader);
      });

      // Verify sort indicator
      expect(screen.getByLabelText(/sorted ascending/i)).toBeInTheDocument();
    });

    it('should implement filtering correctly', async () => {
      const testData = generateTestRequests(10);
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: testData })
      });

      const { user } = setupTest();

      await waitFor(() => {
        const filterButton = screen.getByRole('button', { name: /show filters/i });
        user.click(filterButton);
      });

      const filterInput = await screen.findByRole('textbox', { name: /filter/i });
      await user.type(filterInput, 'Patient 1');

      // Verify filtered results
      expect(screen.queryByText('Patient 2')).not.toBeInTheDocument();
    });

    it('should handle pagination correctly', async () => {
      const testData = generateTestRequests(30);
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: testData })
      });

      setupTest({ defaultPageSize: 10 });

      await waitFor(() => {
        const nextPageButton = screen.getByRole('button', { name: /next page/i });
        fireEvent.click(nextPageButton);
      });

      // Verify page change
      expect(screen.getByText(/11-20 of 30/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const testData = generateTestRequests(5);
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: testData })
      });

      const { container } = setupTest();
      await waitFor(() => {
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const testData = generateTestRequests(5);
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: testData })
      });

      const { user } = setupTest();

      await waitFor(() => {
        const grid = screen.getByRole('grid');
        grid.focus();
      });

      await user.keyboard('{Tab}');
      await user.keyboard('{Enter}');

      // Verify row selection
      expect(screen.getByRole('row', { selected: true })).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Failed to load authorization requests';
      global.fetch = vi.fn().mockRejectedValueOnce(new Error(errorMessage));

      const onError = vi.fn();
      setupTest({ onError });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(screen.getByText(/error loading authorization requests/i)).toBeInTheDocument();
      });
    });

    it('should retry failed requests', async () => {
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: generateTestRequests(5) })
        });

      setupTest();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance', () => {
    it('should debounce filter changes', async () => {
      const testData = generateTestRequests(10);
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: testData })
      });

      const { user } = setupTest();

      await waitFor(() => {
        const filterButton = screen.getByRole('button', { name: /show filters/i });
        user.click(filterButton);
      });

      const filterInput = await screen.findByRole('textbox', { name: /filter/i });
      await user.type(filterInput, 'test');

      // Verify debounced API calls
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2); // Initial load + debounced filter
      });
    });

    it('should implement virtualization for large datasets', async () => {
      const largeDataset = generateTestRequests(1000);
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: largeDataset })
      });

      const { container } = setupTest();

      await waitFor(() => {
        const virtualScroller = container.querySelector('.MuiDataGrid-virtualScroller');
        expect(virtualScroller).toBeInTheDocument();
      });
    });
  });
});