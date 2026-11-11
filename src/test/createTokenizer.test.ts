import { expect, test } from 'vitest';
import { createTokenizer } from '../main/createTokenizer.ts';
import type { TokenHandler } from '../main/types.ts';

test('passes tokens to the handler', () => {
  const calls: unknown[][] = [];

  const handler: TokenHandler = {
    onText(startIndex, endIndex, _input, isRawText) {
      calls.push(['onText', startIndex, endIndex, isRawText]);
    },
    onStartTagName(startIndex, endIndex) {
      calls.push(['onStartTagName', startIndex, endIndex]);
    },
    onStartTagClosing(startIndex, endIndex) {
      calls.push(['onStartTagClosing', startIndex, endIndex]);
    },
    onStartTagSelfClosing(startIndex, endIndex) {
      calls.push(['onStartTagSelfClosing', startIndex, endIndex]);
    },
    onEndTagName(startIndex, endIndex) {
      calls.push(['onEndTagName', startIndex, endIndex]);
    },
    onAttribute(nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex) {
      calls.push(['onAttribute', nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex]);
    },
    onComment(startIndex, endIndex) {
      calls.push(['onComment', startIndex, endIndex]);
    },
    onProcessingInstruction(targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex) {
      calls.push(['onProcessingInstruction', targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex]);
    },
    onCDATASection(startIndex, endIndex) {
      calls.push(['onCDATASection', startIndex, endIndex]);
    },
    onDoctypeName(startIndex, endIndex) {
      calls.push(['onDoctypeName', startIndex, endIndex]);
    },
  };

  createTokenizer().tokenizeFragment('<aaa bbb="ccc">ddd</aaa>', handler);

  expect(calls).toStrictEqual([
    ['onStartTagName', 1, 4],
    ['onAttribute', 5, 8, 10, 13],
    ['onStartTagClosing', 14, 15],
    ['onText', 15, 18, false],
    ['onEndTagName', 20, 23],
  ]);
});

test('passes raw text to the handler', () => {
  const calls: unknown[][] = [];

  const handler: TokenHandler = {
    onText(startIndex, endIndex, _input, isRawText) {
      calls.push(['onText', startIndex, endIndex, isRawText]);
    },
    onStartTagName() {},
    onStartTagClosing() {},
    onStartTagSelfClosing() {},
    onEndTagName() {},
    onAttribute() {},
    onComment() {},
    onProcessingInstruction() {},
    onCDATASection() {},
    onDoctypeName() {},
  };

  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'raw_text' } } });

  tokenizer.tokenizeFragment('<aaa>bbb</aaa>ccc', handler);

  expect(calls).toStrictEqual([
    ['onText', 5, 8, true],
    ['onText', 14, 17, false],
  ]);
});
