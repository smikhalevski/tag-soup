import { describe, expect, test } from 'vitest';
import {
  assignAttribute,
  getCaseInsensitiveHashCode,
  getCaseSensitiveHashCode,
  toLowerCase,
  toLowerCaseCharCode,
} from '../main/utils.ts';

describe('toLowerCaseCharCode', () => {
  test('returns the lower case char code of an ASCII letter', () => {
    expect(toLowerCaseCharCode(/* A */ 65)).toBe(/* a */ 97);
    expect(toLowerCaseCharCode(/* Z */ 90)).toBe(/* z */ 122);
  });

  test('returns any other char code as is', () => {
    expect(toLowerCaseCharCode(/* @ */ 64)).toBe(64);
    expect(toLowerCaseCharCode(/* [ */ 91)).toBe(91);
    expect(toLowerCaseCharCode(/* a */ 97)).toBe(97);
    expect(toLowerCaseCharCode(/* z */ 122)).toBe(122);
    expect(toLowerCaseCharCode(/* Ä */ 196)).toBe(196);
    expect(toLowerCaseCharCode(-1)).toBe(-1);
  });
});

describe('toLowerCase', () => {
  test('converts ASCII letters to lower case', () => {
    expect(toLowerCase('AZ')).toBe('az');
    expect(toLowerCase('aBcZ')).toBe('abcz');
    expect(toLowerCase('xyZ')).toBe('xyz');
  });

  test('returns other chars as is', () => {
    expect(toLowerCase('')).toBe('');
    expect(toLowerCase('abc')).toBe('abc');
    expect(toLowerCase('@[`{')).toBe('@[`{');
    expect(toLowerCase('ÄÖФ')).toBe('ÄÖФ');
  });
});

describe('getCaseInsensitiveHashCode', () => {
  test('returns the djb2 hash code of a substring', () => {
    expect(getCaseInsensitiveHashCode('', 0, 0)).toBe(5381);
    expect(getCaseInsensitiveHashCode('a', 0, 1)).toBe(5381 * 33 + 97);
    expect(getCaseInsensitiveHashCode('xxaaaxx', 2, 5)).toBe(getCaseInsensitiveHashCode('aaa', 0, 3));
  });

  test('ignores the case of ASCII letters', () => {
    expect(getCaseInsensitiveHashCode('AZ', 0, 2)).toBe(getCaseInsensitiveHashCode('az', 0, 2));
    expect(getCaseInsensitiveHashCode('Ä', 0, 1)).not.toBe(getCaseInsensitiveHashCode('ä', 0, 1));
  });

  test('returns a non-negative 30-bit integer', () => {
    // Before the cut to 30 bits, the hash code of aaabbbccc has bit 31 set, of aaaa bit 30, and of aaaaaa both
    for (const name of ['aaabbbccc', 'aaaa', 'aaaaaa']) {
      const hashCode = getCaseInsensitiveHashCode(name, 0, name.length);

      expect(hashCode).toBeGreaterThanOrEqual(0);
      expect(hashCode).toBeLessThan(2 ** 30);
    }
  });
});

describe('getCaseSensitiveHashCode', () => {
  test('returns the djb2 hash code of a substring', () => {
    expect(getCaseSensitiveHashCode('', 0, 0)).toBe(5381);
    expect(getCaseSensitiveHashCode('a', 0, 1)).toBe(5381 * 33 + 97);
    expect(getCaseSensitiveHashCode('xxaaaxx', 2, 5)).toBe(getCaseSensitiveHashCode('aaa', 0, 3));
  });

  test('does not ignore the case of letters', () => {
    expect(getCaseSensitiveHashCode('AZ', 0, 2)).not.toBe(getCaseSensitiveHashCode('az', 0, 2));
  });

  test('returns a non-negative 30-bit integer', () => {
    // Before the cut to 30 bits, the hash code of aaabbbccc has bit 31 set, of aaaa bit 30, and of aaaaaa both
    for (const name of ['aaabbbccc', 'aaaa', 'aaaaaa']) {
      const hashCode = getCaseSensitiveHashCode(name, 0, name.length);

      expect(hashCode).toBeGreaterThanOrEqual(0);
      expect(hashCode).toBeLessThan(2 ** 30);
    }
  });
});

describe('assignAttribute', () => {
  test('adds __proto__ as an own property without changing the prototype', () => {
    const attributes: Record<string, string> = {};

    assignAttribute(attributes, '__proto__', 'aaa');

    expect(Object.getPrototypeOf(attributes)).toBe(Object.prototype);
    expect(Object.entries(attributes)).toStrictEqual([['__proto__', 'aaa']]);
  });
});
