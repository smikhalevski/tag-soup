import {IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {createFromHtmlCharName} from './createFromHtmlCharName';
import {createFromCharCode} from './createFromCharCode';
import {lowerCase} from './utils';
import {checkHtmlCdataTag, checkHtmlImplicitEndTag, checkHtmlVoidTag} from './html-utils';

export function createHtmlSaxParser(options?: IParserOptions): IParser<ISaxHandler, void> {
  return createSaxParser(Object.assign({}, htmlParserOptions, options));
}

const fromCharCode = createFromCharCode();

const htmlAttributeDecoder = createEntitiesDecoder({
  fromCharName: createFromHtmlCharName(),
  fromCharCode,
});

const htmlTextDecoder = createEntitiesDecoder({
  fromCharName: createFromHtmlCharName(),
  fromCharCode,
});

export const htmlParserOptions: IParserOptions = {
  // cdataSectionsEnabled,
  // processingInstructionsEnabled,
  quirkyCommentsEnabled: true,
  // selfClosingEnabled
  decodeText: htmlTextDecoder,
  decodeAttribute: htmlAttributeDecoder,
  renameTag: lowerCase,
  // renameAttribute
  checkCdataTag: checkHtmlCdataTag,
  checkVoidTag: checkHtmlVoidTag,
  checkImplicitEndTag: checkHtmlImplicitEndTag,
  // checkFragmentTag
};
