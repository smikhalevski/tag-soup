import { beforeEach, expect, test, vi } from 'vitest';
import { SAXHandler } from '../main/index.js';
import { parseSAX } from '../main/createSAXParser.js';
import { decodeXML } from 'speedy-entities';
import { resolveTokenizerOptions } from '../main/createTokenizer.js';

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
  parseSAX('aaa&lt;', mockHandler, { decodeText: decodeXML });

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
  parseSAX('<aaa>bbb</AAA>', mockHandler, {
    ...resolveTokenizerOptions({ isCaseInsensitiveTags: true }),
    decodeText: decodeXML,
  });

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
  parseSAX('<aaa>bbb', mockHandler, {
    ...resolveTokenizerOptions({ isUnbalancedStartTagsImplicitlyClosed: true }),
    decodeText: decodeXML,
  });

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
  parseSAX('<aaa><bbb/></aaa>', mockHandler, {
    ...resolveTokenizerOptions({ isSelfClosingTagsRecognized: true }),
    decodeText: decodeXML,
  });

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
  parseSAX('<aaa><?xxx yyy?></aaa>', mockHandler, resolveTokenizerOptions({ isProcessingInstructionRecognized: true }));

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
    resolveTokenizerOptions({ isProcessingInstructionRecognized: true })
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

test('calls onStartTag if it is a single handler', () => {
  const mockHandler = {
    onStartTag: vi.fn(),
  } satisfies SAXHandler;

  parseSAX(
    '<aaa xxx="yyy"><bbb zzz="vvv">',
    mockHandler,
    resolveTokenizerOptions({ isUnbalancedStartTagsImplicitlyClosed: true })
  );

  expect(mockHandler.onStartTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(1, 'aaa', { xxx: 'yyy' }, false);
  expect(mockHandler.onStartTag).toHaveBeenNthCalledWith(2, 'bbb', { zzz: 'vvv' }, false);
});

test('calls onEndTag if it is a single handler', () => {
  const mockHandler = {
    onEndTag: vi.fn(),
  } satisfies SAXHandler;

  parseSAX('<aaa><bbb>', mockHandler, resolveTokenizerOptions({ isUnbalancedStartTagsImplicitlyClosed: true }));

  expect(mockHandler.onEndTag).toHaveBeenCalledTimes(2);
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(1, 'bbb');
  expect(mockHandler.onEndTag).toHaveBeenNthCalledWith(2, 'aaa');
});
