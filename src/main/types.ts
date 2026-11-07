import { resolveTokenizerOptions, type TokenizerOptions } from './createTokenizer.ts';
import type { ResolvedTokenizerOptions } from './tokenizeMarkup.ts';

/**
 * Options of {@link createDOMParser} and {@link createSAXParser}.
 *
 * @group Parser
 */
export interface ParserOptions extends TokenizerOptions {
  /**
   * Decodes text content. Use this method to decode HTML/XML entities. Text inside
   * {@link TagParsingOptions.kind raw text tags}, comments, CDATA sections and processing instructions isn't
   * decoded.
   *
   * By default, text isn't decoded.
   *
   * @example
   * import { decodeHTML } from 'speedy-entities';
   *
   * createDOMParser({ decodeText: decodeHTML });
   *
   * @param text The text to decode.
   */
  decodeText?: (text: string) => string;

  /**
   * Decodes attribute values. Use this method to decode HTML/XML entities. It's separate from {@link decodeText}
   * because HTML decodes attribute values differently: `&copy=2` stays intact in an attribute value, but becomes `©=2`
   * in text.
   *
   * By default, attribute values aren't decoded.
   *
   * @example
   * import { decodeHTMLAttribute } from 'speedy-entities';
   *
   * createDOMParser({ decodeAttribute: decodeHTMLAttribute });
   *
   * @param value The attribute value to decode.
   */
  decodeAttribute?: (value: string) => string;

  /**
   * If `true`, CR LF pairs and CR chars in the input are replaced with LF before it's parsed, like HTML does. Indices
   * in {@link ParserError} point to the replaced input.
   *
   * @default false
   * @see [HTML Preprocessing the Input Stream](https://html.spec.whatwg.org/multipage/parsing.html#preprocessing-the-input-stream)
   */
  areNewlinesNormalized?: boolean;

  /**
   * If `true`, NUL chars are removed from text outside of {@link TagParsingOptions.kind raw text tags} and
   * {@link foreignTags foreign tags}, and replaced with U+FFFD everywhere else, like HTML does.
   *
   * @default false
   */
  areNullCharactersReplaced?: boolean;
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

  /**
   * @see {@link ParserOptions.areNewlinesNormalized}
   */
  areNewlinesNormalized?: boolean;

  /**
   * @see {@link ParserOptions.areNullCharactersReplaced}
   */
  areNullCharactersReplaced?: boolean;
}

/**
 * Converts human-readable parser options into options consumed by {@link parseDOM} and {@link parseSAX}.
 *
 * @param options Parser options.
 * @internal
 */
export function resolveParserOptions(options: ParserOptions): ResolvedParserOptions {
  const { decodeText, decodeAttribute, areNewlinesNormalized, areNullCharactersReplaced } = options;

  return {
    ...resolveTokenizerOptions(options),
    decodeText,
    decodeAttribute,
    areNewlinesNormalized,
    areNullCharactersReplaced,
  };
}

/**
 * Replaces CR LF pairs and CR chars with LF.
 *
 * @internal
 */
export function normalizeNewlines(input: string): string {
  // Most inputs don't have CR, and a search for a char is faster than a regular expression
  return input.indexOf('\r') !== -1 ? input.replace(/\r\n?/g, '\n') : input;
}
