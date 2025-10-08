import { expect, test } from 'vitest';
import { toXML, XMLDOMParser } from '../main/xml.js';
import { f } from 'flyweight-dom/dsl';

test('parses XML DOM', () => {
  expect(XMLDOMParser.parseFragment('<p>aaa</p><p>bbb<br/></p>')).toStrictEqual(f.f(f.p('aaa'), f.p('bbb', f.br())));
});

test('serializes XML', () => {
  expect(toXML(XMLDOMParser.parseDocument('<!DOCTYPEhtml><p>aaa&gt;&lt;</p><p>bbb<br/></p>'))).toBe(
    '<!DOCTYPE html><p>aaa&gt;&lt;</p><p>bbb<br/></p>'
  );
});
