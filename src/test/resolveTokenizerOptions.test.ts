import { describe, expect, test } from 'vitest';
import { resolveTokenizerOptions } from '../main/resolveTokenizerOptions.ts';

describe('resolveTokenizerOptions', () => {
  test('throws if tag names normalize to the same name', () => {
    expect(() => resolveTokenizerOptions({ areTagNamesCaseInsensitive: true, tags: { aaa: {}, AAA: {} } })).toThrow(
      'The tag "AAA" is duplicated.'
    );
  });

  test('does not throw if tag names differ in case and tag names are case-sensitive', () => {
    expect(() => resolveTokenizerOptions({ tags: { aaa: {}, AAA: {} } })).not.toThrow();
  });
});
