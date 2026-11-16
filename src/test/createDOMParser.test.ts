import { type Document, type Element, XML_NAMESPACE, XMLNS_NAMESPACE } from 'flyweight-dom';
import { h } from 'flyweight-dom/dsl';
import { decodeXML } from 'speedy-entities';
import { expect, test } from 'vitest';
import { createDOMParser } from '../main/createDOMParser.ts';
import { createTokenizer } from '../main/createTokenizer.ts';
import { MarkupSyntaxError } from '../main/MarkupSyntaxError.ts';

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
  expect(createDOMParser().parseDocument('aaa')).toStrictEqual(h.document('aaa'));
});

test('parses element', () => {
  expect(createDOMParser().parseDocument('<aaa>bbb</aaa>')).toStrictEqual(h.document(h('aaa', 'bbb')));
});

test('parses attributes', () => {
  expect(createDOMParser().parseDocument('<aaa xxx="yyy" zzz="vvv">bbb</aaa>')).toStrictEqual(
    h.document(h('aaa', { xxx: 'yyy', zzz: 'vvv' }, 'bbb'))
  );
});

test('parses nested elements', () => {
  expect(createDOMParser().parseDocument('<aaa><bbb></bbb></aaa>')).toStrictEqual(h.document(h('aaa', h('bbb'))));
});

test('parses sibling elements', () => {
  expect(createDOMParser().parseDocument('<aaa><bbb></bbb><ccc></ccc></aaa>')).toStrictEqual(
    h.document(h('aaa', h('bbb'), h('ccc')))
  );
});

test('parses self-closing tags', () => {
  const tokenizer = createTokenizer({ areSelfClosingTagsRecognized: true });

  expect(createDOMParser({ tokenizer }).parseDocument('<aaa><bbb/>ccc</aaa>')).toStrictEqual(
    h.document(h('aaa', h('bbb'), 'ccc'))
  );
});

test('parses comments', () => {
  expect(createDOMParser().parseDocument('<!--xxx-->')).toStrictEqual(h.document(h.comment('xxx')));
});

test('parses CDATA sections', () => {
  const tokenizer = createTokenizer({ areCDATASectionsRecognized: true });

  expect(createDOMParser({ tokenizer }).parseDocument('<aaa><![CDATA[<bbb>]]></aaa>')).toStrictEqual(
    h.document(h('aaa', h.cdata('<bbb>')))
  );
});

test('decodes text with decodeText', () => {
  expect(createDOMParser({ decodeText: decodeXML }).parseDocument('<aaa bbb="&lt;">&lt;</aaa>')).toStrictEqual(
    h.document(h('aaa', { bbb: '&lt;' }, '<'))
  );
});

test('does not decode comments', () => {
  expect(createDOMParser({ decodeText: decodeXML }).parseDocument('<!--&amp;-->')).toStrictEqual(
    h.document(h.comment('&amp;'))
  );
});

test('does not decode CDATA sections and processing instructions', () => {
  const tokenizer = createTokenizer({ areCDATASectionsRecognized: true, processingInstructionSyntax: 'xml' });

  expect(
    createDOMParser({ tokenizer, decodeText: decodeXML }).parseDocument('<aaa>&lt;<![CDATA[&lt;]]><?bbb &lt;?></aaa>')
  ).toStrictEqual(h.document(h('aaa', '<', h.cdata('&lt;'), h.processingInstruction('bbb', '&lt;'))));
});

test('does not decode text in raw text tags', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'raw_text' } } });

  expect(createDOMParser({ tokenizer, decodeText: decodeXML }).parseDocument('<aaa>&lt;</aaa>')).toStrictEqual(
    h.document(h('aaa', '&lt;'))
  );
});

test('decodes attribute values with decodeAttribute', () => {
  expect(createDOMParser({ decodeAttribute: decodeXML }).parseDocument('<aaa bbb="&lt;">&lt;</aaa>')).toStrictEqual(
    h.document(h('aaa', { bbb: '<' }, '&lt;'))
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

test('renames tags with renameTag', () => {
  const parser = createDOMParser({ renameTag: name => name.toUpperCase() });

  expect(parser.parseDocument('<aaa><bbb></bbb></aaa>')).toStrictEqual(h.document(h('AAA', h('BBB'))));
});

test('renames attributes with renameAttribute', () => {
  const parser = createDOMParser({ renameAttribute: name => name.toLowerCase() });

  expect(parser.parseDocument('<aaa XXX="YYY"></aaa>')).toStrictEqual(h.document(h('aaa', { xxx: 'YYY' })));
});

test('calls renameTag once for each start tag and renameAttribute once for each attribute', () => {
  const calls: string[][] = [];

  createDOMParser({
    renameTag(name) {
      calls.push(['tag', name]);
      return name;
    },
    renameAttribute(name) {
      calls.push(['attribute', name]);
      return name;
    },
  }).parseDocument('<aaa xxx="yyy"><aaa xxx="zzz"></aaa></aaa>');

  expect(calls).toStrictEqual([
    ['tag', 'aaa'],
    ['attribute', 'xxx'],
    ['tag', 'aaa'],
    ['attribute', 'xxx'],
  ]);
});

test('calls renameTag and renameAttribute with this undefined', () => {
  const calls: unknown[][] = [];

  createDOMParser({
    renameTag(this: unknown, name: string) {
      calls.push(['tag', this]);
      return name;
    },
    renameAttribute(this: unknown, name: string) {
      calls.push(['attribute', this]);
      return name;
    },
  }).parseFragment('<aaa bbb="ccc">ddd</aaa>');

  expect(calls).toStrictEqual([
    ['tag', undefined],
    ['attribute', undefined],
  ]);
});

test('preserves __proto__ attribute', () => {
  const document = createDOMParser().parseDocument('<aaa __proto__="bbb"></aaa>');

  expect(Object.entries(document.documentElement!.attributes)).toStrictEqual([['__proto__', 'bbb']]);
});

test('parses comments in elements', () => {
  expect(createDOMParser().parseDocument('<aaa><!--xxx--></aaa>')).toStrictEqual(
    h.document(h('aaa', h.comment('xxx')))
  );
});

test('parses processing instructions in elements', () => {
  const tokenizer = createTokenizer({ processingInstructionSyntax: 'xml' });

  expect(createDOMParser({ tokenizer }).parseDocument('<aaa><?xxx yyy?></aaa>')).toStrictEqual(
    h.document(h('aaa', h.processingInstruction('xxx', 'yyy')))
  );
});

test('parses DOCTYPE, processing instruction and text', () => {
  const tokenizer = createTokenizer({ processingInstructionSyntax: 'xml' });

  expect(createDOMParser({ tokenizer }).parseDocument('   <!DOCTYPE html>  <?xxx yyy?>  vvv')).toStrictEqual(
    h.document(h.doctype('html'), h.processingInstruction('xxx', 'yyy'), 'vvv')
  );
});

test('parses DOCTYPE, text and bogus comment', () => {
  expect(createDOMParser().parseDocument('   <!DOCTYPE html>   vvv   <?xxx yyy?>')).toStrictEqual(
    h.document(h.doctype('html'), 'vvv   ', h.comment('?xxx yyy?'))
  );
});

test('parses bogus comment, DOCTYPE and text', () => {
  expect(createDOMParser().parseDocument('   <?xxx yyy?>   <!DOCTYPE html>   vvv   ')).toStrictEqual(
    h.document(h.comment('?xxx yyy?'), h.doctype('html'), 'vvv   ')
  );
});

test('parses DOCTYPE identifiers', () => {
  const doctype = createDOMParser().parseDocument('<!DOCTYPE html PUBLIC "aaa" "bbb">').doctype!;

  expect(doctype.name).toBe('html');
  expect(doctype.publicId).toBe('aaa');
  expect(doctype.systemId).toBe('bbb');
});

test('ignores DOCTYPE in a fragment', () => {
  expect(createDOMParser().parseFragment('<!DOCTYPE html>aaa')).toStrictEqual(h.fragment('aaa'));
});

test('throws if the tokenizer does not recover from malformed input', () => {
  expect(() => createDOMParser().parseDocument('<aaa>bbb')).toThrow(
    new MarkupSyntaxError('Unexpected end of the document.', '<aaa>bbb', 8)
  );
});

test('parses chunks', () => {
  const writer = createDOMParser().createDocumentWriter();

  writer.write('<aaa>bb');
  writer.write('b</a');

  expect(writer.end('aa>')).toStrictEqual(h.document(h('aaa', 'bbb')));
});

test('returns the document if the writer is ended without a chunk', () => {
  const writer = createDOMParser().createDocumentWriter();

  // The trailing text is read when the writer is ended
  writer.write('<aaa>bbb</aaa>ccc');

  expect(writer.end()).toStrictEqual(h.document(h('aaa', 'bbb'), 'ccc'));
});

test('parses a fragment with the given tokenizer and keeps leading spaces', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  expect(createDOMParser({ tokenizer }).parseFragment(' <aaa>bbb')).toStrictEqual(h.fragment(' ', h('aaa'), 'bbb'));
});

test('parses document chunks with the given tokenizer and skips leading spaces', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  const writer = createDOMParser({ tokenizer }).createDocumentWriter();

  writer.write(' <aa');

  expect(writer.end('a>bbb')).toStrictEqual(h.document(h('aaa'), 'bbb'));
});

test('parses fragment chunks with the given tokenizer and keeps leading spaces', () => {
  const tokenizer = createTokenizer({ tags: { aaa: { kind: 'void' } } });

  const writer = createDOMParser({ tokenizer }).createFragmentWriter();

  writer.write(' <aa');

  expect(writer.end('a>bbb')).toStrictEqual(h.fragment(' ', h('aaa'), 'bbb'));
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

test('resolves the namespace of a prefix from its innermost declaration', () => {
  expect(
    getNamespaceURIs(namespaceParser.parseDocument('<aaa xmlns:bbb="xxx"><ccc xmlns:bbb="yyy"><bbb:ddd/></ccc></aaa>'))
  ).toStrictEqual({ aaa: null, ccc: null, 'bbb:ddd': 'yyy' });
});

test('does not resolve the namespace of a prefix that is not declared', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<aaa xmlns="xxx"><bbb:ccc></bbb:ccc></aaa>'))).toStrictEqual({
    aaa: 'xxx',
    'bbb:ccc': null,
  });
});

test('does not resolve the namespace of a prefix that only resembles a declared prefix', () => {
  expect(
    getNamespaceURIs(namespaceParser.parseDocument('<aaa xmlns:bb="xxx"><bbb:ccc/><cc:ddd/><bb:eee/></aaa>'))
  ).toStrictEqual({ aaa: null, 'bbb:ccc': null, 'cc:ddd': null, 'bb:eee': 'xxx' });
});

test('resolves the namespace of the xml prefix', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<xml:aaa></xml:aaa>'))).toStrictEqual({
    'xml:aaa': XML_NAMESPACE,
  });
});

test('does not rebind the xml prefix', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<xml:aaa xmlns:xml="xxx"></xml:aaa>'))).toStrictEqual({
    'xml:aaa': XML_NAMESPACE,
  });
});

test('resolves the namespace of the xmlns prefix', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<xmlns:aaa></xmlns:aaa>'))).toStrictEqual({
    'xmlns:aaa': XMLNS_NAMESPACE,
  });
});

test('removes namespaces declared by an element when it is ended', () => {
  expect(
    getNamespaceURIs(namespaceParser.parseDocument('<aaa xmlns="xxx"><bbb xmlns="yyy"></bbb><ccc></ccc></aaa>'))
  ).toStrictEqual({ aaa: 'xxx', bbb: 'yyy', ccc: 'xxx' });
});

test('removes all namespaces declared by an element when it is ended', () => {
  expect(
    getNamespaceURIs(
      namespaceParser.parseDocument('<aaa><bbb xmlns="xxx" xmlns:ccc="yyy"></bbb><ddd></ddd><ccc:eee></ccc:eee></aaa>')
    )
  ).toStrictEqual({ aaa: null, bbb: 'xxx', ddd: null, 'ccc:eee': null });
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

test('resolves namespaces declared after namespaces of an ended element were removed', () => {
  expect(
    getNamespaceURIs(
      namespaceParser.parseDocument(
        '<aaa><bbb xmlns:ppp="xxx"></bbb><ccc><ddd xmlns:ppp="yyy"><ppp:eee/></ddd><ppp:fff/></ccc></aaa>'
      )
    )
  ).toStrictEqual({ aaa: null, bbb: null, ccc: null, ddd: null, 'ppp:eee': 'yyy', 'ppp:fff': null });
});

test('removes the default namespace if xmlns has an empty value', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<aaa xmlns="xxx"><bbb xmlns=""></bbb></aaa>'))).toStrictEqual({
    aaa: 'xxx',
    bbb: null,
  });
});

test('removes the namespace of a prefix if its declaration has an empty value', () => {
  expect(
    getNamespaceURIs(
      namespaceParser.parseDocument('<aaa xmlns:bbb="xxx"><ccc xmlns:bbb=""><bbb:ddd/></ccc><bbb:eee/></aaa>')
    )
  ).toStrictEqual({ aaa: null, ccc: null, 'bbb:ddd': null, 'bbb:eee': 'xxx' });
});

test('does not recognize a namespace declared by an attribute that only starts with xmlns', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<bb:aaa xmlnsbbb="xxx"><ccc/></bb:aaa>'))).toStrictEqual({
    'bb:aaa': null,
    ccc: null,
  });
});

test('does not recognize a prefix declared by xmlns: without a name', () => {
  expect(getNamespaceURIs(namespaceParser.parseDocument('<:aaa xmlns:="xxx"></:aaa>'))).toStrictEqual({
    ':aaa': null,
  });
});

test('recognizes a namespace declared by a renamed attribute', () => {
  const parser = createDOMParser({ renameAttribute: name => name.toLowerCase(), areNamespacesRecognized: true });

  expect(getNamespaceURIs(parser.parseDocument('<aaa XMLNS="xxx"></aaa>'))).toStrictEqual({ aaa: 'xxx' });
});

test('recognizes a namespace declared by a decoded attribute value', () => {
  const parser = createDOMParser({ decodeAttribute: decodeXML, areNamespacesRecognized: true });

  expect(getNamespaceURIs(parser.parseDocument('<aaa xmlns="&lt;"></aaa>'))).toStrictEqual({ aaa: '<' });
});

test('resolves the namespace of a prefix in a renamed tag', () => {
  const parser = createDOMParser({ renameTag: name => name.toLowerCase(), areNamespacesRecognized: true });

  expect(getNamespaceURIs(parser.parseDocument('<AAA:bbb xmlns:aaa="xxx"></AAA:bbb>'))).toStrictEqual({
    'aaa:bbb': 'xxx',
  });
});

test('calls renameTag, renameAttribute and decodeAttribute with this undefined when namespaces are recognized', () => {
  const calls: unknown[][] = [];

  createDOMParser({
    renameTag(this: unknown, name: string) {
      calls.push(['tag', this]);
      return name;
    },
    renameAttribute(this: unknown, name: string) {
      calls.push(['name', this]);
      return name;
    },
    decodeAttribute(this: unknown, value: string) {
      calls.push(['value', this]);
      return value;
    },
    areNamespacesRecognized: true,
  }).parseFragment('<aaa bbb="ccc"></aaa>');

  expect(calls).toStrictEqual([
    ['tag', undefined],
    ['name', undefined],
    ['value', undefined],
  ]);
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
  expect(namespaceParser.parseDocument('<aaa xxx="yyy">bbb<ccc/>ddd<eee>fff</eee>ggg</aaa>')).toStrictEqual(
    h.document(h('aaa', { xxx: 'yyy' }, 'bbb', h('ccc'), 'ddd', h('eee', 'fff'), 'ggg'))
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

test('keeps attributes that were read in a previous chunk when namespaces are recognized', () => {
  const writer = namespaceParser.createDocumentWriter();

  writer.write('<aaa:bbb xmlns:aaa="xxx" ');

  const document = writer.end('ccc="ddd"></aaa:bbb>');

  expect(document.documentElement!.attributes).toStrictEqual({ 'xmlns:aaa': 'xxx', ccc: 'ddd' });
  expect(document.documentElement!.namespaceURI).toBe('xxx');
});

test('parses chunks written to several writers in turns', () => {
  const writer1 = namespaceParser.createDocumentWriter();
  const writer2 = namespaceParser.createDocumentWriter();

  writer1.write('<aaa xmlns="xxx">');
  writer2.write('<bbb>');

  expect(getNamespaceURIs(writer1.end('</aaa>'))).toStrictEqual({ aaa: 'xxx' });
  expect(getNamespaceURIs(writer2.end('</bbb>'))).toStrictEqual({ bbb: null });
});
