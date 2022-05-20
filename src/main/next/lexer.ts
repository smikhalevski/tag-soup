import {TokenHandler} from 'tokenizer-dsl';
import {LexerHandler, LexerType} from './lexer-types';
import {tokenizer} from './tokenizer';
import {Context, Type} from './tokenizer-types';
import {caseInsensitiveHashCodeAt, caseSensitiveHashCodeAt, die} from './utils';

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

  const hashCodeAt = options.caseInsensitiveTagsEnabled ? caseInsensitiveHashCodeAt : caseSensitiveHashCodeAt;
  const toHashCode = (value: string) => hashCodeAt(value, 0, value.length);

  const voidTags = options.voidTags ? new Set(options.voidTags.map(toHashCode)) : null;
  const cdataTags = options.cdataTags ? new Set(options.cdataTags.map(toHashCode)) : null;
  const wrestTags = options.wrestTags ? new Map(Object.entries(options.wrestTags).map(([tag, tags]) => [toHashCode(tag), new Set(tags.map(toHashCode))])) : null;
  const selfClosingTagsEnabled = options.selfClosingTagsEnabled || false;

  return (input, handler) => {

    const context: Context = {
      handler,
      stack: [],
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

    if (input.length !== offset) {
      die('Unexpected token at position ' + offset);
    }

    for (let i = -1; i < context.cursor; ++i) {
      handler(LexerType.END_TAG, input, offset, 0);
    }
  };
}

const tokenHandler: TokenHandler<Type, Context> = (type, chunk, offset, length, context) => {

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
                handler(LexerType.END_TAG, chunk, offset, 0);
              }
            }
            context.cursor = i - 1;
          }
        }
      }

      handler(LexerType.START_TAG, chunk, offset + 1, length - 1);
      break;
    }

    case Type.START_TAG_CLOSING: {
      const {lastTag, voidTags} = context;

      if (context.selfClosingTagsEnabled && length === 2 || voidTags !== null && voidTags.has(lastTag)) {
        // Self-closing or void tag
        handler(LexerType.END_TAG, chunk, offset + length, 0);
      } else {
        context.stack[++context.cursor] = lastTag;
      }
      break;
    }

    case Type.END_TAG_OPENING: {

      // context.cdataMode is updated in the endTagOpeningRule.to
      if (context.cdataMode) {
        // Ignore the end tag since it doesn't match the current CDATA start tag
        handler(LexerType.TEXT, chunk, offset + 2, length - 2);
        break;
      }

      // See endTagOpeningRule.to for related updates
      const {stack, cursor, lastTag} = context;

      const i = stack.lastIndexOf(lastTag);
      if (i !== -1) {
        for (let j = i; j < cursor; ++j) {
          handler(LexerType.END_TAG, chunk, offset, 0);
        }
        handler(LexerType.END_TAG, chunk, offset + 2, length - 2);
        context.cursor = i - 1;
      }
      break;
    }

    case Type.TEXT:
      handler(LexerType.TEXT, chunk, offset, length);
      break;

    case Type.ATTRIBUTE_NAME:
      handler(LexerType.ATTRIBUTE_NAME, chunk, offset, length);
      break;

    case Type.ATTRIBUTE_APOS_VALUE:
    case Type.ATTRIBUTE_QUOT_VALUE:
      handler(LexerType.ATTRIBUTE_VALUE, chunk, offset + 1, length - 2);
      break;

    case Type.ATTRIBUTE_UNQUOTED_VALUE:
      handler(LexerType.ATTRIBUTE_VALUE, chunk, offset, length);
      break;

    case Type.CDATA_SECTION:
      handler(LexerType.CDATA, chunk, offset + 9, length - 12);
      break;

    case Type.COMMENT:
      handler(LexerType.COMMENT, chunk, offset + 4, length - 7);
      break;

    case Type.DOCTYPE:
      handler(LexerType.DOCTYPE, chunk, offset, length);
      break;

    case Type.PROCESSING_INSTRUCTION:
      handler(LexerType.PROCESSING_INSTRUCTION, chunk, offset + 2, length - 4);
      break;
  }
};
