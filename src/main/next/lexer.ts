import {TokenHandler} from 'tokenizer-dsl';
import {LexerHandler, LexerType} from './lexer-types';
import {tokenizer} from './tokenizer';
import {Context, Type} from './tokenizer-types';
import {caseInsensitiveHashCodeAt, caseSensitiveHashCodeAt} from './utils';

export interface Lexer {
  (input: string, handler: LexerHandler): void;
}

export interface LexerOptions {
  voidTags?: string[];
  cdataTags?: string[];
  wrestTags?: { [tag: string]: string[] };
  selfClosingTagsEnabled?: boolean;
  caseSensitiveTagsEnabled?: boolean;
}

export function createLexer(options: LexerOptions = {}): Lexer {

  const hashCodeAt = options.caseSensitiveTagsEnabled ? caseSensitiveHashCodeAt : caseInsensitiveHashCodeAt;
  const toHashCode = (value: string) => hashCodeAt(value, 0, value.length);

  const voidTags = options.voidTags ? new Set(options.voidTags.map(toHashCode)) : null;
  const cdataTags = options.cdataTags ? new Set(options.cdataTags.map(toHashCode)) : null;
  const wrestTags = options.wrestTags ? new Map(Object.entries(options.wrestTags).map(([tag, tags]) => [toHashCode(tag), new Set(tags.map(toHashCode))])) : null;
  const selfClosingTagsEnabled = options.selfClosingTagsEnabled || false;

  return (input, handler) => {
    tokenizer(input, tokenHandler, {
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
    });
  };
}

const tokenHandler: TokenHandler<Type, Context> = {

  token(type, chunk, offset, length, context) {

    const {handler} = context;

    switch (type) {

      case Type.START_TAG_OPENING:
        const startTag = context.lastTag = context.hashCodeAt(chunk, offset + 1, length);
        context.cdataMode = context.cdataTags !== null && context.cdataTags.has(startTag);
        handler(LexerType.START_TAG, chunk, offset + 1, length);
        break;

      case Type.START_TAG_CLOSING:
        if (context.selfClosingTagsEnabled && chunk.charCodeAt(offset - 1) === 47 /*/*/ || context.voidTags !== null && context.voidTags.has(context.lastTag)) {
          // Self-closing or void tag
          handler(LexerType.END_TAG, chunk, offset + length, 0);
        } else {
          context.stack[++context.cursor] = context.lastTag;
        }
        break;

      case Type.END_TAG_OPENING:
        if (context.cdataMode) {
          handler(LexerType.TEXT, chunk, offset + 2, length - 2);
          break;
        }

        const {stack, cursor} = context;
        const endTag = context.lastTag;

        let i = cursor;
        while (i !== -1 && stack[i] !== endTag) {
          --i;
        }
        if (i !== -1) {
          for (let j = cursor; j > i; --j) {
            handler(LexerType.END_TAG, chunk, offset, 0);
          }
          handler(LexerType.END_TAG, chunk, offset + 2, length);
          context.cursor = i - 1;
        }
        break;

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

      case Type.CDATA:
        handler(LexerType.CDATA, chunk, offset + 9, length - 12);
        break;

      case Type.COMMENT:
        handler(LexerType.COMMENT, chunk, offset + 4, length - 7);
        break;

      case Type.DOCTYPE:
        handler(LexerType.DOCTYPE, chunk, offset, length);
        break;

      case Type.DTD:
        handler(LexerType.DTD, chunk, offset, length);
        break;

      case Type.PROCESSING_INSTRUCTION:
        handler(LexerType.PROCESSING_INSTRUCTION, chunk, offset + 2, length - 4);
        break;
    }
  },
};
