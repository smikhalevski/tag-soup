import {IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {createFromHtmlCharName} from './createFromHtmlCharName';
import {createFromCharCode} from './createFromCharCode';
import {checkHtmlCdataTag, checkHtmlImplicitEndTag, checkHtmlVoidTag} from './html-utils';
import * as e from 'entities';

export function createHtmlSaxParser(options?: IParserOptions): IParser<ISaxHandler, void> {
  return createSaxParser(Object.assign({}, htmlParserOptions, options));
}

const htmlDecoder = createEntitiesDecoder(createFromHtmlCharName(), createFromCharCode());

export const htmlParserOptions: IParserOptions = {
  decodeText: htmlDecoder,
  decodeAttribute: htmlDecoder,
  // decodeText: e.decodeHTML5,
  // decodeAttribute: e.decodeHTML5,
  // renameTag: (name) => name.toLowerCase(),
  checkCdataTag: checkHtmlCdataTag,
  checkVoidTag: checkHtmlVoidTag,
  endsAncestorAt: checkHtmlImplicitEndTag,
};
