import {IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {createEntitiesDecoder} from './createEntitiesDecoder';

export function createXmlSaxParser(options?: IParserOptions): IParser<ISaxHandler, void> {
  return createSaxParser(Object.assign({}, xmlParserOptions, options));
}

export const xmlDecoder = createEntitiesDecoder();

export const xmlParserOptions: IParserOptions = {
  cdataEnabled: true,
  processingInstructionsEnabled: true,
  selfClosingEnabled: true,
  decodeText: xmlDecoder,
  decodeAttribute: xmlDecoder,
  // renameTag
  // renameAttribute
  // checkCdataTag
  // checkVoidTag
  // checkImplicitEndTag
  // checkBoundaryTag
};
