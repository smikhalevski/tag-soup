import { f } from 'flyweight-dom/dsl';
import { expect, test } from 'vitest';
import { HTMLDOMParser, toHTML } from '../main/html.ts';

test('parses HTML DOM', () => {
  expect(HTMLDOMParser.parseFragment('<p>aaa<p>bbb</br>')).toStrictEqual(f.f(f.p('aaa'), f.p('bbb', f.br())));
});

test('serializes HTML', () => {
  expect(toHTML(HTMLDOMParser.parseDocument('<!DOCTYPEhtml><p>aaa&gt;&lt;<p>bbb</BR>'))).toBe(
    '<!DOCTYPE html><p>aaa&gt;&lt;</p><p>bbb<BR></p>'
  );
});

test('decodes attribute values differently from text', () => {
  expect(HTMLDOMParser.parseFragment('<a href="?aaa=111&amp;bbb=222&copy=333">&copy=333</a>')).toStrictEqual(
    f.f(f.a({ href: '?aaa=111&bbb=222&copy=333' }, '©=333'))
  );
});

test('parses unquoted attribute values with slashes', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<a href=http://aaa/bbb>ccc</a>'))).toBe(
    '<a href="http://aaa/bbb">ccc</a>'
  );
});

test('closes list items inside the nearest list', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<ul><li>aaa<ul><li>bbb</ul></ul>'))).toBe(
    '<ul><li>aaa<ul><li>bbb</li></ul></li></ul>'
  );
});

test('closes table cells inside the table section', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<table><thead><tr><td>aaa<td>bbb</table>'))).toBe(
    '<table><thead><tr><td>aaa</td><td>bbb</td></tr></thead></table>'
  );
});

test('closes the table section when the next one starts', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<table><thead><tr><th>aaa<tbody><tr><td>bbb</table>'))).toBe(
    '<table><thead><tr><th>aaa</th></tr></thead><tbody><tr><td>bbb</td></tr></tbody></table>'
  );
});

test('round-trips raw text and escapable raw text', () => {
  const html = '<script>aaa<bbb&lt;</script><textarea>aaa&lt;bbb</textarea>';

  expect(toHTML(HTMLDOMParser.parseFragment(html))).toBe(html);
});

test('parses tags after foreignObject', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg><foreignObject></foreignObject></svg><p/>aaa'))).toBe(
    '<svg><foreignObject></foreignObject></svg><p>aaa</p>'
  );
});

test('parses tags after self-closing svg', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg/><p/>aaa'))).toBe('<svg></svg><p>aaa</p>');
});

test('parses foreign tags', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<body><div><svg><path/><foreignObject><em></div><i></body>'))).toBe(
    '<body><div><svg><path></path><foreignObject><em></em></foreignObject></svg></div><i></i></body>'
  );
});
