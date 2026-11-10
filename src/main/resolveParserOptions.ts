import { resolveTokenizerOptions, type TokenizerConfig } from './resolveTokenizerOptions.ts';
import type { ParserOptions } from './types.ts';
import { identity } from './utils.ts';

export interface ParserConfig extends TokenizerConfig {
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
 * Converts parser options into the config consumed by parsers.
 */
export function resolveParserOptions(options: ParserOptions): ParserConfig {
  const { decodeText = identity, decodeAttribute = identity } = options;

  return {
    ...resolveTokenizerOptions(options),
    decodeText,
    decodeAttribute,
  };
}
