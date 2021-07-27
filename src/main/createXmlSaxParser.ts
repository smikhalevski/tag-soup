import {IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {decodeXml} from 'speedy-entities';
import {objectCopy} from './misc';

/**
 * Creates a pre-configured XML SAX parser.
 *
 * @param handler The parsing handler.
 * @param options Options that override the defaults.
 * @see {@link xmlParserOptions}
 */
export function createXmlSaxParser(handler: ISaxHandler, options?: IParserOptions): IParser<void> {
  return createSaxParser(handler, objectCopy(xmlParserOptions, options));
}

/**
 * The default XML parser options:
 * - CDATA sections, processing instructions and self-closing tags are recognized;
 * - XML entities are decoded in text and attribute values;
 * - Tag and attribute names are preserved as is;
 *
 * @see {@link https://github.com/smikhalevski/speedy-entities decodeXml}
 */
export const xmlParserOptions: IParserOptions = {
  cdataEnabled: true,
  processingInstructionsEnabled: true,
  selfClosingEnabled: true,
  decodeText: decodeXml,
  decodeAttribute: decodeXml,
};
