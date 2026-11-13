import fs from 'node:fs';
import path from 'node:path';
import { f } from 'flyweight-dom/dsl';
import { expect, test } from 'vitest';
import { toXML, XMLDOMParser } from '../main/xml.ts';

test('parses XML DOM', () => {
  expect(XMLDOMParser.parseFragment('<p>aaa</p><p>bbb<br/></p>')).toStrictEqual(f.f(f.p('aaa'), f.p('bbb', f.br())));
});

test('decodes attribute values', () => {
  expect(XMLDOMParser.parseFragment('<aaa bbb="&lt;"/>')).toStrictEqual(f.f(f.aaa({ bbb: '<' })));
});

test('resolves namespaces', () => {
  expect(XMLDOMParser.parseDocument('<aaa xmlns="xxx"/>').documentElement!.namespaceURI).toBe('xxx');
});

test('serializes XML', () => {
  expect(toXML(XMLDOMParser.parseDocument('<!DOCTYPEhtml><p>aaa&gt;&lt;<br/></p>'))).toBe(
    '<!DOCTYPE html><p>aaa&gt;&lt;<br/></p>'
  );
});

test('encodes attribute values', () => {
  expect(toXML(XMLDOMParser.parseFragment('<aaa bbb="&quot;"/>'))).toBe('<aaa bbb="&quot;"/>');
});

test('serializes processing instruction without data', () => {
  expect(toXML(XMLDOMParser.parseFragment('<?aaa?>'))).toBe('<?aaa?>');
});

test('parses large XML', () => {
  const testXml = fs.readFileSync(path.resolve(import.meta.dirname, './test.xml'), 'utf-8');

  expect(() => XMLDOMParser.parseDocument(testXml)).not.toThrow();
});
