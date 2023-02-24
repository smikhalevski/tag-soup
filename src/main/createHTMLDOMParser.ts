import { createDOMParser, DOMParser, ParserOptions } from './createDOMParser';
import { htmlLexerOptions } from './createHTMLLexer';
import { decodeHTML } from 'speedy-entities';
import { defaults } from './utils';

export function createHTMLDOMParser(options?: ParserOptions): DOMParser {
  return createDOMParser(defaults(options, htmlParserOptions));
}

const htmlParserOptions: ParserOptions = Object.assign(htmlLexerOptions, {
  decodeText: decodeHTML,
  decodeAttributeValue: decodeHTML,
});
