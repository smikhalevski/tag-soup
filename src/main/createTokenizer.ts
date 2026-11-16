import { createTokenizerWriter } from './createTokenizerWriter.ts';
import { resolveTokenizerOptions, type TokenizerConfig } from './resolveTokenizerOptions.ts';
import type { TokenHandler, TokenizerOptions, TokenizerWriter } from './types.ts';

/**
 * Reads tokens from an input and passes them to a {@link TokenHandler}.
 *
 * @see {@link createTokenizer}
 * @group Tokenizer
 */
export interface Tokenizer {
  /**
   * Reads tokens from a document.
   *
   * Before the first tag or text, spaces are skipped and DOCTYPE is read.
   *
   * @param input The input to read tokens from.
   * @param handler The handler that receives tokens.
   * @throws {@link MarkupSyntaxError} If the input is malformed and tokenizer options don't allow recovery.
   */
  tokenizeDocument(input: string, handler: TokenHandler): void;

  /**
   * Reads tokens from a document fragment.
   *
   * DOCTYPE isn't read.
   *
   * @param input The input to read tokens from.
   * @param handler The handler that receives tokens.
   * @throws {@link MarkupSyntaxError} If the input is malformed and tokenizer options don't allow recovery.
   */
  tokenizeFragment(input: string, handler: TokenHandler): void;

  /**
   * Creates a writer that reads tokens from a document written in chunks.
   *
   * Before the first tag or text, spaces are skipped and DOCTYPE is read.
   *
   * @example
   * const writer = HTMLTokenizer.createDocumentWriter({
   *   onText(input, startIndex, endIndex, isRawText) {
   *     input.substring(startIndex, endIndex);
   *     // ⮕ The token text
   *   },
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
   * DOCTYPE isn't read.
   *
   * @param handler The handler that receives tokens.
   * @returns The new writer.
   */
  createFragmentWriter(handler: TokenHandler): TokenizerWriter;
}

/**
 * Creates a tokenizer that reads tokens from an input and passes them to a {@link TokenHandler}.
 *
 * Tokens are _guaranteed_ to be balanced: each start tag is followed by a matching end tag, unless it's self-closing.
 * Missing tags are inserted and unbalanced end tags are ignored as options allow, otherwise a {@link MarkupSyntaxError}
 * is thrown.
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
 *   onStartTagName(input, startIndex, endIndex) {
 *     // Handle the start tag name here
 *   },
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
