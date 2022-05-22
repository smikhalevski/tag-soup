import {TokenHandler} from 'tokenizer-dsl';
import {tokenizer} from './tokenizer';
import {LexerContext, LexerHandler, TokenType, Type} from './tokenizer-types';
import {getCaseInsensitiveHashCodeAt, getCaseSensitiveHashCodeAt, die} from './utils';

export interface Lexer {
  (input: string, handler: LexerHandler): void;
}

export interface LexerOptions {
  voidTags?: string[];
  cdataTags?: string[];
  wrestTags?: { [tag: string]: string[] };
  selfClosingTagsEnabled?: boolean;
  caseInsensitiveTagsEnabled?: boolean;
}

export function createLexer(options: LexerOptions = {}): Lexer {

  const hashCodeAt = options.caseInsensitiveTagsEnabled ? getCaseInsensitiveHashCodeAt : getCaseSensitiveHashCodeAt;
  const toHashCode = (value: string) => hashCodeAt(value, 0, value.length);

  const voidTags = options.voidTags ? new Set(options.voidTags.map(toHashCode)) : null;
  const cdataTags = options.cdataTags ? new Set(options.cdataTags.map(toHashCode)) : null;
  const wrestTags = options.wrestTags ? new Map(Object.entries(options.wrestTags).map(([tag, tags]) => [toHashCode(tag), new Set(tags.map(toHashCode))])) : null;
  const selfClosingTagsEnabled = options.selfClosingTagsEnabled || false;

  let sharedStack: number[] | undefined;

  return (input, handler) => {

    const stack = sharedStack || [];
    sharedStack = undefined;

    const context: LexerContext = {
      handler,
      stack,
      cursor: -1,
      lastTag: 0,
      cdataMode: false,
      selfClosingTagsEnabled,
      voidTags,
      cdataTags,
      wrestTags,
      hashCodeAt,
    };

    const {offset} = tokenizer(input, tokenHandler, context);

    sharedStack = stack;

    if (input.length !== offset) {
      die('Unexpected token at position ' + offset);
    }

    for (let i = -1; i < context.cursor; ++i) {
      handler(TokenType.END_TAG, input, offset, 0, context);
    }
  };
}

const tokenHandler: TokenHandler<Type, LexerContext> = (type, chunk, offset, length, context) => {

  const {handler} = context;

  switch (type) {

    case Type.START_TAG_OPENING: {
      const {stack, cursor, cdataTags, wrestTags} = context;

      const lastTag = context.lastTag = context.hashCodeAt(chunk, offset + 1, length - 1);

      context.cdataMode = cdataTags !== null && cdataTags.has(lastTag);

      if (wrestTags !== null) {
        const tags = wrestTags.get(lastTag);

        if (tags !== undefined) {
          for (let i = cursor; i > -1; --i) {
            if (tags.has(stack[i])) {
              for (let j = i; j <= cursor; ++j) {
                handler(TokenType.END_TAG, chunk, offset, 0, context);
              }
              context.cursor = i - 1;
              break;
            }
          }
        }
      }

      handler(TokenType.START_TAG, chunk, offset + 1, length - 1, context);
      break;
    }

    case Type.START_TAG_CLOSING: {
      const {lastTag, voidTags} = context;

      if (context.selfClosingTagsEnabled && length === 2 || voidTags !== null && voidTags.has(lastTag)) {
        // Self-closing or void tag
        handler(TokenType.END_TAG, chunk, offset + length, 0, context);
      } else {
        context.stack[++context.cursor] = lastTag;
      }
      break;
    }

    case Type.END_TAG_OPENING: {

      // context.cdataMode is updated in the endTagOpeningRule.to
      if (context.cdataMode) {
        // Ignore the end tag since it doesn't match the current CDATA start tag
        handler(TokenType.TEXT, chunk, offset + 2, length - 2, context);
        break;
      }

      // See endTagOpeningRule.to for related updates
      const {stack, cursor, lastTag} = context;

      // Lookup for the start tag
      let i = cursor;
      while (i > -1 && stack[i] !== lastTag) {
        --i;
      }

      // If start tag is found then emit end tags
      if (i !== -1) {
        for (let j = i; j < cursor; ++j) {
          handler(TokenType.END_TAG, chunk, offset, 0, context);
        }
        handler(TokenType.END_TAG, chunk, offset + 2, length - 2, context);
        context.cursor = i - 1;
      }

      break;
    }

    case Type.TEXT:
      handler(TokenType.TEXT, chunk, offset, length, context);
      break;

    case Type.ATTRIBUTE_NAME:
      handler(TokenType.ATTRIBUTE_NAME, chunk, offset, length, context);
      break;

    case Type.ATTRIBUTE_ENQUOTED_VALUE:
      handler(TokenType.ATTRIBUTE_VALUE, chunk, offset + 1, length - 2, context);
      break;

    case Type.ATTRIBUTE_UNQUOTED_VALUE:
      handler(TokenType.ATTRIBUTE_VALUE, chunk, offset, length, context);
      break;

    case Type.CDATA_SECTION:
      handler(TokenType.CDATA, chunk, offset + 9, length - 12, context);
      break;

    case Type.COMMENT:
      handler(TokenType.COMMENT, chunk, offset + 4, length - 7, context);
      break;

    case Type.DOCTYPE:
      handler(TokenType.DOCTYPE, chunk, offset, length, context);
      break;

    case Type.PROCESSING_INSTRUCTION:
      handler(TokenType.PROCESSING_INSTRUCTION, chunk, offset + 2, length - 4, context);
      break;
  }
};
