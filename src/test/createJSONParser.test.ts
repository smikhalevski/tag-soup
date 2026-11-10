import { decodeXML } from 'speedy-entities';
import { describe, expect, test } from 'vitest';
import { createJSONParser } from '../main/createJSONParser.ts';
import { MarkupSyntaxError } from '../main/MarkupSyntaxError.ts';

describe('createJSONParser', () => {
  test('parses attributes and text', () => {
    expect(createJSONParser().parseDocument('<aaa xxx="yyy" zzz="vvv">bbb</aaa>')).toEqual({
      aaa: { $xxx: 'yyy', $zzz: 'vvv', $: ['bbb'] },
    });
  });

  test('parses child elements and text in document order', () => {
    expect(createJSONParser().parseDocument('<aaa>bbb<ccc></ccc>ddd<eee></eee><ccc></ccc></aaa>')).toEqual({
      aaa: { $: ['bbb', { ccc: { $: [] } }, 'ddd', { eee: { $: [] } }, { ccc: { $: [] } }] },
    });
  });

  test('adds the content key after attribute keys', () => {
    expect(JSON.stringify(createJSONParser().parseDocument('<aaa xxx="yyy" zzz="vvv">bbb</aaa>'))).toBe(
      '{"aaa":{"$xxx":"yyy","$zzz":"vvv","$":["bbb"]}}'
    );
  });

  test('parses self-closing tags', () => {
    expect(createJSONParser({ areSelfClosingTagsRecognized: true }).parseDocument('<aaa><bbb/>ccc</aaa>')).toEqual({
      aaa: { $: [{ bbb: { $: [] } }, 'ccc'] },
    });
  });

  test('joins text that is split by comments, CDATA sections and processing instructions', () => {
    const parser = createJSONParser({ areCDATASectionsRecognized: true, areProcessingInstructionsRecognized: true });

    expect(parser.parseDocument('<aaa>bbb<!--xxx-->ccc<![CDATA[<ddd>]]><?yyy zzz?>eee</aaa>')).toEqual({
      aaa: { $: ['bbbccc<ddd>eee'] },
    });
  });

  test('decodes text and attribute values', () => {
    const parser = createJSONParser({ decodeText: () => 'xxx', decodeAttribute: () => 'yyy' });

    expect(parser.parseDocument('<aaa bbb="ccc">ddd</aaa>')).toEqual({ aaa: { $bbb: 'yyy', $: ['xxx'] } });
  });

  test('does not decode text in raw text tags and CDATA sections', () => {
    const parser = createJSONParser({
      tags: { aaa: { kind: 'raw_text' } },
      areCDATASectionsRecognized: true,
      decodeText: decodeXML,
    });

    expect(parser.parseFragment('<aaa>&lt;</aaa>&lt;<bbb><![CDATA[&lt;]]></bbb>')).toEqual({
      $: [{ aaa: { $: ['&lt;'] } }, '<', { bbb: { $: ['&lt;'] } }],
    });
  });

  test('ignores text outside of the root element', () => {
    expect(createJSONParser().parseDocument('aaa<!--xxx--><bbb></bbb>ccc')).toEqual({ bbb: { $: [] } });
  });

  test('throws if a document has no root element', () => {
    expect(() => createJSONParser().parseDocument('aaa')).toThrow(
      new MarkupSyntaxError('Expected a root element.', 'aaa', 3)
    );
  });

  test('throws if a document has several root elements', () => {
    expect(() => createJSONParser().parseDocument('<aaa></aaa><bbb></bbb>')).toThrow(
      new MarkupSyntaxError('Expected a single root element.', '<aaa></aaa><bbb></bbb>', 15, 16)
    );
  });

  test('parses a fragment as the content of an element', () => {
    expect(createJSONParser().parseFragment('aaa<bbb></bbb><ccc></ccc>')).toEqual({
      $: ['aaa', { bbb: { $: [] } }, { ccc: { $: [] } }],
    });
  });

  test('converts case-insensitive tag names to lower case', () => {
    expect(createJSONParser({ areTagNamesCaseInsensitive: true }).parseDocument('<AAA Xxx="yyy"></aaa>')).toEqual({
      aaa: { $Xxx: 'yyy', $: [] },
    });
  });

  test('parses tags whose names have the same hash code', () => {
    // "aQ" and "b0" have the same hash code
    expect(createJSONParser().parseFragment('<aQ></aQ><b0></b0><aQ></aQ>')).toEqual({
      $: [{ aQ: { $: [] } }, { b0: { $: [] } }, { aQ: { $: [] } }],
    });
  });

  test('parses a tag whose attributes differ from attributes of the preceding tag with the same name', () => {
    expect(createJSONParser().parseFragment('<aaa xxx="111" yyy="222"></aaa><aaa yyy="333"></aaa>')).toEqual({
      $: [{ aaa: { $xxx: '111', $yyy: '222', $: [] } }, { aaa: { $yyy: '333', $: [] } }],
    });
  });

  test('uses the value of the last attribute with the same name', () => {
    expect(createJSONParser().parseDocument('<aaa xxx="111" xxx="222"></aaa>')).toEqual({
      aaa: { $xxx: '222', $: [] },
    });
  });

  test('throws if a strict parser reads attributes with the same name', () => {
    expect(() => createJSONParser({ isStrict: true }).parseDocument('<aaa xxx="111" xxx="222"></aaa>')).toThrow(
      new MarkupSyntaxError(
        "Expected the attribute key '$xxx' to be unique.",
        '<aaa xxx="111" xxx="222"></aaa>',
        24,
        25
      )
    );
  });

  test('preserves __proto__ elements', () => {
    const parser = createJSONParser({ layout: 'grouped', emptyContent: 'omit' });

    expect(JSON.stringify(parser.parseDocument('<aaa><__proto__>bbb</__proto__>ccc</aaa>'))).toBe(
      '{"aaa":{"$":"ccc","__proto__":[{"$":"bbb"}]}}'
    );
  });

  test('does not read inherited properties as child elements', () => {
    expect(createJSONParser({ layout: 'grouped' }).parseDocument('<aaa><toString></toString></aaa>')).toEqual({
      aaa: { $: '', toString: [{ $: '' }] },
    });
  });

  test('parses chunks', () => {
    const writer = createJSONParser().createDocumentWriter();

    writer.write('<aaa xxx="yy');
    writer.write('y" zzz="vvv');
    writer.write('">bb');

    expect(writer.end('b</aaa>')).toEqual({ aaa: { $xxx: 'yyy', $zzz: 'vvv', $: ['bbb'] } });
  });

  test('throws an error with the stream offset if chunks have no root element', () => {
    const writer = createJSONParser().createDocumentWriter();

    writer.write('aaa');

    expect(() => writer.end('bbb')).toThrow(new MarkupSyntaxError('Expected a root element.', 'bbb', 3, 3, 3));
  });

  test('groups child elements by name', () => {
    const parser = createJSONParser({ layout: 'grouped' });

    expect(
      JSON.stringify(parser.parseDocument('<aaa xxx="yyy">bbb<ccc></ccc>ddd<eee>fff</eee><ccc></ccc></aaa>'))
    ).toBe('{"aaa":{"$xxx":"yyy","$":"bbbddd","ccc":[{"$":""},{"$":""}],"eee":[{"$":"fff"}]}}');
  });

  test('groups child elements of each parent separately', () => {
    const parser = createJSONParser({ layout: 'grouped' });

    expect(parser.parseDocument('<aaa><bbb><ccc></ccc></bbb><bbb><ccc></ccc></bbb></aaa>')).toEqual({
      aaa: {
        $: '',
        bbb: [
          { $: '', ccc: [{ $: '' }] },
          { $: '', ccc: [{ $: '' }] },
        ],
      },
    });
  });

  test('groups child elements of a fragment', () => {
    expect(JSON.stringify(createJSONParser({ layout: 'grouped' }).parseFragment('<aaa></aaa>bbb'))).toBe(
      '{"$":"bbb","aaa":[{"$":""}]}'
    );
  });

  test('throws if layout is invalid', () => {
    // @ts-expect-error Invalid layout
    expect(() => createJSONParser({ layout: 'xxx' })).toThrow("layout must be 'ordered' or 'grouped'");
  });

  test('preserves whitespace by default', () => {
    expect(createJSONParser().parseDocument('<aaa> <bbb> ccc </bbb> </aaa>')).toEqual({
      aaa: { $: [' ', { bbb: { $: [' ccc '] } }, ' '] },
    });
  });

  test('drops blank text', () => {
    const parser = createJSONParser({ whitespace: 'drop_blank' });

    expect(parser.parseDocument('<aaa> <bbb> ccc </bbb> <!--xxx--> </aaa>')).toEqual({
      aaa: { $: [{ bbb: { $: [' ccc '] } }] },
    });
  });

  test('drops blank text in the grouped layout', () => {
    const parser = createJSONParser({ whitespace: 'drop_blank', layout: 'grouped' });

    expect(parser.parseDocument('<aaa> <bbb> ccc </bbb> </aaa>')).toEqual({ aaa: { $: '', bbb: [{ $: ' ccc ' }] } });
  });

  test('trims text', () => {
    expect(createJSONParser({ whitespace: 'trim' }).parseDocument('<aaa> <bbb> ccc </bbb> </aaa>')).toEqual({
      aaa: { $: [{ bbb: { $: ['ccc'] } }] },
    });
  });

  test('trims text after it is joined', () => {
    const parser = createJSONParser({ whitespace: 'trim', layout: 'grouped' });

    expect(parser.parseDocument('<aaa> bbb<ccc></ccc> <ccc></ccc>ddd </aaa>')).toEqual({
      aaa: { $: 'bbb ddd', ccc: [{ $: '' }, { $: '' }] },
    });
  });

  test('trims decoded text', () => {
    const parser = createJSONParser({ whitespace: 'trim', decodeText: decodeXML });

    expect(parser.parseDocument('<aaa>&#32;bbb&#32;</aaa>')).toEqual({ aaa: { $: ['bbb'] } });
  });

  test('does not trim chars that are not XML whitespace', () => {
    expect(createJSONParser({ whitespace: 'trim' }).parseDocument('<aaa> \u00a0bbb\u00a0 </aaa>')).toEqual({
      aaa: { $: ['\u00a0bbb\u00a0'] },
    });
  });

  test('does not change attribute values', () => {
    expect(createJSONParser({ whitespace: 'trim' }).parseDocument('<aaa xxx=" yyy "></aaa>')).toEqual({
      aaa: { $xxx: ' yyy ', $: [] },
    });
  });

  test('preserves whitespace in elements with xml:space="preserve" and their descendants', () => {
    const parser = createJSONParser({ whitespace: 'trim' });

    expect(
      parser.parseDocument('<aaa xml:space="preserve"> <bbb> </bbb><ccc xml:space="default"> </ccc></aaa>')
    ).toEqual({
      aaa: {
        '$xml:space': 'preserve',
        $: [' ', { bbb: { $: [' '] } }, { ccc: { '$xml:space': 'default', $: [] } }],
      },
    });
  });

  test('throws if whitespace is invalid', () => {
    // @ts-expect-error Invalid whitespace
    expect(() => createJSONParser({ whitespace: 'xxx' })).toThrow(
      "whitespace must be 'preserve', 'drop_blank' or 'trim'"
    );
  });

  test('omits empty content', () => {
    expect(createJSONParser({ emptyContent: 'omit' }).parseDocument('<aaa><bbb></bbb></aaa>')).toEqual({
      aaa: { $: [{ bbb: {} }] },
    });
  });

  test('omits empty content in the grouped layout', () => {
    const parser = createJSONParser({ emptyContent: 'omit', layout: 'grouped' });

    expect(parser.parseDocument('<aaa><bbb>ccc</bbb><bbb></bbb></aaa>')).toEqual({
      aaa: { bbb: [{ $: 'ccc' }, {}] },
    });
  });

  test('adds the content key before keys of child elements if text follows them', () => {
    const parser = createJSONParser({ emptyContent: 'omit', layout: 'grouped' });

    expect(JSON.stringify(parser.parseDocument('<aaa xxx="yyy"><bbb></bbb>ccc</aaa>'))).toBe(
      '{"aaa":{"$xxx":"yyy","$":"ccc","bbb":[{}]}}'
    );
  });

  test('omits empty content of a fragment', () => {
    expect(createJSONParser({ emptyContent: 'omit' }).parseFragment('')).toEqual({});
  });

  test('throws if emptyContent is invalid', () => {
    // @ts-expect-error Invalid emptyContent
    expect(() => createJSONParser({ emptyContent: 'xxx' })).toThrow("emptyContent must be 'keep' or 'omit'");
  });

  test('unwraps the root element', () => {
    expect(createJSONParser({ root: 'unwrap' }).parseDocument('<aaa xxx="yyy"></aaa>')).toEqual({
      $xxx: 'yyy',
      $: [],
    });
  });

  test('does not unwrap a fragment', () => {
    expect(createJSONParser({ root: 'unwrap' }).parseFragment('<aaa></aaa>')).toEqual({ $: [{ aaa: { $: [] } }] });
  });

  test('throws if root is invalid', () => {
    // @ts-expect-error Invalid root
    expect(() => createJSONParser({ root: 'xxx' })).toThrow("root must be 'wrap' or 'unwrap'");
  });

  test('resolves names of elements and attributes', () => {
    const parser = createJSONParser({ namespaces: { qqq: 'http://xxx' } });

    expect(
      parser.parseDocument(
        '<aaa xmlns:ppp="http://xxx" xmlns:rrr="http://xxx"><ppp:bbb ppp:ccc="111" ccc="222"></ppp:bbb><rrr:bbb></rrr:bbb></aaa>'
      )
    ).toEqual({
      aaa: { $: [{ qqq$bbb: { $qqq$ccc: '111', $ccc: '222', $: [] } }, { qqq$bbb: { $: [] } }] },
    });
  });

  test('resolves names in the default namespace', () => {
    const parser = createJSONParser({ namespaces: { qqq: 'http://xxx' } });

    expect(parser.parseDocument('<aaa xmlns="http://xxx" bbb="ccc"><ddd xmlns=""></ddd></aaa>')).toEqual({
      qqq$aaa: { $bbb: 'ccc', $: [{ ddd: { $: [] } }] },
    });
  });

  test('resolves names in the namespace that is mapped to an empty prefix', () => {
    const parser = createJSONParser({ namespaces: { '': 'http://xxx' } });

    expect(parser.parseDocument('<ppp:aaa xmlns:ppp="http://xxx" ppp:bbb="ccc"></ppp:aaa>')).toEqual({
      aaa: { $bbb: 'ccc', $: [] },
    });
  });

  test('resolves a name with the namespace declaration that follows it in the tag', () => {
    const parser = createJSONParser({ namespaces: { qqq: 'http://xxx' } });

    expect(parser.parseDocument('<ppp:aaa ppp:bbb="ccc" xmlns:ppp="http://xxx"></ppp:aaa>')).toEqual({
      qqq$aaa: { $qqq$bbb: 'ccc', $: [] },
    });
  });

  test('resolves names with namespace declarations that are in scope', () => {
    const parser = createJSONParser({ namespaces: { qqq: 'http://xxx', sss: 'http://yyy' } });

    expect(
      parser.parseDocument(
        '<aaa xmlns:ppp="http://xxx"><ppp:bbb xmlns:ppp="http://yyy"></ppp:bbb><ppp:bbb></ppp:bbb></aaa>'
      )
    ).toEqual({
      aaa: { $: [{ sss$bbb: { $: [] } }, { qqq$bbb: { $: [] } }] },
    });
  });

  test('resolves the xml prefix', () => {
    expect(createJSONParser({ namespaces: {} }).parseDocument('<aaa xml:lang="bbb"></aaa>')).toEqual({
      aaa: { $xml$lang: 'bbb', $: [] },
    });
  });

  test('does not resolve names inside text elements', () => {
    const parser = createJSONParser({ namespaces: {}, textElements: ['aaa'] });

    expect(parser.parseDocument('<aaa ppp:bbb="ccc">ddd<ppp:eee>fff</ppp:eee></aaa>')).toEqual({ aaa: 'dddfff' });
  });

  test('throws if a namespace is not mapped', () => {
    expect(() => createJSONParser({ namespaces: {} }).parseDocument('<aaa xmlns="http://xxx"></aaa>')).toThrow(
      new MarkupSyntaxError("The namespace 'http://xxx' is not mapped.", '<aaa xmlns="http://xxx"></aaa>', 23, 24)
    );
  });

  test('throws if a namespace prefix is not declared', () => {
    expect(() => createJSONParser({ namespaces: {} }).parseDocument('<aaa ppp:xxx="yyy"></aaa>')).toThrow(
      new MarkupSyntaxError("The namespace prefix 'ppp' is not declared.", '<aaa ppp:xxx="yyy"></aaa>', 18, 19)
    );
  });

  test('throws if a tag name is not a qualified name', () => {
    expect(() => createJSONParser({ namespaces: {} }).parseDocument('<aaa:bbb:ccc></aaa:bbb:ccc>')).toThrow(
      new MarkupSyntaxError('Expected a qualified name.', '<aaa:bbb:ccc></aaa:bbb:ccc>', 1, 12)
    );
  });

  test('throws if an attribute name is not a qualified name', () => {
    expect(() => createJSONParser({ namespaces: {} }).parseDocument('<aaa xmlns:="http://xxx"></aaa>')).toThrow(
      new MarkupSyntaxError('Expected a qualified name.', '<aaa xmlns:="http://xxx"></aaa>', 24, 25)
    );
  });

  test('throws if attributes from different namespaces have the same key', () => {
    const parser = createJSONParser({ namespaces: { '': 'http://xxx' } });

    expect(() => parser.parseDocument('<aaa xmlns:ppp="http://xxx" ppp:xxx="yyy" xxx="zzz"></aaa>')).toThrow(
      new MarkupSyntaxError(
        "Expected the attribute key '$xxx' to be unique.",
        '<aaa xmlns:ppp="http://xxx" ppp:xxx="yyy" xxx="zzz"></aaa>',
        51,
        52
      )
    );
  });

  test('throws if child elements from different namespaces have the same name', () => {
    const parser = createJSONParser({ namespaces: { '': 'http://xxx' } });

    // The nested element has the same name as its parent, but it isn't a sibling of the last element
    expect(() =>
      parser.parseDocument('<aaa xmlns:ppp="http://xxx"><bbb><bbb></bbb></bbb><ppp:bbb></ppp:bbb></aaa>')
    ).toThrow(
      new MarkupSyntaxError(
        "Expected child elements 'bbb' to be in the same namespace.",
        '<aaa xmlns:ppp="http://xxx"><bbb><bbb></bbb></bbb><ppp:bbb></ppp:bbb></aaa>',
        58,
        59
      )
    );
  });

  test('parses elements from different namespaces that have the same name but different parents', () => {
    const parser = createJSONParser({ namespaces: { '': 'http://xxx' } });

    expect(parser.parseDocument('<aaa xmlns:ppp="http://xxx"><bbb><ppp:bbb></ppp:bbb></bbb></aaa>')).toEqual({
      aaa: { $: [{ bbb: { $: [{ bbb: { $: [] } }] } }] },
    });
  });

  test('throws if a namespace prefix is invalid', () => {
    expect(() => createJSONParser({ namespaces: { 'ppp:qqq': 'http://xxx' } })).toThrow(
      "namespaces prefixes must be XML names without colons, or ''"
    );
  });

  test('throws if a namespace URI is mapped to several prefixes', () => {
    expect(() => createJSONParser({ namespaces: { ppp: 'http://xxx', qqq: 'http://xxx' } })).toThrow(
      'namespaces must not map a namespace URI to several prefixes'
    );
  });

  test('throws if the xml prefix is mapped to a different namespace URI', () => {
    expect(() => createJSONParser({ namespaces: { xml: 'http://xxx' } })).toThrow(
      'namespaces.xml must be http://www.w3.org/XML/1998/namespace'
    );
  });

  test('converts text elements to their text', () => {
    const parser = createJSONParser({
      textElements: ['bbb'],
      whitespace: 'trim',
      areSelfClosingTagsRecognized: true,
    });

    expect(
      parser.parseDocument('<aaa><bbb xxx="yyy"> ccc <ddd zzz="vvv"> eee </ddd><fff/> ggg </bbb><hhh/></aaa>')
    ).toEqual({
      aaa: { $: [{ bbb: 'ccc  eee  ggg' }, { hhh: { $: [] } }] },
    });
  });

  test('converts text elements that have the parent from an entry', () => {
    const parser = createJSONParser({ textElements: ['ccc/bbb'] });

    expect(parser.parseDocument('<aaa><bbb></bbb><ccc><bbb></bbb></ccc></aaa>')).toEqual({
      aaa: { $: [{ bbb: { $: [] } }, { ccc: { $: [{ bbb: '' }] } }] },
    });
  });

  test('does not convert top-level elements of a fragment if an entry has a parent', () => {
    expect(createJSONParser({ textElements: ['aaa/bbb'] }).parseFragment('<bbb></bbb>')).toEqual({
      $: [{ bbb: { $: [] } }],
    });
  });

  test('throws if an entry of a name list is invalid', () => {
    expect(() => createJSONParser({ textElements: ['aaa/bbb/ccc'] })).toThrow(
      "textElements entries must be like 'name' or 'parent/name'"
    );
  });

  test('stores single elements without arrays in the grouped layout', () => {
    const parser = createJSONParser({ singleElements: ['bbb'], layout: 'grouped' });

    expect(parser.parseDocument('<aaa><bbb>ccc</bbb><ddd></ddd></aaa>')).toEqual({
      aaa: { $: '', bbb: { $: 'ccc' }, ddd: [{ $: '' }] },
    });
  });

  test('adds the content key before keys of single elements if text follows them', () => {
    const parser = createJSONParser({ singleElements: ['bbb'], layout: 'grouped', emptyContent: 'omit' });

    expect(JSON.stringify(parser.parseDocument('<aaa><bbb></bbb>ccc</aaa>'))).toBe('{"aaa":{"$":"ccc","bbb":{}}}');
  });

  test('does not change single elements in the ordered layout', () => {
    expect(createJSONParser({ singleElements: ['bbb'] }).parseDocument('<aaa><bbb></bbb><bbb></bbb></aaa>')).toEqual({
      aaa: { $: [{ bbb: { $: [] } }, { bbb: { $: [] } }] },
    });
  });

  test('throws if a single element occurs twice in its parent', () => {
    const parser = createJSONParser({ singleElements: ['bbb'], layout: 'grouped' });

    expect(() => parser.parseDocument('<aaa><bbb></bbb><bbb></bbb></aaa>')).toThrow(
      new MarkupSyntaxError(
        "Expected the element 'bbb' to occur at most once in its parent.",
        '<aaa><bbb></bbb><bbb></bbb></aaa>',
        20,
        21
      )
    );
  });

  test('converts list elements to arrays of values of their children', () => {
    const parser = createJSONParser({ listElements: ['bbb'], textElements: ['ccc'] });

    expect(parser.parseDocument('<aaa><bbb> <ccc>111</ccc> <ccc>222</ccc> </bbb><bbb></bbb></aaa>')).toEqual({
      aaa: { $: [{ bbb: ['111', '222'] }, { bbb: [] }] },
    });
  });

  test('stores list elements without arrays in the grouped layout', () => {
    const parser = createJSONParser({ listElements: ['bbb'], layout: 'grouped' });

    expect(parser.parseDocument('<aaa><bbb><ccc></ccc></bbb></aaa>')).toEqual({ aaa: { $: '', bbb: [{ $: '' }] } });
  });

  test('ignores namespace declarations of list elements', () => {
    const parser = createJSONParser({ listElements: ['aaa'] });

    expect(parser.parseDocument('<aaa xmlns:ppp="http://xxx"></aaa>')).toEqual({ aaa: [] });
  });

  test('throws if a list element has attributes', () => {
    expect(() => createJSONParser({ listElements: ['aaa'] }).parseDocument('<aaa xxx="yyy"></aaa>')).toThrow(
      new MarkupSyntaxError("Expected the list element 'aaa' to have no attributes.", '<aaa xxx="yyy"></aaa>', 14, 15)
    );
  });

  test('throws if a list element has text', () => {
    expect(() => createJSONParser({ listElements: ['aaa'] }).parseDocument('<aaa>bbb</aaa>')).toThrow(
      new MarkupSyntaxError("Expected the list element 'aaa' to have no text.", '<aaa>bbb</aaa>', 5, 8)
    );
  });

  test('throws if children of a list element have different names', () => {
    const parser = createJSONParser({ listElements: ['aaa'] });

    expect(() => parser.parseDocument('<aaa><bbb></bbb><ccc></ccc></aaa>')).toThrow(
      new MarkupSyntaxError(
        "Expected child elements of the list element 'aaa' to have the same name.",
        '<aaa><bbb></bbb><ccc></ccc></aaa>',
        20,
        21
      )
    );
  });

  test('throws if a list element occurs twice in its parent in the grouped layout', () => {
    const parser = createJSONParser({ listElements: ['bbb'], layout: 'grouped' });

    expect(() => parser.parseDocument('<aaa><bbb></bbb><bbb></bbb></aaa>')).toThrow(
      new MarkupSyntaxError(
        "Expected the element 'bbb' to occur at most once in its parent.",
        '<aaa><bbb></bbb><bbb></bbb></aaa>',
        20,
        21
      )
    );
  });

  test('throws if a list element is a text element', () => {
    const parser = createJSONParser({ listElements: ['aaa'], textElements: ['aaa'] });

    expect(() => parser.parseDocument('<aaa></aaa>')).toThrow(
      new MarkupSyntaxError("The element 'aaa' is both in textElements and in listElements.", '<aaa></aaa>', 4, 5)
    );
  });
});
