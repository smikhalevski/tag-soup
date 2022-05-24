import {TokenHandler} from 'tokenizer-dsl';
import {tokenizer} from './tokenizer';
import {LexerContext, LexerHandler, TokenStage, TokenType} from './tokenizer-types';
import {getCaseInsensitiveHashCode, getCaseSensitiveHashCode, die} from './utils';

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

  let sharedStack: number[] | undefined;

  return (input, handler) => {

    const stack = sharedStack || [];
    sharedStack = undefined;

    const context: LexerContext = {
      state: {
        activeTag: 0,
      },
      handler,
      stack,
      cursor: -1,
      selfClosingTagsEnabled,
      voidTags,
      cdataTags,
      implicitEndTagMap,
      implicitStartTags: null,
      getHashCode,
    };

    const {offset} = tokenizer(input, tokenHandler, context);

    sharedStack = stack;

    if (input.length !== offset) {
      die('Unexpected token at position ' + offset);
    }

    for (let i = -1; i < context.cursor; ++i) {
      handler(TokenType.END_TAG_OPENING, input, offset, 0, context);
    }
  };
}

const tokenHandler: TokenHandler<TokenType, TokenStage, LexerContext> = (type, chunk, offset, length, context, tokenizerState) => {

  const {handler} = context;

  switch (type) {

    case TokenType.START_TAG_OPENING: {
      const {stack, cursor, implicitEndTagMap} = context;

      // const activeTag = context.activeTag = context.getHashCode(chunk, offset + 1, length - 1);

      if (implicitEndTagMap !== null) {
        const tags = implicitEndTagMap.get(context.state.activeTag);

        if (tags !== undefined) {
          for (let i = cursor; i > -1; --i) {
            if (tags.has(stack[i])) {
              for (let j = i; j <= cursor; ++j) {
                handler(TokenType.END_TAG_OPENING, chunk, offset, 0, context);
              }
              context.cursor = i - 1;
              break;
            }
          }
        }
      }

      handler(TokenType.START_TAG_OPENING, chunk, offset + 1, length - 1, context);
      break;
    }

    case TokenType.START_TAG_SELF_CLOSING:
      if (context.selfClosingTagsEnabled) {
        handler(TokenType.END_TAG_OPENING, chunk, offset + length, 0, context);
        break;
      }

    case TokenType.START_TAG_CLOSING: {
      const {voidTags} = context;

      const activeTag = context.state.activeTag

      if (voidTags !== null && voidTags.has(activeTag)) {
        // Self-closing or void tag
        handler(TokenType.END_TAG_OPENING, chunk, offset + length, 0, context);
      } else {
        context.stack[++context.cursor] = activeTag;
      }
      break;
    }

    case TokenType.END_TAG_OPENING: {

      // Ignore the end tags that don't match the CDATA start tag
      if (tokenizerState.stage === TokenStage.CDATA_TAG) {
        handler(TokenType.TEXT, chunk, offset + 2, length - 2, context);
        break;
      }

      const {stack, cursor} = context;

      const activeTag = context.state.activeTag


      // Lookup for the start tag
      let i = cursor;
      while (i > -1 && stack[i] !== activeTag) {
        --i;
      }

      // If start tag is found then emit end tags
      if (i !== -1) {
        for (let j = i; j < cursor; ++j) {
          handler(TokenType.END_TAG_OPENING, chunk, offset, 0, context);
        }
        handler(TokenType.END_TAG_OPENING, chunk, offset + 2, length - 2, context);
        context.cursor = i - 1;
      }

      break;
    }

    default:
      handler(type, chunk, offset, length, context);
      break;
  }
};
