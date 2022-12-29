import { TokenHandler } from 'tokenizer-dsl';
import ruleIterator from './gen/ruleIterator';
import { Lexer, LexerConfig, LexerContext, LexerOptions, LexerStage, LexerState, TokenType } from './lexer-types';
import { createLexerConfig } from './createLexerConfig';
import { die } from './utils';

// Implicit end tags must be emitted up to closest foreign tag
// Shift foreign tag cursor after END_TAG_CLOSING or IMPLICIT_END_TAG

export function createLexer(options: LexerOptions = {}): Lexer {
  const config = createLexerConfig(options, null);

  const lexer: Lexer = (input, handler) => {
    const state = typeof input === 'string' ? createLexerState(input) : input;

    const { chunk, cursor } = state;

    const context: LexerContext = {
      __state: state,
      __handler: handler,
      __config: getCurrentConfig(config, state),
      __endTagCdataModeEnabled: false,
    };

    ruleIterator(state, tokenHandler, context, false);

    while (state.cursor > cursor) {
      handler(TokenType.IMPLICIT_END_TAG, chunk, state.offset, 0, state);
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

    const context: LexerContext = {
      __state: state,
      __handler: handler,
      __config: getCurrentConfig(config, state),
      __endTagCdataModeEnabled: false,
    };

    ruleIterator(state, tokenHandler, context, true);

    return state;
  };

  return lexer;
}

/**
 * Traverses config tree and looks up a config of the current foreign tag.
 *
 * @param rootConfig The root lexer config.
 * @param state The current lexer state.
 * @returns The lexer config of the current foreign tag or root config if lexer isn't in a foreign context.
 */
function getCurrentConfig(rootConfig: LexerConfig, state: LexerState): LexerConfig {
  const { stack, foreignCursor } = state;

  if (foreignCursor === -1) {
    return rootConfig;
  }
  let config = rootConfig;

  for (let i = 0; i < foreignCursor && config.__foreignTagConfigMap; ++i) {
    config = config.__foreignTagConfigMap.get(stack[i]) || config;
  }

  return config.__foreignTagConfigMap?.get(stack[foreignCursor]) || die('Inconsistent lexer state');
}

function createLexerState(chunk: string): LexerState {
  return {
    stage: LexerStage.DOCUMENT,
    chunk,
    chunkOffset: 0,
    offset: 0,
    stack: [],
    cursor: -1,
    foreignCursor: -1,
    activeTag: 0,
  };
}

const tokenHandler: TokenHandler<TokenType, LexerStage, LexerContext> = (type, chunk, offset, length, context) => {
  const { __state, __handler, __config } = context;

  // noinspection FallThroughInSwitchStatementJS
  switch (type) {
    case TokenType.START_TAG_OPENING:
      const startTag = (context.__state.activeTag = __config.__getHashCode(chunk, offset + 1, length - 1));
      emitImplicitEndTags(chunk, offset, context);

      const { foreignCursor } = __state;
      const { __foreignTagConfigMap } = __config;

      const nextCursor = ++__state.cursor;
      const nextConfig = __foreignTagConfigMap && __foreignTagConfigMap.get(startTag);

      __state.stack[nextCursor] = startTag;

      if (nextConfig) {
        context.__config = nextConfig;
        __state.foreignCursor = nextCursor;
      }

      try {
        __handler(TokenType.START_TAG_OPENING, chunk, offset, length, __state);
      } catch (error) {
        // Rollback changes to prevent start tag from being added multiple times on stack
        // if lexer is restated after handler threw an error
        --__state.cursor;
        context.__config = __config;
        __state.foreignCursor = foreignCursor;
        throw error;
      }
      break;

    case TokenType.START_TAG_SELF_CLOSING:
      if (__config.__selfClosingTagsEnabled) {
        __handler(TokenType.START_TAG_SELF_CLOSING, chunk, offset, length, __state);
        --__state.cursor;
        break;
      }

    case TokenType.START_TAG_CLOSING:
      const { __voidTags } = __config;

      if (__voidTags !== null && __voidTags.has(__state.activeTag)) {
        __handler(TokenType.START_TAG_SELF_CLOSING, chunk, offset, length, __state);
        --__state.cursor;
      } else {
        __handler(TokenType.START_TAG_CLOSING, chunk, offset, length, __state);
      }
      __state.activeTag = 0;
      break;

    case TokenType.END_TAG_OPENING:
      // Ignore end tags that don't match the CDATA start tag
      if (context.__endTagCdataModeEnabled) {
        __handler(TokenType.TEXT, chunk, offset, length, __state);
        break;
      }

      const { activeTag, stack, cursor } = __state;

      // Lookup the start tag
      let i = cursor;
      while (i !== -1 && stack[i] !== activeTag) {
        --i;
      }

      // If the start tag is found then emit required end tags
      if (i !== -1) {
        // End unbalanced start tags
        while (i < cursor) {
          __handler(TokenType.IMPLICIT_END_TAG, chunk, offset, 0, __state);
          --__state.cursor;
          ++i;
        }
        // End the start tag
        __handler(TokenType.END_TAG_OPENING, chunk, offset, length, __state);
        --__state.cursor;
        break;
      }

      // Emit implicit start and end tags for orphan end tag
      if (__config.__implicitStartTags?.has(activeTag)) {
        emitImplicitEndTags(chunk, offset, context);

        __state.stack[++__state.cursor] = activeTag;
        try {
          __handler(TokenType.IMPLICIT_START_TAG, chunk, offset, length, __state);
        } finally {
          --__state.cursor;
        }
        break;
      }

      // Prevents emit of the redundant END_TAG_CLOSING token
      __state.activeTag = 0;

      break;

    case TokenType.END_TAG_CLOSING:
      // A tag can be prematurely ended during END_TAG_OPENING
      if (__state.activeTag !== 0) {
        __handler(TokenType.END_TAG_CLOSING, chunk, offset, length, __state);
        __state.activeTag = 0;
      }
      break;

    default:
      __handler(type, chunk, offset, length, __state);
      break;
  }
};

function emitImplicitEndTags(chunk: string, offset: number, context: LexerContext): void {
  const { __state, __handler, __config } = context;

  if (!__config.__implicitEndTagMap) {
    return;
  }

  const { activeTag } = __state;

  const tags = __config.__implicitEndTagMap.get(activeTag);

  if (!tags) {
    return;
  }

  const { stack, cursor } = __state;

  let i = 0;
  while (i <= cursor && !tags.has(stack[i])) {
    ++i;
  }
  while (i <= cursor) {
    __handler(TokenType.IMPLICIT_END_TAG, chunk, offset, 0, __state);
    --__state.cursor;
    ++i;
  }
}
