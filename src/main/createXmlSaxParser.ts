import {IParser, IParserOptions, IXmlSaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {createEntitiesDecoder} from './createEntitiesDecoder';

export function createXmlSaxParser(options?: IParserOptions): IParser<IXmlSaxHandler, void> {
  return createSaxParser(Object.assign({}, xmlParserOptions, options));
}

export const xmlDecoder = createEntitiesDecoder();

export const xmlParserOptions: IParserOptions = {
  cdataSectionsEnabled: true,
  processingInstructionsEnabled: true,
  // quirkyCommentsEnabled
  selfClosingEnabled: true,
  decodeText: xmlDecoder,
  decodeAttribute: xmlDecoder,
  // renameTag
  // renameAttribute
  // checkCdataTag
  // checkVoidTag
  // checkImplicitEndTag
  // checkFragmentTag
};
