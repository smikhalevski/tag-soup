import { resolveTokenizerOptions, type TokenizerConfig } from './resolveTokenizerOptions.ts';
import type { ParserOptions } from './types.ts';
import { identity } from './utils.ts';

/**
 * Resolved parser options: a tokenizer config with decoders.
 */
export interface ParserConfig extends TokenizerConfig {
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
    renameTag = identity,
    renameAttribute = identity,
    decodeText = identity,
    decodeAttribute = identity,
  } = options;

  return {
    ...resolveTokenizerOptions(options),
    renameTag,
    renameAttribute,
    decodeText,
    decodeAttribute,
  };
}
