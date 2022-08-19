import { ValueProvider } from 'tokenizer-dsl';
import { LexerContext, TokenStage } from './lexer-types';

export const startTagClosingRuleTo: ValueProvider<TokenStage, LexerContext, TokenStage> = (chunk, offset, length, context) => {
  const { cdataTags } = context;
  return cdataTags !== null && cdataTags.has(context.state.activeTag) ? TokenStage.CDATA_TAG : TokenStage.DOCUMENT;
};

export const startTagSelfClosingRuleTo: ValueProvider<TokenStage, LexerContext, TokenStage> = (chunk, offset, length, context) => {
  if (context.selfClosingTagsEnabled) {
    return TokenStage.DOCUMENT;
  }
  const { cdataTags } = context;
  return cdataTags !== null && cdataTags.has(context.state.activeTag) ? TokenStage.CDATA_TAG : TokenStage.DOCUMENT;
};

export const endTagOpeningRuleTo: ValueProvider<TokenStage, LexerContext, TokenStage> = (chunk, offset, length, context, tokenizerState) => {
  const { state } = context;
  const endTag = context.getHashCode(chunk, offset + 2, length - 2);

  const endTagCdataModeEnabled = context.endTagCdataModeEnabled = tokenizerState.stage === TokenStage.CDATA_TAG && state.stack[state.cursor] !== endTag;

  if (endTagCdataModeEnabled) {
    return TokenStage.CDATA_TAG;
  }
  state.activeTag = endTag;
  return TokenStage.END_TAG_OPENING;
};
