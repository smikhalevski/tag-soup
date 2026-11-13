import { createTokenizer, type Tokenizer } from './createTokenizer.ts';
import type { ParserOptions } from './types.ts';
import { identity } from './utils.ts';

/**
 * Resolved parser options.
 */
export interface ParserConfig {
  /**
   * @see {@link ParserOptions.tokenizer}
   */
  tokenizer: Tokenizer;

  renameTag: (name: string) => string;

  renameAttribute: (name: string) => string;

  /**
   * @see {@link ParserOptions.decodeText}
   */
  decodeText: (text: string) => string;

  /**
   * @see {@link ParserOptions.decodeAttribute}
   */
  decodeAttribute: (value: string) => string;
}

/**
 * Converts parser options into a parser config.
 */
export function resolveParserOptions(options: ParserOptions): ParserConfig {
  const {
    tokenizer = createTokenizer(),
    renameTag = identity,
    renameAttribute = identity,
    decodeText = identity,
    decodeAttribute = identity,
  } = options;

  return {
    tokenizer,
    renameTag,
    renameAttribute,
    decodeText,
    decodeAttribute,
  };
}
