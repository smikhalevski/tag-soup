import fs from 'node:fs';
import path from 'node:path';
import { h } from 'flyweight-dom/dsl';
import { expect, test, vi } from 'vitest';
import { MarkupSyntaxError } from '../main/MarkupSyntaxError.ts';
import { toXML, XMLDOMParser, XMLSAXParser, XMLTokenizer } from '../main/xml.ts';

test('parses XML DOM', () => {
  expect(XMLDOMParser.parseFragment('<p>aaa</p><p>bbb<br/></p>')).toStrictEqual(
    h.fragment(h('p', 'aaa'), h('p', 'bbb', h('br')))
  );
});

test('parses XML DOM from chunks', () => {
  const writer = XMLDOMParser.createDocumentWriter();

  writer.write('<aaa>bb');
  writer.write('b<ccc/></a');

  expect(writer.end('aa>')).toStrictEqual(h.document(h('aaa', 'bbb', h('ccc'))));
});

test('parses XML SAX', () => {
  const calls: unknown[][] = [];

  XMLSAXParser.parseDocument(
    '<?xml version="1.0"?><!DOCTYPE aaa><!-- bbb --><aaa ccc="&lt;">ddd&amp;<![CDATA[<eee>&amp;]]><?fff ggg?><hhh/></aaa>',
    {
      onText(text) {
        calls.push(['onText', text]);
      },
      onStartTagOpening(tagName) {
        calls.push(['onStartTagOpening', tagName]);
      },
      onStartTagClosing() {
        calls.push(['onStartTagClosing']);
      },
      onStartTagSelfClosing() {
        calls.push(['onStartTagSelfClosing']);
      },
      onStartTag(tagName, attributes, isSelfClosing, namespaceURI) {
        calls.push(['onStartTag', tagName, attributes, isSelfClosing, namespaceURI]);
      },
      onEndTag(tagName, namespaceURI) {
        calls.push(['onEndTag', tagName, namespaceURI]);
      },
      onAttribute(name, value) {
        calls.push(['onAttribute', name, value]);
      },
      onCDATASection(data) {
        calls.push(['onCDATASection', data]);
      },
      onComment(data) {
        calls.push(['onComment', data]);
      },
      onDoctype(name, publicId, systemId) {
        calls.push(['onDoctype', name, publicId, systemId]);
      },
      onProcessingInstruction(target, data) {
        calls.push(['onProcessingInstruction', target, data]);
      },
    }
  );

  expect(calls).toStrictEqual([
    ['onProcessingInstruction', 'xml', 'version="1.0"'],
    ['onDoctype', 'aaa', '', ''],
    ['onComment', ' bbb '],
    ['onStartTagOpening', 'aaa'],
    ['onAttribute', 'ccc', '<'],
    ['onStartTagClosing'],
    ['onStartTag', 'aaa', { ccc: '<' }, false, null],
    ['onText', 'ddd&'],
    ['onCDATASection', '<eee>&amp;'],
    ['onProcessingInstruction', 'fff', 'ggg'],
    ['onStartTagOpening', 'hhh'],
    ['onStartTagSelfClosing'],
    ['onStartTag', 'hhh', {}, true, null],
    ['onEndTag', 'aaa', null],
  ]);
});

test('reads tokens of an XML document', () => {
  const tokens: unknown[][] = [];

  XMLTokenizer.tokenizeDocument('<?aaa bbb?><!DOCTYPE ccc><ddd eee="&lt;">&lt;<![CDATA[fff]]><!--ggg--><hhh/></ddd>', {
    onText(input, startIndex, endIndex, isRawText) {
      tokens.push(['onText', input.substring(startIndex, endIndex), isRawText]);
    },
    onStartTagName(input, startIndex, endIndex) {
      tokens.push(['onStartTagName', input.substring(startIndex, endIndex)]);
    },
    onStartTagClosing(input, startIndex, endIndex) {
      tokens.push(['onStartTagClosing', input.substring(startIndex, endIndex)]);
    },
    onStartTagSelfClosing(input, startIndex, endIndex) {
      tokens.push(['onStartTagSelfClosing', input.substring(startIndex, endIndex)]);
    },
    onEndTagName(input, startIndex, endIndex) {
      tokens.push(['onEndTagName', input.substring(startIndex, endIndex)]);
    },
    onAttribute(input, nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex) {
      tokens.push([
        'onAttribute',
        input.substring(nameStartIndex, nameEndIndex),
        input.substring(valueStartIndex, valueEndIndex),
      ]);
    },
    onComment(input, startIndex, endIndex) {
      tokens.push(['onComment', input.substring(startIndex, endIndex)]);
    },
    onProcessingInstruction(input, targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex) {
      tokens.push([
        'onProcessingInstruction',
        input.substring(targetStartIndex, targetEndIndex),
        input.substring(dataStartIndex, dataEndIndex),
      ]);
    },
    onCDATASection(input, startIndex, endIndex) {
      tokens.push(['onCDATASection', input.substring(startIndex, endIndex)]);
    },
    onDoctype(input, nameStartIndex, nameEndIndex) {
      tokens.push(['onDoctype', input.substring(nameStartIndex, nameEndIndex)]);
    },
  });

  expect(tokens).toStrictEqual([
    ['onProcessingInstruction', 'aaa', 'bbb'],
    ['onDoctype', 'ccc'],
    ['onStartTagName', 'ddd'],
    ['onAttribute', 'eee', '&lt;'],
    ['onStartTagClosing', '>'],
    ['onText', '&lt;', false],
    ['onCDATASection', 'fff'],
    ['onComment', 'ggg'],
    ['onStartTagName', 'hhh'],
    ['onStartTagSelfClosing', '/>'],
    ['onEndTagName', 'ddd'],
  ]);
});

test('decodes attribute values', () => {
  expect(XMLDOMParser.parseFragment('<aaa bbb="&lt;"/>')).toStrictEqual(h.fragment(h('aaa', { bbb: '<' })));
});

test('decodes XML entities and numeric character references, but not HTML entities', () => {
  expect(XMLDOMParser.parseFragment('<aaa bbb="&lt;&#65;&#x42;&copy;">&lt;&#65;&#x42;&copy;</aaa>')).toStrictEqual(
    h.fragment(h('aaa', { bbb: '<AB&copy;' }, '<AB&copy;'))
  );
});

test('keeps the case of tag and attribute names', () => {
  expect(XMLDOMParser.parseFragment('<AAA BBB="ccc"><aaa/></AAA>')).toStrictEqual(
    h.fragment(h('AAA', { BBB: 'ccc' }, h('aaa')))
  );
});

test('does not apply HTML rules to tags', () => {
  expect(XMLDOMParser.parseFragment('<p>aaa<p>bbb<br/></p></p><script>&lt;</script>')).toStrictEqual(
    h.fragment(h('p', 'aaa', h('p', 'bbb', h('br'))), h('script', '<'))
  );
});

test('parses CDATA sections, comments and processing instructions without decoding', () => {
  const xml = '<aaa><![CDATA[<bbb>&amp;]]><!--<ccc>&amp;--><?ddd <eee>&amp;?></aaa>';
  const fragment = XMLDOMParser.parseFragment(xml);

  expect(fragment).toStrictEqual(
    h.fragment(h('aaa', h.cdata('<bbb>&amp;'), h.comment('<ccc>&amp;'), h.processingInstruction('ddd', '<eee>&amp;')))
  );
  expect(toXML(fragment)).toBe(xml);
});

test('parses the XML declaration and DOCTYPE of a document', () => {
  const document = XMLDOMParser.parseDocument('<?xml version="1.0"?> <!DOCTYPE aaa> <aaa/>');

  expect(document).toStrictEqual(
    h.document(h.processingInstruction('xml', 'version="1.0"'), h.doctype('aaa'), h('aaa'))
  );
  expect(toXML(document)).toBe('<?xml version="1.0"?><!DOCTYPE aaa><aaa/>');
});

test('resolves namespaces', () => {
  expect(XMLDOMParser.parseDocument('<aaa xmlns="xxx"/>').documentElement!.namespaceURI).toBe('xxx');
});

test('resolves namespaces of prefixes', () => {
  const document = XMLDOMParser.parseDocument('<aaa xmlns="xxx" xmlns:bbb="yyy"><bbb:ccc/><ddd:eee/></aaa>');

  expect(Array.from(document.getElementsByTagName('*'), element => element.namespaceURI)).toStrictEqual([
    'xxx',
    'yyy',
    null,
  ]);
});

test('keeps attributes that declare namespaces, so namespaces of attributes can be looked up', () => {
  const element = XMLDOMParser.parseDocument('<aaa xmlns:bbb="xxx" bbb:ccc="ddd"/>').documentElement!;

  expect(element.attributes).toStrictEqual({ 'xmlns:bbb': 'xxx', 'bbb:ccc': 'ddd' });
  expect(element.getAttributeNS('xxx', 'ccc')).toBe('ddd');
});

test('resolves namespaces of tags', () => {
  const onStartTagMock = vi.fn();

  XMLSAXParser.parseDocument('<aaa xmlns="xxx"/>', { onStartTag: onStartTagMock });

  expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'aaa', { xmlns: 'xxx' }, true, 'xxx');
});

test('passes namespaces to onStartTag and onEndTag', () => {
  const calls: unknown[][] = [];

  XMLSAXParser.parseFragment('<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>', {
    onStartTag(tagName, attributes, isSelfClosing, namespaceURI) {
      calls.push(['onStartTag', tagName, attributes, isSelfClosing, namespaceURI]);
    },
    onEndTag(tagName, namespaceURI) {
      calls.push(['onEndTag', tagName, namespaceURI]);
    },
  });

  expect(calls).toStrictEqual([
    ['onStartTag', 'svg', { xmlns: 'http://www.w3.org/2000/svg' }, false, 'http://www.w3.org/2000/svg'],
    ['onStartTag', 'circle', {}, true, 'http://www.w3.org/2000/svg'],
    ['onEndTag', 'svg', 'http://www.w3.org/2000/svg'],
  ]);
});

test('throws MarkupSyntaxError that points to the name of an unbalanced end tag', () => {
  const xml = '<p>hello</br>';

  // Indices 10 and 12 enclose "br"
  const error = new MarkupSyntaxError('Unexpected end tag.', xml, 10, 12);

  expect(() => XMLDOMParser.parseFragment(xml)).toThrow(error);
  expect(() => XMLSAXParser.parseFragment(xml, {})).toThrow(error);
  expect(() => XMLTokenizer.tokenizeFragment(xml, {})).toThrow(error);
});

test.each([
  ['<aaa>', 'Unexpected end of the document.', 5, 5],
  ['<br>', 'Unexpected end of the document.', 4, 4],
  ['<aaa></AAA>', 'Unexpected end tag.', 7, 10],
  ['<aaa><bbb></aaa></bbb>', 'Expected an end tag.', 10, 10],
  ['<aaa bbb/>', "Expected an attribute value separated by an equals sign ('=').", 8, 9],
  ['<aaa bbb=ccc/>', `Expected a double-quoted ('"') or a single-quoted ("'") attribute value.`, 9, 10],
  ['<1aaa/>', 'Expected a name for the start tag.', 1, 2],
  ['<aaa><!--bbb</aaa>', "Expected the comment to be closed with '-->'.", 5, 18],
  ['<aaa><![CDATA[bbb</aaa>', "Expected the CDATA section to be closed with ']]>'.", 5, 23],
  ['<aaa><?bbb</aaa>', "Expected the processing instruction to be closed with '?>'.", 5, 16],
  ['<!DOCTYPE aaa><aaa/>', "Expected a comment ('<!--'), or a CDATA section ('<![CDATA[').", 0, 2],
])('throws if markup is %j', (xml, message, startIndex, endIndex) => {
  expect(() => XMLDOMParser.parseFragment(xml)).toThrow(new MarkupSyntaxError(message, xml, startIndex, endIndex));
});

test('throws if a document has several root elements', () => {
  expect(() => XMLDOMParser.parseDocument('<aaa/><bbb/>')).toThrow(
    new MarkupSyntaxError('Expected a single root element.', '<aaa/><bbb/>', 6, 10)
  );
});

test('does not throw if a fragment has several root elements', () => {
  expect(XMLDOMParser.parseFragment('<aaa/><bbb/>')).toStrictEqual(h.fragment(h('aaa'), h('bbb')));
});

test('throws MarkupSyntaxError with the offset of the input in chunks', () => {
  const writer = XMLDOMParser.createFragmentWriter();

  writer.write('<p>hello');

  expect(() => writer.end('</br>')).toThrow(new MarkupSyntaxError('Unexpected end tag.', 'hello</br>', 7, 9, 3));
});

test('serializes XML', () => {
  const xml = '<!DOCTYPE html><p>aaa&gt;&lt;<br/></p>';

  expect(toXML(XMLDOMParser.parseDocument(xml))).toBe(xml);
});

test('encodes attribute values', () => {
  expect(toXML(XMLDOMParser.parseFragment('<aaa bbb="&quot;"/>'))).toBe('<aaa bbb="&quot;"/>');
});

test('encodes markup characters in text and attribute values', () => {
  expect(toXML(h('aaa', { bbb: `&<>"'` }, `&<>"'`))).toBe(
    '<aaa bbb="&amp;&lt;&gt;&quot;&apos;">&amp;&lt;&gt;&quot;&apos;</aaa>'
  );
});

test('does not apply HTML rules to tags when serializing', () => {
  expect(toXML(h.fragment(h('br'), h('script', '<')))).toBe('<br/><script>&lt;</script>');
});

test('serializes processing instruction without data', () => {
  expect(toXML(XMLDOMParser.parseFragment('<?aaa?>'))).toBe('<?aaa?>');
});

test('round-trips a well-formed document', () => {
  const xml =
    '<?xml version="1.0"?><!DOCTYPE aaa><!-- bbb --><aaa ccc="&lt;&quot;">' +
    '<ddd:eee xmlns:ddd="fff">ggg &amp; hhh</ddd:eee><![CDATA[<iii>]]><?jjj kkk?><lll/></aaa>';

  expect(toXML(XMLDOMParser.parseDocument(xml))).toBe(xml);
});

test('parses an XML file', () => {
  const xml = fs.readFileSync(path.resolve(import.meta.dirname, './test_small.xml'), 'utf-8');

  const document = XMLDOMParser.parseDocument(xml);

  expect(document.firstChild).toStrictEqual(h.processingInstruction('xml', 'version="1.0" encoding="utf-8"'));
  expect(document.documentElement!.tagName).toBe('Root');
  expect(document.documentElement!.namespaceURI).toBe('http://www.adventure-works.com');
  expect(document.getElementsByTagName('*')).toHaveLength(357);
  expect(document.getElementsByTagNameNS('http://www.adventure-works.com', '*')).toHaveLength(357);
  expect(document.getElementsByTagName('Customer')).toHaveLength(4);
  expect(document.getElementsByTagName('Order')).toHaveLength(22);
});
