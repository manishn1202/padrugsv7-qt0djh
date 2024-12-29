/**
 * @fileoverview Comprehensive test suite for LoginForm component
 * @version 1.0.0
 * @package @testing-library/react ^13.4.0
 * @package @testing-library/user-event ^14.0.0
 * @package @axe-core/react ^4.7.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';
import LoginForm from '../../../src/components/auth/LoginForm';
import { useAuth } from '../../../src/hooks/useAuth';
import { theme } from '../../../src/assets/styles/theme';
import { ThemeProvider } from '@mui/material';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock useAuth hook
jest.mock('../../../src/hooks/useAuth');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Test data constants
const TEST_DATA = {
  validCredentials: {
    email: 'test@example.com',
    password: 'Test123!@#$',
  },
  invalidCredentials: {
    email: 'invalid-email',
    password: 'short',
  },
  errorMessages: {
    requiredEmail: 'Email is required',
    requiredPassword: 'Password is required',
    invalidEmail: 'Please enter a valid email address',
    invalidPassword: 'Password must be at least 12 characters',
    loginFailed: 'Authentication failed. Please try again.',
  },
  organizationId: 'org-123',
};

// Helper function to render LoginForm with required providers
const renderLoginForm = (props = {}) => {
  const store = configureStore({
    reducer: {
      auth: (state = { isLoading: false, error: null }) => state,
    },
  });

  const mockLogin = jest.fn();
  mockUseAuth.mockReturnValue({
    login: mockLogin,
    isLoading: false,
    error: null,
    isAuthenticated: false,
    user: null,
    logout: jest.fn(),
    getToken: jest.fn(),
    checkRole: jest.fn(),
    hasPermission: jest.fn(),
    checkMfaStatus: jest.fn(),
    validateEnterpriseConnection: jest.fn(),
  });

  return {
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <LoginForm
            onSuccess={jest.fn()}
            onError={jest.fn()}
            {...props}
          />
        </ThemeProvider>
      </Provider>
    ),
    mockLogin,
  };
};

describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderLoginForm();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      renderLoginForm();
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Test tab order
      expect(document.body).toHaveFocus();
      userEvent.tab();
      expect(emailInput).toHaveFocus();
      userEvent.tab();
      expect(passwordInput).toHaveFocus();
      userEvent.tab();
      expect(submitButton).toHaveFocus();
    });

    it('should announce form errors to screen readers', async () => {
      renderLoginForm();
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.click(submitButton);
      
      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts).toHaveLength(2); // Email and password errors
        expect(alerts[0]).toHaveTextContent(TEST_DATA.errorMessages.requiredEmail);
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      renderLoginForm();
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(TEST_DATA.errorMessages.requiredEmail)).toBeInTheDocument();
        expect(screen.getByText(TEST_DATA.errorMessages.requiredPassword)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      renderLoginForm();
      const emailInput = screen.getByLabelText(/email address/i);

      await userEvent.type(emailInput, TEST_DATA.invalidCredentials.email);
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText(TEST_DATA.errorMessages.invalidEmail)).toBeInTheDocument();
      });
    });

    it('should validate password requirements', async () => {
      renderLoginForm();
      const passwordInput = screen.getByLabelText(/password/i);

      await userEvent.type(passwordInput, TEST_DATA.invalidCredentials.password);
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(TEST_DATA.errorMessages.invalidPassword)).toBeInTheDocument();
      });
    });

    it('should handle password visibility toggle', async () => {
      renderLoginForm();
      const passwordInput = screen.getByLabelText(/password/i);
      const visibilityToggle = screen.getByRole('button', { name: /show password/i });

      expect(passwordInput).toHaveAttribute('type', 'password');
      fireEvent.click(visibilityToggle);
      expect(passwordInput).toHaveAttribute('type', 'text');
      fireEvent.click(visibilityToggle);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      const onSuccess = jest.fn();
      const { mockLogin } = renderLoginForm({ onSuccess });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, TEST_DATA.validCredentials.email);
      await userEvent.type(passwordInput, TEST_DATA.validCredentials.password);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: TEST_DATA.validCredentials.email,
          password: TEST_DATA.validCredentials.password,
          rememberMe: false,
          organization: undefined,
        });
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should handle login failure', async () => {
      const onError = jest.fn();
      const { mockLogin } = renderLoginForm({ onError });
      mockLogin.mockRejectedValue(new Error(TEST_DATA.errorMessages.loginFailed));

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, TEST_DATA.validCredentials.email);
      await userEvent.type(passwordInput, TEST_DATA.validCredentials.password);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(TEST_DATA.errorMessages.loginFailed);
        expect(screen.getByRole('alert')).toHaveTextContent(TEST_DATA.errorMessages.loginFailed);
      });
    });

    it('should handle rate limiting', async () => {
      const onError = jest.fn();
      const { mockLogin } = renderLoginForm({ onError });
      mockLogin.mockRejectedValue(new Error(TEST_DATA.errorMessages.loginFailed));

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Attempt login multiple times
      for (let i = 0; i < 6; i++) {
        await userEvent.type(emailInput, TEST_DATA.validCredentials.email);
        await userEvent.type(passwordInput, TEST_DATA.validCredentials.password);
        fireEvent.click(submitButton);
      }

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/account is temporarily locked/i);
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('SSO Integration', () => {
    it('should render SSO button when organizationId is provided', () => {
      renderLoginForm({ organizationId: TEST_DATA.organizationId });
      expect(screen.getByRole('button', { name: /sign in with sso/i })).toBeInTheDocument();
    });

    it('should handle SSO login', async () => {
      const { mockLogin } = renderLoginForm({ organizationId: TEST_DATA.organizationId });
      const ssoButton = screen.getByRole('button', { name: /sign in with sso/i });

      fireEvent.click(ssoButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          organization: TEST_DATA.organizationId,
        });
      });
    });
  });

  describe('Loading States', () => {
    it('should disable form during authentication', async () => {
      mockUseAuth.mockReturnValue({
        ...mockUseAuth(),
        isLoading: true,
      });

      renderLoginForm();

      expect(screen.getByLabelText(/email address/i)).toBeDisabled();
      expect(screen.getByLabelText(/password/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
    });

    it('should show loading indicator during authentication', async () => {
      mockUseAuth.mockReturnValue({
        ...mockUseAuth(),
        isLoading: true,
      });

      renderLoginForm();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });
});