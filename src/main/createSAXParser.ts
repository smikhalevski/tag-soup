import { type ResolvedParserOptions, resolveParserOptions } from './resolveParserOptions.ts';
import { createTokenizerState, createTokenizerWriter } from './tokenizeMarkup.ts';
import { type ParserOptions, type ParserWriter, type TokenCallback } from './types.ts';

/**
 * Handler whose methods are called during parsing. All methods are optional, implement only the ones you need.
 *
 * Callbacks for a tag are called in this order:
 * 1. {@link onStartTagOpening},
 * 2. {@link onAttribute} for each attribute,
 * 3. {@link onStartTagClosing} or {@link onStartTagSelfClosing},
 * 4. {@link onStartTag},
 * 5. {@link onEndTag} after the tag content.
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
   * Called when a start tag name is read.
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
   * Called when a tag is ended: by its end tag, implicitly, or right after the start tag of a void tag.
   *
   * **Note:** Not called for self-closing tags.
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
   * Parses text as a document.
   *
   * Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @param input The text to parse.
   * @param handler The token handler.
   * @throws {@link ParserError} If input is malformed and parser options don't allow to recover.
   */
  parseDocument(input: string, handler: SAXHandler): void;

  /**
   * Parses text as a document fragment.
   *
   * DOCTYPE isn't recognized.
   *
   * @param input The text to parse.
   * @param handler The token handler.
   * @throws {@link ParserError} If input is malformed and parser options don't allow to recover.
   */
  parseFragment(input: string, handler: SAXHandler): void;

  /**
   * Creates a writer that parses a document written in chunks.
   *
   * Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @example
   * const writer = HTMLSAXParser.createDocumentWriter({
   *   onText(text) {
   *     // Handle text here
   *   },
   * });
   *
   * writer.write('<p>Hello, ');
   * writer.write('Bob!');
   * writer.end();
   *
   * @param handler The token handler.
   * @returns The new writer.
   */
  createDocumentWriter(handler: SAXHandler): ParserWriter;

  /**
   * Creates a writer that parses a document fragment written in chunks.
   *
   * DOCTYPE isn't recognized.
   *
   * @param handler The token handler.
   * @returns The new writer.
   */
  createFragmentWriter(handler: SAXHandler): ParserWriter;
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
      createSAXParserWriter(handler, documentOptions).end(input);
    },

    parseFragment(input, handler) {
      createSAXParserWriter(handler, fragmentOptions).end(input);
    },

    createDocumentWriter(handler) {
      return createSAXParserWriter(handler, documentOptions);
    },

    createFragmentWriter(handler) {
      return createSAXParserWriter(handler, fragmentOptions);
    },
  };
}

/**
 * Creates a writer that parses chunks of text and calls {@link SAXHandler} methods when tokens are read.
 *
 * @param handler The token handler.
 * @param options Parser options.
 * @see {@link createTokenizerWriter}
 * @internal
 */
export function createSAXParserWriter(handler: SAXHandler, options: ResolvedParserOptions): ParserWriter {
  const { decodeText, decodeAttribute } = options;

  const isTagNameStackUsed = handler.onStartTag !== undefined || handler.onEndTag !== undefined;

  const tokenizerState = createTokenizerState(options.initialContext);

  const tagNameStack = ['', '', '', '', '', '', '', '', ''];

  let tagNameStackCursor = -1;
  let isRawText = false;
  let attributeNameStartIndex = 0;
  let attributeNameEndIndex = 0;
  let piTargetStartIndex = 0;
  let piTargetEndIndex = 0;
  let attributes: Record<string, string> | undefined;

  const tokenCallback: TokenCallback = (token, startIndex, endIndex, input) => {
    switch (token) {
      case 'text':
        if (handler.onText !== undefined) {
          const text = input.substring(startIndex, endIndex);

          handler.onText(isRawText ? text : decodeText(text));
        }
        break;

      case 'start_tag_name': {
        const tagOptions = tokenizerState.tagOptions;

        let tagName;

        isRawText = tagOptions !== undefined && tagOptions.isRawText;

        if (handler.onStartTagOpening !== undefined) {
          tagName = input.substring(startIndex, endIndex);

          handler.onStartTagOpening(tagName);
        }

        if (isTagNameStackUsed) {
          tagNameStack[++tagNameStackCursor] = tagName !== undefined ? tagName : input.substring(startIndex, endIndex);
        }

        if (handler.onStartTag !== undefined) {
          attributes = {};
        }
        break;
      }

      case 'start_tag_closing':
        if (handler.onStartTagClosing !== undefined) {
          handler.onStartTagClosing();
        }

        if (handler.onStartTag !== undefined) {
          handler.onStartTag(tagNameStack[tagNameStackCursor], attributes!, false);
          attributes = undefined;
        }
        break;

      case 'end_tag_name':
        isRawText = false;

        if (handler.onEndTag !== undefined) {
          handler.onEndTag(tagNameStack[tagNameStackCursor]);
        }

        --tagNameStackCursor;
        break;

      case 'attribute_name':
        attributeNameStartIndex = startIndex;
        attributeNameEndIndex = endIndex;
        break;

      case 'attribute_value': {
        if (attributes === undefined && handler.onAttribute === undefined) {
          break;
        }

        const name = input.substring(attributeNameStartIndex, attributeNameEndIndex);
        const value = decodeAttribute(input.substring(startIndex, endIndex));

        if (attributes !== undefined) {
          if (name === '__proto__') {
            Object.defineProperty(attributes, name, { value, writable: true, enumerable: true, configurable: true });
          } else {
            attributes[name] = value;
          }
        }

        if (handler.onAttribute !== undefined) {
          handler.onAttribute(name, value);
        }
        break;
      }

      case 'start_tag_self_closing':
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

      case 'cdata_section':
        if (handler.onCDATASection !== undefined) {
          handler.onCDATASection(input.substring(startIndex, endIndex));
        }
        break;

      case 'comment':
        if (handler.onComment !== undefined) {
          handler.onComment(input.substring(startIndex, endIndex));
        }
        break;

      case 'doctype_name':
        if (handler.onDoctype !== undefined) {
          handler.onDoctype(input.substring(startIndex, endIndex));
        }
        break;

      case 'processing_instruction_target':
        piTargetStartIndex = startIndex;
        piTargetEndIndex = endIndex;
        break;

      case 'processing_instruction_data':
        if (handler.onProcessingInstruction !== undefined) {
          handler.onProcessingInstruction(
            input.substring(piTargetStartIndex, piTargetEndIndex),
            input.substring(startIndex, endIndex)
          );
        }
        break;
    }
  };

  return createTokenizerWriter(tokenCallback, options, tokenizerState);
}
