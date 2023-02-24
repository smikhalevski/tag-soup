import { createHTMLDOMParser } from '../main';
import fs from 'fs';
import path from 'path';

const largeSource = fs.readFileSync(path.join(__dirname, './test.html'), 'utf8');

describe('createHTMLDOMParser', () => {
  test('', () => {
    const parser = createHTMLDOMParser();

    const node = parser(largeSource);

    console.log(node);
  });
});
