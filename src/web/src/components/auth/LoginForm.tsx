/**
 * @fileoverview Secure and accessible login form component with OAuth 2.0 + OIDC authentication
 * @version 1.0.0
 * @package @mui/material ^5.x
 * @package react-hook-form ^7.x
 * @package yup ^1.x
 */

import React, { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Box,
  TextField,
  FormControlLabel,
  Checkbox,
  Typography,
  Alert,
  Divider,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import Button from '../common/Button';
import { theme } from '../../assets/styles/theme';

// Form validation schema
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required')
    .matches(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Invalid email format'
    ),
  password: yup
    .string()
    .required('Password is required')
    .min(12, 'Password must be at least 12 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  rememberMe: yup.boolean(),
});

// Props interface
interface LoginFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
  organizationId?: string;
}

// Form data interface
interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Enhanced login form component with comprehensive security features
 * and accessibility support
 */
export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  organizationId,
}) => {
  // Auth hook for handling authentication
  const { login, isLoading, error: authError } = useAuth();

  // Form state management
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);

  // Login attempt tracking for rate limiting
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

  // Handle form submission
  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      if (isLocked) {
        onError('Account is temporarily locked. Please try again later.');
        return;
      }

      try {
        await login({
          email: data.email,
          password: data.password,
          organization: organizationId,
          rememberMe: data.rememberMe,
        });

        // Reset form and attempts on success
        reset();
        setLoginAttempts(0);
        onSuccess();
      } catch (error) {
        // Handle failed login attempt
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          setIsLocked(true);
          setTimeout(() => {
            setIsLocked(false);
            setLoginAttempts(0);
          }, LOCKOUT_DURATION);
          onError('Too many failed attempts. Account locked for 30 minutes.');
        } else {
          onError((error as Error).message);
        }
      }
    },
    [login, loginAttempts, isLocked, onSuccess, onError, reset, organizationId]
  );

  // Toggle password visibility
  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      sx={{
        width: '100%',
        maxWidth: 400,
        p: theme.spacing(3),
      }}
    >
      <Typography
        component="h1"
        variant="h5"
        align="center"
        gutterBottom
        sx={{ mb: 3 }}
      >
        Sign In
      </Typography>

      {(authError || isLocked) && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          role="alert"
          aria-live="polite"
        >
          {isLocked
            ? 'Account is temporarily locked. Please try again later.'
            : authError}
        </Alert>
      )}

      <TextField
        {...register('email')}
        margin="normal"
        required
        fullWidth
        id="email"
        label="Email Address"
        autoComplete="email"
        autoFocus
        error={!!errors.email}
        helperText={errors.email?.message}
        disabled={isLoading || isLocked}
        InputProps={{
          'aria-label': 'Email Address',
          'aria-describedby': errors.email ? 'email-error' : undefined,
        }}
      />

      <TextField
        {...register('password')}
        margin="normal"
        required
        fullWidth
        label="Password"
        type={showPassword ? 'text' : 'password'}
        id="password"
        autoComplete="current-password"
        error={!!errors.password}
        helperText={errors.password?.message}
        disabled={isLoading || isLocked}
        InputProps={{
          'aria-label': 'Password',
          'aria-describedby': errors.password ? 'password-error' : undefined,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={handleTogglePassword}
                edge="end"
                size="large"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <FormControlLabel
        control={
          <Checkbox
            {...register('rememberMe')}
            color="primary"
            disabled={isLoading || isLocked}
          />
        }
        label="Remember me"
        sx={{ mt: 1 }}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        loading={isLoading}
        disabled={isLocked}
        sx={{ mt: 3, mb: 2 }}
        aria-label="Sign In"
      >
        Sign In
      </Button>

      {organizationId && (
        <>
          <Divider sx={{ my: 2 }}>
            <Typography variant="body2" color="text.secondary">
              OR
            </Typography>
          </Divider>

          <Button
            fullWidth
            variant="outlined"
            size="large"
            onClick={() => login({ organization: organizationId })}
            disabled={isLoading || isLocked}
            aria-label="Sign in with SSO"
          >
            Sign in with SSO
          </Button>
        </>
      )}
    </Box>
  );
};

export default LoginForm;