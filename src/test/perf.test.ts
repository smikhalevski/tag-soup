import fs from 'node:fs';
import { expect, test } from 'vitest';
import { HTMLDOMParser } from '../main/index.js';
import { Document } from 'flyweight-dom';

test('parses large source file', () => {
  const testHtml = fs.readFileSync(import.meta.dirname + '/test.html', 'utf8');

  expect(HTMLDOMParser.parseDocument(testHtml)).toBeInstanceOf(Document);
});
