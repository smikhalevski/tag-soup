import { beforeEach, expect, test, vi } from 'vitest';
import { createTokenizer } from '../main/createTokenizer.ts';
import { MarkupSyntaxError } from '../main/MarkupSyntaxError.ts';
import type { TokenHandler } from '../main/types.ts';

const callbackMock = vi.fn();

// Passes the name and the arguments of each method call, except the input, to callbackMock
const handler = {
  onText(_input, startIndex, endIndex, isRawText) {
    callbackMock('onText', startIndex, endIndex, isRawText);
  },
  onStartTagName(_input, startIndex, endIndex) {
    callbackMock('onStartTagName', startIndex, endIndex);
  },
  onStartTagClosing(_input, startIndex, endIndex) {
    callbackMock('onStartTagClosing', startIndex, endIndex);
  },
  onStartTagSelfClosing(_input, startIndex, endIndex) {
    callbackMock('onStartTagSelfClosing', startIndex, endIndex);
  },
  onEndTagName(_input, startIndex, endIndex) {
    callbackMock('onEndTagName', startIndex, endIndex);
  },
  onAttribute(_input, nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex) {
    callbackMock('onAttribute', nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex);
  },
  onComment(_input, startIndex, endIndex) {
    callbackMock('onComment', startIndex, endIndex);
  },
  onProcessingInstruction(_input, targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex) {
    callbackMock('onProcessingInstruction', targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex);
  },
  onCDATASection(_input, startIndex, endIndex) {
    callbackMock('onCDATASection', startIndex, endIndex);
  },
  onDoctype(
    _input,
    nameStartIndex,
    nameEndIndex,
    publicIdStartIndex,
    publicIdEndIndex,
    systemIdStartIndex,
    systemIdEndIndex
  ) {
    callbackMock(
      'onDoctype',
      nameStartIndex,
      nameEndIndex,
      publicIdStartIndex,
      publicIdEndIndex,
      systemIdStartIndex,
      systemIdEndIndex
    );
  },
} satisfies TokenHandler;

beforeEach(() => {
  callbackMock.mockReset();
});

test('passes tokens of every kind to the handler', () => {
  const tokenizer = createTokenizer({
    areSelfClosingTagsRecognized: true,
    areCDATASectionsRecognized: true,
    processingInstructionSyntax: 'xml',
  });

  tokenizer.tokenizeDocument(
    '<!DOCTYPE aaa><?bbb ccc?><ddd eee="fff">ggg<hhh/><!--iii--><![CDATA[jjj]]></ddd>',
    handler
  );

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onDoctype', 10, 13, 13, 13, 13, 13],
    ['onProcessingInstruction', 16, 19, 20, 23],
    ['onStartTagName', 26, 29],
    ['onAttribute', 30, 33, 35, 38],
    ['onStartTagClosing', 39, 40],
    ['onText', 40, 43, false],
    ['onStartTagName', 44, 47],
    ['onStartTagSelfClosing', 47, 49],
    ['onComment', 53, 56],
    ['onCDATASection', 68, 71],
    ['onEndTagName', 76, 79],
  ]);
});

test('passes isRawText to a handler that implements only onText', () => {
  const onTextMock = vi.fn();
  const input = '<aaa>bbb</aaa>ccc';

  // All other TokenHandler methods are optional
  createTokenizer({ tags: { aaa: { kind: 'raw_text' } } }).tokenizeFragment(input, { onText: onTextMock });

  expect(onTextMock.mock.calls).toStrictEqual([
    [input, 5, 8, true],
    [input, 14, 17, false],
  ]);
});

test('does not require any handler method', () => {
  const tokenizer = createTokenizer({
    tags: { br: { kind: 'void' }, p: { implicitEndingTagNames: ['p'], isImplicitlyStarted: true } },
    areSelfClosingTagsRecognized: true,
    areCDATASectionsRecognized: true,
    processingInstructionSyntax: 'xml',
    areUnbalancedStartTagsImplicitlyEnded: true,
    areUnbalancedEndTagsIgnored: true,
  });

  // Tokens of every kind, read and inserted
  expect(() =>
    tokenizer.tokenizeDocument(
      '<!DOCTYPE aaa>bbb<?ccc ddd?>eee<![CDATA[fff]]>ggg<!--hhh-->iii<!jjj>kkk</#lll>mmm<p nnn ooo=ppp qqq="rrr">' +
        'sss<p>ttt<br><uuu/>vvv</p></p><www><xxx></www><yyy>zzz<br',
      {}
    )
  ).not.toThrow();

  expect(() => tokenizer.tokenizeFragment('aaa', {})).not.toThrow();
});

test('tokenizeDocument skips leading spaces and reads DOCTYPE', () => {
  createTokenizer().tokenizeDocument('  <!DOCTYPE aaa>  bbb', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onDoctype', 12, 15, 15, 15, 15, 15],
    ['onText', 18, 21, false],
  ]);
});

test('tokenizeFragment reads leading spaces as text and ignores DOCTYPE', () => {
  createTokenizer().tokenizeFragment('  <!DOCTYPE aaa>  bbb', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onText', 0, 2, false],
    ['onText', 16, 21, false],
  ]);
});

test('createDocumentWriter reads a document from chunks', () => {
  const writer = createTokenizer().createDocumentWriter(handler);

  writer.write('  <!DOCTYPE a');

  expect(callbackMock).not.toHaveBeenCalled();
  expect(writer.inputOffset).toBe(2);

  // Indexes point into the unread text '<!DOCTYPE a' followed by the last chunk
  writer.end('aa>  bbb');

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onDoctype', 10, 13, 13, 13, 13, 13],
    ['onText', 16, 19, false],
  ]);
});

test('createFragmentWriter reads a fragment from chunks', () => {
  const writer = createTokenizer().createFragmentWriter(handler);

  writer.write('  <!DOCTYPE a');

  expect(callbackMock).not.toHaveBeenCalled();
  expect(writer.inputOffset).toBe(0);

  writer.end('aa>  bbb');

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onText', 0, 2, false],
    ['onText', 16, 21, false],
  ]);
});

test('strict tokenizer rejects a second root element in a document, but not in a fragment', () => {
  const tokenizer = createTokenizer({ isStrict: true, areSelfClosingTagsRecognized: true });

  expect(() => tokenizer.tokenizeDocument('<aaa/><bbb/>', {})).toThrow(
    new MarkupSyntaxError('Expected a single root element.', '<aaa/><bbb/>', 6, 10)
  );

  tokenizer.tokenizeFragment('<aaa/><bbb/>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagName', 1, 4],
    ['onStartTagSelfClosing', 4, 6],
    ['onStartTagName', 7, 10],
    ['onStartTagSelfClosing', 10, 12],
  ]);
});

test('reads an input after an input that was rejected', () => {
  const tokenizer = createTokenizer();

  expect(() => tokenizer.tokenizeFragment('<aaa>', {})).toThrow(
    new MarkupSyntaxError('Unexpected end of the document.', '<aaa>', 5, 5)
  );

  tokenizer.tokenizeFragment('<aaa></aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagName', 1, 4],
    ['onStartTagClosing', 4, 5],
    ['onEndTagName', 7, 10],
  ]);
});
