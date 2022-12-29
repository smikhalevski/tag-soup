import { ValueProvider } from 'tokenizer-dsl';
import { LexerContext, LexerStage } from './lexer-types';

type To = ValueProvider<LexerStage, LexerContext, LexerStage>;

export const startTagClosingRuleTo: To = (chunk, offset, length, context) => {
  const { cdataTags } = context.config;

  if (cdataTags !== null && cdataTags.has(context.state.activeTag)) {
    return LexerStage.CDATA_TAG;
  }
  return LexerStage.DOCUMENT;
};

export const startTagSelfClosingRuleTo: To = (chunk, offset, length, context) => {
  const { config } = context;
  if (config.selfClosingTagsEnabled) {
    return LexerStage.DOCUMENT;
  }
  const { cdataTags } = config;

  if (cdataTags !== null && cdataTags.has(context.state.activeTag)) {
    return LexerStage.CDATA_TAG;
  }
  return LexerStage.DOCUMENT;
};

export const endTagOpeningRuleTo: To = (chunk, offset, length, context) => {
  const { state, config } = context;

  const endTag = config.getHashCode(chunk, offset + 2, length - 2);
  const endTagCdataModeEnabled = state.stage === LexerStage.CDATA_TAG && state.stack[state.cursor] !== endTag;

  context.endTagCdataModeEnabled = endTagCdataModeEnabled;

  if (endTagCdataModeEnabled) {
    return LexerStage.CDATA_TAG;
  }
  state.activeTag = endTag;
  return LexerStage.END_TAG;
};
