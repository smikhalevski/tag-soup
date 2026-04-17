import { ResolvedTokenizerOptions } from './tokenizeMarkup.js';
import { TokenizerOptions } from './createTokenizer.js';

/**
 * Options of {@link createDOMParser} and {@link createSAXParser}.
 *
 * @group Parser
 */
export interface ParserOptions extends TokenizerOptions {
  /**
   * Decode text content. Use this method to decode HTML/XML entities.
   *
   * @param text Text to decode.
   */
  decodeText?: (text: string) => string;
}

export interface ResolvedParserOptions extends ResolvedTokenizerOptions {
  isFragment?: boolean;
  decodeText?: (text: string) => string;
}
