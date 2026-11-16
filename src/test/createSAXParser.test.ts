import { decodeXML } from 'speedy-entities';
import { beforeEach, expect, test, vi } from 'vitest';
import { createSAXParser } from '../main/createSAXParser.ts';
import { createTokenizer } from '../main/createTokenizer.ts';
import type { SAXHandler } from '../main/index.ts';
import { MarkupSyntaxError } from '../main/MarkupSyntaxError.ts';
import { identity } from '../main/utils.ts';

const namespaceParser = createSAXParser({
  tokenizer: createTokenizer({ areSelfClosingTagsRecognized: true }),
  areNamespacesRecognized: true,
});

const callbackMock = vi.fn();

// Passes the name and the arguments of each call to callbackMock, so a test can check the order of calls
const handler = {
  onText(text) {
    callbackMock('onText', text);
  },
  onStartTagOpening(tagName) {
    callbackMock('onStartTagOpening', tagName);
  },
  onStartTagClosing() {
    callbackMock('onStartTagClosing');
  },
  onStartTagSelfClosing() {
    callbackMock('onStartTagSelfClosing');
  },
  onStartTag(tagName, attributes, isSelfClosing, namespaceURI) {
    callbackMock('onStartTag', tagName, attributes, isSelfClosing, namespaceURI);
  },
  onEndTag(tagName, namespaceURI) {
    callbackMock('onEndTag', tagName, namespaceURI);
  },
  onAttribute(name, value) {
    callbackMock('onAttribute', name, value);
  },
  onCDATASection(data) {
    callbackMock('onCDATASection', data);
  },
  onComment(data) {
    callbackMock('onComment', data);
  },
  onDoctype(name, publicId, systemId) {
    callbackMock('onDoctype', name, publicId, systemId);
  },
  onProcessingInstruction(target, data) {
    callbackMock('onProcessingInstruction', target, data);
  },
} satisfies SAXHandler;

// Returns a handler that has a mock for each callback
function mockSAXHandler() {
  return {
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
}

beforeEach(() => {
  vi.resetAllMocks();
});

test('parses text', () => {
  createSAXParser().parseDocument('aaa', handler);

  expect(callbackMock.mock.calls).toStrictEqual([['onText', 'aaa']]);
});

test('parses element', () => {
  createSAXParser().parseDocument('<aaa>bbb</aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onText', 'bbb'],
    ['onEndTag', 'aaa', null],
  ]);
});

test('calls onEndTag with the name of the start tag if the end tag differs in case', () => {
  createSAXParser({ tokenizer: createTokenizer({ areTagNamesCaseInsensitive: true }) }).parseDocument(
    '<aaa></AAA>',
    handler
  );

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('parses element with implicitly inserted end tag', () => {
  createSAXParser({ tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }) }).parseDocument(
    '<aaa>bbb',
    handler
  );

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onText', 'bbb'],
    ['onEndTag', 'aaa', null],
  ]);
});

test('parses attributes', () => {
  createSAXParser().parseDocument('<aaa ccc="ddd" eee="fff">bbb</aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'ccc', 'ddd'],
    ['onAttribute', 'eee', 'fff'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { ccc: 'ddd', eee: 'fff' }, false, null],
    ['onText', 'bbb'],
    ['onEndTag', 'aaa', null],
  ]);
});

test('passes an empty string as the value of an attribute without a value', () => {
  createSAXParser().parseDocument('<aaa bbb></aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'bbb', ''],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { bbb: '' }, false, null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('parses self-closing tags', () => {
  createSAXParser({ tokenizer: createTokenizer({ areSelfClosingTagsRecognized: true }) }).parseDocument(
    '<aaa><bbb/></aaa>',
    handler
  );

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onStartTagOpening', 'bbb'],
    ['onStartTagSelfClosing'],
    ['onStartTag', 'bbb', {}, true, null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('parses comments', () => {
  createSAXParser().parseDocument('<!--aaa-->', handler);

  expect(callbackMock.mock.calls).toStrictEqual([['onComment', 'aaa']]);
});

test('parses CDATA sections', () => {
  createSAXParser({ tokenizer: createTokenizer({ areCDATASectionsRecognized: true }) }).parseDocument(
    '<aaa><![CDATA[<bbb>]]></aaa>',
    handler
  );

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onCDATASection', '<bbb>'],
    ['onEndTag', 'aaa', null],
  ]);
});

test('parses processing instructions in elements', () => {
  createSAXParser({ tokenizer: createTokenizer({ processingInstructionSyntax: 'xml' }) }).parseDocument(
    '<aaa><?bbb ccc?></aaa>',
    handler
  );

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onProcessingInstruction', 'bbb', 'ccc'],
    ['onEndTag', 'aaa', null],
  ]);
});

test('parses DOCTYPE, processing instruction and text', () => {
  createSAXParser({ tokenizer: createTokenizer({ processingInstructionSyntax: 'xml' }) }).parseDocument(
    '   <!DOCTYPE html>  <?aaa bbb?>  ccc',
    handler
  );

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onDoctype', 'html', '', ''],
    ['onProcessingInstruction', 'aaa', 'bbb'],
    ['onText', 'ccc'],
  ]);
});

test('passes DOCTYPE identifiers', () => {
  createSAXParser().parseDocument('<!DOCTYPE html PUBLIC "aaa" "bbb">', handler);

  expect(callbackMock.mock.calls).toStrictEqual([['onDoctype', 'html', 'aaa', 'bbb']]);
});

test('parses DOCTYPE, text and bogus comment', () => {
  createSAXParser().parseDocument('   <!DOCTYPE html>   aaa   <?bbb ccc?>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onDoctype', 'html', '', ''],
    ['onText', 'aaa   '],
    ['onComment', '?bbb ccc?'],
  ]);
});

test('parses bogus comment, DOCTYPE and text', () => {
  createSAXParser().parseDocument('   <?aaa bbb?>   <!DOCTYPE html>   ccc   ', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onComment', '?aaa bbb?'],
    ['onDoctype', 'html', '', ''],
    ['onText', 'ccc   '],
  ]);
});

test('calls callbacks of a tag in the documented order', () => {
  createSAXParser().parseDocument('<aaa ccc="ddd" eee="fff">bbb</aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'ccc', 'ddd'],
    ['onAttribute', 'eee', 'fff'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { ccc: 'ddd', eee: 'fff' }, false, null],
    ['onText', 'bbb'],
    ['onEndTag', 'aaa', null],
  ]);
});

test('calls callbacks of a self-closing tag in the documented order', () => {
  createSAXParser({ tokenizer: createTokenizer({ areSelfClosingTagsRecognized: true }) }).parseDocument(
    '<aaa bbb="ccc"/>',
    handler
  );

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'bbb', 'ccc'],
    ['onStartTagSelfClosing'],
    ['onStartTag', 'aaa', { bbb: 'ccc' }, true, null],
  ]);
});

test('calls callbacks with the handler as this', () => {
  const handlerMock = mockSAXHandler();

  createSAXParser({
    tokenizer: createTokenizer({
      areSelfClosingTagsRecognized: true,
      areCDATASectionsRecognized: true,
      processingInstructionSyntax: 'xml',
    }),
  }).parseDocument('<!DOCTYPE aaa><!--bbb--><ccc ddd="eee">fff<ggg/><![CDATA[hhh]]><?iii jjj?></ccc>', handlerMock);

  for (const [name, mock] of Object.entries(handlerMock)) {
    expect(mock, name).toHaveBeenCalled();

    for (const context of mock.mock.contexts) {
      expect(context, name).toBe(handlerMock);
    }
  }
});

test('parses with a handler that has no callbacks', () => {
  const tokenizer = createTokenizer({
    areSelfClosingTagsRecognized: true,
    areCDATASectionsRecognized: true,
    processingInstructionSyntax: 'xml',
  });

  const input = '<!DOCTYPE aaa><!--bbb--><ccc ddd="eee">fff<ggg/><![CDATA[hhh]]><?iii jjj?></ccc>';

  expect(() => createSAXParser({ tokenizer }).parseDocument(input, {})).not.toThrow();
  expect(() => createSAXParser({ tokenizer, areNamespacesRecognized: true }).parseDocument(input, {})).not.toThrow();
});

test('decodes text with decodeText', () => {
  createSAXParser({ decodeText: decodeXML }).parseDocument('<aaa bbb="&lt;">&lt;</aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'bbb', '&lt;'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { bbb: '&lt;' }, false, null],
    ['onText', '<'],
    ['onEndTag', 'aaa', null],
  ]);
});

test('does not decode text in raw text tags', () => {
  createSAXParser({
    tokenizer: createTokenizer({ tags: { aaa: { kind: 'raw_text' } } }),
    decodeText: decodeXML,
  }).parseDocument('<aaa>&lt;</aaa>&lt;', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onText', '&lt;'],
    ['onEndTag', 'aaa', null],
    ['onText', '<'],
  ]);
});

test('does not decode comments, CDATA sections and processing instructions', () => {
  createSAXParser({
    tokenizer: createTokenizer({ areCDATASectionsRecognized: true, processingInstructionSyntax: 'xml' }),
    decodeText: decodeXML,
  }).parseDocument('<aaa>&lt;<!--&lt;--><![CDATA[&lt;]]><?bbb &lt;?></aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onText', '<'],
    ['onComment', '&lt;'],
    ['onCDATASection', '&lt;'],
    ['onProcessingInstruction', 'bbb', '&lt;'],
    ['onEndTag', 'aaa', null],
  ]);
});

test('decodes attribute values with decodeAttribute', () => {
  createSAXParser({ decodeAttribute: decodeXML }).parseDocument('<aaa bbb="&lt;">&lt;</aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'bbb', '<'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { bbb: '<' }, false, null],
    ['onText', '&lt;'],
    ['onEndTag', 'aaa', null],
  ]);
});

test('calls decodeText and decodeAttribute with this undefined', () => {
  const decodeTextMock = vi.fn(identity);
  const decodeAttributeMock = vi.fn(identity);

  createSAXParser({ decodeText: decodeTextMock, decodeAttribute: decodeAttributeMock }).parseDocument(
    '<aaa bbb="ccc">ddd</aaa>',
    handler
  );

  expect(decodeTextMock.mock.contexts).toStrictEqual([undefined]);
  expect(decodeAttributeMock.mock.contexts).toStrictEqual([undefined]);
});

test('renames tags with renameTag', () => {
  const renameTagMock = vi.fn((name: string) => name.toUpperCase());

  createSAXParser({ renameTag: renameTagMock }).parseDocument('<aaa><bbb></bbb></aaa>', handler);

  expect(renameTagMock).toHaveBeenCalledTimes(2);
  expect(renameTagMock).toHaveBeenNthCalledWith(1, 'aaa');
  expect(renameTagMock).toHaveBeenNthCalledWith(2, 'bbb');

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'AAA'],
    ['onStartTagClosing'],
    ['onStartTag', 'AAA', {}, false, null],
    ['onStartTagOpening', 'BBB'],
    ['onStartTagClosing'],
    ['onStartTag', 'BBB', {}, false, null],
    ['onEndTag', 'BBB', null],
    ['onEndTag', 'AAA', null],
  ]);
});

test('renames tags with renameTag if the handler has no onStartTagOpening', () => {
  const renameTagMock = vi.fn((name: string) => name.toUpperCase());

  const handlerMock = {
    onStartTag: vi.fn(),
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ renameTag: renameTagMock }).parseDocument('<aaa></aaa>', handlerMock);

  expect(renameTagMock).toHaveBeenCalledTimes(1);

  expect(handlerMock.onStartTag).toHaveBeenNthCalledWith(1, 'AAA', {}, false, null);
  expect(handlerMock.onEndTag).toHaveBeenNthCalledWith(1, 'AAA', null);
});

test('calls renameTag once for each start tag', () => {
  const renameTagMock = vi.fn((name: string) => name.toUpperCase());

  createSAXParser({
    tokenizer: createTokenizer({ areSelfClosingTagsRecognized: true }),
    renameTag: renameTagMock,
  }).parseDocument('<aaa><bbb/><bbb/></aaa>', handler);

  expect(renameTagMock).toHaveBeenCalledTimes(3);
  expect(renameTagMock).toHaveBeenNthCalledWith(1, 'aaa');
  expect(renameTagMock).toHaveBeenNthCalledWith(2, 'bbb');
  expect(renameTagMock).toHaveBeenNthCalledWith(3, 'bbb');

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'AAA'],
    ['onStartTagClosing'],
    ['onStartTag', 'AAA', {}, false, null],
    ['onStartTagOpening', 'BBB'],
    ['onStartTagSelfClosing'],
    ['onStartTag', 'BBB', {}, true, null],
    ['onStartTagOpening', 'BBB'],
    ['onStartTagSelfClosing'],
    ['onStartTag', 'BBB', {}, true, null],
    ['onEndTag', 'AAA', null],
  ]);
});

test('matches end tags by names from the input regardless of renameTag', () => {
  expect(() =>
    createSAXParser({ renameTag: name => name.toLowerCase() }).parseDocument('<AAA></aaa>', handler)
  ).toThrow(new MarkupSyntaxError('Unexpected end tag.', '<AAA></aaa>', 7, 10));
});

test('renames attributes with renameAttribute', () => {
  createSAXParser({ renameAttribute: name => name.toLowerCase() }).parseDocument('<aaa BBB="CCC"></aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'bbb', 'CCC'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { bbb: 'CCC' }, false, null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('calls renameAttribute once for each attribute', () => {
  const renameAttributeMock = vi.fn((name: string) => name.toUpperCase());

  createSAXParser({ renameAttribute: renameAttributeMock }).parseDocument(
    '<aaa ccc="ddd"><bbb ccc="eee"></bbb></aaa>',
    handler
  );

  expect(renameAttributeMock).toHaveBeenCalledTimes(2);
  expect(renameAttributeMock).toHaveBeenNthCalledWith(1, 'ccc');
  expect(renameAttributeMock).toHaveBeenNthCalledWith(2, 'ccc');
});

test('calls renameTag and renameAttribute with this undefined', () => {
  const renameTagMock = vi.fn(identity);
  const renameAttributeMock = vi.fn(identity);

  const parser = createSAXParser({ renameTag: renameTagMock, renameAttribute: renameAttributeMock });

  parser.parseDocument('<aaa bbb="ccc"></aaa>', handler);

  // Tags are renamed in another place if the handler has no onStartTagOpening
  parser.parseDocument('<aaa bbb="ccc"></aaa>', { onStartTag: vi.fn() });

  expect(renameTagMock.mock.contexts).toStrictEqual([undefined, undefined]);
  expect(renameAttributeMock.mock.contexts).toStrictEqual([undefined, undefined]);
});

test('does not decode text if the handler has no onText', () => {
  const decodeTextMock = vi.fn(identity);

  createSAXParser({ decodeText: decodeTextMock }).parseDocument('<aaa>bbb</aaa>', { onStartTag: vi.fn() });

  expect(decodeTextMock).not.toHaveBeenCalled();
});

test('does not rename tags if the handler has no onStartTagOpening, no onStartTag and no onEndTag', () => {
  const renameTagMock = vi.fn(identity);

  createSAXParser({ renameTag: renameTagMock }).parseDocument('<aaa>bbb</aaa>', { onText: vi.fn() });

  expect(renameTagMock).not.toHaveBeenCalled();
});

test('does not rename and decode attributes if the handler has no onAttribute and no onStartTag', () => {
  const renameAttributeMock = vi.fn((name: string) => name);
  const decodeAttributeMock = vi.fn((value: string) => value);

  const handlerMock = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ renameAttribute: renameAttributeMock, decodeAttribute: decodeAttributeMock }).parseDocument(
    '<aaa bbb="ccc"></aaa>',
    handlerMock
  );

  expect(handlerMock.onEndTag).toHaveBeenCalledTimes(1);

  expect(renameAttributeMock).not.toHaveBeenCalled();
  expect(decodeAttributeMock).not.toHaveBeenCalled();
});

test('preserves __proto__ attribute', () => {
  const onStartTagMock = vi.fn();

  createSAXParser().parseDocument('<aaa __proto__="bbb"></aaa>', { onStartTag: onStartTagMock });

  expect(Object.entries(onStartTagMock.mock.calls[0][1])).toStrictEqual([['__proto__', 'bbb']]);
});

test('calls onStartTag and onEndTag for an implicitly ended tag whose start tag is not closed', () => {
  createSAXParser({ tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }) }).parseDocument(
    '<aaa',
    handler
  );

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('calls onStartTag with attributes if the handler has no other callbacks', () => {
  const handlerMock = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }) }).parseDocument(
    '<aaa ccc="ddd"><bbb eee="fff">',
    handlerMock
  );

  expect(handlerMock.onStartTag).toHaveBeenCalledTimes(2);
  expect(handlerMock.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { ccc: 'ddd' }, false, null);
  expect(handlerMock.onStartTag).toHaveBeenNthCalledWith(2, 'bbb', { eee: 'fff' }, false, null);
});

test('calls onEndTag if the handler has no other callbacks', () => {
  const handlerMock = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }) }).parseDocument(
    '<aaa><bbb>',
    handlerMock
  );

  expect(handlerMock.onEndTag).toHaveBeenCalledTimes(2);
  expect(handlerMock.onEndTag).toHaveBeenNthCalledWith(1, 'bbb', null);
  expect(handlerMock.onEndTag).toHaveBeenNthCalledWith(2, 'aaa', null);
});

test('calls onAttribute if the handler has no other callbacks', () => {
  const handlerMock = {
    onAttribute: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser().parseDocument('<aaa ccc="ddd"><bbb eee="fff"></bbb></aaa>', handlerMock);

  expect(handlerMock.onAttribute).toHaveBeenCalledTimes(2);
  expect(handlerMock.onAttribute).toHaveBeenNthCalledWith(1, 'ccc', 'ddd');
  expect(handlerMock.onAttribute).toHaveBeenNthCalledWith(2, 'eee', 'fff');
});

test('calls onStartTagOpening if the handler has no other callbacks', () => {
  const handlerMock = {
    onStartTagOpening: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser().parseDocument('<aaa ccc="ddd"><bbb></bbb></aaa>', handlerMock);

  expect(handlerMock.onStartTagOpening).toHaveBeenCalledTimes(2);
  expect(handlerMock.onStartTagOpening).toHaveBeenNthCalledWith(1, 'aaa');
  expect(handlerMock.onStartTagOpening).toHaveBeenNthCalledWith(2, 'bbb');
});

test('throws if the tokenizer does not recover from malformed input', () => {
  expect(() => createSAXParser().parseDocument('<aaa>bbb', handler)).toThrow(
    new MarkupSyntaxError('Unexpected end of the document.', '<aaa>bbb', 8)
  );

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onText', 'bbb'],
  ]);
});

test('parses chunks', () => {
  const writer = createSAXParser().createDocumentWriter(handler);

  writer.write('<aaa bbb="cc');
  writer.write('c">ddd</aaa>');
  writer.end();

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'bbb', 'ccc'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { bbb: 'ccc' }, false, null],
    ['onText', 'ddd'],
    ['onEndTag', 'aaa', null],
  ]);
});

test('keeps attributes that were read in a previous chunk', () => {
  const handlerMock = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  const writer = createSAXParser().createDocumentWriter(handlerMock);

  writer.write('<aaa bbb="ccc" ');
  writer.end('ddd="eee"></aaa>');

  expect(handlerMock.onStartTag).toHaveBeenCalledTimes(1);
  expect(handlerMock.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { bbb: 'ccc', ddd: 'eee' }, false, null);
});

test('parses a fragment with the given tokenizer and keeps leading spaces', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  createSAXParser({ tokenizer }).parseFragment(' <aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onText', ' '],
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('parses document chunks with the given tokenizer and skips leading spaces', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  const writer = createSAXParser({ tokenizer }).createDocumentWriter(handler);

  writer.write(' <aa');
  writer.end('a>');

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('parses fragment chunks with the given tokenizer and keeps leading spaces', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  const writer = createSAXParser({ tokenizer }).createFragmentWriter(handler);

  writer.write(' <aa');
  writer.end('a>');

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onText', ' '],
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('ignores DOCTYPE in a fragment', () => {
  createSAXParser().parseFragment('<!DOCTYPE html>aaa', handler);

  expect(callbackMock.mock.calls).toStrictEqual([['onText', 'aaa']]);
});

test('does not recognize namespaces by default', () => {
  createSAXParser().parseDocument('<aaa xmlns="bbb"></aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'xmlns', 'bbb'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { xmlns: 'bbb' }, false, null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('calls onStartTag and onEndTag with the default namespace of a tag and its descendants', () => {
  namespaceParser.parseDocument('<aaa xmlns="ccc"><bbb></bbb></aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'xmlns', 'ccc'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { xmlns: 'ccc' }, false, 'ccc'],
    ['onStartTagOpening', 'bbb'],
    ['onStartTagClosing'],
    ['onStartTag', 'bbb', {}, false, 'ccc'],
    ['onEndTag', 'bbb', 'ccc'],
    ['onEndTag', 'aaa', 'ccc'],
  ]);
});

test('calls onStartTag and onEndTag with the namespace of a prefix declared by the same tag', () => {
  namespaceParser.parseDocument('<aaa:bbb xmlns:aaa="ccc"></aaa:bbb>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa:bbb'],
    ['onAttribute', 'xmlns:aaa', 'ccc'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa:bbb', { 'xmlns:aaa': 'ccc' }, false, 'ccc'],
    ['onEndTag', 'aaa:bbb', 'ccc'],
  ]);
});

test('removes namespaces declared by a tag when it is ended', () => {
  namespaceParser.parseDocument('<aaa><bbb xmlns="ddd"></bbb><ccc></ccc></aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onStartTagOpening', 'bbb'],
    ['onAttribute', 'xmlns', 'ddd'],
    ['onStartTagClosing'],
    ['onStartTag', 'bbb', { xmlns: 'ddd' }, false, 'ddd'],
    ['onEndTag', 'bbb', 'ddd'],
    ['onStartTagOpening', 'ccc'],
    ['onStartTagClosing'],
    ['onStartTag', 'ccc', {}, false, null],
    ['onEndTag', 'ccc', null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('removes namespaces declared by a self-closing tag', () => {
  namespaceParser.parseDocument('<aaa><bbb xmlns="ddd"/><ccc/></aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', {}, false, null],
    ['onStartTagOpening', 'bbb'],
    ['onAttribute', 'xmlns', 'ddd'],
    ['onStartTagSelfClosing'],
    ['onStartTag', 'bbb', { xmlns: 'ddd' }, true, 'ddd'],
    ['onStartTagOpening', 'ccc'],
    ['onStartTagSelfClosing'],
    ['onStartTag', 'ccc', {}, true, null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('removes namespaces declared by a self-closing tag if the handler has no onStartTag', () => {
  const onEndTagMock = vi.fn();

  namespaceParser.parseDocument('<aaa xmlns="bbb"><ccc xmlns="ddd"/><eee></eee></aaa>', { onEndTag: onEndTagMock });

  expect(onEndTagMock.mock.calls).toStrictEqual([
    ['eee', 'bbb'],
    ['aaa', 'bbb'],
  ]);
});

test('calls onStartTag with a namespace if the handler has no other callbacks', () => {
  const handlerMock = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  namespaceParser.parseDocument('<aaa xmlns="bbb"></aaa>', handlerMock);

  expect(handlerMock.onStartTag).toHaveBeenCalledTimes(1);
  expect(handlerMock.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xmlns: 'bbb' }, false, 'bbb');
});

test('calls onEndTag with a namespace if the handler has no other callbacks', () => {
  const handlerMock = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  namespaceParser.parseDocument('<aaa xmlns="bbb"></aaa>', handlerMock);

  expect(handlerMock.onEndTag).toHaveBeenCalledTimes(1);
  expect(handlerMock.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', 'bbb');
});

test('calls start tag callbacks when namespaces are recognized', () => {
  namespaceParser.parseDocument('<aaa xmlns="eee" bbb="ccc"><ddd/></aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'xmlns', 'eee'],
    ['onAttribute', 'bbb', 'ccc'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { xmlns: 'eee', bbb: 'ccc' }, false, 'eee'],
    ['onStartTagOpening', 'ddd'],
    ['onStartTagSelfClosing'],
    ['onStartTag', 'ddd', {}, true, 'eee'],
    ['onEndTag', 'aaa', 'eee'],
  ]);
});

test('calls callbacks in the documented order when namespaces are recognized', () => {
  namespaceParser.parseDocument('<aaa xmlns="fff"><bbb ccc="ddd"/>eee</aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'xmlns', 'fff'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { xmlns: 'fff' }, false, 'fff'],
    ['onStartTagOpening', 'bbb'],
    ['onAttribute', 'ccc', 'ddd'],
    ['onStartTagSelfClosing'],
    ['onStartTag', 'bbb', { ccc: 'ddd' }, true, 'fff'],
    ['onText', 'eee'],
    ['onEndTag', 'aaa', 'fff'],
  ]);
});

test('calls callbacks with the handler as this when namespaces are recognized', () => {
  const handlerMock = mockSAXHandler();

  createSAXParser({
    tokenizer: createTokenizer({
      areSelfClosingTagsRecognized: true,
      areCDATASectionsRecognized: true,
      processingInstructionSyntax: 'xml',
    }),
    areNamespacesRecognized: true,
  }).parseDocument('<!DOCTYPE aaa><!--bbb--><ccc ddd="eee">fff<ggg/><![CDATA[hhh]]><?iii jjj?></ccc>', handlerMock);

  for (const [name, mock] of Object.entries(handlerMock)) {
    expect(mock, name).toHaveBeenCalled();

    for (const context of mock.mock.contexts) {
      expect(context, name).toBe(handlerMock);
    }
  }
});

test('resolves namespaces after tags and attributes are renamed', () => {
  createSAXParser({
    renameTag: name => name.toLowerCase(),
    renameAttribute: name => name.toLowerCase(),
    areNamespacesRecognized: true,
  }).parseDocument('<AAA:bbb XMLNS:AAA="ccc"></AAA:bbb>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa:bbb'],
    ['onAttribute', 'xmlns:aaa', 'ccc'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa:bbb', { 'xmlns:aaa': 'ccc' }, false, 'ccc'],
    ['onEndTag', 'aaa:bbb', 'ccc'],
  ]);
});

test('resolves namespaces after attribute values are decoded', () => {
  createSAXParser({ decodeAttribute: decodeXML, areNamespacesRecognized: true }).parseDocument(
    '<aaa xmlns="&lt;"></aaa>',
    handler
  );

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'xmlns', '<'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { xmlns: '<' }, false, '<'],
    ['onEndTag', 'aaa', '<'],
  ]);
});

test('calls renameAttribute and decodeAttribute with this undefined when namespaces are recognized', () => {
  const renameAttributeMock = vi.fn(identity);
  const decodeAttributeMock = vi.fn(identity);

  createSAXParser({
    renameAttribute: renameAttributeMock,
    decodeAttribute: decodeAttributeMock,
    areNamespacesRecognized: true,
  }).parseDocument('<aaa bbb="ccc"></aaa>', handler);

  expect(renameAttributeMock.mock.contexts).toStrictEqual([undefined]);
  expect(decodeAttributeMock.mock.contexts).toStrictEqual([undefined]);
});

test('does not read attributes to resolve namespaces if the handler has no onStartTag and no onEndTag', () => {
  const renameAttributeMock = vi.fn((name: string) => name);
  const decodeAttributeMock = vi.fn((value: string) => value);

  const handlerMock = {
    onText: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({
    renameAttribute: renameAttributeMock,
    decodeAttribute: decodeAttributeMock,
    areNamespacesRecognized: true,
  }).parseDocument('<aaa xmlns="ccc">bbb</aaa>', handlerMock);

  expect(handlerMock.onText).toHaveBeenCalledTimes(1);

  expect(renameAttributeMock).not.toHaveBeenCalled();
  expect(decodeAttributeMock).not.toHaveBeenCalled();
});

test('preserves __proto__ attribute when namespaces are recognized', () => {
  const onStartTagMock = vi.fn();

  namespaceParser.parseDocument('<aaa __proto__="bbb"></aaa>', { onStartTag: onStartTagMock });

  expect(Object.entries(onStartTagMock.mock.calls[0][1])).toStrictEqual([['__proto__', 'bbb']]);
});

test('does not keep tag names and namespaces of an input that failed to parse', () => {
  expect(() => namespaceParser.parseDocument('<aaa xmlns="ddd"><bbb>', handler)).toThrow(MarkupSyntaxError);

  namespaceParser.parseDocument('<ccc></ccc>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'xmlns', 'ddd'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { xmlns: 'ddd' }, false, 'ddd'],
    ['onStartTagOpening', 'bbb'],
    ['onStartTagClosing'],
    ['onStartTag', 'bbb', {}, false, 'ddd'],
    ['onStartTagOpening', 'ccc'],
    ['onStartTagClosing'],
    ['onStartTag', 'ccc', {}, false, null],
    ['onEndTag', 'ccc', null],
  ]);
});

test('calls onEndTag with names and namespaces of deeply nested tags', () => {
  const tagNames = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg', 'hhh', 'iii', 'jjj', 'kkk', 'lll'];

  const startTags = tagNames.map(tagName => `<${tagName} xmlns="${tagName}">`);
  const endTags = tagNames.map(tagName => `</${tagName}>`).reverse();

  namespaceParser.parseDocument(startTags.join('') + endTags.join(''), handler);

  expect(callbackMock.mock.calls.filter(args => args[0] === 'onEndTag')).toStrictEqual(
    tagNames.map(tagName => ['onEndTag', tagName, tagName]).reverse()
  );
});

test('resolves namespaces of a fragment', () => {
  namespaceParser.parseFragment('<aaa xmlns="bbb"></aaa>', handler);

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'xmlns', 'bbb'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { xmlns: 'bbb' }, false, 'bbb'],
    ['onEndTag', 'aaa', 'bbb'],
  ]);
});

test('resolves namespaces of document chunks', () => {
  const writer = namespaceParser.createDocumentWriter(handler);

  writer.write('<aaa:bbb xmlns:aaa="cc');
  writer.end('c"></aaa:bbb>');

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa:bbb'],
    ['onAttribute', 'xmlns:aaa', 'ccc'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa:bbb', { 'xmlns:aaa': 'ccc' }, false, 'ccc'],
    ['onEndTag', 'aaa:bbb', 'ccc'],
  ]);
});

test('resolves namespaces of fragment chunks', () => {
  const writer = namespaceParser.createFragmentWriter(handler);

  writer.write('<aaa xmlns="bb');
  writer.end('b"></aaa>');

  expect(callbackMock.mock.calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'xmlns', 'bbb'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { xmlns: 'bbb' }, false, 'bbb'],
    ['onEndTag', 'aaa', 'bbb'],
  ]);
});

test('keeps namespaces that were declared in a previous chunk', () => {
  const handlerMock = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  const writer = namespaceParser.createDocumentWriter(handlerMock);

  writer.write('<aaa:bbb xmlns:aaa="eee" ');
  writer.end('ccc="ddd"></aaa:bbb>');

  expect(handlerMock.onStartTag).toHaveBeenCalledTimes(1);
  expect(handlerMock.onStartTag).toHaveBeenNthCalledWith(
    1,
    'aaa:bbb',
    { 'xmlns:aaa': 'eee', ccc: 'ddd' },
    false,
    'eee'
  );
});

test('parses chunks written to several writers in turns', () => {
  const handlerMock1 = {
    onStartTag: vi.fn(),
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  const handlerMock2 = {
    onStartTag: vi.fn(),
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  const writer1 = namespaceParser.createDocumentWriter(handlerMock1);
  const writer2 = namespaceParser.createDocumentWriter(handlerMock2);

  writer1.write('<aaa xmlns="ccc">');
  writer2.write('<bbb>');
  writer1.end('</aaa>');
  writer2.end('</bbb>');

  expect(handlerMock1.onStartTag).toHaveBeenCalledTimes(1);
  expect(handlerMock1.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xmlns: 'ccc' }, false, 'ccc');

  expect(handlerMock1.onEndTag).toHaveBeenCalledTimes(1);
  expect(handlerMock1.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', 'ccc');

  expect(handlerMock2.onStartTag).toHaveBeenCalledTimes(1);
  expect(handlerMock2.onStartTag).toHaveBeenNthCalledWith(1, 'bbb', {}, false, null);

  expect(handlerMock2.onEndTag).toHaveBeenCalledTimes(1);
  expect(handlerMock2.onEndTag).toHaveBeenNthCalledWith(1, 'bbb', null);
});
