/**
 * @fileoverview Enhanced settings page component providing comprehensive user preferences
 * and configuration options with full accessibility support and organization-specific theming.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
  Stack,
  Alert,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import {
  DarkMode,
  Notifications,
  Language,
  Contrast,
  Business,
} from '@mui/icons-material';

// Internal imports
import MainLayout from '../layouts/MainLayout';
import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { useAnalytics } from '../hooks/useAnalytics';

// Types
interface SettingsProps {
  className?: string;
}

interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  sms: boolean;
}

interface LanguagePreference {
  language: string;
  isRTL: boolean;
}

/**
 * Enhanced settings page component providing comprehensive user preferences
 * and configuration options with full accessibility support.
 */
const Settings: React.FC<SettingsProps> = ({ className }) => {
  // Hooks
  const { user, userPreferences } = useAuth();
  const { 
    mode, 
    isDarkMode, 
    isHighContrast, 
    toggleTheme, 
    toggleContrast, 
    applyOrgTheme 
  } = useTheme();
  const analytics = useAnalytics();

  // Local state
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email: true,
    inApp: true,
    sms: false,
  });
  const [language, setLanguage] = useState<LanguagePreference>({
    language: 'en-US',
    isRTL: false,
  });
  const [orgTheme, setOrgTheme] = useState({
    primary: '#0066CC',
    secondary: '#666666',
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Load saved preferences
  useEffect(() => {
    if (userPreferences) {
      setNotifications(userPreferences.notifications);
      setLanguage(userPreferences.language);
      setOrgTheme(userPreferences.orgTheme);
    }
  }, [userPreferences]);

  /**
   * Handles theme toggle with analytics tracking
   */
  const handleThemeToggle = useCallback(() => {
    toggleTheme();
    analytics.trackNavigation({
      type: 'settings',
      action: 'toggle_theme',
      value: !isDarkMode ? 'dark' : 'light',
    });
  }, [toggleTheme, isDarkMode, analytics]);

  /**
   * Handles contrast mode toggle with analytics tracking
   */
  const handleContrastToggle = useCallback(() => {
    toggleContrast();
    analytics.trackNavigation({
      type: 'settings',
      action: 'toggle_contrast',
      value: !isHighContrast ? 'high' : 'normal',
    });
  }, [toggleContrast, isHighContrast, analytics]);

  /**
   * Handles notification preference changes
   */
  const handleNotificationChange = useCallback((type: keyof NotificationPreferences) => {
    setNotifications(prev => {
      const updated = { ...prev, [type]: !prev[type] };
      analytics.trackNavigation({
        type: 'settings',
        action: 'update_notifications',
        value: JSON.stringify(updated),
      });
      return updated;
    });
  }, [analytics]);

  /**
   * Handles language preference changes
   */
  const handleLanguageChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = event.target.value;
    setLanguage(prev => ({
      ...prev,
      language: newLanguage,
      isRTL: ['ar', 'he'].includes(newLanguage.split('-')[0]),
    }));
    analytics.trackNavigation({
      type: 'settings',
      action: 'change_language',
      value: newLanguage,
    });
  }, [analytics]);

  /**
   * Handles organization theme changes
   */
  const handleOrgThemeChange = useCallback((color: string, type: 'primary' | 'secondary') => {
    setOrgTheme(prev => {
      const updated = { ...prev, [type]: color };
      applyOrgTheme(updated);
      analytics.trackNavigation({
        type: 'settings',
        action: 'update_org_theme',
        value: JSON.stringify(updated),
      });
      return updated;
    });
  }, [applyOrgTheme, analytics]);

  return (
    <MainLayout>
      <ErrorBoundary>
        <PageHeader
          title="Settings"
          subtitle="Manage your preferences and configurations"
          analyticsData={{
            pageId: 'settings',
            section: 'user_preferences',
          }}
        />

        <Box sx={{ p: 3 }}>
          <Stack spacing={3}>
            {/* Theme Settings */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Display Settings
                </Typography>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isDarkMode}
                        onChange={handleThemeToggle}
                        aria-label="Toggle dark mode"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <DarkMode />
                        <Typography>Dark Mode</Typography>
                      </Stack>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isHighContrast}
                        onChange={handleContrastToggle}
                        aria-label="Toggle high contrast mode"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Contrast />
                        <Typography>High Contrast Mode</Typography>
                      </Stack>
                    }
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Notification Preferences
                </Typography>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.email}
                        onChange={() => handleNotificationChange('email')}
                        aria-label="Toggle email notifications"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Notifications />
                        <Typography>Email Notifications</Typography>
                      </Stack>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.inApp}
                        onChange={() => handleNotificationChange('inApp')}
                        aria-label="Toggle in-app notifications"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Notifications />
                        <Typography>In-App Notifications</Typography>
                      </Stack>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.sms}
                        onChange={() => handleNotificationChange('sms')}
                        aria-label="Toggle SMS notifications"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Notifications />
                        <Typography>SMS Notifications</Typography>
                      </Stack>
                    }
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Language Settings */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Language & Region
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Language />
                    <Select
                      value={language.language}
                      onChange={handleLanguageChange}
                      aria-label="Select language"
                      sx={{ minWidth: 200 }}
                    >
                      <MenuItem value="en-US">English (US)</MenuItem>
                      <MenuItem value="es">Español</MenuItem>
                    </Select>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Organization Theme Settings (Admin Only) */}
            {user?.role === 'SYSTEM_ADMIN' && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Organization Theme
                  </Typography>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business />
                      <TextField
                        label="Primary Color"
                        type="color"
                        value={orgTheme.primary}
                        onChange={(e) => handleOrgThemeChange(e.target.value, 'primary')}
                        sx={{ width: 200 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business />
                      <TextField
                        label="Secondary Color"
                        type="color"
                        value={orgTheme.secondary}
                        onChange={(e) => handleOrgThemeChange(e.target.value, 'secondary')}
                        sx={{ width: 200 }}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Status Messages */}
            {saveStatus === 'success' && (
              <Alert severity="success">Settings saved successfully</Alert>
            )}
            {saveStatus === 'error' && (
              <Alert severity="error">Failed to save settings. Please try again.</Alert>
            )}
          </Stack>
        </Box>
      </ErrorBoundary>
    </MainLayout>
  );
};

// Display name for debugging
Settings.displayName = 'Settings';

export default Settings;