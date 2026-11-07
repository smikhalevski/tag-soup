import { decodeXML } from 'speedy-entities';
import { beforeEach, expect, test, vi } from 'vitest';
import { parseSAX } from '../main/createSAXParser.ts';
import type { SAXHandler } from '../main/index.ts';
import { resolveParserOptions } from '../main/types.ts';

const mockHandler = {
  onText: vi.fn(),
  onStartTagOpening: vi.fn(),
  onStartTagClosing: vi.fn(),
  onStartTagSelfClosing: vi.fn(),
  onStartTag: vi.fn(),
  onEndTag: vi.fn(),
  onAttribute: vi.fn(),
  onCDATASection: vi.fn(),
  onComment: vi.fn(),
  onDoctype: vi.fn(),
  onProcessingInstruction: vi.fn(),
} satisfies SAXHandler;

beforeEach(() => {
  vi.resetAllMocks();
});

test('parses text', () => {
  parseSAX('aaa&lt;', mockHandler, resolveParserOptions({ decodeText: decodeXML }));

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'aaa<');

  expect(mockHandler.onStartTagOpening).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagClosing).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();
  expect(mockHandler.onStartTag).not.toHaveBeenCalled();
  expect(mockHandler.onEndTag).not.toHaveBeenCalled();
  expect(mockHandler.onAttribute).not.toHaveBeenCalled();
  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();
  expect(mockHandler.onComment).not.toHaveBeenCalled();
  expect(mockHandler.onDoctype).not.toHaveBeenCalled();
  expect(mockHandler.onProcessingInstruction).not.toHaveBeenCalled();
});

test('parses element', () => {
  parseSAX(
    '<aaa>bbb</AAA>',
    mockHandler,
    resolveParserOptions({ areTagNamesCaseInsensitive: true, decodeText: decodeXML })
  );

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'bbb');

  expect(mockHandler.onStartTagOpening).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(1, 'aaa');

  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);

  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa');

  expect(mockHandler.onAttribute).not.toHaveBeenCalled();
  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();
  expect(mockHandler.onComment).not.toHaveBeenCalled();
  expect(mockHandler.onDoctype).not.toHaveBeenCalled();
  expect(mockHandler.onProcessingInstruction).not.toHaveBeenCalled();
});

test('parses element with implicitly inserted end tag', () => {
  parseSAX(
    '<aaa>bbb',
    mockHandler,
    resolveParserOptions({ areUnbalancedStartTagsImplicitlyEnded: true, decodeText: decodeXML })
  );

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'bbb');

  expect(mockHandler.onStartTagOpening).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(1, 'aaa');

  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);

  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa');

  expect(mockHandler.onAttribute).not.toHaveBeenCalled();
  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();
  expect(mockHandler.onComment).not.toHaveBeenCalled();
  expect(mockHandler.onDoctype).not.toHaveBeenCalled();
  expect(mockHandler.onProcessingInstruction).not.toHaveBeenCalled();
});

test('parses attributes', () => {
  parseSAX('<aaa xxx="yyy" zzz="vvv">bbb</aaa>', mockHandler);

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'bbb');

  expect(mockHandler.onStartTagOpening).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(1, 'aaa');

  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);

  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xxx: 'yyy', zzz: 'vvv' }, false);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa');

  expect(mockHandler.onAttribute).toHaveBeenCalledTimes(2);
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'xxx', 'yyy');
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(2, 'zzz', 'vvv');

  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();
  expect(mockHandler.onComment).not.toHaveBeenCalled();
  expect(mockHandler.onDoctype).not.toHaveBeenCalled();
  expect(mockHandler.onProcessingInstruction).not.toHaveBeenCalled();
});

test('parses self-closing tags elements', () => {
  parseSAX(
    '<aaa><bbb/></aaa>',
    mockHandler,
    resolveParserOptions({ areSelfClosingTagsRecognized: true, decodeText: decodeXML })
  );

  expect(mockHandler.onText).not.toHaveBeenCalled();

  expect(mockHandler.onStartTagOpening).toHaveBeenCalledTimes(2);
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(1, 'aaa');
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(2, 'bbb');

  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);

  expect(mockHandler.onStartTagSelfClosing).toHaveBeenCalledTimes(1);

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(2, 'bbb', {}, true);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa');

  expect(mockHandler.onAttribute).not.toHaveBeenCalled();
  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();
  expect(mockHandler.onComment).not.toHaveBeenCalled();
  expect(mockHandler.onDoctype).not.toHaveBeenCalled();
  expect(mockHandler.onProcessingInstruction).not.toHaveBeenCalled();
});

test('parses comments', () => {
  parseSAX('<!--xxx-->', mockHandler);

  expect(mockHandler.onText).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagOpening).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagClosing).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();
  expect(mockHandler.onStartTag).not.toHaveBeenCalled();
  expect(mockHandler.onEndTag).not.toHaveBeenCalled();
  expect(mockHandler.onAttribute).not.toHaveBeenCalled();
  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();

  expect(mockHandler.onComment).toHaveBeenCalledTimes(1);
  expect(mockHandler.onComment).toHaveBeenNthCalledWith(1, 'xxx');

  expect(mockHandler.onDoctype).not.toHaveBeenCalled();
  expect(mockHandler.onProcessingInstruction).not.toHaveBeenCalled();
});

test('parses processing instructions in elements', () => {
  parseSAX('<aaa><?xxx yyy?></aaa>', mockHandler, resolveParserOptions({ areProcessingInstructionsRecognized: true }));

  expect(mockHandler.onText).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagOpening).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onAttribute).not.toHaveBeenCalled();
  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();
  expect(mockHandler.onComment).not.toHaveBeenCalled();
  expect(mockHandler.onDoctype).not.toHaveBeenCalled();

  expect(mockHandler.onProcessingInstruction).toHaveBeenCalledTimes(1);
  expect(mockHandler.onProcessingInstruction).toHaveBeenNthCalledWith(1, 'xxx', 'yyy');
});

test('parses DOCTYPE, processing instruction and text', () => {
  parseSAX(
    '   <!DOCTYPE html>  <?xxx yyy?>  vvv',
    mockHandler,
    resolveParserOptions({ areProcessingInstructionsRecognized: true })
  );

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'vvv');

  expect(mockHandler.onStartTagOpening).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagClosing).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();
  expect(mockHandler.onStartTag).not.toHaveBeenCalled();
  expect(mockHandler.onEndTag).not.toHaveBeenCalled();
  expect(mockHandler.onAttribute).not.toHaveBeenCalled();
  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();
  expect(mockHandler.onComment).not.toHaveBeenCalled();

  expect(mockHandler.onDoctype).toHaveBeenCalledTimes(1);
  expect(mockHandler.onDoctype).toHaveBeenNthCalledWith(1, 'html');

  expect(mockHandler.onProcessingInstruction).toHaveBeenCalledTimes(1);
  expect(mockHandler.onProcessingInstruction).toHaveBeenNthCalledWith(1, 'xxx', 'yyy');
});

test('parses DOCTYPE, text and quirky comment', () => {
  parseSAX('   <!DOCTYPE html>   vvv   <?xxx yyy?>', mockHandler);

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'vvv   ');

  expect(mockHandler.onStartTagOpening).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagClosing).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();
  expect(mockHandler.onStartTag).not.toHaveBeenCalled();
  expect(mockHandler.onEndTag).not.toHaveBeenCalled();
  expect(mockHandler.onAttribute).not.toHaveBeenCalled();
  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();

  expect(mockHandler.onComment).toHaveBeenCalledTimes(1);
  expect(mockHandler.onComment).toHaveBeenNthCalledWith(1, '?xxx yyy?');

  expect(mockHandler.onDoctype).toHaveBeenCalledTimes(1);
  expect(mockHandler.onDoctype).toHaveBeenNthCalledWith(1, 'html');

  expect(mockHandler.onProcessingInstruction).not.toHaveBeenCalled();
});

test('parses quirky comment, DOCTYPE and text', () => {
  parseSAX('   <?xxx yyy?>   <!DOCTYPE html>   vvv   ', mockHandler);

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'vvv   ');

  expect(mockHandler.onStartTagOpening).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagClosing).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();
  expect(mockHandler.onStartTag).not.toHaveBeenCalled();
  expect(mockHandler.onEndTag).not.toHaveBeenCalled();
  expect(mockHandler.onAttribute).not.toHaveBeenCalled();
  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();

  expect(mockHandler.onComment).toHaveBeenCalledTimes(1);
  expect(mockHandler.onComment).toHaveBeenNthCalledWith(1, '?xxx yyy?');

  expect(mockHandler.onDoctype).toHaveBeenCalledTimes(1);
  expect(mockHandler.onDoctype).toHaveBeenNthCalledWith(1, 'html');

  expect(mockHandler.onProcessingInstruction).not.toHaveBeenCalled();
});

test('does not decode text in raw text tags', () => {
  parseSAX(
    '<aaa>&lt;</aaa>&lt;',
    mockHandler,
    resolveParserOptions({ tags: { aaa: { kind: 'raw_text' } }, decodeText: decodeXML })
  );

  expect(mockHandler.onText).toHaveBeenCalledTimes(2);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, '&lt;');
  expect(mockHandler.onText).toHaveBeenNthCalledWith(2, '<');
});

test('decodes attribute values with decodeAttribute', () => {
  parseSAX('<aaa bbb="&lt;">&lt;</aaa>', mockHandler, resolveParserOptions({ decodeAttribute: decodeXML }));

  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'bbb', '<');
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, '&lt;');
});

test('normalizes newlines', () => {
  parseSAX('<aaa bbb="\r\n">\r\n\r</aaa>', mockHandler, resolveParserOptions({ areNewlinesNormalized: true }));

  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'bbb', '\n');
  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, '\n\n');
});

test('removes NUL chars from decoded text', () => {
  parseSAX(
    'aaa\0&\0amp;<bbb>\0</bbb>',
    mockHandler,
    resolveParserOptions({ decodeText: decodeXML, areNullCharactersReplaced: true })
  );

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'aaa&amp;');
});

test('replaces NUL chars outside of text', () => {
  parseSAX(
    '<!DOCTYPE aaa\0><?bbb\0 \0?><![CDATA[\0]]><ccc\0 ddd\0="\0"><!--\0--><eee>\0</eee>\0<fff>\0</fff>\0<ggg>\0</ggg>\0</ccc\0>',
    mockHandler,
    resolveParserOptions({
      tags: { eee: { kind: 'raw_text' }, fff: { kind: 'escapable_raw_text' }, ggg: { foreignContext: {} } },
      areCDATASectionsRecognized: true,
      areProcessingInstructionsRecognized: true,
      areNullCharactersReplaced: true,
    })
  );

  expect(mockHandler.onDoctype).toHaveBeenNthCalledWith(1, 'aaa\uFFFD');
  expect(mockHandler.onProcessingInstruction).toHaveBeenNthCalledWith(1, 'bbb\uFFFD', '\uFFFD');
  expect(mockHandler.onCDATASection).toHaveBeenNthCalledWith(1, '\uFFFD');
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(1, 'ccc\uFFFD');
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'ddd\uFFFD', '\uFFFD');
  expect(mockHandler.onComment).toHaveBeenNthCalledWith(1, '\uFFFD');
  expect(mockHandler.onText).toHaveBeenCalledTimes(3);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, '\uFFFD');
  expect(mockHandler.onText).toHaveBeenNthCalledWith(2, '\uFFFD');
  expect(mockHandler.onText).toHaveBeenNthCalledWith(3, '\uFFFD');
  expect(mockHandler.onEndTag).toHaveBeenLastCalledWith('ccc\uFFFD');
});

test('preserves __proto__ attribute', () => {
  parseSAX('<aaa __proto__="bbb"></aaa>', mockHandler);

  expect(Object.entries(mockHandler.onStartTag.mock.calls[0][1])).toEqual([['__proto__', 'bbb']]);
});

test('calls onStartTag for a start tag that is not closed at the end of the input', () => {
  parseSAX('<aaa', mockHandler, resolveParserOptions({ areUnbalancedStartTagsImplicitlyEnded: true }));

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false);
});

test('calls onStartTag if it is a single handler', () => {
  const mockHandler = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  parseSAX(
    '<aaa xxx="yyy"><bbb zzz="vvv">',
    mockHandler,
    resolveParserOptions({ areUnbalancedStartTagsImplicitlyEnded: true })
  );

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xxx: 'yyy' }, false);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(2, 'bbb', { zzz: 'vvv' }, false);
});

test('calls onEndTag if it is a single handler', () => {
  const mockHandler = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  parseSAX('<aaa><bbb>', mockHandler, resolveParserOptions({ areUnbalancedStartTagsImplicitlyEnded: true }));

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'bbb');
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(2, 'aaa');
});

test('replaces NUL chars in tag names if onEndTag is a single handler', () => {
  const mockHandler = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  parseSAX('<aaa\0></aaa\0>', mockHandler, resolveParserOptions({ areNullCharactersReplaced: true }));

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa�');
});
