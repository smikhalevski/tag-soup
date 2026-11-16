import { describe, expect, test } from 'vitest';
import { MarkupSyntaxError } from '../main/MarkupSyntaxError.ts';

describe('MarkupSyntaxError', () => {
  test('is a SyntaxError that has its own name', () => {
    const error = new MarkupSyntaxError('aaa', 'bbb');

    expect(error).toBeInstanceOf(SyntaxError);
    expect(error.name).toBe('MarkupSyntaxError');
    expect(String(error)).toBe('MarkupSyntaxError: aaa');
  });

  test('has unknown indices and no input offset by default', () => {
    const error = new MarkupSyntaxError('aaa', 'bbb');

    expect(error.message).toBe('aaa');
    expect(error.input).toBe('bbb');
    expect(error.startIndex).toBe(-1);
    expect(error.endIndex).toBe(-1);
    expect(error.inputOffset).toBe(0);
  });

  test('points to a position if the end index is omitted', () => {
    const error = new MarkupSyntaxError('aaa', 'bbb', 1);

    expect(error.startIndex).toBe(1);
    expect(error.endIndex).toBe(1);
  });

  test('keeps the range and the input offset', () => {
    const error = new MarkupSyntaxError('aaa', 'bbb', 1, 2, 3);

    expect(error.startIndex).toBe(1);
    expect(error.endIndex).toBe(2);
    expect(error.inputOffset).toBe(3);
  });
});
