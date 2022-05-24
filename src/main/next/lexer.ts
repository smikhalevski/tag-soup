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
  implicitStartTags?: string[];
  selfClosingTagsEnabled?: boolean;
  caseInsensitiveTagsEnabled?: boolean;
}

export function createLexer(options: LexerOptions = {}): Lexer {

  const getHashCode = options.caseInsensitiveTagsEnabled ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;
  const toHashCode = (value: string) => getHashCode(value, 0, value.length);

  const voidTags = options.voidTags ? new Set(options.voidTags.map(toHashCode)) : null;
  const cdataTags = options.cdataTags ? new Set(options.cdataTags.map(toHashCode)) : null;
  const implicitEndTags = options.implicitEndTags ? new Map(Object.entries(options.implicitEndTags).map(([tag, tags]) => [toHashCode(tag), new Set(tags.map(toHashCode))])) : null;
  const implicitStartTags = options.implicitStartTags ? new Set(options.implicitStartTags.map(toHashCode)) : null;
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
      voidTags: voidTags,
      cdataTags: cdataTags,
      implicitEndTagMap: implicitEndTags,
      implicitStartTags: implicitStartTags,
      getHashCode,
    };

    const {offset} = tokenizer(input, tokenHandler, context, state);

    if (input.length !== offset) {
      die('Unexpected token at position ' + offset);
    }

    for (let i = -1; i < state.cursor; ++i) {
      handler(TokenType.IMPLICIT_END_TAG, input, offset, 0, state);
    }
  };
}

const tokenHandler: TokenHandler<TokenType, LexerContext> = (type, chunk, offset, length, context) => {

  const {state, handler} = context;

  switch (type) {

    case TokenType.START_TAG_OPENING: {
      const {state, implicitEndTagMap} = context;
      const startTag = context.getHashCode(chunk, offset + 1, length - 1);

      // Lookup tags that are implicitly ended by this start tag
      if (implicitEndTagMap != null) {
        const tags = implicitEndTagMap.get(startTag);

        if (tags != null) {
          const {stack, cursor} = state;

          let i = 0;
          while (i <= cursor && !tags.has(stack[i])) {
            ++i;
          }
          while (i <= cursor) {
            handler(TokenType.IMPLICIT_END_TAG, chunk, offset, 0, state);
            --state.cursor;
            ++i;
          }
        }
      }

      state.activeTag = startTag;
      handler(TokenType.START_TAG_OPENING, chunk, offset, length, state);
      break;
    }

    case TokenType.START_TAG_CLOSING: {
      const {state, voidTags} = context;
      const {activeTag} = state;

      // if (tag !== 0) {
      handler(TokenType.START_TAG_CLOSING, chunk, offset, length, state);
      // state.tag = 0;
      // }

      if (context.selfClosingTagsEnabled && length === 2 || voidTags != null && voidTags.has(activeTag)) {
        handler(TokenType.IMPLICIT_END_TAG, chunk, offset + length, 0, state);
      } else {
        state.stack[++state.cursor] = activeTag;
      }
      break;
    }

    case TokenType.END_TAG_OPENING: {

      if (state.stage === TokenStage.CDATA_TAG) {
        // Ignore the end tag since it doesn't match the current CDATA container start tag
        handler(TokenType.TEXT, chunk, offset, length, state);
        break;
      }

      const {stack, cursor, activeTag} = state;

      // Lookup the start tag
      let i = cursor;
      while (i > -1 && stack[i] !== activeTag) {
        --i;
      }

      // If start tag is found then emit end tags
      if (i !== -1) {
        while (i < cursor) {
          // Implicit end tags for unbalanced start tags
          handler(TokenType.IMPLICIT_END_TAG, chunk, offset, 0, state);
          --state.cursor;
          ++i;
        }
        handler(TokenType.END_TAG_OPENING, chunk, offset, length, state);
        break;
      }

      const {implicitStartTags} = context;

      // Implicit start tag for an orphan end tag
      if (implicitStartTags != null && implicitStartTags.has(activeTag)) {
        handler(TokenType.IMPLICIT_START_TAG, chunk, offset, length, state);
      }

      // Ignore consequent end tag closing
      state.activeTag = 0;
      break;
    }

    case TokenType.END_TAG_CLOSING:
      if (state.activeTag !== 0) {
        handler(TokenType.END_TAG_CLOSING, chunk, offset, length, state);
        --state.cursor;
        state.activeTag = 0;
      }
      break;

    default:
      handler(type, chunk, offset, length, state);
      break;
  }
};
