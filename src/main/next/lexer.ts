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
      lastTag: 0,
      cdataPending: false,
    };

    const context: LexerContext = {
      state,
      handler,
      selfClosingTagsEnabled,
      voidTags,
      cdataTags,
      implicitEndTags,
      implicitStartTags,
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
      const {state, implicitEndTags} = context;
      const lastTag = state.lastTag = context.getHashCode(chunk, offset + 1, length - 1);

      if (implicitEndTags != null) {
        const implicitlyEndedTags = implicitEndTags.get(lastTag);

        // Lookup tags that are implicitly ended by this start tag
        if (implicitlyEndedTags !== undefined) {
          const {stack, cursor} = state;

          for (let i = 0; i <= cursor; ++i) {
            if (implicitlyEndedTags.has(stack[i])) {
              while (i <= cursor) {
                handler(TokenType.IMPLICIT_END_TAG, chunk, offset, 0, state);
                --state.cursor;
                ++i;
              }
              break;
            }
          }

        }
      }

      handler(TokenType.START_TAG_OPENING, chunk, offset, length, state);
      break;
    }

    case TokenType.START_TAG_CLOSING: {
      const {state, voidTags} = context;

      handler(TokenType.START_TAG_CLOSING, chunk, offset, length, state);

      if (context.selfClosingTagsEnabled && length === 2 || !state.cdataPending && voidTags != null && voidTags.has(state.lastTag)) {
        handler(TokenType.IMPLICIT_END_TAG, chunk, offset + length, 0, state);
      } else {
        state.stack[++state.cursor] = state.lastTag;
      }
      break;
    }

    case TokenType.END_TAG_OPENING: {

      if (state.cdataPending) {
        // Ignore the end tag since it doesn't match the current CDATA container start tag
        handler(TokenType.TEXT, chunk, offset, length, state);
        break;
      }

      const {stack, cursor, lastTag} = state;

      // Lookup the explicit start tag
      for (let i = cursor; i > -1; --i) {
        if (stack[i] === lastTag) {
          // Inject implicit end tags for unbalanced start tags
          while (i < cursor) {
            handler(TokenType.IMPLICIT_END_TAG, chunk, offset, 0, state);
            --state.cursor;
            ++i;
          }
          handler(TokenType.END_TAG_OPENING, chunk, offset, length, state);
          return;
        }
      }

      const {implicitStartTags} = context;

      if (implicitStartTags != null && implicitStartTags.has(lastTag)) {
        handler(TokenType.IMPLICIT_START_TAG, chunk, offset, length, state);
      }

      state.lastTag = 0;

      break;
    }

    case TokenType.END_TAG_CLOSING:
      if (state.lastTag !== 0) {
        handler(TokenType.END_TAG_CLOSING, chunk, offset, length, state);
        --state.cursor;
      }
      break;

    default:
      handler(type, chunk, offset, length, state);
      break;
  }
};
