import {TokenHandler} from 'tokenizer-dsl';
import {tokenizer} from './tokenizer';
import {LexerContext, LexerHandler, LexerState, TokenStage, TokenType} from './tokenizer-types';
import {die, getCaseInsensitiveHashCode, getCaseSensitiveHashCode} from './utils';

export interface Lexer {
  (input: string, handler: LexerHandler): void;
}

export interface LexerOptions {
  voidTags?: string[];
  cdataTags?: string[];
  implicitEndTags?: { [tag: string]: string[] };
  selfClosingTagsEnabled?: boolean;
  caseInsensitiveTagsEnabled?: boolean;
}

export function createLexer(options: LexerOptions = {}): Lexer {

  const getHashCode = options.caseInsensitiveTagsEnabled ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;
  const toHashCode = (value: string) => getHashCode(value, 0, value.length);

  const voidTags = options.voidTags ? new Set(options.voidTags.map(toHashCode)) : null;
  const cdataTags = options.cdataTags ? new Set(options.cdataTags.map(toHashCode)) : null;
  const implicitEndTagMap = options.implicitEndTags ? new Map(Object.entries(options.implicitEndTags).map(([tag, tags]) => [toHashCode(tag), new Set(tags.map(toHashCode))])) : null;
  const selfClosingTagsEnabled = options.selfClosingTagsEnabled || false;

  return (input, handler) => {

    const state: LexerState = {
      stage: TokenStage.DOCUMENT,
      chunk: input,
      chunkOffset: 0,
      offset: 0,
      stack: [],
      cursor: -1,
      activeTag: 0,
    };

    const context: LexerContext = {
      state,
      handler,
      selfClosingTagsEnabled,
      voidTags,
      cdataTags,
      implicitEndTagMap,
      implicitStartTags: null,
      getHashCode,
    };

    const {offset} = tokenizer(state, tokenHandler, context);

    if (input.length !== offset) {
      die('Unexpected token at position ' + offset);
    }

    for (let i = -1; i < state.cursor; ++i) {
      handler(TokenType.IMPLICIT_END_TAG, input, offset, 0, state);
    }
  };
}

const tokenHandler: TokenHandler<TokenType, TokenStage, LexerContext> = (type, chunk, offset, length, context, tokenizerState) => {

  const {handler} = context;

  switch (type) {

    case TokenType.START_TAG_OPENING: {
      const {state, implicitEndTagMap} = context;
      const {stack, cursor} = state;

      // const activeTag = context.activeTag = context.getHashCode(chunk, offset + 1, length - 1);

      if (implicitEndTagMap !== null) {
        const tags = implicitEndTagMap.get(context.state.activeTag);

        if (tags !== undefined) {
          for (let i = cursor; i > -1; --i) {
            if (tags.has(stack[i])) {
              for (let j = i; j <= cursor; ++j) {
                handler(TokenType.END_TAG_OPENING, chunk, offset, 0, state);
              }
              context.state.cursor = i - 1;
              break;
            }
          }
        }
      }

      handler(TokenType.START_TAG_OPENING, chunk, offset + 1, length - 1, state);
      break;
    }

    case TokenType.START_TAG_SELF_CLOSING:
      if (context.selfClosingTagsEnabled) {
        handler(TokenType.IMPLICIT_END_TAG, chunk, offset + length, 0, context.state);
        break;
      }

    case TokenType.START_TAG_CLOSING: {
      const {state, voidTags} = context;

      const activeTag = state.activeTag

      if (voidTags !== null && voidTags.has(activeTag)) {
        // Self-closing or void tag
        handler(TokenType.END_TAG_OPENING, chunk, offset + length, 0, state);
      } else {
        state.stack[++state.cursor] = activeTag;
      }
      break;
    }

    case TokenType.END_TAG_OPENING: {
      const {state} = context;

      // Ignore the end tags that don't match the CDATA start tag
      if (tokenizerState.stage === TokenStage.CDATA_TAG) {
        handler(TokenType.TEXT, chunk, offset + 2, length - 2, state);
        break;
      }

      const {stack, cursor} = context.state;

      const activeTag = context.state.activeTag


      // Lookup for the start tag
      let i = cursor;
      while (i > -1 && stack[i] !== activeTag) {
        --i;
      }

      // If start tag is found then emit end tags
      if (i !== -1) {
        for (let j = i; j < cursor; ++j) {
          handler(TokenType.END_TAG_OPENING, chunk, offset, 0, state);
        }
        handler(TokenType.END_TAG_OPENING, chunk, offset + 2, length - 2, state);
        context.state.cursor = i - 1;
      }

      break;
    }

    default:
      handler(type, chunk, offset, length, context.state);
      break;
  }
};
