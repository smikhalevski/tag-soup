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

  const {state, handler} = context;

  // noinspection FallThroughInSwitchStatementJS
  switch (type) {

    case TokenType.START_TAG_OPENING:
      emitImplicitEndTags(chunk, offset, context);
      handler(TokenType.START_TAG_OPENING, chunk, offset, length, state);
      state.stack[++state.cursor] = state.activeTag;
      break;

    case TokenType.START_TAG_SELF_CLOSING:
      if (context.selfClosingTagsEnabled) {
        handler(TokenType.START_TAG_SELF_CLOSING, chunk, offset, length, state);
        --state.cursor;
        break;
      }

    case TokenType.START_TAG_CLOSING:
      const {voidTags} = context;

      if (voidTags !== null && voidTags.has(state.activeTag)) {
        handler(TokenType.START_TAG_SELF_CLOSING, chunk, offset, length, state);
        --state.cursor;
      } else {
        handler(TokenType.START_TAG_CLOSING, chunk, offset, length, state);
      }
      state.activeTag = 0;
      break;

    case TokenType.END_TAG_OPENING:

      // Ignore end tags that don't match the CDATA start tag
      if (tokenizerState.stage === TokenStage.CDATA_TAG) {
        handler(TokenType.TEXT, chunk, offset, length, state);
        break;
      }

      const {activeTag, stack, cursor} = state;

      // Lookup the start tag
      let i = cursor;
      while (i !== -1 && stack[i] !== activeTag) {
        --i;
      }

      // If the start tag is found then emit required end tags
      if (i !== -1) {
        // End unbalanced start tags
        while (i < cursor) {
          handler(TokenType.IMPLICIT_END_TAG, chunk, offset, 0, state);
          --state.cursor;
          ++i;
        }
        // End the start tag
        handler(TokenType.END_TAG_OPENING, chunk, offset, length, state);
        --state.cursor;
        break;
      }

      // Emit implicit start and end tags for orphan end tag
      if (context.implicitStartTags?.has(activeTag)) {
        emitImplicitEndTags(chunk, offset, context);
        handler(TokenType.IMPLICIT_START_TAG, chunk, offset, length, state);
      }

      // Prevents emit of the redundant END_TAG_CLOSING token
      state.activeTag = 0;

      break;

    case TokenType.END_TAG_CLOSING:

      // A tag can be prematurely ended during END_TAG_OPENING
      if (state.activeTag !== 0) {
        handler(TokenType.END_TAG_CLOSING, chunk, offset, length, state);
        state.activeTag = 0;
      }
      break;

    default:
      handler(type, chunk, offset, length, state);
      break;
  }
};

function emitImplicitEndTags(chunk: string, offset: number, context: LexerContext): void {
  const {state, implicitEndTagMap} = context;

  if (!implicitEndTagMap) {
    return;
  }

  const tags = implicitEndTagMap.get(state.activeTag);

  if (!tags) {
    return;
  }

  const {stack, cursor} = state;

  let i = 0;
  while (i <= cursor && !tags.has(stack[i])) {
    ++i;
  }
  while (i <= cursor) {
    context.handler(TokenType.IMPLICIT_END_TAG, chunk, offset, 0, state);
    --state.cursor;
    ++i;
  }
}
