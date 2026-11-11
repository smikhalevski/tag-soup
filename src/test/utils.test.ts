import { describe, expect, test } from 'vitest';
import { getCaseInsensitiveHashCode, getCaseSensitiveHashCode } from '../main/utils.ts';

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
