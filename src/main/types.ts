import type { ResolvedTokenizerOptions } from './tokenizeMarkup.js';
import type { TokenizerOptions } from './createTokenizer.js';

/**
 * Options of {@link createDOMParser} and {@link createSAXParser}.
 *
 * @group Parser
 */
export interface ParserOptions extends TokenizerOptions {
  /**
   * Decode text content. Use this method to decode HTML/XML entities.
   *
   * @param input Text to decode.
   */
  decodeText?: (input: string) => string;
}

export interface ResolvedParserOptions extends ResolvedTokenizerOptions {
  isFragment?: boolean;
  decodeText?: (input: string) => string;
}
