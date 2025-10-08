import { expect, test } from 'vitest';
import { HTMLDOMParser, toHTML } from '../main/html.js';
import { f } from 'flyweight-dom/dsl';

test('parses HTML DOM', () => {
  expect(HTMLDOMParser.parseFragment('<p>aaa<p>bbb</br>')).toStrictEqual(f.f(f.p('aaa'), f.p('bbb', f.br())));
});

test('serializes HTML', () => {
  expect(toHTML(HTMLDOMParser.parseDocument('<!DOCTYPEhtml><p>aaa&gt;&lt;<p>bbb</br>'))).toBe(
    '<!DOCTYPE html><p>aaa&gt;&lt;</p><p>bbb<br></p>'
  );
});
