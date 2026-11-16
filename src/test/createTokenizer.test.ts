import { expect, test } from 'vitest';
import { createTokenizer } from '../main/createTokenizer.ts';
import { MarkupSyntaxError } from '../main/MarkupSyntaxError.ts';
import type { TokenHandler } from '../main/types.ts';

// Returns a handler that records the name and the arguments of each method call, except the input
function createHandler(calls: unknown[][]): TokenHandler {
  return {
    onText(_input, startIndex, endIndex, isRawText) {
      calls.push(['onText', startIndex, endIndex, isRawText]);
    },
    onStartTagName(_input, startIndex, endIndex) {
      calls.push(['onStartTagName', startIndex, endIndex]);
    },
    onStartTagClosing(_input, startIndex, endIndex) {
      calls.push(['onStartTagClosing', startIndex, endIndex]);
    },
    onStartTagSelfClosing(_input, startIndex, endIndex) {
      calls.push(['onStartTagSelfClosing', startIndex, endIndex]);
    },
    onEndTagName(_input, startIndex, endIndex) {
      calls.push(['onEndTagName', startIndex, endIndex]);
    },
    onAttribute(_input, nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex) {
      calls.push(['onAttribute', nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex]);
    },
    onComment(_input, startIndex, endIndex) {
      calls.push(['onComment', startIndex, endIndex]);
    },
    onProcessingInstruction(_input, targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex) {
      calls.push(['onProcessingInstruction', targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex]);
    },
    onCDATASection(_input, startIndex, endIndex) {
      calls.push(['onCDATASection', startIndex, endIndex]);
    },
    onDoctype(_input, nameStartIndex, nameEndIndex) {
      calls.push(['onDoctype', nameStartIndex, nameEndIndex]);
    },
  };
}

test('passes tokens of every kind to the handler', () => {
  const calls: unknown[][] = [];

  const tokenizer = createTokenizer({
    areSelfClosingTagsRecognized: true,
    areCDATASectionsRecognized: true,
    processingInstructionSyntax: 'xml',
  });

  tokenizer.tokenizeDocument(
    '<!DOCTYPE aaa><?bbb ccc?><ddd eee="fff">ggg<hhh/><!--iii--><![CDATA[jjj]]></ddd>',
    createHandler(calls)
  );

  expect(calls).toStrictEqual([
    ['onDoctype', 10, 13],
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
  const calls: unknown[][] = [];

  // All other TokenHandler methods are optional
  const handler: TokenHandler = {
    onText(_input, startIndex, endIndex, isRawText) {
      calls.push(['onText', startIndex, endIndex, isRawText]);
    },
  };

  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'raw_text' } } });

  tokenizer.tokenizeFragment('<aaa>bbb</aaa>ccc', handler);

  expect(calls).toStrictEqual([
    ['onText', 5, 8, true],
    ['onText', 14, 17, false],
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
  const calls: unknown[][] = [];

  createTokenizer().tokenizeDocument('  <!DOCTYPE aaa>  bbb', createHandler(calls));

  expect(calls).toStrictEqual([
    ['onDoctype', 12, 15],
    ['onText', 18, 21, false],
  ]);
});

test('tokenizeFragment reads leading spaces as text and ignores DOCTYPE', () => {
  const calls: unknown[][] = [];

  createTokenizer().tokenizeFragment('  <!DOCTYPE aaa>  bbb', createHandler(calls));

  expect(calls).toStrictEqual([
    ['onText', 0, 2, false],
    ['onText', 16, 21, false],
  ]);
});

test('createDocumentWriter reads a document from chunks', () => {
  const calls: unknown[][] = [];

  const writer = createTokenizer().createDocumentWriter(createHandler(calls));

  writer.write('  <!DOCTYPE a');

  expect(calls).toStrictEqual([]);
  expect(writer.inputOffset).toBe(2);

  // Indices point into the unread text '<!DOCTYPE a' followed by the last chunk
  writer.end('aa>  bbb');

  expect(calls).toStrictEqual([
    ['onDoctype', 10, 13],
    ['onText', 16, 19, false],
  ]);
});

test('createFragmentWriter reads a fragment from chunks', () => {
  const calls: unknown[][] = [];

  const writer = createTokenizer().createFragmentWriter(createHandler(calls));

  writer.write('  <!DOCTYPE a');

  expect(calls).toStrictEqual([]);
  expect(writer.inputOffset).toBe(0);

  writer.end('aa>  bbb');

  expect(calls).toStrictEqual([
    ['onText', 0, 2, false],
    ['onText', 16, 21, false],
  ]);
});

test('strict tokenizer rejects a second root element in a document, but not in a fragment', () => {
  const calls: unknown[][] = [];

  const tokenizer = createTokenizer({ isStrict: true, areSelfClosingTagsRecognized: true });

  expect(() => tokenizer.tokenizeDocument('<aaa/><bbb/>', {})).toThrow(
    new MarkupSyntaxError('Expected a single root element.', '<aaa/><bbb/>', 6, 10)
  );

  tokenizer.tokenizeFragment('<aaa/><bbb/>', createHandler(calls));

  expect(calls).toStrictEqual([
    ['onStartTagName', 1, 4],
    ['onStartTagSelfClosing', 4, 6],
    ['onStartTagName', 7, 10],
    ['onStartTagSelfClosing', 10, 12],
  ]);
});

test('reads an input after an input that was rejected', () => {
  const calls: unknown[][] = [];

  const tokenizer = createTokenizer();

  expect(() => tokenizer.tokenizeFragment('<aaa>', {})).toThrow(
    new MarkupSyntaxError('Unexpected end of the document.', '<aaa>', 5, 5)
  );

  tokenizer.tokenizeFragment('<aaa></aaa>', createHandler(calls));

  expect(calls).toStrictEqual([
    ['onStartTagName', 1, 4],
    ['onStartTagClosing', 4, 5],
    ['onEndTagName', 7, 10],
  ]);
});
