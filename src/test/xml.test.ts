import { expect, test } from 'vitest';
import { toXML, XMLDOMParser } from '../main/xml.js';
import { f } from 'flyweight-dom/dsl';
import fs from 'node:fs';
import path from 'node:path';

const memberslistxmlXml = fs.readFileSync(path.resolve(import.meta.dirname, './memberslistxml.xml'), 'utf-8');

test('parses XML DOM', () => {
  expect(XMLDOMParser.parseFragment('<p>aaa</p><p>bbb<br/></p>')).toStrictEqual(f.f(f.p('aaa'), f.p('bbb', f.br())));
});

test('serializes XML', () => {
  expect(toXML(XMLDOMParser.parseDocument('<!DOCTYPEhtml><p>aaa&gt;&lt;</p><p>bbb<br/></p>'))).toBe(
    '<!DOCTYPE html><p>aaa&gt;&lt;</p><p>bbb<br/></p>'
  );
});

test('parses large XML', () => {
  expect(() => XMLDOMParser.parseDocument(memberslistxmlXml)).not.toThrow();
});
