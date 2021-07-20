import {IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {createDecoder} from './createDecoder';
import {fromXmlEntityName} from './xml-decoder';

/**
 * Creates a pre-configured XML SAX parser.
 *
 * @param handler The parsing handler.
 * @param options Options that override the defaults.
 */
export function createXmlSaxParser(handler: ISaxHandler, options?: IParserOptions): IParser<void> {
  return createSaxParser(handler, Object.assign({}, xmlParserOptions, options));
}

const xmlDecoder = createDecoder(fromXmlEntityName);

/**
 * The default XML SAX parser options.
 */
export const xmlParserOptions: IParserOptions = {
  cdataEnabled: true,
  processingInstructionsEnabled: true,
  selfClosingEnabled: true,
  decodeText: xmlDecoder,
  decodeAttribute: xmlDecoder,
};
