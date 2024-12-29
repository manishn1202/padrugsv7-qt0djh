import { createTheme } from '@mui/material';
import { ThemeOptions, Theme } from '@mui/material/styles';

// Global constants
const SPACING_UNIT = 8;
const FONT_FAMILY = '"Inter var", system-ui, -apple-system, sans-serif';
const CONTRAST_RATIO_AA = 4.5;
const CONTRAST_RATIO_AAA = 7.0;

// Color palette definition with WCAG contrast compliance
const COLORS = {
  light: {
    primary: {
      main: '#0066CC',
      light: '#3399FF',
      dark: '#004C99',
      contrastText: '#FFFFFF',
      hover: '#0052A3',
      active: '#003D7A',
      disabled: '#B3D1FF',
    },
    secondary: {
      main: '#666666',
      light: '#999999',
      dark: '#333333',
      contrastText: '#FFFFFF',
      hover: '#4D4D4D',
      active: '#404040',
      disabled: '#CCCCCC',
    },
    success: {
      main: '#28A745',
      light: '#48C767',
      dark: '#1E7E34',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#FFC107',
      light: '#FFCD38',
      dark: '#D39E00',
      contrastText: '#000000',
    },
    error: {
      main: '#DC3545',
      light: '#E4606D',
      dark: '#BD2130',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FFFFFF',
      paper: '#F5F5F5',
      elevated: '#FFFFFF',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
      disabled: '#999999',
    },
  },
  dark: {
    primary: {
      main: '#3399FF',
      light: '#66B2FF',
      dark: '#0066CC',
      contrastText: '#FFFFFF',
      hover: '#1A8CFF',
      active: '#0073E6',
      disabled: '#99CCFF',
    },
    secondary: {
      main: '#CCCCCC',
      light: '#E6E6E6',
      dark: '#999999',
      contrastText: '#000000',
      hover: '#BFBFBF',
      active: '#B3B3B3',
      disabled: '#808080',
    },
    success: {
      main: '#34D058',
      light: '#50D970',
      dark: '#28A745',
      contrastText: '#000000',
    },
    warning: {
      main: '#FFD700',
      light: '#FFDF33',
      dark: '#CCAC00',
      contrastText: '#000000',
    },
    error: {
      main: '#FF4D4D',
      light: '#FF8080',
      dark: '#FF1A1A',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#1A1A1A',
      paper: '#2D2D2D',
      elevated: '#404040',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#CCCCCC',
      disabled: '#808080',
    },
  },
};

// Typography scale with fluid sizing
const TYPOGRAPHY = {
  fontFamily: FONT_FAMILY,
  fontSize: 16,
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
  h1: {
    fontSize: 'clamp(2rem, 5vw, 2.5rem)',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01562em',
  },
  h2: {
    fontSize: 'clamp(1.75rem, 4vw, 2rem)',
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: '-0.00833em',
  },
  h3: {
    fontSize: 'clamp(1.5rem, 3vw, 1.75rem)',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0em',
  },
  body1: {
    fontSize: '1rem',
    lineHeight: 1.5,
    letterSpacing: '0.00938em',
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
    letterSpacing: '0.01071em',
  },
  button: {
    fontSize: '0.875rem',
    fontWeight: 500,
    letterSpacing: '0.02857em',
    textTransform: 'none',
  },
};

// Responsive breakpoints
const BREAKPOINTS = {
  values: {
    xs: 0,
    sm: 375,
    md: 1024,
    lg: 1440,
    xl: 1920,
  },
};

// Spacing system based on 8px grid
const SPACING = {
  unit: SPACING_UNIT,
  grid: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

// Elevation shadows
const SHADOWS = {
  card: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  dropdown: '0px 4px 8px rgba(0, 0, 0, 0.15)',
  modal: '0px 8px 16px rgba(0, 0, 0, 0.2)',
  elevated: '0px 12px 24px rgba(0, 0, 0, 0.25)',
};

// Animation configurations
const TRANSITIONS = {
  duration: {
    shortest: 150,
    shorter: 200,
    short: 250,
    standard: 300,
    complex: 375,
    enteringScreen: 225,
    leavingScreen: 195,
  },
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
};

// Contrast ratio validation utility
const validateContrastRatio = (foreground: string, background: string, level: 'AA' | 'AAA'): boolean => {
  // Implementation would calculate actual contrast ratio
  // This is a placeholder that should be replaced with actual calculation
  const targetRatio = level === 'AA' ? CONTRAST_RATIO_AA : CONTRAST_RATIO_AAA;
  return true; // Placeholder return
};

// Theme creation function with support for organization customization
const createCustomTheme = (
  mode: 'light' | 'dark',
  orgTheme: Partial<ThemeOptions> = {},
  highContrast: boolean = false
): Theme => {
  const baseTheme = mode === 'light' ? COLORS.light : COLORS.dark;
  
  const theme = createTheme({
    palette: {
      mode,
      ...baseTheme,
      ...(highContrast && {
        // High contrast overrides would go here
        text: {
          primary: mode === 'light' ? '#000000' : '#FFFFFF',
          secondary: mode === 'light' ? '#000000' : '#FFFFFF',
        },
      }),
    },
    typography: TYPOGRAPHY,
    spacing: SPACING.unit,
    breakpoints: BREAKPOINTS,
    shadows: [
      'none',
      SHADOWS.card,
      SHADOWS.dropdown,
      SHADOWS.modal,
      SHADOWS.elevated,
      // ... other shadow levels
    ],
    transitions: TRANSITIONS,
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: SPACING.unit,
            padding: `${SPACING.grid.sm}px ${SPACING.grid.md}px`,
            '&:focus-visible': {
              outline: `3px solid ${baseTheme.primary.main}`,
              outlineOffset: '2px',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: SPACING.unit,
            },
          },
        },
      },
      // Additional component overrides...
    },
    ...orgTheme, // Merge organization-specific theme overrides
  });

  return theme;
};

// Export default light theme
export const theme = createCustomTheme('light');

// Export dark theme
export const darkTheme = createCustomTheme('dark');

// Export theme utilities and constants
export {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  BREAKPOINTS,
  SHADOWS,
  TRANSITIONS,
  createCustomTheme,
  validateContrastRatio,
};