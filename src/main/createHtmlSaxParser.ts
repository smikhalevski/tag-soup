import {IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {checkHtmlCdataTag, checkHtmlImplicitEndTag, checkHtmlVoidTag} from './html-utils';
import {decodeHtml} from 'speedy-entities';

/**
 * Creates a pre-configured HTML SAX parser.
 *
 * @param handler The parsing handler.
 * @param options Options that override the defaults.
 */
export function createHtmlSaxParser(handler: ISaxHandler, options?: IParserOptions): IParser<void> {
  return createSaxParser(handler, Object.assign({}, htmlParserOptions, options));
}

export const htmlParserOptions: IParserOptions = {
  decodeText: decodeHtml,
  decodeAttribute: decodeHtml,
  renameTag: (name) => name.toLowerCase(),
  checkCdataTag: checkHtmlCdataTag,
  checkVoidTag: checkHtmlVoidTag,
  endsAncestorAt: checkHtmlImplicitEndTag,
};
