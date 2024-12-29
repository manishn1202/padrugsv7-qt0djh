import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import Button from '../../src/components/common/Button';
import { theme, darkTheme, createCustomTheme } from '../../src/assets/styles/theme';

// Helper function to render components with theme context
const renderWithTheme = (ui: React.ReactNode, customTheme = theme) => {
  return render(
    <ThemeProvider theme={customTheme}>
      {ui}
    </ThemeProvider>
  );
};

// Common test setup
const setupTest = (props = {}) => {
  const user = userEvent.setup();
  const mockOnClick = jest.fn();
  const mockOnFocus = jest.fn();
  
  const utils = renderWithTheme(
    <Button 
      onClick={mockOnClick}
      onFocus={mockOnFocus}
      {...props}
    >
      Test Button
    </Button>
  );

  const button = screen.getByRole('button');
  return { ...utils, button, mockOnClick, mockOnFocus, user };
};

// Mock window.matchMedia for theme testing
beforeAll(() => {
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
});

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      const { button } = setupTest();
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('data-testid', 'button-unnamed');
      expect(button).toHaveClass('MuiButton-contained');
    });

    it('renders with custom text content', () => {
      const { button } = setupTest({ children: 'Custom Text' });
      expect(button).toHaveTextContent('Custom Text');
    });

    it('renders with start icon', () => {
      const startIcon = <span data-testid="start-icon">→</span>;
      const { button } = setupTest({ startIcon });
      expect(within(button).getByTestId('start-icon')).toBeInTheDocument();
    });

    it('renders with custom class name', () => {
      const { button } = setupTest({ className: 'custom-class' });
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Variants', () => {
    it('renders contained variant with correct styles', () => {
      const { button } = setupTest({ variant: 'contained' });
      expect(button).toHaveClass('MuiButton-contained');
      expect(button).toHaveStyle({
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
      });
    });

    it('renders outlined variant with correct styles', () => {
      const { button } = setupTest({ variant: 'outlined' });
      expect(button).toHaveClass('MuiButton-outlined');
      expect(button).toHaveStyle({
        borderColor: theme.palette.primary.main,
      });
    });

    it('renders text variant with correct styles', () => {
      const { button } = setupTest({ variant: 'text' });
      expect(button).toHaveClass('MuiButton-text');
    });
  });

  describe('Sizes', () => {
    it('renders small size with correct dimensions', () => {
      const { button } = setupTest({ size: 'small' });
      expect(button).toHaveClass('MuiButton-sizeSmall');
      expect(button).toHaveStyle({ minHeight: '32px' });
    });

    it('renders medium size with correct dimensions', () => {
      const { button } = setupTest({ size: 'medium' });
      expect(button).toHaveClass('MuiButton-sizeMedium');
      expect(button).toHaveStyle({ minHeight: '40px' });
    });

    it('renders large size with correct dimensions', () => {
      const { button } = setupTest({ size: 'large' });
      expect(button).toHaveClass('MuiButton-sizeLarge');
      expect(button).toHaveStyle({ minHeight: '48px' });
    });
  });

  describe('States', () => {
    it('shows loading spinner when loading', () => {
      const { button } = setupTest({ loading: true });
      expect(within(button).getByRole('progressbar')).toBeInTheDocument();
    });

    it('disables button when loading', () => {
      const { button, mockOnClick } = setupTest({ loading: true });
      fireEvent.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('applies disabled styles when disabled', () => {
      const { button } = setupTest({ disabled: true });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('Mui-disabled');
    });

    it('applies hover styles on mouse over', async () => {
      const { button, user } = setupTest();
      await user.hover(button);
      expect(button).toHaveStyle({
        backgroundColor: theme.palette.primary.hover,
      });
    });
  });

  describe('Interaction', () => {
    it('calls onClick when clicked', async () => {
      const { button, mockOnClick, user } = setupTest();
      await user.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('prevents click when disabled', async () => {
      const { button, mockOnClick, user } = setupTest({ disabled: true });
      await user.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('handles keyboard enter press', async () => {
      const { button, mockOnClick, user } = setupTest();
      button.focus();
      await user.keyboard('{Enter}');
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has correct role attribute', () => {
      const { button } = setupTest();
      expect(button).toHaveAttribute('role', 'button');
    });

    it('has correct aria-disabled state', () => {
      const { button } = setupTest({ disabled: true });
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('maintains focus outline visibility', async () => {
      const { button, user } = setupTest();
      await user.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveStyle({
        outline: `2px solid ${theme.palette.primary.main}`,
      });
    });

    it('provides appropriate screen reader text', () => {
      const { button } = setupTest({ 
        ariaLabel: 'Submit form',
        loading: true 
      });
      expect(button).toHaveAttribute('aria-label', 'Submit form');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Theming', () => {
    it('applies correct light theme colors', () => {
      const { button } = setupTest();
      expect(button).toHaveStyle({
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
      });
    });

    it('applies correct dark theme colors', () => {
      const { button } = renderWithTheme(
        <Button>Dark Theme Button</Button>,
        darkTheme
      ).getByRole('button');

      expect(button).toHaveStyle({
        backgroundColor: darkTheme.palette.primary.main,
        color: darkTheme.palette.primary.contrastText,
      });
    });

    it('supports high contrast mode', () => {
      const highContrastTheme = createCustomTheme('light', {}, true);
      const { button } = renderWithTheme(
        <Button>High Contrast Button</Button>,
        highContrastTheme
      ).getByRole('button');

      expect(button).toHaveStyle({
        '@media (forced-colors: active)': {
          outline: '2px solid ButtonText',
        },
      });
    });
  });
});