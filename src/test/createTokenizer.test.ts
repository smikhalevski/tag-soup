import { expect, test } from 'vitest';
import { createTokenizer } from '../main/createTokenizer.ts';

test('calls the callback with this undefined', () => {
  const calls: unknown[][] = [];

  createTokenizer().tokenizeFragment('<aaa bbb="ccc">ddd</aaa>', function (this: unknown, tokenKind) {
    calls.push([tokenKind, this]);
  });

  expect(calls).toStrictEqual([
    ['start_tag_name', undefined],
    ['attribute_name', undefined],
    ['attribute_value', undefined],
    ['start_tag_closing', undefined],
    ['text', undefined],
    ['end_tag_name', undefined],
  ]);
});
