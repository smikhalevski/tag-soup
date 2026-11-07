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

test('normalizes newlines and NUL chars', () => {
  expect(
    HTMLDOMParser.parseFragment('<p aaa="\r\n">\0bbb\r\n</p><svg>\0<foreignObject>\0</foreignObject></svg>')
  ).toStrictEqual(f.f(f.p({ aaa: '\n' }, 'bbb\n'), f.svg('\uFFFD', f.foreignObject())));
});

test('parses unquoted attribute values with slashes', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<a href=http://aaa/bbb>ccc</a>'))).toBe(
    '<a href="http://aaa/bbb">ccc</a>'
  );
});

test('ends list items inside the nearest list', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<ul><li>aaa<ul><li>bbb</ul></ul>'))).toBe(
    '<ul><li>aaa<ul><li>bbb</li></ul></li></ul>'
  );
});

test('ends table cells inside the table section', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<table><thead><tr><td>aaa<td>bbb</table>'))).toBe(
    '<table><thead><tr><td>aaa</td><td>bbb</td></tr></thead></table>'
  );
});

test('ends the table section when the next one starts', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<table><thead><tr><th>aaa<tbody><tr><td>bbb</table>'))).toBe(
    '<table><thead><tr><th>aaa</th></tr></thead><tbody><tr><td>bbb</td></tr></tbody></table>'
  );
});

test('ends a paragraph with list items and blocks', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<p>aaa<li>bbb<p>ccc<center>ddd'))).toBe(
    '<p>aaa</p><li>bbb<p>ccc</p><center>ddd</center></li>'
  );
});

test('ends ruby annotations', () => {
  expect(
    toHTML(HTMLDOMParser.parseFragment('<ruby><rb>aaa<rt>bbb<rp>ccc<rb>ddd<rtc>eee<rp>fff<rtc>ggg<rb>hhh</ruby>'))
  ).toBe(
    '<ruby><rb>aaa</rb><rt>bbb</rt><rp>ccc</rp><rb>ddd</rb><rtc>eee<rp>fff</rp></rtc><rtc>ggg</rtc><rb>hhh</rb></ruby>'
  );
});

test('parses bgsound as a void tag', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<bgsound>aaa'))).toBe('<bgsound>aaa');
});

test('parses xmp as raw text that ends a paragraph', () => {
  expect(HTMLDOMParser.parseFragment('<p>aaa<xmp><p>&amp;</xmp>')).toStrictEqual(f.f(f.p('aaa'), f.xmp('<p>&amp;')));
});

test('parses title as escapable raw text', () => {
  expect(HTMLDOMParser.parseFragment('<title><b>&amp;</b></title>')).toStrictEqual(f.f(f.title('<b>&</b>')));
});

test('parses title inside SVG and MathML as a tag', () => {
  const html = '<svg><title><a>aaa</a></title></svg><math><title><mi>bbb</mi></title></math>';

  expect(toHTML(HTMLDOMParser.parseFragment(html))).toBe(html);
});

test('round-trips raw text and escapable raw text', () => {
  const html = '<script>aaa<bbb&lt;</script><textarea>aaa&lt;bbb</textarea>';

  expect(toHTML(HTMLDOMParser.parseFragment(html))).toBe(html);
});

test('round-trips escaped script data', () => {
  const html = '<script><!--<script></script></script>';

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

test('implicitly ends a paragraph from SVG and MathML content', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<p>aaa<svg><p>bbb<math><p>ccc'))).toBe(
    '<p>aaa<svg></svg></p><p>bbb<math></math></p><p>ccc</p>'
  );
});

test('implicitly ends SVG and MathML with HTML tags', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg><br>aaa<math><br>bbb'))).toBe(
    '<svg></svg><br>aaa<math></math><br>bbb'
  );
});

test('does not implicitly end outer tags with tags inside SVG and MathML', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<a><svg><a></a></svg><math><a>'))).toBe(
    '<a><svg><a></a></svg><math><a></a></math></a>'
  );
});

test('does not implicitly end SVG and MathML inside integration points', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg><title><p>aaa</svg><math><mi><p>bbb</math>'))).toBe(
    '<svg><title><p>aaa</p></title></svg><math><mi><p>bbb</p></mi></math>'
  );
});
