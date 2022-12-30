import { createDOMParser, DOMParser, ParserOptions } from './createDOMParser';
import { htmlLexerOptions } from './createHTMLLexer';
import { decodeHtml } from 'speedy-entities';
import { defaults } from './utils';

export function createHTMLDOMParser(options?: ParserOptions): DOMParser {
  return createDOMParser(defaults(options, htmlParserOptions));
}

const htmlParserOptions: ParserOptions = Object.assign(htmlLexerOptions, {
  decodeText: decodeHtml,
  decodeAttributeValue: decodeHtml,
});
