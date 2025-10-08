import { resolveTokenizerOptions } from './createTokenizer.js';
import { TokenCallback, tokenizeMarkup } from './tokenizeMarkup.js';
import { ParserOptions, ResolvedParserOptions } from './types.js';

/**
 * Handler which methods are called during parsing.
 *
 * @group SAX
 */
export interface SAXHandler {
  /**
   * Called when a text is read.
   *
   * @param text The decoded text.
   */
  onText?(text: string): void;

  /**
   * Called when a start tag name is read.
   *
   * @param tagName The start tag name.
   */
  onStartTagOpening?(tagName: string): void;

  /**
   * Called when a start tag is closed.
   */
  onStartTagClosing?(): void;

  /**
   * Called when a start tag is self-closed.
   */
  onStartTagSelfClosing?(): void;

  /**
   * Called when an end tag is read.
   *
   * @param tagName The tag name that matches the currently opened start tag.
   */
  onEndTag?(tagName: string): void;

  /**
   * Called when an attribute and its value are read.
   *
   * @param name The attribute name.
   * @param value The decoded attribute value.
   */
  onAttribute?(name: string, value: string): void;

  /**
   * Called when a CDATA section is read.
   *
   * @param data The CDATA section value.
   */
  onCDATASection?(data: string): void;

  /**
   * Called when a comment is read.
   *
   * @param data The decoded comment.
   */
  onComment?(data: string): void;

  /**
   * Called when a DOCTYPE is read.
   *
   * @param name The DOCTYPE name.
   */
  onDoctype?(name: string): void;

  /**
   * Called when a processing instruction is read.
   *
   * @param target The processing instruction target.
   * @param data The processing instruction content.
   */
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
  parseFragment(text: string, handler: SAXHandler): void;
}

/**
 * Parses text as a stream of tokens.
 *
 * @example
 * import { createSAXParser, htmlTokenizerOptions } from 'tag-soup';
 *
 * const parser = createSAXParser(htmlTokenizerOptions);
 *
 * parser.parseFragment('Hello, <b>Bob</b>!', {
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

  const fragmentOptions: ResolvedParserOptions = { ...documentOptions, isFragment: true };

  return {
    parseDocument(text, handler) {
      return parseSAX(text, handler, documentOptions);
    },

    parseFragment(text, handler) {
      return parseSAX(text, handler, fragmentOptions);
    },
  };
}

/**
 * Parses text as a stream of tokens.
 *
 * @param text The text to parse.
 * @param handler The token handler.
 * @param options Parser options.
 * @returns The document node.
 */
export function parseSAX(text: string, handler: SAXHandler, options: ResolvedParserOptions = {}): void {
  const { decodeText = identity } = options;

  const tagNameStack: string[] = ['', '', '', '', '', '', '', '', ''];

  let tagNameStackCursor = -1;
  let attributeNameStartIndex = 0;
  let attributeNameEndIndex = 0;
  let piTargetStartIndex = 0;
  let piTargetEndIndex = 0;

  const tokenCallback: TokenCallback = (token, startIndex, endIndex) => {
    switch (token) {
      case 'TEXT':
        if (handler.onText !== undefined) {
          handler.onText(decodeText(text.substring(startIndex, endIndex)));
        }
        break;

      case 'START_TAG_NAME':
        let tagName;

        if (handler.onStartTagOpening !== undefined) {
          tagName = text.substring(startIndex, endIndex);
          handler.onStartTagOpening(tagName);
        }

        if (handler.onEndTag !== undefined) {
          tagNameStack[++tagNameStackCursor] = tagName === undefined ? text.substring(startIndex, endIndex) : tagName;
        }
        break;

      case 'START_TAG_CLOSING':
        if (handler.onStartTagClosing !== undefined) {
          handler.onStartTagClosing();
        }
        break;

      case 'START_TAG_SELF_CLOSING':
        --tagNameStackCursor;

        if (handler.onStartTagSelfClosing !== undefined) {
          handler.onStartTagSelfClosing();
        }
        break;

      case 'END_TAG_NAME':
        if (handler.onEndTag !== undefined) {
          handler.onEndTag(tagNameStack[tagNameStackCursor--]);
        }
        break;

      case 'ATTRIBUTE_NAME':
        attributeNameStartIndex = startIndex;
        attributeNameEndIndex = endIndex;
        break;

      case 'ATTRIBUTE_VALUE':
        if (handler.onAttribute !== undefined) {
          handler.onAttribute(
            text.substring(attributeNameStartIndex, attributeNameEndIndex),
            decodeText(text.substring(startIndex, endIndex))
          );
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
        piTargetStartIndex = startIndex;
        piTargetEndIndex = endIndex;
        break;

      case 'PROCESSING_INSTRUCTION_DATA':
        if (handler.onProcessingInstruction !== undefined) {
          handler.onProcessingInstruction(
            text.substring(piTargetStartIndex, piTargetEndIndex),
            text.substring(startIndex, endIndex)
          );
        }
        break;
    }
  };

  tokenizeMarkup(text, tokenCallback, options);
}

function identity(value: string): string {
  return value;
}
