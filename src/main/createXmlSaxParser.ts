import {IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {decodeXml} from 'speedy-entities';
import {objectCopy} from './misc';

/**
 * Creates a pre-configured XML SAX parser.
 *
 * @param handler The parsing handler.
 * @param options Options that override the defaults.
 */
export function createXmlSaxParser(handler: ISaxHandler, options?: IParserOptions): IParser<void> {
  return createSaxParser(handler, objectCopy(xmlParserOptions, options));
}

/**
 * The default XML SAX parser options.
 */
export const xmlParserOptions: IParserOptions = {
  cdataEnabled: true,
  processingInstructionsEnabled: true,
  selfClosingEnabled: true,
  decodeText: decodeXml,
  decodeAttribute: decodeXml,
};
