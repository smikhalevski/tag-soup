import { f } from 'flyweight-dom/dsl';
import { decodeXML } from 'speedy-entities';
import { expect, test } from 'vitest';
import { parseDOM } from '../main/createDOMParser.ts';
import { resolveParserOptions } from '../main/types.ts';

test('parses text', () => {
  expect(parseDOM('aaa')).toStrictEqual(f.doc('aaa'));
});

test('parses element', () => {
  expect(parseDOM('<aaa>bbb</aaa>')).toStrictEqual(f.doc(f.aaa('bbb')));
});

test('parses attributes', () => {
  expect(parseDOM('<aaa xxx="yyy" zzz="vvv">bbb</aaa>')).toEqual(f.doc(f.aaa({ xxx: 'yyy', zzz: 'vvv' }, 'bbb')));
});

test('parses nested elements', () => {
  expect(parseDOM('<aaa><bbb></bbb></aaa>')).toEqual(f.doc(f.aaa(f.bbb())));
});

test('parses self-closing tags elements', () => {
  expect(parseDOM('<aaa><bbb/></aaa>', resolveParserOptions({ areSelfClosingTagsRecognized: true }))).toEqual(
    f.doc(f.aaa(f.bbb()))
  );
});

test('parses comments', () => {
  expect(parseDOM('<!--xxx-->')).toEqual(f.doc(f.comment('xxx')));
});

test('does not decode comments', () => {
  expect(parseDOM('<!--&amp;-->', resolveParserOptions({ decodeText: decodeXML }))).toEqual(f.doc(f.comment('&amp;')));
});

test('does not decode text in raw text tags', () => {
  expect(
    parseDOM('<aaa>&lt;</aaa>', resolveParserOptions({ tags: { aaa: { kind: 'raw_text' } }, decodeText: decodeXML }))
  ).toEqual(f.doc(f.aaa('&lt;')));
});

test('decodes attribute values with decodeAttribute', () => {
  expect(parseDOM('<aaa bbb="&lt;">&lt;</aaa>', resolveParserOptions({ decodeAttribute: decodeXML }))).toEqual(
    f.doc(f.aaa({ bbb: '<' }, '&lt;'))
  );
});

test('normalizes newlines', () => {
  expect(parseDOM('<aaa bbb="\r\n">\r\n\r</aaa>', resolveParserOptions({ areNewlinesNormalized: true }))).toEqual(
    f.doc(f.aaa({ bbb: '\n' }, '\n\n'))
  );
});

test('removes NUL chars from decoded text', () => {
  expect(
    parseDOM(
      'aaa\0&\0amp;<bbb>\0</bbb>',
      resolveParserOptions({ decodeText: decodeXML, areNullCharactersReplaced: true })
    )
  ).toEqual(f.doc('aaa&amp;', f.bbb()));
});

test('replaces NUL chars outside of text', () => {
  expect(
    parseDOM(
      '<!DOCTYPE aaa\0><?bbb\0 \0?><![CDATA[\0]]><ccc\0 ddd\0="\0"><!--\0--><eee>\0</eee>\0<fff>\0</fff>\0<ggg>\0</ggg>\0</ccc\0>',
      resolveParserOptions({
        tags: { eee: { kind: 'raw_text' }, fff: { kind: 'escapable_raw_text' } },
        foreignTags: { ggg: {} },
        areCDATASectionsRecognized: true,
        areProcessingInstructionsRecognized: true,
        areNullCharactersReplaced: true,
      })
    )
  ).toEqual(
    f.doc(
      f.doctype('aaa\uFFFD'),
      f.pi('bbb\uFFFD', '\uFFFD'),
      f.cdata('\uFFFD'),
      f['ccc\uFFFD']({ 'ddd\uFFFD': '\uFFFD' }, f.comment('\uFFFD'), f.eee('\uFFFD'), f.fff('\uFFFD'), f.ggg('\uFFFD'))
    )
  );
});

test('parses comments in elements', () => {
  expect(parseDOM('<aaa><!--xxx--></aaa>')).toEqual(f.doc(f.aaa(f.comment('xxx'))));
});

test('parses processing instructions in elements', () => {
  expect(
    parseDOM('<aaa><?xxx yyy?></aaa>', resolveParserOptions({ areProcessingInstructionsRecognized: true }))
  ).toEqual(f.doc(f.aaa(f.pi('xxx', 'yyy'))));
});

test('parses DOCTYPE, processing instruction and text', () => {
  expect(
    parseDOM(
      '   <!DOCTYPE html>  <?xxx yyy?>  vvv',
      resolveParserOptions({ areProcessingInstructionsRecognized: true })
    )
  ).toEqual(f.doc(f.doctype('html'), f.pi('xxx', 'yyy'), 'vvv'));
});

test('parses DOCTYPE, text and quirky comment', () => {
  expect(parseDOM('   <!DOCTYPE html>   vvv   <?xxx yyy?>')).toEqual(
    f.doc(f.doctype('html'), 'vvv   ', f.comment('?xxx yyy?'))
  );
});

test('parses quirky comment, DOCTYPE and text', () => {
  expect(parseDOM('   <?xxx yyy?>   <!DOCTYPE html>   vvv   ')).toEqual(
    f.doc(f.comment('?xxx yyy?'), f.doctype('html'), 'vvv   ')
  );
});
