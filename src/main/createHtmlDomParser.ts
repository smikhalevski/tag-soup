import {createXmlDomParser, IDomElement, IDomNode, IDomText} from './createXmlDomParser';
import {createHtmlSaxParser, IHtmlSaxParserDialectOptions} from './createHtmlSaxParser';
import {IDomParser, IDomParserDialectOptions} from './dom-parser-types';

export interface IHtmlDomParserOptions extends IHtmlSaxParserDialectOptions {
}

/**
 * Preconfigured Cheerio-compatible HTML DOM parser. In contrast with {@link createXmlDomParser} this one knows how to
 * handle HTML void tags and which HTML tags should be implicitly closed.
 *
 * @see createDomParser
 * @see createXmlDomParser
 * @see createHtmlDomParser
 */
export function createHtmlDomParser(options?: IHtmlDomParserOptions): IDomParser<IDomNode, IDomElement, IDomText> {
  const domParserOptions: IDomParserDialectOptions<IDomElement> = {
    saxParserFactory: createHtmlSaxParser,
  };
  return createXmlDomParser(Object.assign({}, options, domParserOptions));
}
