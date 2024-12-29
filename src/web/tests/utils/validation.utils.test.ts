import { describe, test, expect } from '@jest/globals'; // v29.0.0
import {
  validateRequired,
  validateEmail,
  validatePhone,
  validateNPI,
  validateICD10,
  validateDate
} from '../../src/utils/validation.utils';

describe('Required Field Validation', () => {
  test('should validate undefined values correctly', () => {
    const result = validateRequired(undefined);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('This field is required');
  });

  test('should validate null values correctly', () => {
    const result = validateRequired(null);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('This field is required');
  });

  test('should validate empty strings correctly', () => {
    const result = validateRequired('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('This field is required');
  });

  test('should validate whitespace strings correctly', () => {
    const result = validateRequired('   ');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate valid strings correctly', () => {
    const result = validateRequired('test value');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate empty arrays correctly', () => {
    const result = validateRequired([]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate populated arrays correctly', () => {
    const result = validateRequired([1, 2, 3]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate empty objects correctly', () => {
    const result = validateRequired({});
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate zero values correctly', () => {
    const result = validateRequired(0);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate boolean values correctly', () => {
    expect(validateRequired(true).isValid).toBe(true);
    expect(validateRequired(false).isValid).toBe(true);
  });
});

describe('Email Validation', () => {
  test('should validate undefined email correctly', () => {
    const result = validateEmail(undefined as unknown as string);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid email address');
  });

  test('should validate empty email correctly', () => {
    const result = validateEmail('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid email address');
  });

  test('should validate invalid email format correctly', () => {
    const result = validateEmail('invalid.email');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid email address');
  });

  test('should validate healthcare domain email correctly', () => {
    const result = validateEmail('doctor@hospital.org');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate email with special characters correctly', () => {
    const result = validateEmail('user.name+label@domain.com');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate email length restrictions correctly', () => {
    const longEmail = 'a'.repeat(246) + '@test.com'; // 256 chars
    const result = validateEmail(longEmail);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Email must not exceed 255 characters');
  });
});

describe('NPI Validation', () => {
  test('should validate undefined NPI correctly', () => {
    const result = validateNPI(undefined as unknown as string);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid 10-digit NPI number');
  });

  test('should validate empty NPI correctly', () => {
    const result = validateNPI('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid 10-digit NPI number');
  });

  test('should validate invalid length NPI correctly', () => {
    const result = validateNPI('123456789');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('NPI must be exactly 10 digits');
  });

  test('should validate invalid checksum NPI correctly', () => {
    const result = validateNPI('1234567890');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid NPI checksum');
  });

  test('should validate valid NPI correctly', () => {
    // Using a valid NPI number with correct checksum
    const result = validateNPI('1234567893');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate NPI with non-numeric characters correctly', () => {
    const result = validateNPI('12345A7890');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid 10-digit NPI number');
  });
});

describe('ICD-10 Code Validation', () => {
  test('should validate undefined ICD-10 code correctly', () => {
    const result = validateICD10(undefined as unknown as string);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid ICD-10 diagnosis code');
  });

  test('should validate empty ICD-10 code correctly', () => {
    const result = validateICD10('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid ICD-10 diagnosis code');
  });

  test('should validate invalid category ICD-10 code correctly', () => {
    const result = validateICD10('123.45');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid ICD-10 category');
  });

  test('should validate invalid subcategory ICD-10 code correctly', () => {
    const result = validateICD10('AXX.45');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid ICD-10 subcategory');
  });

  test('should validate valid ICD-10 code correctly', () => {
    const result = validateICD10('A01.1');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate ICD-10 code with extended classification correctly', () => {
    const result = validateICD10('A01.12');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('Date Validation', () => {
  test('should validate invalid date format correctly', () => {
    const result = validateDate('invalid-date');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid date format');
  });

  test('should validate date before minimum date correctly', () => {
    const minDate = new Date('2024-01-01');
    const result = validateDate('2023-12-31', minDate);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Date must be after 2024-01-01');
  });

  test('should validate date after maximum date correctly', () => {
    const maxDate = new Date('2024-12-31');
    const result = validateDate('2025-01-01', undefined, maxDate);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Date must be before 2024-12-31');
  });

  test('should validate valid date within range correctly', () => {
    const minDate = new Date('2024-01-01');
    const maxDate = new Date('2024-12-31');
    const result = validateDate('2024-06-15', minDate, maxDate);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('Phone Number Validation', () => {
  test('should validate undefined phone number correctly', () => {
    const result = validatePhone(undefined as unknown as string);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid phone number in international format');
  });

  test('should validate empty phone number correctly', () => {
    const result = validatePhone('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid phone number in international format');
  });

  test('should validate invalid format phone number correctly', () => {
    const result = validatePhone('123-456-7890');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid phone number in international format');
  });

  test('should validate valid international phone number correctly', () => {
    const result = validatePhone('+12345678901');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate phone number length correctly', () => {
    const result = validatePhone('+123456789012345678');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Phone number must not exceed 15 characters');
  });
});