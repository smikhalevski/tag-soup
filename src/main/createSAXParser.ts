import { type TokenCallback, tokenizeMarkup, type TokenizerState } from './tokenizeMarkup.ts';
import { type ParserOptions, type ResolvedParserOptions, resolveParserOptions } from './types.ts';

/**
 * Handler whose methods are called during parsing. All methods are optional, implement only the ones you need.
 *
 * Callbacks for a tag are called in this order: {@link onStartTagOpening}, {@link onAttribute} for each attribute,
 * {@link onStartTagClosing} or {@link onStartTagSelfClosing}, {@link onStartTag}, and then {@link onEndTag} after
 * the tag content.
 *
 * @group SAX
 */
export interface SAXHandler {
  /**
   * Called when text is read.
   *
   * @param text The decoded text. Text inside {@link TagParsingOptions.kind raw text tags} isn't decoded.
   */
  onText?(text: string): void;

  /**
   * Called when a start tag name is read, before its attributes.
   *
   * @param tagName The start tag name.
   */
  onStartTagOpening?(tagName: string): void;

  /**
   * Called when a start tag is closed with `>`.
   */
  onStartTagClosing?(): void;

  /**
   * Called when a start tag is closed with `/>`. Only called if
   * {@link ContextualTokenizerOptions.areSelfClosingTagsRecognized self-closing tags are recognized}.
   */
  onStartTagSelfClosing?(): void;

  /**
   * Called when a start tag and all its attributes are read.
   *
   * @param tagName The start tag name.
   * @param attributes The decoded attribute values by attribute name.
   * @param isSelfClosing `true` if the tag is self-closing. {@link onEndTag} isn't called for self-closing tags.
   */
  onStartTag?(tagName: string, attributes: Record<string, string>, isSelfClosing: boolean): void;

  /**
   * Called when a tag is ended: by its end tag, implicitly, or right after the start tag of a void tag. Not called for
   * self-closing tags.
   *
   * @param tagName The name of the tag that is ended.
   */
  onEndTag?(tagName: string): void;

  /**
   * Called when an attribute and its value are read.
   *
   * @param name The attribute name.
   * @param value The decoded attribute value. An empty string if the attribute has no value.
   */
  onAttribute?(name: string, value: string): void;

  /**
   * Called when a CDATA section is read.
   *
   * @param data The CDATA section content.
   */
  onCDATASection?(data: string): void;

  /**
   * Called when a comment is read.
   *
   * @param data The comment content.
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
 * Parses text and calls {@link SAXHandler} methods when tokens are read.
 *
 * @see {@link createSAXParser}
 * @group SAX
 */
export interface SAXParser {
  /**
   * Parses text as a document. Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @param input The text to parse.
   * @param handler The token handler.
   * @throws {@link ParserError} If input is malformed and parser options don't allow to recover.
   */
  parseDocument(input: string, handler: SAXHandler): void;

  /**
   * Parses text as a document fragment. DOCTYPE isn't recognized.
   *
   * @param input The text to parse.
   * @param handler The token handler.
   * @throws {@link ParserError} If input is malformed and parser options don't allow to recover.
   */
  parseFragment(input: string, handler: SAXHandler): void;
}

/**
 * Creates a parser that parses text and calls {@link SAXHandler} methods when tokens are read.
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
 * @returns The new SAX parser.
 * @group SAX
 */
export function createSAXParser(options: ParserOptions = {}): SAXParser {
  const documentOptions: ResolvedParserOptions = resolveParserOptions(options);

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
 * Parses text and calls {@link SAXHandler} methods when tokens are read.
 *
 * @param input The text to parse.
 * @param handler The token handler.
 * @param options Parser options.
 * @throws {@link ParserError} If input is malformed and options don't allow to recover.
 * @internal
 */
export function parseSAX(input: string, handler: SAXHandler, options: ResolvedParserOptions = { context: {} }): void {
  const { decodeText = identity, decodeAttribute = identity } = options;

  const isTagNameStackUsed = handler.onStartTag !== undefined || handler.onEndTag !== undefined;

  // The tokenizer looks up each start tag, so it isn't looked up again here
  const state: TokenizerState = { tagHashCode: 0, tagOptions: undefined, context: options.context };

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

      case 'START_TAG_NAME': {
        let tagName;

        // Text inside raw text tags isn't decoded
        isRawText = state.tagOptions !== undefined && state.tagOptions.isRawText;

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
      }

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

      case 'ATTRIBUTE_VALUE': {
        if (attributes === undefined && handler.onAttribute === undefined) {
          break;
        }

        const attributeName = input.substring(attributeNameStartIndex, attributeNameEndIndex);
        const attributeValue = decodeAttribute(input.substring(startIndex, endIndex));

        if (attributes !== undefined) {
          attributes[attributeName] = attributeValue;
        }

        if (handler.onAttribute !== undefined) {
          handler.onAttribute(attributeName, attributeValue);
        }
        break;
      }

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

  tokenizeMarkup(input, tokenCallback, options, state);
}

function identity(value: string): string {
  return value;
}
