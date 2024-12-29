/**
 * @file User Model
 * @version 1.0.0
 * @description HIPAA-compliant user model with Auth0 integration and RBAC support
 * @requires mongoose ^7.0.0
 * @requires bcryptjs ^2.4.3
 */

import mongoose, { Schema, Model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { auth0Config } from '../config/auth0.config';

// Constants for security configuration
const SALT_ROUNDS = 12;
const PASSWORD_HISTORY_LIMIT = 5;
const ROLES = ['HEALTHCARE_PROVIDER', 'INSURANCE_REVIEWER', 'ADMIN_STAFF', 'SYSTEM_ADMIN'] as const;

/**
 * Interface defining HIPAA-compliant user entity structure
 */
export interface IUser extends Document {
  auth0Id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: typeof ROLES[number];
  permissions: string[];
  organizationId: string;
  isActive: boolean;
  passwordHash: string;
  passwordHistory: string[];
  lastLoginAt: Date;
  lastPasswordChangeAt: Date;
  createdAt: Date;
  updatedAt: Date;
  auditLog: Array<{
    action: string;
    timestamp: Date;
    details: Record<string, any>;
    ipAddress: string;
    userAgent: string;
  }>;
}

/**
 * Interface defining user instance methods
 */
export interface IUserMethods {
  validatePassword(password: string): Promise<boolean>;
  hasPermission(permission: string): boolean;
  addAuditLog(action: string, details: Record<string, any>): Promise<void>;
}

/**
 * Interface for the User Model with static methods
 */
interface IUserModel extends Model<IUser, {}, IUserMethods> {
  findByAuth0Id(auth0Id: string): Promise<IUser | null>;
  findByEmail(email: string): Promise<IUser | null>;
}

/**
 * Mongoose schema for HIPAA-compliant user model
 */
const UserSchema = new Schema<IUser, IUserModel, IUserMethods>({
  auth0Id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true,
    validate: {
      validator: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      message: 'Invalid email format',
    },
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    required: true,
    enum: ROLES,
  },
  permissions: [{
    type: String,
    required: true,
  }],
  organizationId: {
    type: String,
    required: true,
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  passwordHistory: [{
    type: String,
    required: true,
  }],
  lastLoginAt: {
    type: Date,
    default: null,
  },
  lastPasswordChangeAt: {
    type: Date,
    default: Date.now,
  },
  auditLog: [{
    action: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: {
      type: Schema.Types.Mixed,
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
  }],
}, {
  timestamps: true,
  collection: 'users',
  toJSON: {
    transform: (_, ret) => {
      delete ret.passwordHash;
      delete ret.passwordHistory;
      return ret;
    },
  },
});

/**
 * Instance method to validate password
 */
UserSchema.method('validatePassword', async function(password: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, this.passwordHash);
  } catch (error) {
    throw new Error('Password validation failed');
  }
});

/**
 * Instance method to check permissions
 */
UserSchema.method('hasPermission', function(permission: string): boolean {
  return this.permissions.includes(permission);
});

/**
 * Instance method to add audit log entry
 */
UserSchema.method('addAuditLog', async function(
  action: string,
  details: Record<string, any>,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  this.auditLog.push({
    action,
    timestamp: new Date(),
    details,
    ipAddress,
    userAgent,
  });
  await this.save();
});

/**
 * Static method to find user by Auth0 ID
 */
UserSchema.static('findByAuth0Id', async function(auth0Id: string): Promise<IUser | null> {
  if (!auth0Id.startsWith(`auth0|`)) {
    throw new Error('Invalid Auth0 ID format');
  }
  return this.findOne({ auth0Id, isActive: true });
});

/**
 * Static method to find user by email
 */
UserSchema.static('findByEmail', async function(email: string): Promise<IUser | null> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email format');
  }
  return this.findOne({ email: email.toLowerCase(), isActive: true });
});

/**
 * Pre-save middleware for password hashing
 */
UserSchema.pre('save', async function(next) {
  if (this.isModified('passwordHash')) {
    // Hash the new password
    const hash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
    
    // Add current password to history
    this.passwordHistory.unshift(hash);
    
    // Keep only the last PASSWORD_HISTORY_LIMIT entries
    this.passwordHistory = this.passwordHistory.slice(0, PASSWORD_HISTORY_LIMIT);
    
    // Update password hash and change date
    this.passwordHash = hash;
    this.lastPasswordChangeAt = new Date();
  }
  next();
});

/**
 * Index configuration for performance and security
 */
UserSchema.index({ email: 1, organizationId: 1 }, { unique: true });
UserSchema.index({ auth0Id: 1, isActive: 1 });
UserSchema.index({ 'auditLog.timestamp': -1 });

/**
 * Export the User model with HIPAA-compliant operations
 */
export const UserModel = mongoose.model<IUser, IUserModel>('User', UserSchema);

/**
 * Validate user data according to HIPAA and security requirements
 */
export async function validateUserData(userData: Partial<IUser>): Promise<boolean> {
  try {
    // Required fields validation
    const requiredFields = ['email', 'firstName', 'lastName', 'role', 'organizationId'];
    for (const field of requiredFields) {
      if (!userData[field as keyof IUser]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Role validation
    if (!ROLES.includes(userData.role as typeof ROLES[number])) {
      throw new Error('Invalid role specified');
    }

    // Email uniqueness check
    const existingUser = await UserModel.findByEmail(userData.email!);
    if (existingUser && existingUser._id.toString() !== userData._id?.toString()) {
      throw new Error('Email already in use');
    }

    // Auth0 ID format validation if provided
    if (userData.auth0Id && !userData.auth0Id.startsWith('auth0|')) {
      throw new Error('Invalid Auth0 ID format');
    }

    return true;
  } catch (error) {
    throw error;
  }
}

export default UserModel;