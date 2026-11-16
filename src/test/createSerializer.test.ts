import { Node, Text } from 'flyweight-dom';
import { h } from 'flyweight-dom/dsl';
import { escapeXML } from 'speedy-entities';
import { expect, test, vi } from 'vitest';
import { createSerializer } from '../main/createSerializer.ts';
import type { TagParsingOptions } from '../main/types.ts';
import { identity } from '../main/utils.ts';

test('does not encode text and attribute values by default', () => {
  expect(createSerializer()(h('aaa', { bbb: '"<&' }, '<&>'))).toBe('<aaa bbb=""<&"><&></aaa>');
});

test('encodes attribute values separately from text', () => {
  const serialize = createSerializer({ encodeText: () => 'eee', encodeAttribute: () => 'fff' });

  expect(serialize(h.fragment(h('aaa', { bbb: 'ccc' }, 'ddd')))).toBe('<aaa bbb="fff">eee</aaa>');
});

test('encodes text that is not inside an element', () => {
  const serialize = createSerializer({ encodeText: escapeXML });

  expect(serialize(new Text('<'))).toBe('&lt;');
});

test('calls encodeText with each text and encodeAttribute with each attribute value', () => {
  const encodeTextMock = vi.fn(identity);
  const encodeAttributeMock = vi.fn(identity);

  const serialize = createSerializer({ encodeText: encodeTextMock, encodeAttribute: encodeAttributeMock });

  serialize(h.fragment('aaa', h('bbb', { ccc: 'ddd', eee: 'fff' }, 'ggg', h('hhh', 'iii'))));

  expect(encodeTextMock.mock.calls).toStrictEqual([['aaa'], ['ggg'], ['iii']]);
  expect(encodeAttributeMock.mock.calls).toStrictEqual([['ddd'], ['fff']]);
});

test('calls encodeText and encodeAttribute with this undefined', () => {
  const encodeTextMock = vi.fn(identity);
  const encodeAttributeMock = vi.fn(identity);

  createSerializer({ encodeText: encodeTextMock, encodeAttribute: encodeAttributeMock })(
    h('aaa', { bbb: 'ccc' }, 'ddd')
  );

  expect(encodeTextMock.mock.contexts).toStrictEqual([undefined]);
  expect(encodeAttributeMock.mock.contexts).toStrictEqual([undefined]);
});

test('writes an element without children as a start tag and an end tag by default', () => {
  expect(createSerializer()(h('aaa'))).toBe('<aaa></aaa>');
});

test('writes attributes in double quotes, separated by spaces', () => {
  expect(createSerializer()(h('aaa', { bbb: 'ccc', ddd: '' }))).toBe('<aaa bbb="ccc" ddd=""></aaa>');
});

test('writes __proto__ attribute', () => {
  const element = h('aaa');

  element.setAttribute('__proto__', 'bbb');

  expect(createSerializer()(element)).toBe('<aaa __proto__="bbb"></aaa>');
});

test('writes a void tag that has attributes without an end tag', () => {
  const serialize = createSerializer({ tags: { aaa: { kind: 'void' } } });

  expect(serialize(h.fragment(h('aaa', { bbb: 'ccc' }), h('ddd', { eee: 'fff' })))).toBe(
    '<aaa bbb="ccc"><ddd eee="fff"></ddd>'
  );
});

test('writes an element without children as a self-closing tag if self-closing tags are supported', () => {
  const serialize = createSerializer({ areSelfClosingTagsSupported: true });

  expect(serialize(h.fragment(h('aaa'), h('bbb', { ccc: 'ddd' }), h('eee', 'fff')))).toBe(
    '<aaa/><bbb ccc="ddd"/><eee>fff</eee>'
  );
});

test('writes a void tag without an end tag if self-closing tags are supported', () => {
  const serialize = createSerializer({ tags: { aaa: { kind: 'void' } }, areSelfClosingTagsSupported: true });

  expect(serialize(h.fragment(h('aaa'), h('aaa', { bbb: 'ccc' }), h('ddd')))).toBe('<aaa><aaa bbb="ccc"><ddd/>');
});

test('does not encode text of raw text and script data tags', () => {
  const serialize = createSerializer({
    tags: { aaa: { kind: 'raw_text' }, bbb: { kind: 'script_data' } },
    encodeText: escapeXML,
  });

  expect(serialize(h.fragment(h('aaa', '<&>'), h('bbb', '<&>')))).toBe('<aaa><&></aaa><bbb><&></bbb>');
});

test('encodes text of escapable raw text and normal tags', () => {
  const serialize = createSerializer({
    tags: { aaa: { kind: 'escapable_raw_text' }, bbb: { kind: 'normal' } },
    encodeText: escapeXML,
  });

  expect(serialize(h.fragment(h('aaa', '<&>'), h('bbb', '<&>'), h('ccc', '<&>')))).toBe(
    '<aaa>&lt;&amp;&gt;</aaa><bbb>&lt;&amp;&gt;</bbb><ccc>&lt;&amp;&gt;</ccc>'
  );
});

test('encodes text of an element inside a raw text tag', () => {
  const serialize = createSerializer({ tags: { aaa: { kind: 'raw_text' } }, encodeText: escapeXML });

  expect(serialize(h('aaa', '<', h('bbb', '<'), '<'))).toBe('<aaa><<bbb>&lt;</bbb><</aaa>');
});

test('compares tag names by case by default', () => {
  const serialize = createSerializer({ tags: { aaa: { kind: 'void' } } });

  expect(serialize(h.fragment(h('aaa'), h('AAA')))).toBe('<aaa><AAA></AAA>');
});

test('compares tag names with names of tag options ignoring case if tag names are case-insensitive', () => {
  const serialize = createSerializer({
    tags: { AAA: { kind: 'raw_text' } },
    areTagNamesCaseInsensitive: true,
    encodeText: escapeXML,
  });

  expect(serialize(h.fragment(h('aaa', '<'), h('AaA', '<'), h('bbb', '<')))).toBe(
    '<aaa><</aaa><AaA><</AaA><bbb>&lt;</bbb>'
  );
});

test('applies the first of tag options whose names differ only in case if tag names are case-insensitive', () => {
  const serialize = createSerializer({
    tags: { aaa: { kind: 'void' }, AAA: { kind: 'raw_text' } },
    areTagNamesCaseInsensitive: true,
    encodeText: escapeXML,
  });

  expect(serialize(h.fragment(h('aaa'), h('AAA', '<')))).toBe('<aaa><AAA>&lt;</AAA>');
});

test('ignores tag options that only tokenizers use', () => {
  const tags: Record<string, TagParsingOptions> = {
    aaa: { kind: 'void', isImplicitlyStarted: true },
    bbb: { implicitEndingTagNames: ['bbb'], isImplicitEndingScope: true, foreignContext: {} },
  };

  expect(createSerializer({ tags })(h.fragment(h('aaa'), h('bbb')))).toBe('<aaa><bbb></bbb>');
});

test('writes a comment as is', () => {
  expect(createSerializer({ encodeText: escapeXML })(h.comment('<&>'))).toBe('<!--<&>-->');
});

test('writes a CDATA section as is', () => {
  expect(createSerializer({ encodeText: escapeXML })(h.cdata('<&>'))).toBe('<![CDATA[<&>]]>');
});

test('writes a processing instruction as is', () => {
  expect(createSerializer({ encodeText: escapeXML })(h.processingInstruction('aaa', '<&>'))).toBe('<?aaa <&>?>');
});

test('writes a processing instruction without data', () => {
  expect(createSerializer()(h.processingInstruction('aaa'))).toBe('<?aaa?>');
});

test('writes a DOCTYPE without identifiers', () => {
  expect(createSerializer()(h.doctype('aaa'))).toBe('<!DOCTYPE aaa>');
});

test('writes a DOCTYPE with public and system identifiers', () => {
  expect(createSerializer()(h.doctype('aaa', 'bbb', 'ccc'))).toBe('<!DOCTYPE aaa PUBLIC "bbb" "ccc">');
});

test('writes a DOCTYPE with a public identifier', () => {
  expect(createSerializer()(h.doctype('aaa', 'bbb'))).toBe('<!DOCTYPE aaa PUBLIC "bbb">');
});

test('writes a DOCTYPE with a system identifier', () => {
  expect(createSerializer()(h.doctype('aaa', '', 'ccc'))).toBe('<!DOCTYPE aaa SYSTEM "ccc">');
});

test('writes children of a document', () => {
  expect(createSerializer()(h.document(h.doctype('aaa'), h.comment('bbb'), h('aaa', 'ccc')))).toBe(
    '<!DOCTYPE aaa><!--bbb--><aaa>ccc</aaa>'
  );
});

test('writes nothing for a node of an unknown type', () => {
  expect(createSerializer()(new Node())).toBe('');
});
