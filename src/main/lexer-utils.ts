import { ValueProvider } from 'tokenizer-dsl';
import { LexerContext, LexerStage } from './lexer-types';

type To = ValueProvider<LexerStage, LexerContext, LexerStage>;

export const startTagClosingRuleTo: To = (chunk, offset, length, context) => {
  const { __cdataTags } = context.__config;

  if (__cdataTags !== null && __cdataTags.has(context.__state.activeTag)) {
    return LexerStage.CDATA_TAG;
  }
  return LexerStage.DOCUMENT;
};

export const startTagSelfClosingRuleTo: To = (chunk, offset, length, context) => {
  const { __config } = context;
  if (__config.__selfClosingTagsEnabled) {
    return LexerStage.DOCUMENT;
  }
  const { __cdataTags } = __config;

  if (__cdataTags !== null && __cdataTags.has(context.__state.activeTag)) {
    return LexerStage.CDATA_TAG;
  }
  return LexerStage.DOCUMENT;
};

export const endTagOpeningRuleTo: To = (chunk, offset, length, context) => {
  const { __state, __config } = context;

  const endTag = __config.__getHashCode(chunk, offset + 2, length - 2);
  const endTagCdataModeEnabled = __state.stage === LexerStage.CDATA_TAG && __state.stack[__state.cursor] !== endTag;

  context.__endTagCdataModeEnabled = endTagCdataModeEnabled;

  if (endTagCdataModeEnabled) {
    return LexerStage.CDATA_TAG;
  }
  __state.activeTag = endTag;
  return LexerStage.END_TAG;
};
