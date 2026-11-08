import { decodeXML } from 'speedy-entities';
import { beforeEach, expect, test, vi } from 'vitest';
import { createSAXParser, createSAXParserWriter } from '../main/createSAXParser.ts';
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
  createSAXParser({ decodeText: decodeXML }).parseDocument('aaa&lt;', mockHandler);

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
  createSAXParser({ areTagNamesCaseInsensitive: true, decodeText: decodeXML }).parseDocument(
    '<aaa>bbb</AAA>',
    mockHandler
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
  createSAXParser({ areUnbalancedStartTagsImplicitlyEnded: true, decodeText: decodeXML }).parseDocument(
    '<aaa>bbb',
    mockHandler
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
  createSAXParser().parseDocument('<aaa xxx="yyy" zzz="vvv">bbb</aaa>', mockHandler);

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
  createSAXParser({ areSelfClosingTagsRecognized: true, decodeText: decodeXML }).parseDocument(
    '<aaa><bbb/></aaa>',
    mockHandler
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
  createSAXParser().parseDocument('<!--xxx-->', mockHandler);

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
  createSAXParser({ areProcessingInstructionsRecognized: true }).parseDocument('<aaa><?xxx yyy?></aaa>', mockHandler);

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
  createSAXParser({ areProcessingInstructionsRecognized: true }).parseDocument(
    '   <!DOCTYPE html>  <?xxx yyy?>  vvv',
    mockHandler
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
  createSAXParser().parseDocument('   <!DOCTYPE html>   vvv   <?xxx yyy?>', mockHandler);

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
  createSAXParser().parseDocument('   <?xxx yyy?>   <!DOCTYPE html>   vvv   ', mockHandler);

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
  createSAXParser({ tags: { aaa: { kind: 'raw_text' } }, decodeText: decodeXML }).parseDocument(
    '<aaa>&lt;</aaa>&lt;',
    mockHandler
  );

  expect(mockHandler.onText).toHaveBeenCalledTimes(2);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, '&lt;');
  expect(mockHandler.onText).toHaveBeenNthCalledWith(2, '<');
});

test('decodes attribute values with decodeAttribute', () => {
  createSAXParser({ decodeAttribute: decodeXML }).parseDocument('<aaa bbb="&lt;">&lt;</aaa>', mockHandler);

  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'bbb', '<');
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, '&lt;');
});

test('preserves __proto__ attribute', () => {
  createSAXParser().parseDocument('<aaa __proto__="bbb"></aaa>', mockHandler);

  expect(Object.entries(mockHandler.onStartTag.mock.calls[0][1])).toEqual([['__proto__', 'bbb']]);
});

test('calls onStartTag for a start tag that is not closed at the end of the input', () => {
  createSAXParser({ areUnbalancedStartTagsImplicitlyEnded: true }).parseDocument('<aaa', mockHandler);

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false);
});

test('calls onStartTag if it is a single handler', () => {
  const mockHandler = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ areUnbalancedStartTagsImplicitlyEnded: true }).parseDocument(
    '<aaa xxx="yyy"><bbb zzz="vvv">',
    mockHandler
  );

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xxx: 'yyy' }, false);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(2, 'bbb', { zzz: 'vvv' }, false);
});

test('calls onEndTag if it is a single handler', () => {
  const mockHandler = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ areUnbalancedStartTagsImplicitlyEnded: true }).parseDocument('<aaa><bbb>', mockHandler);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'bbb');
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(2, 'aaa');
});

test('parses chunks', () => {
  const writer = createSAXParserWriter(mockHandler, resolveParserOptions({}));

  writer.write('<aaa bbb="cc');
  writer.write('c">ddd</aaa>');
  writer.end();

  expect(mockHandler.onAttribute).toHaveBeenCalledTimes(1);
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'bbb', 'ccc');

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'ddd');
});
