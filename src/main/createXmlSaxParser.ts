import {IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {createDecoder} from './createDecoder';
import {fromXmlEntityName} from './xml-decoder';

export function createXmlSaxParser(handler: ISaxHandler, options?: IParserOptions): IParser<void> {
  return createSaxParser(handler, Object.assign({}, xmlParserOptions, options));
}

export const xmlDecoder = createDecoder(fromXmlEntityName);

export const xmlParserOptions: IParserOptions = {
  cdataEnabled: true,
  processingInstructionsEnabled: true,
  selfClosingEnabled: true,
  decodeText: xmlDecoder,
  decodeAttribute: xmlDecoder,
};
