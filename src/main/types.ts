import type { ResolvedTokenizerOptions } from './tokenizeMarkup.js';
import type { TokenizerOptions } from './createTokenizer.js';

/**
 * Options of {@link createDOMParser} and {@link createSAXParser}.
 *
 * @group Parser
 */
export interface ParserOptions extends TokenizerOptions {
  /**
   * Decodes text content and attribute values. Use this method to decode HTML/XML entities. Text inside
   * {@link rawTextTags raw text tags}, comments, CDATA sections and processing instructions isn't decoded.
   *
   * @example
   * import { decodeHTML } from 'speedy-entities';
   *
   * createDOMParser({ decodeText: decodeHTML });
   *
   * @param text Text to decode.
   * @default No decoding
   */
  decodeText?: (text: string) => string;
}

/**
 * Options of {@link parseDOM} and {@link parseSAX}.
 *
 * @internal
 */
export interface ResolvedParserOptions extends ResolvedTokenizerOptions {
  /**
   * @see {@link ParserOptions.decodeText}
   */
  decodeText?: (text: string) => string;
}
