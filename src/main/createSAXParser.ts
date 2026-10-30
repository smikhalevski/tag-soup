import { resolveTokenizerOptions } from './createTokenizer.js';
import { getCaseSensitiveHashCode, type TokenCallback, tokenizeMarkup } from './tokenizeMarkup.js';
import type { ParserOptions, ResolvedParserOptions } from './types.js';

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
   * Called when a start tag is closed.
   *
   * @param tagName The start tag name.
   * @param attributes Associated attributes.
   * @param isSelfClosing `true` if tag is self-closing.
   */
  onStartTag?(tagName: string, attributes: Record<string, string>, isSelfClosing: boolean): void;

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
   * @param input The text to parse.
   * @param handler The token handler.
   */
  parseDocument(input: string, handler: SAXHandler): void;

  /**
   * Parses text as a document fragment.
   *
   * @param input The text to parse.
   * @param handler The token handler.
   */
  parseFragment(input: string, handler: SAXHandler): void;
}

/**
 * Parses text as a stream of tokens.
 *
 * @example
 * import { HTMLSAXParser } from 'tag-soup';
 *
 * HTMLSAXParser.parseFragment('Hello, <b>Bob</b>!', {
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
    parseDocument(input, handler) {
      return parseSAX(input, handler, documentOptions);
    },

    parseFragment(input, handler) {
      return parseSAX(input, handler, fragmentOptions);
    },
  };
}

/**
 * Parses text as a stream of tokens.
 *
 * @param input The text to parse.
 * @param handler The token handler.
 * @param options Parser options.
 * @returns The document node.
 */
export function parseSAX(input: string, handler: SAXHandler, options: ResolvedParserOptions = {}): void {
  const { readTag = getCaseSensitiveHashCode, rawTextTags, decodeText = identity } = options;

  const isTagNameStackUsed = handler.onStartTag !== undefined || handler.onEndTag !== undefined;

  // Text inside raw text tags isn't decoded
  const undecodedTextTags = options.decodeText !== undefined ? rawTextTags : undefined;

  const tagNameStack = ['', '', '', '', '', '', '', '', ''];

  let tagNameStackCursor = -1;
  let isRawText = false;
  let attributeNameStartIndex = 0;
  let attributeNameEndIndex = 0;
  let piTargetStartIndex = 0;
  let piTargetEndIndex = 0;
  let attributes: Record<string, string> | undefined;

  const tokenCallback: TokenCallback = (token, startIndex, endIndex) => {
    switch (token) {
      case 'TEXT':
        if (handler.onText !== undefined) {
          const text = input.substring(startIndex, endIndex);

          handler.onText(isRawText ? text : decodeText(text));
        }
        break;

      case 'START_TAG_NAME':
        let tagName;

        if (undecodedTextTags !== undefined) {
          isRawText = undecodedTextTags.has(readTag(input, startIndex, endIndex));
        }

        if (handler.onStartTagOpening !== undefined) {
          tagName = input.substring(startIndex, endIndex);
          handler.onStartTagOpening(tagName);
        }

        if (isTagNameStackUsed) {
          tagNameStack[++tagNameStackCursor] = tagName !== undefined ? tagName : input.substring(startIndex, endIndex);
        }

        if (handler.onStartTag !== undefined) {
          // No prototype, so attributes like "__proto__" are preserved
          attributes = Object.create(null);
        }
        break;

      case 'START_TAG_CLOSING':
        if (handler.onStartTagClosing !== undefined) {
          handler.onStartTagClosing();
        }

        if (handler.onStartTag !== undefined) {
          handler.onStartTag(tagNameStack[tagNameStackCursor], attributes!, false);
          attributes = undefined;
        }
        break;

      case 'START_TAG_SELF_CLOSING':
        isRawText = false;

        if (handler.onStartTagSelfClosing !== undefined) {
          handler.onStartTagSelfClosing();
        }

        if (handler.onStartTag !== undefined) {
          handler.onStartTag(tagNameStack[tagNameStackCursor], attributes!, true);
          attributes = undefined;
        }

        --tagNameStackCursor;
        break;

      case 'END_TAG_NAME':
        isRawText = false;

        if (handler.onEndTag !== undefined) {
          handler.onEndTag(tagNameStack[tagNameStackCursor]);
        }

        --tagNameStackCursor;
        break;

      case 'ATTRIBUTE_NAME':
        attributeNameStartIndex = startIndex;
        attributeNameEndIndex = endIndex;
        break;

      case 'ATTRIBUTE_VALUE':
        if (attributes === undefined && handler.onAttribute === undefined) {
          break;
        }

        const attributeName = input.substring(attributeNameStartIndex, attributeNameEndIndex);
        const attributeValue = decodeText(input.substring(startIndex, endIndex));

        if (attributes !== undefined) {
          attributes[attributeName] = attributeValue;
        }

        if (handler.onAttribute !== undefined) {
          handler.onAttribute(attributeName, attributeValue);
        }
        break;

      case 'CDATA_SECTION':
        if (handler.onCDATASection !== undefined) {
          handler.onCDATASection(input.substring(startIndex, endIndex));
        }
        break;

      case 'COMMENT':
        if (handler.onComment !== undefined) {
          handler.onComment(input.substring(startIndex, endIndex));
        }
        break;

      case 'DOCTYPE_NAME':
        if (handler.onDoctype !== undefined) {
          handler.onDoctype(input.substring(startIndex, endIndex));
        }
        break;

      case 'PROCESSING_INSTRUCTION_TARGET':
        piTargetStartIndex = startIndex;
        piTargetEndIndex = endIndex;
        break;

      case 'PROCESSING_INSTRUCTION_DATA':
        if (handler.onProcessingInstruction !== undefined) {
          handler.onProcessingInstruction(
            input.substring(piTargetStartIndex, piTargetEndIndex),
            input.substring(startIndex, endIndex)
          );
        }
        break;
    }
  };

  tokenizeMarkup(input, tokenCallback, options);
}

function identity(value: string): string {
  return value;
}
