import {ResolvedTokenizerOptions} from "./tokenizeMarkup.js";
import {TokenizerOptions} from "./createTokenizer.js";

/**
 * Options of the {@link createDOMParser}.
 *
 * @group Parser
 */
export interface ParserOptions extends Omit<TokenizerOptions, 'isDocumentFragment'> {
  /**
   * Decode text content before it is pushed to an DOM node. Use this method to decode HTML entities.
   *
   * @param text Text to decode.
   */
  decodeText?: (text: string) => string;
}

export interface ResolvedParserOptions extends ResolvedTokenizerOptions {
  isDocumentFragment?: boolean;
  decodeText?: (text: string) => string;
}