import { type Document, type Element, XML_NAMESPACE } from 'flyweight-dom';
import { f } from 'flyweight-dom/dsl';
import { decodeXML } from 'speedy-entities';
import { expect, test } from 'vitest';
import { createDOMParser } from '../main/createDOMParser.ts';
import { createSerializer } from '../main/createSerializer.ts';
import { createTokenizer } from '../main/createTokenizer.ts';

const namespaceParser = createDOMParser({
  tokenizer: createTokenizer({ areSelfClosingTagsRecognized: true }),
  areNamespacesRecognized: true,
});

// Returns namespaces of elements by tag name
function getNamespaceURIs(document: Document): Record<string, string | null> {
  const namespaceURIs: Record<string, string | null> = {};

  for (const element of document.getElementsByTagName('*')) {
    namespaceURIs[element.tagName] = element.namespaceURI;
  }
  return namespaceURIs;
}

test('parses text', () => {
  expect(createDOMParser().parseDocument('aaa')).toStrictEqual(f.doc('aaa'));
});

test('parses element', () => {
  expect(createDOMParser().parseDocument('<aaa>bbb</aaa>')).toStrictEqual(f.doc(f.aaa('bbb')));
});

test('parses attributes', () => {
  expect(createDOMParser().parseDocument('<aaa xxx="yyy" zzz="vvv">bbb</aaa>')).toEqual(
    f.doc(f.aaa({ xxx: 'yyy', zzz: 'vvv' }, 'bbb'))
  );
});

test('parses nested elements', () => {
  expect(createDOMParser().parseDocument('<aaa><bbb></bbb></aaa>')).toEqual(f.doc(f.aaa(f.bbb())));
});

test('parses self-closing tags elements', () => {
  const tokenizer = createTokenizer({ areSelfClosingTagsRecognized: true });

  expect(createDOMParser({ tokenizer }).parseDocument('<aaa><bbb/></aaa>')).toEqual(f.doc(f.aaa(f.bbb())));
});

test('parses comments', () => {
  expect(createDOMParser().parseDocument('<!--xxx-->')).toEqual(f.doc(f.comment('xxx')));
});

test('does not decode comments', () => {
  expect(createDOMParser({ decodeText: decodeXML }).parseDocument('<!--&amp;-->')).toEqual(f.doc(f.comment('&amp;')));
});

test('does not decode text in raw text tags', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'raw_text' } } });

  expect(createDOMParser({ tokenizer, decodeText: decodeXML }).parseDocument('<aaa>&lt;</aaa>')).toEqual(
    f.doc(f.aaa('&lt;'))
  );
});

test('decodes attribute values with decodeAttribute', () => {
  expect(createDOMParser({ decodeAttribute: decodeXML }).parseDocument('<aaa bbb="&lt;">&lt;</aaa>')).toEqual(
    f.doc(f.aaa({ bbb: '<' }, '&lt;'))
  );
});

test('calls decodeText and decodeAttribute with this undefined', () => {
  const calls: unknown[][] = [];

  createDOMParser({
    decodeText(this: unknown, text: string) {
      calls.push(['text', this]);
      return text;
    },
    decodeAttribute(this: unknown, value: string) {
      calls.push(['attribute', this]);
      return value;
    },
  }).parseFragment('<aaa bbb="ccc">ddd</aaa>');

  expect(calls).toStrictEqual([
    ['attribute', undefined],
    ['text', undefined],
  ]);
});

test('parses comments in elements', () => {
  expect(createDOMParser().parseDocument('<aaa><!--xxx--></aaa>')).toEqual(f.doc(f.aaa(f.comment('xxx'))));
});

test('parses processing instructions in elements', () => {
  const tokenizer = createTokenizer({ areProcessingInstructionsRecognized: true });

  expect(createDOMParser({ tokenizer }).parseDocument('<aaa><?xxx yyy?></aaa>')).toEqual(
    f.doc(f.aaa(f.pi('xxx', 'yyy')))
  );
});

test('parses DOCTYPE, processing instruction and text', () => {
  const tokenizer = createTokenizer({ areProcessingInstructionsRecognized: true });

  expect(createDOMParser({ tokenizer }).parseDocument('   <!DOCTYPE html>  <?xxx yyy?>  vvv')).toEqual(
    f.doc(f.doctype('html'), f.pi('xxx', 'yyy'), 'vvv')
  );
});

test('parses DOCTYPE, text and bogus comment', () => {
  expect(createDOMParser().parseDocument('   <!DOCTYPE html>   vvv   <?xxx yyy?>')).toEqual(
    f.doc(f.doctype('html'), 'vvv   ', f.comment('?xxx yyy?'))
  );
});

test('parses bogus comment, DOCTYPE and text', () => {
  expect(createDOMParser().parseDocument('   <?xxx yyy?>   <!DOCTYPE html>   vvv   ')).toEqual(
    f.doc(f.comment('?xxx yyy?'), f.doctype('html'), 'vvv   ')
  );
});

test('parses chunks', () => {
  const writer = createDOMParser().createDocumentWriter();

  writer.write('<aaa>bb');
  writer.write('b</a');

  expect(writer.end('aa>')).toEqual(f.doc(f.aaa('bbb')));
});

test('parses a fragment with the tokenizer', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  expect(createDOMParser({ tokenizer }).parseFragment(' <aaa>bbb')).toStrictEqual(f.f(' ', f.aaa(), 'bbb'));
});

test('parses document chunks with the tokenizer', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  const writer = createDOMParser({ tokenizer }).createDocumentWriter();

  writer.write(' <aa');

  expect(writer.end('a>bbb')).toStrictEqual(f.doc(f.aaa(), 'bbb'));
});

test('parses fragment chunks with the tokenizer', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  const writer = createDOMParser({ tokenizer }).createFragmentWriter();

  writer.write(' <aa');

  expect(writer.end('a>bbb')).toStrictEqual(f.f(' ', f.aaa(), 'bbb'));
});

test('does not recognize namespaces by default', () => {
  expect(getNamespaceURIs(createDOMParser().parseDocument('<aaa xmlns="xxx"></aaa>'))).toStrictEqual({ aaa: null });
});

test('resolves the default namespace of an element and its descendants', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<aaa xmlns="xxx"><bbb></bbb></aaa>'))).toStrictEqual({
    aaa: 'xxx',
    bbb: 'xxx',
  });
});

test('resolves the namespace of a prefix declared by the same element', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<aaa:bbb xmlns:aaa="xxx"></aaa:bbb>'))).toStrictEqual({
    'aaa:bbb': 'xxx',
  });
});

test('resolves the namespace of a prefix declared by an enclosing element', () => {
  expect(
    getNamespaceURIs(namespaceParser.parseDocument('<aaa xmlns:bbb="xxx"><bbb:ccc></bbb:ccc></aaa>'))
  ).toStrictEqual({ aaa: null, 'bbb:ccc': 'xxx' });
});

test('resolves the namespace of a prefix declared by the innermost element', () => {
  expect(
    getNamespaceURIs(namespaceParser.parseDocument('<aaa xmlns:bbb="xxx"><ccc xmlns:bbb="yyy"><bbb:ddd/></ccc></aaa>'))
  ).toStrictEqual({ aaa: null, ccc: null, 'bbb:ddd': 'yyy' });
});

test('does not resolve the namespace of a prefix that is not declared', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<aaa:bbb></aaa:bbb>'))).toStrictEqual({ 'aaa:bbb': null });
});

test('resolves the namespace of the xml prefix', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<xml:aaa></xml:aaa>'))).toStrictEqual({
    'xml:aaa': XML_NAMESPACE,
  });
});

test('removes namespaces declared by an element when it is ended', () => {
  expect(
    getNamespaceURIs(namespaceParser.parseDocument('<aaa xmlns="xxx"><bbb xmlns="yyy"></bbb><ccc></ccc></aaa>'))
  ).toStrictEqual({ aaa: 'xxx', bbb: 'yyy', ccc: 'xxx' });
});

test('removes all namespaces declared by an element when it is ended', () => {
  expect(
    getNamespaceURIs(namespaceParser.parseDocument('<aaa><bbb xmlns="xxx" xmlns:ccc="yyy"></bbb><ddd></ddd></aaa>'))
  ).toStrictEqual({ aaa: null, bbb: 'xxx', ddd: null });
});

test('removes namespaces declared by nested elements when they are ended', () => {
  expect(
    getNamespaceURIs(
      namespaceParser.parseDocument('<aaa><bbb xmlns="xxx"><ccc xmlns="yyy"></ccc></bbb><ddd></ddd></aaa>')
    )
  ).toStrictEqual({ aaa: null, bbb: 'xxx', ccc: 'yyy', ddd: null });
});

test('removes namespaces declared by a self-closing element', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<aaa><bbb xmlns:ccc="xxx"/><ccc:ddd/></aaa>'))).toStrictEqual({
    aaa: null,
    bbb: null,
    'ccc:ddd': null,
  });
});

test('removes the default namespace declared with an empty value', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<aaa xmlns="xxx"><bbb xmlns=""></bbb></aaa>'))).toStrictEqual({
    aaa: 'xxx',
    bbb: null,
  });
});

test('does not recognize a namespace declared by an attribute that only starts with xmlns', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<aaa xmlnsbbb="xxx"></aaa>'))).toStrictEqual({ aaa: null });
});

test('recognizes a namespace declared by a renamed attribute', () => {
  const parser = createDOMParser({ renameAttribute: name => name.toLowerCase(), areNamespacesRecognized: true });

  expect(getNamespaceURIs(parser.parseDocument('<aaa XMLNS="xxx"></aaa>'))).toStrictEqual({ aaa: 'xxx' });
});

test('recognizes a namespace declared by a decoded attribute value', () => {
  const parser = createDOMParser({ decodeAttribute: decodeXML, areNamespacesRecognized: true });

  expect(getNamespaceURIs(parser.parseDocument('<aaa xmlns="&lt;"></aaa>'))).toStrictEqual({ aaa: '<' });
});

test('keeps attributes of an element when namespaces are recognized', () => {
  const document = namespaceParser.parseDocument('<aaa xmlns="xxx" bbb="ccc"></aaa>');

  expect(document.documentElement!.attributes).toStrictEqual({ xmlns: 'xxx', bbb: 'ccc' });
});

test('preserves __proto__ attribute when namespaces are recognized', () => {
  const document = namespaceParser.parseDocument('<aaa __proto__="bbb"></aaa>');

  expect(Object.entries(document.documentElement!.attributes)).toStrictEqual([['__proto__', 'bbb']]);
});

test('parses nested nodes when namespaces are recognized', () => {
  const serialize = createSerializer({ areSelfClosingTagsSupported: true });

  expect(serialize(namespaceParser.parseDocument('<aaa xxx="yyy">bbb<ccc/>ddd<eee>fff</eee>ggg</aaa>'))).toBe(
    '<aaa xxx="yyy">bbb<ccc/>ddd<eee>fff</eee>ggg</aaa>'
  );
});

test('resolves namespaces of a fragment', () => {
  const fragment = namespaceParser.parseFragment('<aaa xmlns="xxx"></aaa>');

  expect((fragment.firstChild as Element).namespaceURI).toBe('xxx');
});

test('resolves namespaces of document chunks', () => {
  const writer = namespaceParser.createDocumentWriter();

  writer.write('<aaa:bbb xmlns:aaa="xx');

  expect(getNamespaceURIs(writer.end('x"></aaa:bbb>'))).toStrictEqual({ 'aaa:bbb': 'xxx' });
});

test('resolves namespaces of fragment chunks', () => {
  const writer = namespaceParser.createFragmentWriter();

  writer.write('<aaa xmlns="xx');

  expect((writer.end('x"></aaa>').firstChild as Element).namespaceURI).toBe('xxx');
});
