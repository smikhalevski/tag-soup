import { TokenHandler } from 'tokenizer-dsl';
import ruleIterator from './gen/ruleIterator';
import { Lexer, LexerConfig, LexerContext, LexerOptions, LexerStage, LexerState, TokenType } from './lexer-types';
import { createLexerConfig } from './createLexerConfig';
import { die } from './utils';

// Implicit end tags must be emitted up to the closest foreign tag
// Shift foreign tag cursor after END_TAG_CLOSING or IMPLICIT_END_TAG

export function createLexer<Context = void>(options: LexerOptions = {}): Lexer<Context> {
  const config = createLexerConfig(options, null);

  const lexer: Lexer<Context> = (input, handler, context) => {
    const state = typeof input === 'string' ? createLexerState(input) : input;

    const { chunk, cursor } = state;

    const lexerContext: LexerContext = {
      state,
      handler,
      config: getCurrentConfig(config, state),
      context,
      endTagCdataModeEnabled: false,
    };

    ruleIterator(state, tokenHandler, lexerContext, false);

    while (state.cursor > cursor) {
      handler('IMPLICIT_END_TAG', chunk, state.offset, 0, context, state);
      --state.cursor;
    }

    return state;
  };

  lexer.write = (chunk, state, handler, context) => {
    if (state) {
      state.chunk = state.chunk.slice(state.offset) + chunk;
      state.chunkOffset += state.offset;
      state.offset = 0;
    } else {
      state = createLexerState(chunk);
    }

    const lexerContext: LexerContext = {
      state,
      handler,
      config: getCurrentConfig(config, state),
      context,
      endTagCdataModeEnabled: false,
    };

    ruleIterator(state, tokenHandler, lexerContext, true);

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

  let config: LexerConfig | undefined = rootConfig;
  let cursor = 0;

  while (cursor <= foreignCursor && config !== undefined && config.foreignTagConfigMap !== null) {
    config = config.foreignTagConfigMap.get(stack[cursor++]);
  }
  if (cursor <= foreignCursor || config === undefined) {
    die('Inconsistent lexer state');
  }
  return config;
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

const tokenHandler: TokenHandler<TokenType, LexerStage, LexerContext> = (type, chunk, offset, length, lexerContext) => {
  const { state, handler, config, context } = lexerContext;

  // noinspection FallThroughInSwitchStatementJS
  switch (type) {
    case 'START_TAG_OPENING':
      let startTag = config.getHashCode(chunk, offset + 1, length - 1);

      lexerContext.state.activeTag = startTag;

      emitImplicitEndTags(chunk, offset, lexerContext);

      const { foreignCursor } = state;
      const { foreignTagConfigMap } = config;

      const nextCursor = ++state.cursor;
      const nextConfig = foreignTagConfigMap && foreignTagConfigMap.get(startTag);

      if (nextConfig != null /*&& nextConfig.rootTag === nextConfig.getHashCode(chunk, offset + 1, length - 1)*/) {
        lexerContext.config = nextConfig;
        state.foreignCursor = nextCursor;
      }

      state.stack[nextCursor] = startTag;

      try {
        handler('START_TAG_OPENING', chunk, offset, length, context, state);
      } catch (error) {
        // Rollback changes to prevent start tag from being added multiple times on stack
        // if lexer is restated after handler threw an error
        --state.cursor;
        lexerContext.config = config;
        state.foreignCursor = foreignCursor;
        throw error;
      }
      break;

    case 'START_TAG_SELF_CLOSING':
      if (config.selfClosingTagsEnabled) {
        handler('START_TAG_SELF_CLOSING', chunk, offset, length, context, state);
        --state.cursor;
        break;
      }

    case 'START_TAG_CLOSING':
      const { voidTags } = config;

      if (voidTags !== null && voidTags.has(state.activeTag)) {
        handler('START_TAG_SELF_CLOSING', chunk, offset, length, context, state);
        --state.cursor;
      } else {
        handler('START_TAG_CLOSING', chunk, offset, length, context, state);
      }
      state.activeTag = 0;
      break;

    case 'END_TAG_OPENING':
      // Ignore end tags that don't match the CDATA start tag
      if (lexerContext.endTagCdataModeEnabled) {
        handler('TEXT', chunk, offset, length, context, state);
        break;
      }

      const { activeTag, stack, cursor } = state;

      // Lookup the start tag
      let i = cursor;
      while (i !== -1 && stack[i] !== activeTag) {
        --i;
      }

      // If the start tag is found then emit required end tags
      if (i !== -1) {
        // End unbalanced start tags
        while (i < cursor) {
          handler('IMPLICIT_END_TAG', chunk, offset, 0, context, state);
          --state.cursor;
          ++i;
        }
        // End the start tag
        handler('END_TAG_OPENING', chunk, offset, length, context, state);
        --state.cursor;
        break;
      }

      // Emit implicit start and end tags for orphan end tag
      if (config.implicitStartTags !== null && config.implicitStartTags.has(activeTag)) {
        emitImplicitEndTags(chunk, offset, lexerContext);

        state.stack[++state.cursor] = activeTag;
        try {
          handler('IMPLICIT_START_TAG', chunk, offset, length, context, state);
        } finally {
          --state.cursor;
        }
        break;
      }

      // Prevents emit of the redundant END_TAG_CLOSING token
      state.activeTag = 0;

      break;

    case 'END_TAG_CLOSING':
      // A tag can be prematurely ended during END_TAG_OPENING
      if (state.activeTag !== 0) {
        handler('END_TAG_CLOSING', chunk, offset, length, context, state);
        state.activeTag = 0;
      }
      break;

    default:
      handler(type, chunk, offset, length, context, state);
      break;
  }
};

function emitImplicitEndTags(chunk: string, offset: number, lexerContext: LexerContext): void {
  const { state, handler, config, context } = lexerContext;

  if (!config.implicitEndTagMap) {
    return;
  }

  const { activeTag } = state;

  const tags = config.implicitEndTagMap.get(activeTag);

  if (!tags) {
    return;
  }

  const { stack, cursor } = state;

  let i = 0;
  while (i <= cursor && !tags.has(stack[i])) {
    ++i;
  }
  while (i <= cursor) {
    handler('IMPLICIT_END_TAG', chunk, offset, 0, context, state);
    --state.cursor;
    ++i;
  }
}
