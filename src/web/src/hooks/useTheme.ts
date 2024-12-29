// React hooks - version ^18.2.0
import { useState, useEffect, useCallback } from 'react';
// Material UI hooks - version ^5.0.0
import { useMediaQuery, useTheme as useMuiTheme } from '@mui/material';
// Lodash utilities - version ^4.17.21
import { debounce } from 'lodash';

// Internal imports
import { theme, darkTheme, createCustomTheme, validateContrastRatio } from '../assets/styles/theme';
import { setLocalStorage, getLocalStorage } from '../utils/storage.utils';
import { ThemeMode, ApiResponse } from '../types/common.types';

// Storage keys for theme preferences
const THEME_STORAGE_KEY = 'theme_mode';
const CONTRAST_STORAGE_KEY = 'contrast_mode';
const ORG_THEME_KEY = 'org_theme';

// Types for theme management
type ContrastMode = 'normal' | 'high';

interface OrgTheme {
  primary: string;
  secondary: string;
  accent: string;
}

interface ThemeHookOptions {
  defaultMode?: ThemeMode;
  orgTheme?: OrgTheme;
}

interface ThemeState {
  mode: ThemeMode;
  contrast: ContrastMode;
  orgTheme: OrgTheme | null;
}

/**
 * Custom hook for comprehensive theme management including system preferences,
 * high contrast mode, and organization-specific theming
 */
export function useTheme(options: ThemeHookOptions = {}) {
  // Initialize theme state
  const [themeState, setThemeState] = useState<ThemeState>({
    mode: options.defaultMode || 'light',
    contrast: 'normal',
    orgTheme: null
  });

  // Get system theme preference
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const muiTheme = useMuiTheme();

  // Load saved preferences on mount
  useEffect(() => {
    const loadThemePreferences = async () => {
      try {
        // Load theme mode preference
        const savedMode: ApiResponse<ThemeMode> = await getLocalStorage(THEME_STORAGE_KEY);
        const savedContrast: ApiResponse<ContrastMode> = await getLocalStorage(CONTRAST_STORAGE_KEY);
        const savedOrgTheme: ApiResponse<OrgTheme> = await getLocalStorage(ORG_THEME_KEY);

        setThemeState({
          mode: savedMode.success ? savedMode.data : (prefersDarkMode ? 'dark' : 'light'),
          contrast: savedContrast.success ? savedContrast.data : 'normal',
          orgTheme: savedOrgTheme.success ? savedOrgTheme.data : null
        });
      } catch (error) {
        console.error('Error loading theme preferences:', error);
      }
    };

    loadThemePreferences();
  }, [prefersDarkMode]);

  // Handle system theme changes
  useEffect(() => {
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (!themeState.mode) {
        setThemeState(prev => ({
          ...prev,
          mode: e.matches ? 'dark' : 'light'
        }));
      }
    };

    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      darkModeMediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [themeState.mode]);

  // Debounced theme persistence
  const persistThemePreferences = useCallback(
    debounce(async (state: ThemeState) => {
      await setLocalStorage(THEME_STORAGE_KEY, state.mode);
      await setLocalStorage(CONTRAST_STORAGE_KEY, state.contrast);
      if (state.orgTheme) {
        await setLocalStorage(ORG_THEME_KEY, state.orgTheme);
      }
    }, 500),
    []
  );

  // Theme toggle handler
  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const newState = {
        ...prev,
        mode: prev.mode === 'light' ? 'dark' : 'light'
      };
      persistThemePreferences(newState);
      return newState;
    });
  }, [persistThemePreferences]);

  // Contrast mode toggle handler
  const toggleContrast = useCallback(() => {
    setThemeState(prev => {
      const newState = {
        ...prev,
        contrast: prev.contrast === 'normal' ? 'high' : 'normal'
      };
      persistThemePreferences(newState);
      return newState;
    });
  }, [persistThemePreferences]);

  // Organization theme handler
  const applyOrgTheme = useCallback((orgTheme: OrgTheme) => {
    // Validate contrast ratios for accessibility
    const isValidContrast = validateContrastRatio(
      orgTheme.primary,
      muiTheme.palette.background.default,
      'AA'
    );

    if (!isValidContrast) {
      console.warn('Organization theme colors do not meet WCAG contrast requirements');
      return;
    }

    setThemeState(prev => {
      const newState = {
        ...prev,
        orgTheme
      };
      persistThemePreferences(newState);
      return newState;
    });
  }, [muiTheme.palette.background.default, persistThemePreferences]);

  // Create current theme based on state
  const currentTheme = createCustomTheme(
    themeState.mode,
    themeState.orgTheme || {},
    themeState.contrast === 'high'
  );

  // Emit theme change event for other components
  useEffect(() => {
    const themeChangeEvent = new CustomEvent('themeChange', {
      detail: {
        mode: themeState.mode,
        contrast: themeState.contrast,
        orgTheme: themeState.orgTheme
      }
    });
    window.dispatchEvent(themeChangeEvent);
  }, [themeState]);

  return {
    mode: themeState.mode,
    isDarkMode: themeState.mode === 'dark',
    isHighContrast: themeState.contrast === 'high',
    theme: currentTheme,
    toggleTheme,
    toggleContrast,
    applyOrgTheme
  };
}

// Type exports for consumers
export type { ThemeMode, ContrastMode, OrgTheme };