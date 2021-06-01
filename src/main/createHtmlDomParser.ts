import {IDomParser, IDomParserDialectOptions} from './createDomParser';
import {createXmlDomParser, IDomElement, IDomNode, IDomText} from './createXmlDomParser';
import {createHtmlSaxParser, IHtmlSaxParserDialectOptions} from './createHtmlSaxParser';

export interface IHtmlDomParserOptions extends IHtmlSaxParserDialectOptions {
}

/**
 * Preconfigured Cheerio-compatible HTML DOM parser. In contrast with {@link createXmlDomParser} this one knows how to
 * handle HTML void tags and which HTML tags should be implicitly closed.
 *
 * @see {@link createDomParser}
 * @see {@link createXmlDomParser}
 * @see {@link createHtmlDomParser}
 */
export function createHtmlDomParser(options?: IHtmlDomParserOptions): IDomParser<IDomNode, IDomElement, IDomText> {
  const domParserOptions: IDomParserDialectOptions<IDomElement> = {
    saxParserFactory: createHtmlSaxParser,
  };
  return createXmlDomParser(Object.assign({}, options, domParserOptions));
}
