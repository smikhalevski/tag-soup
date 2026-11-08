import { f } from 'flyweight-dom/dsl';
import { decodeXML } from 'speedy-entities';
import { expect, test } from 'vitest';
import { createDOMParser, createDOMParserWriter } from '../main/createDOMParser.ts';
import { resolveParserOptions } from '../main/types.ts';

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
  expect(createDOMParser({ areSelfClosingTagsRecognized: true }).parseDocument('<aaa><bbb/></aaa>')).toEqual(
    f.doc(f.aaa(f.bbb()))
  );
});

test('parses comments', () => {
  expect(createDOMParser().parseDocument('<!--xxx-->')).toEqual(f.doc(f.comment('xxx')));
});

test('does not decode comments', () => {
  expect(createDOMParser({ decodeText: decodeXML }).parseDocument('<!--&amp;-->')).toEqual(f.doc(f.comment('&amp;')));
});

test('does not decode text in raw text tags', () => {
  expect(
    createDOMParser({ tags: { aaa: { kind: 'raw_text' } }, decodeText: decodeXML }).parseDocument('<aaa>&lt;</aaa>')
  ).toEqual(f.doc(f.aaa('&lt;')));
});

test('decodes attribute values with decodeAttribute', () => {
  expect(createDOMParser({ decodeAttribute: decodeXML }).parseDocument('<aaa bbb="&lt;">&lt;</aaa>')).toEqual(
    f.doc(f.aaa({ bbb: '<' }, '&lt;'))
  );
});

test('parses comments in elements', () => {
  expect(createDOMParser().parseDocument('<aaa><!--xxx--></aaa>')).toEqual(f.doc(f.aaa(f.comment('xxx'))));
});

test('parses processing instructions in elements', () => {
  expect(
    createDOMParser({ areProcessingInstructionsRecognized: true }).parseDocument('<aaa><?xxx yyy?></aaa>')
  ).toEqual(f.doc(f.aaa(f.pi('xxx', 'yyy'))));
});

test('parses DOCTYPE, processing instruction and text', () => {
  expect(
    createDOMParser({ areProcessingInstructionsRecognized: true }).parseDocument('   <!DOCTYPE html>  <?xxx yyy?>  vvv')
  ).toEqual(f.doc(f.doctype('html'), f.pi('xxx', 'yyy'), 'vvv'));
});

test('parses DOCTYPE, text and quirky comment', () => {
  expect(createDOMParser().parseDocument('   <!DOCTYPE html>   vvv   <?xxx yyy?>')).toEqual(
    f.doc(f.doctype('html'), 'vvv   ', f.comment('?xxx yyy?'))
  );
});

test('parses quirky comment, DOCTYPE and text', () => {
  expect(createDOMParser().parseDocument('   <?xxx yyy?>   <!DOCTYPE html>   vvv   ')).toEqual(
    f.doc(f.comment('?xxx yyy?'), f.doctype('html'), 'vvv   ')
  );
});

test('parses chunks', () => {
  const writer = createDOMParserWriter(resolveParserOptions({}));

  writer.write('<aaa>bb');
  writer.write('b</a');

  expect(writer.end('aa>')).toEqual(f.doc(f.aaa('bbb')));
});
