import { resolveTokenizerOptions, type TokenizerConfig } from './resolveTokenizerOptions.ts';
import { createTokenizerState, createTokenizerWriter } from './tokenizeMarkup.ts';
import type { TokenCallback, TokenizerOptions, TokenizerWriter } from './types.ts';

/**
 * Reads tokens from text and returns them by invoking a callback.
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
   * @param callback The callback that is invoked when a token is read.
   * @throws {@link MarkupSyntaxError} If text is malformed and tokenizer options don't allow to recover.
   */
  tokenizeDocument(text: string, callback: TokenCallback): void;

  /**
   * Reads tokens from a document fragment.
   *
   * DOCTYPE isn't recognized.
   *
   * @param text The text to read tokens from.
   * @param callback The callback that is invoked when a token is read.
   * @throws {@link MarkupSyntaxError} If text is malformed and tokenizer options don't allow to recover.
   */
  tokenizeFragment(text: string, callback: TokenCallback): void;

  /**
   * Creates a writer that reads tokens from a document written in chunks.
   *
   * Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @example
   * const writer = HTMLTokenizer.createDocumentWriter((tokenKind, startIndex, endIndex, input) => {
   *   input.substring(startIndex, endIndex);
   *   // ⮕ The token text
   * });
   *
   * writer.write('<p>Hello, ');
   * writer.write('Bob!');
   * writer.end();
   *
   * @param callback The callback that is invoked when a token is read.
   * @returns The new writer.
   */
  createDocumentWriter(callback: TokenCallback): TokenizerWriter;

  /**
   * Creates a writer that reads tokens from a document fragment written in chunks.
   *
   * DOCTYPE isn't recognized.
   *
   * @param callback The callback that is invoked when a token is read.
   * @returns The new writer.
   */
  createFragmentWriter(callback: TokenCallback): TokenizerWriter;
}

/**
 * Creates a tokenizer that reads tokens from text and returns them by invoking a callback.
 *
 * Tokens are _guaranteed_ to be balanced: each start tag is followed by a matching end tag. Missing tokens are inserted
 * if needed.
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
 * tokenizer.tokenizeFragment(
 *   'Hello, <b>Bob</b>!',
 *   (tokenKind, startIndex, endIndex) => {
 *     // Handle token here
 *   },
 * );
 *
 * @param options Tokenizer options.
 * @returns The new tokenizer.
 * @group Tokenizer
 */
export function createTokenizer(options: TokenizerOptions = {}): Tokenizer {
  const documentConfig: TokenizerConfig = resolveTokenizerOptions(options);

  const fragmentConfig: TokenizerConfig = { ...documentConfig, isFragment: true };

  return {
    tokenizeDocument(text, callback) {
      createTokenizerWriter(callback, documentConfig, createTokenizerState(documentConfig.initialContext)).end(text);
    },

    tokenizeFragment(text, callback) {
      createTokenizerWriter(callback, fragmentConfig, createTokenizerState(fragmentConfig.initialContext)).end(text);
    },

    createDocumentWriter(callback) {
      return createTokenizerWriter(callback, documentConfig, createTokenizerState(documentConfig.initialContext));
    },

    createFragmentWriter(callback) {
      return createTokenizerWriter(callback, fragmentConfig, createTokenizerState(fragmentConfig.initialContext));
    },
  };
}
