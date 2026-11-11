import { resolveTokenizerOptions, type TokenizerConfig } from './resolveTokenizerOptions.ts';
import { createTokenizerWriter } from './tokenizeMarkup.ts';
import type { TokenHandler, TokenizerOptions, TokenizerWriter } from './types.ts';

/**
 * Reads tokens from text and passes them to a {@link TokenHandler}.
 *
 * @see {@link createTokenizer}
 * @group Tokenizer
 */
export interface Tokenizer {
  /**
   * Reads tokens from a document.
   *
   * Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @param text The text to read tokens from.
   * @param handler The handler that receives tokens.
   * @throws {@link MarkupSyntaxError} If text is malformed and tokenizer options don't allow to recover.
   */
  tokenizeDocument(text: string, handler: TokenHandler): void;

  /**
   * Reads tokens from a document fragment.
   *
   * DOCTYPE isn't recognized.
   *
   * @param text The text to read tokens from.
   * @param handler The handler that receives tokens.
   * @throws {@link MarkupSyntaxError} If text is malformed and tokenizer options don't allow to recover.
   */
  tokenizeFragment(text: string, handler: TokenHandler): void;

  /**
   * Creates a writer that reads tokens from a document written in chunks.
   *
   * Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @example
   * const writer = HTMLTokenizer.createDocumentWriter({
   *   onText(startIndex, endIndex, input, isRawText) {
   *     input.substring(startIndex, endIndex);
   *     // ⮕ The token text
   *   },
   *   // …other TokenHandler methods
   * });
   *
   * writer.write('<p>Hello, ');
   * writer.write('Bob!');
   * writer.end();
   *
   * @param handler The handler that receives tokens.
   * @returns The new writer.
   */
  createDocumentWriter(handler: TokenHandler): TokenizerWriter;

  /**
   * Creates a writer that reads tokens from a document fragment written in chunks.
   *
   * DOCTYPE isn't recognized.
   *
   * @param handler The handler that receives tokens.
   * @returns The new writer.
   */
  createFragmentWriter(handler: TokenHandler): TokenizerWriter;
}

/**
 * Creates a tokenizer that reads tokens from text and passes them to a {@link TokenHandler}.
 *
 * Tokens are _guaranteed_ to be balanced: each start tag is followed by a matching end tag, unless it's self-closing.
 * Missing tokens are inserted if needed.
 *
 * @example
 * import { createTokenizer } from 'tag-soup';
 *
 * const tokenizer = createTokenizer({
 *   tags: {
 *     br: { kind: 'void' },
 *   },
 * });
 *
 * tokenizer.tokenizeFragment('Hello, <b>Bob</b>!', {
 *   onStartTagName(startIndex, endIndex, input) {
 *     // Handle the start tag name here
 *   },
 *   // …other TokenHandler methods
 * });
 *
 * @param options Tokenizer options.
 * @returns The new tokenizer.
 * @group Tokenizer
 */
export function createTokenizer(options: TokenizerOptions = {}): Tokenizer {
  const documentConfig: TokenizerConfig = resolveTokenizerOptions(options);

  const fragmentConfig: TokenizerConfig = { ...documentConfig, isFragment: true };

  return {
    tokenizeDocument(text, handler) {
      createTokenizerWriter(handler, documentConfig).end(text);
    },

    tokenizeFragment(text, handler) {
      createTokenizerWriter(handler, fragmentConfig).end(text);
    },

    createDocumentWriter(handler) {
      return createTokenizerWriter(handler, documentConfig);
    },

    createFragmentWriter(handler) {
      return createTokenizerWriter(handler, fragmentConfig);
    },
  };
}
