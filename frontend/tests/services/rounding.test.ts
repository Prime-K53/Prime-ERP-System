import { describe, it, expect } from 'vitest';
import { roundCurrency, roundQuantity, roundUnitCost, roundPercentage } from '../../utils/rounding';

describe('rounding utilities', () => {
  describe('roundCurrency', () => {
    it('rounds to 2 decimal places', () => {
      expect(roundCurrency(10.456)).toBe(10.46);
      expect(roundCurrency(10.454)).toBe(10.45);
    });

    it('handles whole numbers', () => {
      expect(roundCurrency(10)).toBe(10);
    });

    it('handles zero', () => {
      expect(roundCurrency(0)).toBe(0);
    });

    it('handles negative values', () => {
      expect(roundCurrency(-5.678)).toBe(-5.68);
    });
  });

  describe('roundQuantity', () => {
    it('rounds to 0 decimal places by default', () => {
      expect(roundQuantity(10.7)).toBe(11);
      expect(roundQuantity(10.4)).toBe(10);
    });
  });

  describe('roundUnitCost', () => {
    it('rounds to 4 decimal places', () => {
      expect(roundUnitCost(1.23456)).toBe(1.2346);
    });
  });

  describe('roundPercentage', () => {
    it('rounds to 1 decimal place', () => {
      expect(roundPercentage(12.345)).toBe(12.3);
      expect(roundPercentage(12.35)).toBe(12.4);
    });
  });
});
