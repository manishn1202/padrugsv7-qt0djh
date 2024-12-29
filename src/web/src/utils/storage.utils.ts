// crypto-js version ^4.1.1
import AES from 'crypto-js/aes';
import encUtf8 from 'crypto-js/enc-utf8';
import { ApiResponse, ErrorResponse } from '../types/common.types';

// Constants for storage configuration
const STORAGE_ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY || 'default-dev-key';
const SENSITIVE_DATA_KEYS = ['auth_token', 'user_data', 'medical_info'];
const STORAGE_VERSION = '1.0';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

// Interface for storage metadata
interface StorageMetadata {
  version: string;
  timestamp: string;
  encrypted: boolean;
}

// Interface for storage options
interface StorageOptions {
  forceEncryption?: boolean;
  skipSizeValidation?: boolean;
}

/**
 * Stores data in localStorage with encryption for sensitive data
 * @param key Storage key
 * @param value Data to store
 * @param options Storage options
 * @returns Promise<ApiResponse<void>>
 */
export async function setLocalStorage<T>(
  key: string,
  value: T,
  options: StorageOptions = {}
): Promise<ApiResponse<void>> {
  try {
    // Validate storage availability
    const storageValidation = await validateStorage();
    if (!storageValidation.success) {
      return {
        success: false,
        data: null,
        error: {
          code: 'STORAGE_UNAVAILABLE',
          message: 'Local storage is not available',
          details: {},
          timestamp: new Date().toISOString()
        }
      };
    }

    // Prepare storage data
    const isSensitive = SENSITIVE_DATA_KEYS.includes(key) || options.forceEncryption;
    const metadata: StorageMetadata = {
      version: STORAGE_VERSION,
      timestamp: new Date().toISOString(),
      encrypted: isSensitive
    };

    let storageValue = value;
    
    // Encrypt sensitive data
    if (isSensitive) {
      const stringValue = JSON.stringify(value);
      storageValue = AES.encrypt(stringValue, STORAGE_ENCRYPTION_KEY).toString();
    }

    // Prepare final storage object
    const storageObject = {
      data: storageValue,
      metadata
    };

    // Validate storage size if required
    if (!options.skipSizeValidation) {
      const storageSize = new Blob([JSON.stringify(storageObject)]).size;
      if (storageSize > MAX_STORAGE_SIZE) {
        return {
          success: false,
          data: null,
          error: {
            code: 'STORAGE_QUOTA_EXCEEDED',
            message: 'Storage quota would be exceeded',
            details: { requiredSize: storageSize, maxSize: MAX_STORAGE_SIZE },
            timestamp: new Date().toISOString()
          }
        };
      }
    }

    // Store data
    localStorage.setItem(key, JSON.stringify(storageObject));

    return {
      success: true,
      data: null,
      error: null,
      timestamp: new Date().toISOString(),
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'STORAGE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown storage error',
        details: { error },
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Retrieves and decrypts data from localStorage
 * @param key Storage key
 * @returns Promise<ApiResponse<T>>
 */
export async function getLocalStorage<T>(key: string): Promise<ApiResponse<T>> {
  try {
    // Validate storage availability
    const storageValidation = await validateStorage();
    if (!storageValidation.success) {
      return {
        success: false,
        data: null,
        error: storageValidation.error
      };
    }

    // Retrieve stored data
    const storedItem = localStorage.getItem(key);
    if (!storedItem) {
      return {
        success: false,
        data: null,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: `No data found for key: ${key}`,
          details: {},
          timestamp: new Date().toISOString()
        }
      };
    }

    // Parse stored object
    const storageObject = JSON.parse(storedItem);
    const { data, metadata } = storageObject;

    // Validate storage version
    if (metadata.version !== STORAGE_VERSION) {
      return {
        success: false,
        data: null,
        error: {
          code: 'VERSION_MISMATCH',
          message: 'Storage version mismatch',
          details: { current: STORAGE_VERSION, stored: metadata.version },
          timestamp: new Date().toISOString()
        }
      };
    }

    // Decrypt if necessary
    let parsedData: T;
    if (metadata.encrypted) {
      const decrypted = AES.decrypt(data, STORAGE_ENCRYPTION_KEY).toString(encUtf8);
      parsedData = JSON.parse(decrypted);
    } else {
      parsedData = data;
    }

    return {
      success: true,
      data: parsedData,
      error: null,
      timestamp: new Date().toISOString(),
      metadata: metadata
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'RETRIEVAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown retrieval error',
        details: { error },
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Removes item from localStorage
 * @param key Storage key
 * @returns Promise<ApiResponse<void>>
 */
export async function removeLocalStorage(key: string): Promise<ApiResponse<void>> {
  try {
    // Validate storage availability
    const storageValidation = await validateStorage();
    if (!storageValidation.success) {
      return {
        success: false,
        data: null,
        error: storageValidation.error
      };
    }

    localStorage.removeItem(key);

    return {
      success: true,
      data: null,
      error: null,
      timestamp: new Date().toISOString(),
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'REMOVAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown removal error',
        details: { error },
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Clears all items from localStorage
 * @returns Promise<ApiResponse<void>>
 */
export async function clearLocalStorage(): Promise<ApiResponse<void>> {
  try {
    // Validate storage availability
    const storageValidation = await validateStorage();
    if (!storageValidation.success) {
      return {
        success: false,
        data: null,
        error: storageValidation.error
      };
    }

    localStorage.clear();

    return {
      success: true,
      data: null,
      error: null,
      timestamp: new Date().toISOString(),
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'CLEAR_ERROR',
        message: error instanceof Error ? error.message : 'Unknown clear error',
        details: { error },
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Validates storage availability and quota
 * @param requiredSize Optional size requirement in bytes
 * @returns Promise<ApiResponse<boolean>>
 */
export async function validateStorage(requiredSize?: number): Promise<ApiResponse<boolean>> {
  try {
    // Check if localStorage is available
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available');
    }

    // Test storage functionality
    const testKey = `__storage_test_${Math.random()}`;
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);

    // Calculate current storage usage
    let currentSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        currentSize += new Blob([localStorage.getItem(key) || '']).size;
      }
    }

    // Validate against size limits
    if (requiredSize && (currentSize + requiredSize > MAX_STORAGE_SIZE)) {
      return {
        success: false,
        data: false,
        error: {
          code: 'INSUFFICIENT_SPACE',
          message: 'Insufficient storage space',
          details: {
            currentSize,
            requiredSize,
            maxSize: MAX_STORAGE_SIZE
          },
          timestamp: new Date().toISOString()
        }
      };
    }

    return {
      success: true,
      data: true,
      error: null,
      timestamp: new Date().toISOString(),
      metadata: { currentSize, maxSize: MAX_STORAGE_SIZE }
    };
  } catch (error) {
    return {
      success: false,
      data: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        details: { error },
        timestamp: new Date().toISOString()
      }
    };
  }
}