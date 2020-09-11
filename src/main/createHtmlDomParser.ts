import {DomParser, DomParserDialectOptions} from './createDomParser';
import {createXmlDomParser, DomElement, DomNode, DomText} from './createXmlDomParser';
import {createHtmlSaxParser, HtmlSaxParserDialectOptions} from './createHtmlSaxParser';

export interface HtmlDomParserOptions extends HtmlSaxParserDialectOptions {
}

/**
 * Preconfigured Cheerio-compatible HTML DOM parser. In contrast with {@link createXmlDomParser} this one knows how to
 * handle HTML void tags and which HTML tags should be implicitly closed.
 *
 * @see {@link createDomParser}
 * @see {@link createXmlDomParser}
 * @see {@link createHtmlDomParser}
 */
export function createHtmlDomParser(options?: HtmlDomParserOptions): DomParser<DomNode, DomElement, DomText> {
  const domParserOptions: DomParserDialectOptions<DomElement> = {
    saxParserFactory: createHtmlSaxParser,
  };
  return createXmlDomParser(Object.assign({}, options, domParserOptions));
}
