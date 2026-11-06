import fs from 'node:fs';
import path from 'node:path';
import { f } from 'flyweight-dom/dsl';
import { expect, test } from 'vitest';
import { toXML, XMLDOMParser } from '../main/xml.ts';

test('parses XML DOM', () => {
  expect(XMLDOMParser.parseFragment('<p>aaa</p><p>bbb<br/></p>')).toStrictEqual(f.f(f.p('aaa'), f.p('bbb', f.br())));
});

test('serializes XML', () => {
  expect(toXML(XMLDOMParser.parseDocument('<!DOCTYPEhtml><p>aaa&gt;&lt;<br/></p>'))).toBe(
    '<!DOCTYPE html><p>aaa&gt;&lt;<br/></p>'
  );
});

test('does not match end tag with a different name', () => {
  // "Aa" and "BB" have the same djb2 hash
  expect(() => XMLDOMParser.parseFragment('<Aa></BB>')).toThrow('Unexpected end tag.');
});

test('serializes processing instruction without data', () => {
  expect(toXML(XMLDOMParser.parseFragment('<?aaa?>'))).toBe('<?aaa?>');
});

test('parses large XML', () => {
  const testXml = fs.readFileSync(path.resolve(import.meta.dirname, './test.xml'), 'utf-8');

  expect(() => XMLDOMParser.parseDocument(testXml)).not.toThrow();
});
