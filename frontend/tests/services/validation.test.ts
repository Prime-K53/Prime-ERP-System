import { describe, it, expect } from 'vitest';
import { validateRequired, validatePositiveNumber, validateEmail, chain } from '../../utils/validation';

describe('validation utilities', () => {
  describe('validateRequired', () => {
    it('passes for non-empty values', () => {
      const result = validateRequired('hello', 'field');
      expect(result.valid).toBe(true);
    });

    it('fails for empty values', () => {
      expect(validateRequired('', 'field').valid).toBe(false);
      expect(validateRequired(null, 'field').valid).toBe(false);
      expect(validateRequired(undefined, 'field').valid).toBe(false);
    });
  });

  describe('validatePositiveNumber', () => {
    it('passes for positive numbers', () => {
      expect(validatePositiveNumber(10, 'amount').valid).toBe(true);
    });

    it('fails for zero and negatives', () => {
      expect(validatePositiveNumber(0, 'amount').valid).toBe(false);
      expect(validatePositiveNumber(-5, 'amount').valid).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('passes for valid emails', () => {
      expect(validateEmail('test@example.com').valid).toBe(true);
    });

    it('fails for invalid emails', () => {
      expect(validateEmail('not-an-email').valid).toBe(false);
    });
  });

  describe('chain', () => {
    it('returns first error', () => {
      const validators = [
        () => validateRequired('', 'name'),
        () => validatePositiveNumber(10, 'age')
      ];
      const result = chain(validators);
      expect(result.valid).toBe(false);
      expect(result.errors?.name).toBeDefined();
    });

    it('passes when all validators pass', () => {
      const validators = [
        () => validateRequired('John', 'name'),
        () => validatePositiveNumber(25, 'age')
      ];
      const result = chain(validators);
      expect(result.valid).toBe(true);
    });
  });
});
