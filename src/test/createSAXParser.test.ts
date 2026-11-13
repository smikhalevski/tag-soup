import { decodeXML } from 'speedy-entities';
import { beforeEach, expect, test, vi } from 'vitest';
import { createSAXParser } from '../main/createSAXParser.ts';
import { createTokenizer } from '../main/createTokenizer.ts';
import type { SAXHandler } from '../main/index.ts';

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

const namespaceParser = createSAXParser({
  tokenizer: createTokenizer({ areSelfClosingTagsRecognized: true }),
  areNamespacesRecognized: true,
});

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
  createSAXParser({
    tokenizer: createTokenizer({ areTagNamesCaseInsensitive: true }),
    decodeText: decodeXML,
  }).parseDocument('<aaa>bbb</AAA>', mockHandler);

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'bbb');

  expect(mockHandler.onStartTagOpening).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(1, 'aaa');

  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);

  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false, null);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);

  expect(mockHandler.onAttribute).not.toHaveBeenCalled();
  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();
  expect(mockHandler.onComment).not.toHaveBeenCalled();
  expect(mockHandler.onDoctype).not.toHaveBeenCalled();
  expect(mockHandler.onProcessingInstruction).not.toHaveBeenCalled();
});

test('parses element with implicitly inserted end tag', () => {
  createSAXParser({
    tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }),
    decodeText: decodeXML,
  }).parseDocument('<aaa>bbb', mockHandler);

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'bbb');

  expect(mockHandler.onStartTagOpening).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(1, 'aaa');

  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);

  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false, null);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);

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
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xxx: 'yyy', zzz: 'vvv' }, false, null);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);

  expect(mockHandler.onAttribute).toHaveBeenCalledTimes(2);
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'xxx', 'yyy');
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(2, 'zzz', 'vvv');

  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();
  expect(mockHandler.onComment).not.toHaveBeenCalled();
  expect(mockHandler.onDoctype).not.toHaveBeenCalled();
  expect(mockHandler.onProcessingInstruction).not.toHaveBeenCalled();
});

test('parses self-closing tags elements', () => {
  createSAXParser({
    tokenizer: createTokenizer({ areSelfClosingTagsRecognized: true }),
    decodeText: decodeXML,
  }).parseDocument('<aaa><bbb/></aaa>', mockHandler);

  expect(mockHandler.onText).not.toHaveBeenCalled();

  expect(mockHandler.onStartTagOpening).toHaveBeenCalledTimes(2);
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(1, 'aaa');
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(2, 'bbb');

  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);

  expect(mockHandler.onStartTagSelfClosing).toHaveBeenCalledTimes(1);

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false, null);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(2, 'bbb', {}, true, null);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);

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
  createSAXParser({ tokenizer: createTokenizer({ areProcessingInstructionsRecognized: true }) }).parseDocument(
    '<aaa><?xxx yyy?></aaa>',
    mockHandler
  );

  expect(mockHandler.onText).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagOpening).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false, null);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onAttribute).not.toHaveBeenCalled();
  expect(mockHandler.onCDATASection).not.toHaveBeenCalled();
  expect(mockHandler.onComment).not.toHaveBeenCalled();
  expect(mockHandler.onDoctype).not.toHaveBeenCalled();

  expect(mockHandler.onProcessingInstruction).toHaveBeenCalledTimes(1);
  expect(mockHandler.onProcessingInstruction).toHaveBeenNthCalledWith(1, 'xxx', 'yyy');
});

test('parses DOCTYPE, processing instruction and text', () => {
  createSAXParser({ tokenizer: createTokenizer({ areProcessingInstructionsRecognized: true }) }).parseDocument(
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

test('parses DOCTYPE, text and bogus comment', () => {
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

test('parses bogus comment, DOCTYPE and text', () => {
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
  createSAXParser({
    tokenizer: createTokenizer({ tags: { aaa: { kind: 'raw_text' } } }),
    decodeText: decodeXML,
  }).parseDocument('<aaa>&lt;</aaa>&lt;', mockHandler);

  expect(mockHandler.onText).toHaveBeenCalledTimes(2);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, '&lt;');
  expect(mockHandler.onText).toHaveBeenNthCalledWith(2, '<');
});

test('decodes attribute values with decodeAttribute', () => {
  createSAXParser({ decodeAttribute: decodeXML }).parseDocument('<aaa bbb="&lt;">&lt;</aaa>', mockHandler);

  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'bbb', '<');
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, '&lt;');
});

test('calls decodeText and decodeAttribute with this undefined', () => {
  const calls: unknown[][] = [];

  createSAXParser({
    decodeText(this: unknown, text: string) {
      calls.push(['text', this]);
      return text;
    },
    decodeAttribute(this: unknown, value: string) {
      calls.push(['attribute', this]);
      return value;
    },
  }).parseDocument('<aaa bbb="ccc">ddd</aaa>', mockHandler);

  expect(calls).toStrictEqual([
    ['attribute', undefined],
    ['text', undefined],
  ]);
});

test('preserves __proto__ attribute', () => {
  createSAXParser().parseDocument('<aaa __proto__="bbb"></aaa>', mockHandler);

  expect(Object.entries(mockHandler.onStartTag.mock.calls[0][1])).toEqual([['__proto__', 'bbb']]);
});

test('calls onStartTag for a start tag that is not closed at the end of the input', () => {
  createSAXParser({ tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }) }).parseDocument(
    '<aaa',
    mockHandler
  );

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false, null);
});

test('calls onStartTag if it is a single handler', () => {
  const mockHandler = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }) }).parseDocument(
    '<aaa xxx="yyy"><bbb zzz="vvv">',
    mockHandler
  );

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xxx: 'yyy' }, false, null);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(2, 'bbb', { zzz: 'vvv' }, false, null);
});

test('calls onEndTag if it is a single handler', () => {
  const mockHandler = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }) }).parseDocument(
    '<aaa><bbb>',
    mockHandler
  );

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'bbb', null);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(2, 'aaa', null);
});

test('parses chunks', () => {
  const writer = createSAXParser().createDocumentWriter(mockHandler);

  writer.write('<aaa bbb="cc');
  writer.write('c">ddd</aaa>');
  writer.end();

  expect(mockHandler.onAttribute).toHaveBeenCalledTimes(1);
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'bbb', 'ccc');

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'ddd');
});

test('parses a fragment with the tokenizer', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  createSAXParser({ tokenizer }).parseFragment(' <aaa>', mockHandler);

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, ' ');

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);
});

test('parses document chunks with the tokenizer', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  const writer = createSAXParser({ tokenizer }).createDocumentWriter(mockHandler);

  writer.write(' <aa');
  writer.end('a>');

  expect(mockHandler.onText).not.toHaveBeenCalled();

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);
});

test('parses fragment chunks with the tokenizer', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  const writer = createSAXParser({ tokenizer }).createFragmentWriter(mockHandler);

  writer.write(' <aa');
  writer.end('a>');

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, ' ');

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);
});

test('does not recognize namespaces by default', () => {
  createSAXParser().parseDocument('<aaa xmlns="xxx"></aaa>', mockHandler);

  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xmlns: 'xxx' }, false, null);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);
});

test('calls onStartTag and onEndTag with the default namespace of a tag and its descendants', () => {
  namespaceParser.parseDocument('<aaa xmlns="xxx"><bbb></bbb></aaa>', mockHandler);

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xmlns: 'xxx' }, false, 'xxx');
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(2, 'bbb', {}, false, 'xxx');

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'bbb', 'xxx');
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(2, 'aaa', 'xxx');
});

test('calls onStartTag and onEndTag with the namespace of a prefix declared by the same tag', () => {
  namespaceParser.parseDocument('<aaa:bbb xmlns:aaa="xxx"></aaa:bbb>', mockHandler);

  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa:bbb', { 'xmlns:aaa': 'xxx' }, false, 'xxx');
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa:bbb', 'xxx');
});

test('removes namespaces declared by a tag when it is ended', () => {
  namespaceParser.parseDocument('<aaa><bbb xmlns="xxx"></bbb><ccc></ccc></aaa>', mockHandler);

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(3);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(3, 'ccc', {}, false, null);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(3);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'bbb', 'xxx');
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(2, 'ccc', null);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(3, 'aaa', null);
});

test('removes namespaces declared by a self-closing tag', () => {
  namespaceParser.parseDocument('<aaa><bbb xmlns="xxx"/><ccc/></aaa>', mockHandler);

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(3);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(2, 'bbb', { xmlns: 'xxx' }, true, 'xxx');
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(3, 'ccc', {}, true, null);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);
});

test('calls onStartTag with a namespace if it is a single handler', () => {
  const mockHandler = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  namespaceParser.parseDocument('<aaa xmlns="xxx"></aaa>', mockHandler);

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xmlns: 'xxx' }, false, 'xxx');
});

test('calls onEndTag with a namespace if it is a single handler', () => {
  const mockHandler = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  namespaceParser.parseDocument('<aaa xmlns="xxx"></aaa>', mockHandler);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', 'xxx');
});

test('calls start tag callbacks when namespaces are recognized', () => {
  namespaceParser.parseDocument('<aaa xmlns="xxx" bbb="ccc"><ddd/></aaa>', mockHandler);

  expect(mockHandler.onStartTagOpening).toHaveBeenCalledTimes(2);
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(1, 'aaa');
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(2, 'ddd');

  expect(mockHandler.onAttribute).toHaveBeenCalledTimes(2);
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'xmlns', 'xxx');
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(2, 'bbb', 'ccc');

  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagSelfClosing).toHaveBeenCalledTimes(1);

  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xmlns: 'xxx', bbb: 'ccc' }, false, 'xxx');
});

test('preserves __proto__ attribute when namespaces are recognized', () => {
  namespaceParser.parseDocument('<aaa __proto__="bbb"></aaa>', mockHandler);

  expect(Object.entries(mockHandler.onStartTag.mock.calls[0][1])).toEqual([['__proto__', 'bbb']]);
});

test('resolves namespaces of a fragment', () => {
  namespaceParser.parseFragment('<aaa xmlns="xxx"></aaa>', mockHandler);

  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', 'xxx');
});

test('resolves namespaces of document chunks', () => {
  const writer = namespaceParser.createDocumentWriter(mockHandler);

  writer.write('<aaa:bbb xmlns:aaa="xx');
  writer.end('x"></aaa:bbb>');

  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa:bbb', 'xxx');
});

test('resolves namespaces of fragment chunks', () => {
  const writer = namespaceParser.createFragmentWriter(mockHandler);

  writer.write('<aaa xmlns="xx');
  writer.end('x"></aaa>');

  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', 'xxx');
});
