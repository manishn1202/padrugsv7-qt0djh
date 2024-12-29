/**
 * @file Authentication Controller
 * @version 1.0.0
 * @description Enterprise-grade authentication controller with OAuth 2.0, SAML, and MFA support
 * @requires express ^4.18.0
 * @requires http-errors ^2.0.0
 * @requires rate-limiter-flexible ^2.4.1
 */

import { Request, Response, NextFunction } from 'express';
import createHttpError from 'http-errors';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import { AuthService } from '../services/auth.service';
import { validateJWT } from '../middleware/jwt.middleware';
import { auth0Config } from '../config/auth0.config';

/**
 * Interface for login request body
 */
interface LoginRequest {
  email: string;
  password: string;
  deviceId?: string;
  mfaCode?: string;
}

/**
 * Interface for refresh token request
 */
interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Enhanced authentication controller implementing enterprise security features
 */
export class AuthController {
  private authService: AuthService;
  private rateLimiter: RateLimiterMemory;

  constructor() {
    this.authService = new AuthService();
    
    // Initialize rate limiter for login attempts
    this.rateLimiter = new RateLimiterMemory({
      points: auth0Config.rateLimit,
      duration: 60, // Per minute
      blockDuration: 300 // 5 minutes block duration
    });
  }

  /**
   * Handle user login with enhanced security features
   * @param req Express request
   * @param res Express response
   * @param next Next function
   */
  public login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, password, deviceId, mfaCode }: LoginRequest = req.body;

      // Validate request body
      if (!email || !password) {
        throw createHttpError(400, 'Email and password are required');
      }

      // Apply rate limiting
      await this.rateLimiter.consume(email);

      // Perform initial authentication
      const authResponse = await this.authService.authenticateUser(email, password);

      // Check if MFA is required
      if (auth0Config.mfaConfig.enabled && !mfaCode) {
        res.status(200).json({
          requiresMFA: true,
          sessionToken: authResponse.accessToken,
          mfaTypes: auth0Config.mfaConfig.authenticatorTypes
        });
        return;
      }

      // Validate MFA if provided
      if (mfaCode) {
        const mfaValidation = await this.authService.validateMFA(
          authResponse.user.id,
          mfaCode
        );

        if (!mfaValidation.isValid) {
          throw createHttpError(401, 'Invalid MFA code', {
            remainingAttempts: mfaValidation.remainingAttempts,
            lockoutTime: mfaValidation.lockoutTime
          });
        }
      }

      // Set secure response headers
      res.set({
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });

      // Return authentication response
      res.status(200).json({
        accessToken: authResponse.accessToken,
        idToken: authResponse.idToken,
        refreshToken: authResponse.refreshToken,
        expiresIn: authResponse.expiresIn,
        user: {
          id: authResponse.user.id,
          email: authResponse.user.email,
          role: authResponse.user.role,
          permissions: authResponse.user.permissions
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handle SAML authentication callback
   * @param req Express request
   * @param res Express response
   * @param next Next function
   */
  public samlCallback = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const samlResponse = req.body.SAMLResponse;
      if (!samlResponse) {
        throw createHttpError(400, 'SAML response is required');
      }

      const authResponse = await this.authService.authenticateSAML(samlResponse);

      res.status(200).json({
        accessToken: authResponse.accessToken,
        user: authResponse.user
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Refresh access token
   * @param req Express request
   * @param res Express response
   * @param next Next function
   */
  public refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;

      if (!refreshToken) {
        throw createHttpError(400, 'Refresh token is required');
      }

      const newTokens = await this.authService.refreshToken(refreshToken);

      res.status(200).json({
        accessToken: newTokens.accessToken,
        idToken: newTokens.idToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user profile with security context
   * @param req Express request
   * @param res Express response
   * @param next Next function
   */
  public getUserProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        throw createHttpError(401, 'No token provided');
      }

      const profile = await this.authService.getUserProfile(token);

      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handle user logout
   * @param req Express request
   * @param res Express response
   * @param next Next function
   */
  public logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        throw createHttpError(401, 'No token provided');
      }

      await this.authService.validateSecurityContext(token);

      // Clear secure cookies if used
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
      });

      res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;