import { describe, expect, test } from 'vitest';
import { getCaseInsensitiveHashCode, getCaseSensitiveHashCode, toASCIILowerCase } from '../main/utils.ts';

describe('toASCIILowerCase', () => {
  test('converts only ASCII letters to lower case', () => {
    expect(toASCIILowerCase('AAAbbbФФФ')).toBe('aaabbbФФФ');
  });
});

describe('getCaseInsensitiveHashCode', () => {
  test('returns a non-negative 30-bit integer', () => {
    const hashCode = getCaseInsensitiveHashCode('aaabbbccc', 0, 9);

    expect(hashCode).toBeGreaterThanOrEqual(0);
    expect(hashCode).toBeLessThan(2 ** 30);
  });
});

describe('getCaseSensitiveHashCode', () => {
  test('returns a non-negative 30-bit integer', () => {
    const hashCode = getCaseSensitiveHashCode('aaabbbccc', 0, 9);

    expect(hashCode).toBeGreaterThanOrEqual(0);
    expect(hashCode).toBeLessThan(2 ** 30);
  });
});
