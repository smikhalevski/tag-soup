import { decodeXML } from 'speedy-entities';
import { beforeEach, expect, test, vi } from 'vitest';
import { createSAXParser } from '../main/createSAXParser.ts';
import { createTokenizer } from '../main/createTokenizer.ts';
import type { SAXHandler } from '../main/index.ts';
import { MarkupSyntaxError } from '../main/MarkupSyntaxError.ts';

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

// Makes callbacks of mockHandler record their names and arguments in the order of calls
function recordCalls(): unknown[][] {
  const calls: unknown[][] = [];

  for (const [name, mock] of Object.entries(mockHandler)) {
    mock.mockImplementation((...args: unknown[]) => {
      calls.push([name, ...args]);
    });
  }
  return calls;
}

beforeEach(() => {
  vi.resetAllMocks();
});

test('parses text', () => {
  createSAXParser().parseDocument('aaa', mockHandler);

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, 'aaa');

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
  createSAXParser().parseDocument('<aaa>bbb</aaa>', mockHandler);

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

test('calls onEndTag with the name of the start tag if the end tag differs in case', () => {
  createSAXParser({ tokenizer: createTokenizer({ areTagNamesCaseInsensitive: true }) }).parseDocument(
    '<aaa></AAA>',
    mockHandler
  );

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);
});

test('parses element with implicitly inserted end tag', () => {
  createSAXParser({ tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }) }).parseDocument(
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

test('passes an empty string as the value of an attribute without a value', () => {
  createSAXParser().parseDocument('<aaa bbb></aaa>', mockHandler);

  expect(mockHandler.onAttribute).toHaveBeenCalledTimes(1);
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'bbb', '');

  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { bbb: '' }, false, null);
});

test('parses self-closing tags', () => {
  createSAXParser({ tokenizer: createTokenizer({ areSelfClosingTagsRecognized: true }) }).parseDocument(
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

test('parses CDATA sections', () => {
  createSAXParser({ tokenizer: createTokenizer({ areCDATASectionsRecognized: true }) }).parseDocument(
    '<aaa><![CDATA[<bbb>]]></aaa>',
    mockHandler
  );

  expect(mockHandler.onText).not.toHaveBeenCalled();
  expect(mockHandler.onStartTagOpening).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTagSelfClosing).not.toHaveBeenCalled();
  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onAttribute).not.toHaveBeenCalled();

  expect(mockHandler.onCDATASection).toHaveBeenCalledTimes(1);
  expect(mockHandler.onCDATASection).toHaveBeenNthCalledWith(1, '<bbb>');

  expect(mockHandler.onComment).not.toHaveBeenCalled();
  expect(mockHandler.onDoctype).not.toHaveBeenCalled();
  expect(mockHandler.onProcessingInstruction).not.toHaveBeenCalled();
});

test('parses processing instructions in elements', () => {
  createSAXParser({ tokenizer: createTokenizer({ processingInstructionSyntax: 'xml' }) }).parseDocument(
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
  const calls = recordCalls();

  createSAXParser({ tokenizer: createTokenizer({ processingInstructionSyntax: 'xml' }) }).parseDocument(
    '   <!DOCTYPE html>  <?xxx yyy?>  vvv',
    mockHandler
  );

  expect(calls).toStrictEqual([
    ['onDoctype', 'html', '', ''],
    ['onProcessingInstruction', 'xxx', 'yyy'],
    ['onText', 'vvv'],
  ]);
});

test('passes DOCTYPE identifiers', () => {
  createSAXParser().parseDocument('<!DOCTYPE html PUBLIC "aaa" "bbb">', mockHandler);

  expect(mockHandler.onDoctype).toHaveBeenCalledTimes(1);
  expect(mockHandler.onDoctype).toHaveBeenNthCalledWith(1, 'html', 'aaa', 'bbb');
});

test('parses DOCTYPE, text and bogus comment', () => {
  const calls = recordCalls();

  createSAXParser().parseDocument('   <!DOCTYPE html>   vvv   <?xxx yyy?>', mockHandler);

  expect(calls).toStrictEqual([
    ['onDoctype', 'html', '', ''],
    ['onText', 'vvv   '],
    ['onComment', '?xxx yyy?'],
  ]);
});

test('parses bogus comment, DOCTYPE and text', () => {
  const calls = recordCalls();

  createSAXParser().parseDocument('   <?xxx yyy?>   <!DOCTYPE html>   vvv   ', mockHandler);

  expect(calls).toStrictEqual([
    ['onComment', '?xxx yyy?'],
    ['onDoctype', 'html', '', ''],
    ['onText', 'vvv   '],
  ]);
});

test('calls callbacks of a tag in the documented order', () => {
  const calls = recordCalls();

  createSAXParser().parseDocument('<aaa xxx="yyy" zzz="vvv">bbb</aaa>', mockHandler);

  expect(calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'xxx', 'yyy'],
    ['onAttribute', 'zzz', 'vvv'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { xxx: 'yyy', zzz: 'vvv' }, false, null],
    ['onText', 'bbb'],
    ['onEndTag', 'aaa', null],
  ]);
});

test('calls callbacks of a self-closing tag in the documented order', () => {
  const calls = recordCalls();

  createSAXParser({ tokenizer: createTokenizer({ areSelfClosingTagsRecognized: true }) }).parseDocument(
    '<aaa xxx="yyy"/>',
    mockHandler
  );

  expect(calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'xxx', 'yyy'],
    ['onStartTagSelfClosing'],
    ['onStartTag', 'aaa', { xxx: 'yyy' }, true, null],
  ]);
});

test('calls callbacks with the handler as this', () => {
  createSAXParser({
    tokenizer: createTokenizer({
      areSelfClosingTagsRecognized: true,
      areCDATASectionsRecognized: true,
      processingInstructionSyntax: 'xml',
    }),
  }).parseDocument('<!DOCTYPE aaa><!--bbb--><ccc ddd="eee">fff<ggg/><![CDATA[hhh]]><?iii jjj?></ccc>', mockHandler);

  for (const [name, mock] of Object.entries(mockHandler)) {
    expect(mock, name).toHaveBeenCalled();

    for (const context of mock.mock.contexts) {
      expect(context, name).toBe(mockHandler);
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
  createSAXParser({ decodeText: decodeXML }).parseDocument('<aaa bbb="&lt;">&lt;</aaa>', mockHandler);

  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, '<');
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'bbb', '&lt;');
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

test('does not decode comments, CDATA sections and processing instructions', () => {
  createSAXParser({
    tokenizer: createTokenizer({ areCDATASectionsRecognized: true, processingInstructionSyntax: 'xml' }),
    decodeText: decodeXML,
  }).parseDocument('<aaa>&lt;<!--&lt;--><![CDATA[&lt;]]><?bbb &lt;?></aaa>', mockHandler);

  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, '<');
  expect(mockHandler.onComment).toHaveBeenNthCalledWith(1, '&lt;');
  expect(mockHandler.onCDATASection).toHaveBeenNthCalledWith(1, '&lt;');
  expect(mockHandler.onProcessingInstruction).toHaveBeenNthCalledWith(1, 'bbb', '&lt;');
});

test('decodes attribute values with decodeAttribute', () => {
  createSAXParser({ decodeAttribute: decodeXML }).parseDocument('<aaa bbb="&lt;">&lt;</aaa>', mockHandler);

  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'bbb', '<');
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { bbb: '<' }, false, null);
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

test('renames tags with renameTag', () => {
  const renameTagMock = vi.fn((name: string) => name.toUpperCase());

  createSAXParser({ renameTag: renameTagMock }).parseDocument('<aaa><bbb></bbb></aaa>', mockHandler);

  expect(renameTagMock).toHaveBeenCalledTimes(2);
  expect(renameTagMock).toHaveBeenNthCalledWith(1, 'aaa');
  expect(renameTagMock).toHaveBeenNthCalledWith(2, 'bbb');

  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(1, 'AAA');
  expect(mockHandler.onStartTagOpening).toHaveBeenNthCalledWith(2, 'BBB');

  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'AAA', {}, false, null);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(2, 'BBB', {}, false, null);

  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'BBB', null);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(2, 'AAA', null);
});

test('renames tags with renameTag if the handler has no onStartTagOpening', () => {
  const renameTagMock = vi.fn((name: string) => name.toUpperCase());

  const handler = {
    onStartTag: vi.fn(),
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ renameTag: renameTagMock }).parseDocument('<aaa></aaa>', handler);

  expect(renameTagMock).toHaveBeenCalledTimes(1);

  expect(handler.onStartTag).toHaveBeenNthCalledWith(1, 'AAA', {}, false, null);
  expect(handler.onEndTag).toHaveBeenNthCalledWith(1, 'AAA', null);
});

test('calls renameTag once for each start tag', () => {
  const renameTagMock = vi.fn((name: string) => name.toUpperCase());

  createSAXParser({
    tokenizer: createTokenizer({ areSelfClosingTagsRecognized: true }),
    renameTag: renameTagMock,
  }).parseDocument('<aaa><bbb/><bbb/></aaa>', mockHandler);

  expect(renameTagMock).toHaveBeenCalledTimes(3);
  expect(renameTagMock).toHaveBeenNthCalledWith(1, 'aaa');
  expect(renameTagMock).toHaveBeenNthCalledWith(2, 'bbb');
  expect(renameTagMock).toHaveBeenNthCalledWith(3, 'bbb');

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'AAA', null);
});

test('matches end tags by names from the input regardless of renameTag', () => {
  expect(() =>
    createSAXParser({ renameTag: name => name.toLowerCase() }).parseDocument('<AAA></aaa>', mockHandler)
  ).toThrow(new MarkupSyntaxError('Unexpected end tag.', '<AAA></aaa>', 7, 10));
});

test('renames attributes with renameAttribute', () => {
  createSAXParser({ renameAttribute: name => name.toLowerCase() }).parseDocument('<aaa XXX="YYY"></aaa>', mockHandler);

  expect(mockHandler.onAttribute).toHaveBeenCalledTimes(1);
  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'xxx', 'YYY');

  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xxx: 'YYY' }, false, null);
});

test('calls renameAttribute once for each attribute', () => {
  const renameAttributeMock = vi.fn((name: string) => name.toUpperCase());

  createSAXParser({ renameAttribute: renameAttributeMock }).parseDocument(
    '<aaa xxx="yyy"><bbb xxx="zzz"></bbb></aaa>',
    mockHandler
  );

  expect(renameAttributeMock).toHaveBeenCalledTimes(2);
  expect(renameAttributeMock).toHaveBeenNthCalledWith(1, 'xxx');
  expect(renameAttributeMock).toHaveBeenNthCalledWith(2, 'xxx');
});

test('calls renameTag and renameAttribute with this undefined', () => {
  const calls: unknown[][] = [];

  const parser = createSAXParser({
    renameTag(this: unknown, name: string) {
      calls.push(['tag', this]);
      return name;
    },
    renameAttribute(this: unknown, name: string) {
      calls.push(['attribute', this]);
      return name;
    },
  });

  parser.parseDocument('<aaa bbb="ccc"></aaa>', mockHandler);

  // Tags are renamed in another place if the handler has no onStartTagOpening
  parser.parseDocument('<aaa bbb="ccc"></aaa>', { onStartTag: vi.fn() });

  expect(calls).toStrictEqual([
    ['tag', undefined],
    ['attribute', undefined],
    ['tag', undefined],
    ['attribute', undefined],
  ]);
});

test('does not rename and decode attributes if the handler has no onAttribute and no onStartTag', () => {
  const renameAttributeMock = vi.fn((name: string) => name);
  const decodeAttributeMock = vi.fn((value: string) => value);

  const handler = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ renameAttribute: renameAttributeMock, decodeAttribute: decodeAttributeMock }).parseDocument(
    '<aaa xxx="yyy"></aaa>',
    handler
  );

  expect(handler.onEndTag).toHaveBeenCalledTimes(1);

  expect(renameAttributeMock).not.toHaveBeenCalled();
  expect(decodeAttributeMock).not.toHaveBeenCalled();
});

test('preserves __proto__ attribute', () => {
  createSAXParser().parseDocument('<aaa __proto__="bbb"></aaa>', mockHandler);

  expect(Object.entries(mockHandler.onStartTag.mock.calls[0][1])).toEqual([['__proto__', 'bbb']]);
});

test('calls onStartTag and onEndTag for an implicitly ended tag whose start tag is not closed', () => {
  createSAXParser({ tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }) }).parseDocument(
    '<aaa',
    mockHandler
  );

  expect(mockHandler.onStartTagClosing).toHaveBeenCalledTimes(1);

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', {}, false, null);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);
});

test('calls onStartTag with attributes if the handler has no other callbacks', () => {
  const handler = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }) }).parseDocument(
    '<aaa xxx="yyy"><bbb zzz="vvv">',
    handler
  );

  expect(handler.onStartTag).toHaveBeenCalledTimes(2);
  expect(handler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xxx: 'yyy' }, false, null);
  expect(handler.onStartTag).toHaveBeenNthCalledWith(2, 'bbb', { zzz: 'vvv' }, false, null);
});

test('calls onEndTag if the handler has no other callbacks', () => {
  const handler = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({ tokenizer: createTokenizer({ areUnbalancedStartTagsImplicitlyEnded: true }) }).parseDocument(
    '<aaa><bbb>',
    handler
  );

  expect(handler.onEndTag).toHaveBeenCalledTimes(2);
  expect(handler.onEndTag).toHaveBeenNthCalledWith(1, 'bbb', null);
  expect(handler.onEndTag).toHaveBeenNthCalledWith(2, 'aaa', null);
});

test('calls onAttribute if the handler has no other callbacks', () => {
  const handler = {
    onAttribute: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser().parseDocument('<aaa xxx="yyy"><bbb zzz="vvv"></bbb></aaa>', handler);

  expect(handler.onAttribute).toHaveBeenCalledTimes(2);
  expect(handler.onAttribute).toHaveBeenNthCalledWith(1, 'xxx', 'yyy');
  expect(handler.onAttribute).toHaveBeenNthCalledWith(2, 'zzz', 'vvv');
});

test('calls onStartTagOpening if the handler has no other callbacks', () => {
  const handler = {
    onStartTagOpening: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser().parseDocument('<aaa xxx="yyy"><bbb></bbb></aaa>', handler);

  expect(handler.onStartTagOpening).toHaveBeenCalledTimes(2);
  expect(handler.onStartTagOpening).toHaveBeenNthCalledWith(1, 'aaa');
  expect(handler.onStartTagOpening).toHaveBeenNthCalledWith(2, 'bbb');
});

test('throws if the tokenizer does not recover from malformed input', () => {
  expect(() => createSAXParser().parseDocument('<aaa>bbb', mockHandler)).toThrow(
    new MarkupSyntaxError('Unexpected end of the document.', '<aaa>bbb', 8)
  );

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).not.toHaveBeenCalled();
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

test('keeps attributes that were read in a previous chunk', () => {
  const handler = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  const writer = createSAXParser().createDocumentWriter(handler);

  writer.write('<aaa bbb="ccc" ');
  writer.end('ddd="eee"></aaa>');

  expect(handler.onStartTag).toHaveBeenCalledTimes(1);
  expect(handler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { bbb: 'ccc', ddd: 'eee' }, false, null);
});

test('parses a fragment with the given tokenizer and keeps leading spaces', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  createSAXParser({ tokenizer }).parseFragment(' <aaa>', mockHandler);

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, ' ');

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);
});

test('parses document chunks with the given tokenizer and skips leading spaces', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  const writer = createSAXParser({ tokenizer }).createDocumentWriter(mockHandler);

  writer.write(' <aa');
  writer.end('a>');

  expect(mockHandler.onText).not.toHaveBeenCalled();

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);
});

test('parses fragment chunks with the given tokenizer and keeps leading spaces', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  const writer = createSAXParser({ tokenizer }).createFragmentWriter(mockHandler);

  writer.write(' <aa');
  writer.end('a>');

  expect(mockHandler.onText).toHaveBeenCalledTimes(1);
  expect(mockHandler.onText).toHaveBeenNthCalledWith(1, ' ');

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', null);
});

test('ignores DOCTYPE in a fragment', () => {
  const calls = recordCalls();

  createSAXParser().parseFragment('<!DOCTYPE html>aaa', mockHandler);

  expect(calls).toStrictEqual([['onText', 'aaa']]);
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

test('calls onStartTag with a namespace if the handler has no other callbacks', () => {
  const handler = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  namespaceParser.parseDocument('<aaa xmlns="xxx"></aaa>', handler);

  expect(handler.onStartTag).toHaveBeenCalledTimes(1);
  expect(handler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xmlns: 'xxx' }, false, 'xxx');
});

test('calls onEndTag with a namespace if the handler has no other callbacks', () => {
  const handler = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  namespaceParser.parseDocument('<aaa xmlns="xxx"></aaa>', handler);

  expect(handler.onEndTag).toHaveBeenCalledTimes(1);
  expect(handler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', 'xxx');
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

test('calls callbacks in the documented order when namespaces are recognized', () => {
  const calls = recordCalls();

  namespaceParser.parseDocument('<aaa xmlns="xxx"><bbb ccc="ddd"/>eee</aaa>', mockHandler);

  expect(calls).toStrictEqual([
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'xmlns', 'xxx'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { xmlns: 'xxx' }, false, 'xxx'],
    ['onStartTagOpening', 'bbb'],
    ['onAttribute', 'ccc', 'ddd'],
    ['onStartTagSelfClosing'],
    ['onStartTag', 'bbb', { ccc: 'ddd' }, true, 'xxx'],
    ['onText', 'eee'],
    ['onEndTag', 'aaa', 'xxx'],
  ]);
});

test('calls callbacks with the handler as this when namespaces are recognized', () => {
  createSAXParser({
    tokenizer: createTokenizer({
      areSelfClosingTagsRecognized: true,
      areCDATASectionsRecognized: true,
      processingInstructionSyntax: 'xml',
    }),
    areNamespacesRecognized: true,
  }).parseDocument('<!DOCTYPE aaa><!--bbb--><ccc ddd="eee">fff<ggg/><![CDATA[hhh]]><?iii jjj?></ccc>', mockHandler);

  for (const [name, mock] of Object.entries(mockHandler)) {
    expect(mock, name).toHaveBeenCalled();

    for (const context of mock.mock.contexts) {
      expect(context, name).toBe(mockHandler);
    }
  }
});

test('resolves namespaces after tags and attributes are renamed', () => {
  createSAXParser({
    renameTag: name => name.toLowerCase(),
    renameAttribute: name => name.toLowerCase(),
    areNamespacesRecognized: true,
  }).parseDocument('<AAA:bbb XMLNS:AAA="xxx"></AAA:bbb>', mockHandler);

  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'xmlns:aaa', 'xxx');
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa:bbb', { 'xmlns:aaa': 'xxx' }, false, 'xxx');
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa:bbb', 'xxx');
});

test('resolves namespaces after attribute values are decoded', () => {
  createSAXParser({ decodeAttribute: decodeXML, areNamespacesRecognized: true }).parseDocument(
    '<aaa xmlns="&lt;"></aaa>',
    mockHandler
  );

  expect(mockHandler.onAttribute).toHaveBeenNthCalledWith(1, 'xmlns', '<');
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xmlns: '<' }, false, '<');
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', '<');
});

test('calls renameAttribute and decodeAttribute with this undefined when namespaces are recognized', () => {
  const calls: unknown[][] = [];

  createSAXParser({
    renameAttribute(this: unknown, name: string) {
      calls.push(['name', this]);
      return name;
    },
    decodeAttribute(this: unknown, value: string) {
      calls.push(['value', this]);
      return value;
    },
    areNamespacesRecognized: true,
  }).parseDocument('<aaa bbb="ccc"></aaa>', mockHandler);

  expect(calls).toStrictEqual([
    ['name', undefined],
    ['value', undefined],
  ]);
});

test('does not read attributes to resolve namespaces if the handler has no onStartTag and no onEndTag', () => {
  const renameAttributeMock = vi.fn((name: string) => name);
  const decodeAttributeMock = vi.fn((value: string) => value);

  const handler = {
    onText: vi.fn(),
  } satisfies SAXHandler;

  createSAXParser({
    renameAttribute: renameAttributeMock,
    decodeAttribute: decodeAttributeMock,
    areNamespacesRecognized: true,
  }).parseDocument('<aaa xmlns="xxx">bbb</aaa>', handler);

  expect(handler.onText).toHaveBeenCalledTimes(1);

  expect(renameAttributeMock).not.toHaveBeenCalled();
  expect(decodeAttributeMock).not.toHaveBeenCalled();
});

test('preserves __proto__ attribute when namespaces are recognized', () => {
  namespaceParser.parseDocument('<aaa __proto__="bbb"></aaa>', mockHandler);

  expect(Object.entries(mockHandler.onStartTag.mock.calls[0][1])).toEqual([['__proto__', 'bbb']]);
});

test('does not keep tag names and namespaces of an input that failed to parse', () => {
  expect(() => namespaceParser.parseDocument('<aaa xmlns="xxx"><bbb>', mockHandler)).toThrow(MarkupSyntaxError);

  namespaceParser.parseDocument('<ccc></ccc>', mockHandler);

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(3);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(3, 'ccc', {}, false, null);

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(1);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'ccc', null);
});

test('calls onEndTag with names and namespaces of deeply nested tags', () => {
  const tagNames = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg', 'hhh', 'iii', 'jjj', 'kkk', 'lll'];

  const startTags = tagNames.map(tagName => `<${tagName} xmlns="${tagName}">`);
  const endTags = tagNames.map(tagName => `</${tagName}>`).reverse();

  namespaceParser.parseDocument(startTags.join('') + endTags.join(''), mockHandler);

  expect(mockHandler.onEndTag.mock.calls).toStrictEqual(tagNames.map(tagName => [tagName, tagName]).reverse());
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

test('keeps namespaces that were declared in a previous chunk', () => {
  const handler = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  const writer = namespaceParser.createDocumentWriter(handler);

  writer.write('<aaa:bbb xmlns:aaa="xxx" ');
  writer.end('ccc="ddd"></aaa:bbb>');

  expect(handler.onStartTag).toHaveBeenCalledTimes(1);
  expect(handler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa:bbb', { 'xmlns:aaa': 'xxx', ccc: 'ddd' }, false, 'xxx');
});

test('parses chunks written to several writers in turns', () => {
  const handler1 = {
    onStartTag: vi.fn(),
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  const handler2 = {
    onStartTag: vi.fn(),
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  const writer1 = namespaceParser.createDocumentWriter(handler1);
  const writer2 = namespaceParser.createDocumentWriter(handler2);

  writer1.write('<aaa xmlns="xxx">');
  writer2.write('<bbb>');
  writer1.end('</aaa>');
  writer2.end('</bbb>');

  expect(handler1.onStartTag).toHaveBeenCalledTimes(1);
  expect(handler1.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xmlns: 'xxx' }, false, 'xxx');

  expect(handler1.onEndTag).toHaveBeenCalledTimes(1);
  expect(handler1.onEndTag).toHaveBeenNthCalledWith(1, 'aaa', 'xxx');

  expect(handler2.onStartTag).toHaveBeenCalledTimes(1);
  expect(handler2.onStartTag).toHaveBeenNthCalledWith(1, 'bbb', {}, false, null);

  expect(handler2.onEndTag).toHaveBeenCalledTimes(1);
  expect(handler2.onEndTag).toHaveBeenNthCalledWith(1, 'bbb', null);
});
