import { resolveTokenizerOptions } from './createTokenizer.js';
import { TokenCallback, tokenizeMarkup } from './tokenizeMarkup.js';

import { ParserOptions, ResolvedParserOptions } from './types.js';

/**
 * @group SAX
 */
export interface SAXHandler {
  onText?(text: string): void;

  onStartTagOpening?(tagName: string): void;

  onStartTagClosing?(): void;

  onStartTagSelfClosing?(): void;

  onEndTag?(tagName: string): void;

  onAttribute?(name: string, value: string): void;

  onCDATASection?(data: string): void;

  onComment?(data: string): void;

  onDoctype?(name: string): void;

  onProcessingInstruction?(target: string, data: string): void;
}

/**
 * Parses text as a stream of tokens.
 *
 * @group SAX
 */
export interface SAXParser {
  /**
   * Parses text as a document.
   *
   * @param text The text to parse.
   * @param handler The token handler.
   */
  parseDocument(text: string, handler: SAXHandler): void;

  /**
   * Parses text as a document fragment.
   *
   * @param text The text to parse.
   * @param handler The token handler.
   */
  parseDocumentFragment(text: string, handler: SAXHandler): void;
}

/**
 * Parses text as a stream of tokens.
 *
 * @example
 * import { createSAXParser, htmlTokenizerOptions } from 'tag-soup';
 *
 * const parser = createSAXParser(htmlTokenizerOptions);
 *
 * parser.parseDocumentFragment('Hello, <b>Bob</b>!', {
 *   onStartTagOpening(tagName) {
 *     // Handle <b> tag
 *   },
 * });
 *
 * @param options Parser options.
 * @group SAX
 */
export function createSAXParser(options: ParserOptions = {}): SAXParser {
  const { decodeText } = options;

  const documentOptions: ResolvedParserOptions = { ...resolveTokenizerOptions(options), decodeText };

  const documentFragmentOptions: ResolvedParserOptions = { ...documentOptions, isDocumentFragment: true };

  return {
    parseDocument(text, handler) {
      parseSAX(text, handler, documentOptions);
    },

    parseDocumentFragment(text, handler) {
      parseSAX(text, handler, documentFragmentOptions);
    },
  };
}

/**
 * Parses text as a document.
 *
 * @example
 * parseSAX('Hello, <b>Bob</b>!', createTokenizer(htmlTokenizerOptions());
 *
 * @param text The text to parse.
 * @param handler The token handler.
 * @param options Parser options.
 * @returns The document node.
 */
export function parseSAX(text: string, handler: SAXHandler, options: ResolvedParserOptions = {}): void {
  const { decodeText } = options;

  let attributeName: string;
  let processingInstructionTarget: string;
  let data: string;

  const tokenCallback: TokenCallback = (token, startIndex, endIndex) => {
    switch (token) {
      case 'TEXT':
        data = text.substring(startIndex, endIndex);

        if (handler.onText !== undefined) {
          handler.onText(decodeText !== undefined ? decodeText(data) : data);
        }
        break;

      case 'START_TAG_NAME':
        if (handler.onStartTagOpening !== undefined) {
          handler.onStartTagOpening(text.substring(startIndex, endIndex));
        }
        break;

      case 'START_TAG_CLOSING':
        if (handler.onStartTagClosing !== undefined) {
          handler.onStartTagClosing();
        }
        break;

      case 'START_TAG_SELF_CLOSING':
        if (handler.onStartTagSelfClosing !== undefined) {
          handler.onStartTagSelfClosing();
        }
        break;

      case 'END_TAG_NAME':
        if (handler.onEndTag !== undefined) {
          handler.onEndTag(text.substring(startIndex, endIndex));
        }
        break;

      case 'ATTRIBUTE_NAME':
        attributeName = text.substring(startIndex, endIndex);
        break;

      case 'ATTRIBUTE_VALUE':
        data = text.substring(startIndex, endIndex);

        if (handler.onAttribute !== undefined) {
          handler.onAttribute(attributeName, decodeText !== undefined ? decodeText(data) : data);
        }
        break;

      case 'CDATA_SECTION':
        if (handler.onCDATASection !== undefined) {
          handler.onCDATASection(text.substring(startIndex, endIndex));
        }
        break;

      case 'COMMENT':
        if (handler.onComment !== undefined) {
          handler.onComment(text.substring(startIndex, endIndex));
        }
        break;

      case 'DOCTYPE_NAME':
        if (handler.onDoctype !== undefined) {
          handler.onDoctype(text.substring(startIndex, endIndex));
        }
        break;

      case 'PROCESSING_INSTRUCTION_TARGET':
        processingInstructionTarget = text.substring(startIndex, endIndex);
        break;

      case 'PROCESSING_INSTRUCTION_DATA':
        if (handler.onProcessingInstruction !== undefined) {
          handler.onProcessingInstruction(processingInstructionTarget, text.substring(startIndex, endIndex));
        }
        break;
    }
  };

  tokenizeMarkup(text, tokenCallback, options);
}
