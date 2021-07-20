import {IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {createDecoder} from './createDecoder';
import {createFromHtmlCharName} from './createFromHtmlCharName';
import {createFromCharCode} from './createFromCharCode';
import {checkHtmlCdataTag, checkHtmlImplicitEndTag, checkHtmlVoidTag} from './html-utils';

export function createHtmlSaxParser(handler: ISaxHandler, options?: IParserOptions): IParser<void> {
  return createSaxParser(handler, Object.assign({}, htmlParserOptions, options));
}

const htmlDecoder = createDecoder(createFromHtmlCharName(), createFromCharCode());

export const htmlParserOptions: IParserOptions = {
  decodeText: htmlDecoder,
  decodeAttribute: htmlDecoder,
  // renameTag: (name) => name.toLowerCase(),
  checkCdataTag: checkHtmlCdataTag,
  checkVoidTag: checkHtmlVoidTag,
  endsAncestorAt: checkHtmlImplicitEndTag,
};
