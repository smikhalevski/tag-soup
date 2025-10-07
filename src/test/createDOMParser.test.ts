import { expect, test } from 'vitest';
import { parseDOM } from '../main/createDOMParser.js';
import { f } from 'flyweight-dom/dsl';

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
  expect(parseDOM('<aaa><bbb/></aaa>', { isSelfClosingTagsRecognized: true })).toEqual(f.doc(f.aaa(f.bbb())));
});

test('parses comments', () => {
  expect(parseDOM('<!--xxx-->')).toEqual(f.doc(f.comment('xxx')));
});

test('parses comments in elements', () => {
  expect(parseDOM('<aaa><!--xxx--></aaa>')).toEqual(f.doc(f.aaa(f.comment('xxx'))));
});

test('parses processing instructions in elements', () => {
  expect(parseDOM('<aaa><?xxx yyy?></aaa>', { isProcessingInstructionRecognized: true })).toEqual(
    f.doc(f.aaa(f.pi('xxx', 'yyy')))
  );
});

test('parses DOCTYPE, processing instruction and text', () => {
  expect(parseDOM('   <!DOCTYPE html>  <?xxx yyy?>  vvv', { isProcessingInstructionRecognized: true })).toEqual(
    f.doc(f.doctype('html'), f.pi('xxx', 'yyy'), 'vvv')
  );
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
