import type { TokenizerOptions } from './createTokenizer.ts';
import type { ResolvedTokenizerOptions } from './tokenizeMarkup.ts';

/**
 * Options of {@link createDOMParser} and {@link createSAXParser}.
 *
 * @group Parser
 */
export interface ParserOptions extends TokenizerOptions {
  /**
   * Decodes text content. Use this method to decode HTML/XML entities. Text inside
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

  /**
   * Decodes attribute values. Use this method to decode HTML/XML entities. It's separate from {@link decodeText}
   * because HTML decodes attribute values differently: `&copy=2` stays intact in an attribute value, but becomes `©=2`
   * in text.
   *
   * @example
   * import { decodeHTMLAttribute } from 'speedy-entities';
   *
   * createDOMParser({ decodeAttribute: decodeHTMLAttribute });
   *
   * @param value Attribute value to decode.
   * @default No decoding
   */
  decodeAttribute?: (value: string) => string;
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

  /**
   * @see {@link ParserOptions.decodeAttribute}
   */
  decodeAttribute?: (value: string) => string;
}
