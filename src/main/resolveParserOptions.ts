import { type ResolvedTokenizerOptions, resolveTokenizerOptions } from './resolveTokenizerOptions.ts';
import type { ParserOptions } from './types.ts';
import { identity } from './utils.ts';

export interface ResolvedParserOptions extends ResolvedTokenizerOptions {
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
 * Converts human-readable parser options into options consumed by parsers.
 */
export function resolveParserOptions(options: ParserOptions): ResolvedParserOptions {
  const { decodeText = identity, decodeAttribute = identity } = options;

  return {
    ...resolveTokenizerOptions(options),
    decodeText,
    decodeAttribute,
  };
}
