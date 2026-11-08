import { f } from 'flyweight-dom/dsl';
import { decodeXML } from 'speedy-entities';
import { expect, test } from 'vitest';
import { createDOMParserWriter, parseDOM } from '../main/createDOMParser.ts';
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

test('parses chunks', () => {
  const writer = createDOMParserWriter(resolveParserOptions({}));

  writer.write('<aaa>bb');
  writer.write('b</a');

  expect(writer.end('aa>')).toEqual(f.doc(f.aaa('bbb')));
});
