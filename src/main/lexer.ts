import {TokenHandler} from 'tokenizer-dsl';
import {tokenizer} from './tokenizer';
import {LexerContext, LexerHandler, LexerState, TokenStage, TokenType} from './lexer-types';
import {getCaseInsensitiveHashCode, getCaseSensitiveHashCode, toHashCodeMap, toHashCodeSet} from './utils';

export interface Lexer {

  (input: string | LexerState, handler: LexerHandler): LexerState;

  write(chunk: string, state: LexerState | undefined, handler: LexerHandler): LexerState;
}

export interface LexerOptions {
  voidTags?: string[];
  cdataTags?: string[];
  implicitStartTags?: string[];
  implicitEndTagMap?: Record<string, string[]>;
  selfClosingTagsEnabled?: boolean;
  caseInsensitiveTagsEnabled?: boolean;
  foreignTags?: Record<string, LexerOptions>;
}

// TODO Delete void tags from cdataTags

// TODO Foreign context
//  Read options (voidTags, cdataTags, etc) of the current foreign tag from the context
//  Shift foreign cursor to the start of the stack at the END_TAG_CLOSING of the foreign tag
//  Foreign tags form a tree structure with child-parent and parent-child links, and store foreignCursors in context to resolve nesting

export function createLexer(options: LexerOptions = {}): Lexer {

  const getHashCode = options.caseInsensitiveTagsEnabled ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const voidTags = toHashCodeSet(options.voidTags, getHashCode);

  const cdataTags = toHashCodeSet(options.cdataTags, getHashCode);
  const implicitStartTags = toHashCodeSet(options.implicitStartTags, getHashCode);
  const implicitEndTagMap = toHashCodeMap(options.implicitEndTagMap, getHashCode);
  const selfClosingTagsEnabled = options.selfClosingTagsEnabled || false;

  const lexer: Lexer = (input, handler) => {

    const state = typeof input === 'string' ? createLexerState(input) : input;
    const {chunk, cursor} = state;
    const {offset} = tokenizer(state, tokenHandler, {
      state,
      handler,
      voidTags,
      cdataTags,
      implicitStartTags,
      implicitEndTagMap,
      selfClosingTagsEnabled,
      endTagCdataModeEnabled: false,
      getHashCode,
    });

    while (state.cursor > cursor) {
      handler(TokenType.IMPLICIT_END_TAG, chunk, offset, 0, state);
      --state.cursor;
    }

    return state;
  };

  lexer.write = (chunk, state, handler) => {

    if (state) {
      state.chunk = state.chunk.slice(state.offset) + chunk;
      state.chunkOffset += state.offset;
      state.offset = 0;
    } else {
      state = createLexerState(chunk);
    }

    tokenizer.write(chunk, state, tokenHandler, {
      state,
      handler,
      voidTags,
      cdataTags,
      implicitStartTags,
      implicitEndTagMap,
      selfClosingTagsEnabled,
      endTagCdataModeEnabled: false,
      getHashCode,
    });

    return state;
  };

  return lexer;
}

const tokenHandler: TokenHandler<TokenType, TokenStage, LexerContext> = (type, chunk, offset, length, context) => {

  const {state, handler} = context;

  // noinspection FallThroughInSwitchStatementJS
  switch (type) {

    case TokenType.START_TAG_OPENING:
      const startTag = context.state.activeTag = context.getHashCode(chunk, offset + 1, length - 1);
      emitImplicitEndTags(chunk, offset, context);

      state.stack[++state.cursor] = startTag;
      try {
        handler(TokenType.START_TAG_OPENING, chunk, offset, length, state);
      } catch (error) {
        // Prevents start tag from being added multiple times on stack if lexer is restated after handler threw an error
        --state.cursor;
        throw error;
      }
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
      if (context.endTagCdataModeEnabled) {
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

        state.stack[++state.cursor] = activeTag;
        try {
          handler(TokenType.IMPLICIT_START_TAG, chunk, offset, length, state);
        } finally {
          --state.cursor;
        }
        break;
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
  const {handler, state, implicitEndTagMap} = context;

  if (!implicitEndTagMap) {
    return;
  }

  const {activeTag} = state;

  const tags = implicitEndTagMap.get(activeTag);

  if (!tags) {
    return;
  }

  const {stack, cursor} = state;

  let i = 0;
  while (i <= cursor && !tags.has(stack[i])) {
    ++i;
  }
  while (i <= cursor) {
    state.activeTag = stack[state.cursor];
    try {
      handler(TokenType.IMPLICIT_END_TAG, chunk, offset, 0, state);
    } finally {
      state.activeTag = activeTag;
    }
    --state.cursor;
    ++i;
  }
}

function createLexerState(chunk: string): LexerState {
  return {
    stage: TokenStage.DOCUMENT,
    chunk,
    chunkOffset: 0,
    offset: 0,
    stack: [],
    cursor: -1,
    foreignCursor: -1,
    activeTag: 0,
  };
}
