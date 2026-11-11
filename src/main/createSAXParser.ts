import { type ParserConfig, resolveParserOptions } from './resolveParserOptions.ts';
import type { TagParsingConfig } from './resolveTokenizerOptions.ts';
import { createTokenizerWriter, type TokenHandler } from './tokenizeMarkup.ts';
import { type ParserOptions, type ParserWriter } from './types.ts';
import { keepHiddenClasses } from './utils.ts';

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
   * {@link TokenizerContextOptions.areSelfClosingTagsRecognized self-closing tags are recognized}.
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
   * @throws {@link MarkupSyntaxError} If input is malformed and parser options don't allow to recover.
   */
  parseDocument(input: string, handler: SAXHandler): void;

  /**
   * Parses text as a document fragment.
   *
   * DOCTYPE isn't recognized.
   *
   * @param input The text to parse.
   * @param handler The token handler.
   * @throws {@link MarkupSyntaxError} If input is malformed and parser options don't allow to recover.
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
  const documentConfig: ParserConfig = resolveParserOptions(options);

  const fragmentConfig: ParserConfig = { ...documentConfig, isFragment: true };

  return {
    parseDocument(input, handler) {
      createSAXParserWriter(handler, documentConfig).end(input);
    },

    parseFragment(input, handler) {
      createSAXParserWriter(handler, fragmentConfig).end(input);
    },

    createDocumentWriter(handler) {
      return createSAXParserWriter(handler, documentConfig);
    },

    createFragmentWriter(handler) {
      return createSAXParserWriter(handler, fragmentConfig);
    },
  };
}

/**
 * Creates a writer that parses chunks of text and calls {@link SAXHandler} methods.
 *
 * @see {@link createTokenizerWriter}
 */
function createSAXParserWriter(handler: SAXHandler, config: ParserConfig): ParserWriter {
  return createTokenizerWriter(new SAXTokenHandler(handler, config), config);
}

/**
 * Calls {@link SAXHandler} methods for tokens.
 */
class SAXTokenHandler implements TokenHandler {
  handler: SAXHandler;
  decodeText: (text: string) => string;
  decodeAttribute: (value: string) => string;
  isTagNameStackUsed: boolean;
  tagNameStack = ['', '', '', '', '', '', '', '', ''];
  tagNameStackCursor = -1;
  isRawText = false;
  attributeNameStartIndex = 0;
  attributeNameEndIndex = 0;
  piTargetStartIndex = 0;
  piTargetEndIndex = 0;
  attributes: Record<string, string> | undefined = undefined;

  constructor(handler: SAXHandler, config: ParserConfig) {
    this.handler = handler;
    this.decodeText = config.decodeText;
    this.decodeAttribute = config.decodeAttribute;
    this.isTagNameStackUsed = handler.onStartTag !== undefined || handler.onEndTag !== undefined;
  }

  onText(startIndex: number, endIndex: number, input: string): void {
    const handler = this.handler;

    if (handler.onText !== undefined) {
      const text = input.substring(startIndex, endIndex);

      // Called through a local, so the decoder gets `this` undefined
      const decodeText = this.decodeText;

      handler.onText(this.isRawText ? text : decodeText(text));
    }
  }

  onStartTagName(startIndex: number, endIndex: number, input: string, tagConfig: TagParsingConfig | undefined): void {
    const handler = this.handler;

    let tagName;

    this.isRawText = tagConfig !== undefined && tagConfig.isRawText;

    if (handler.onStartTagOpening !== undefined) {
      tagName = input.substring(startIndex, endIndex);

      handler.onStartTagOpening(tagName);
    }

    if (this.isTagNameStackUsed) {
      this.tagNameStack[++this.tagNameStackCursor] =
        tagName !== undefined ? tagName : input.substring(startIndex, endIndex);
    }

    if (handler.onStartTag !== undefined) {
      this.attributes = {};
    }
  }

  onStartTagClosing(): void {
    const handler = this.handler;

    if (handler.onStartTagClosing !== undefined) {
      handler.onStartTagClosing();
    }

    if (handler.onStartTag !== undefined) {
      handler.onStartTag(this.tagNameStack[this.tagNameStackCursor], this.attributes!, false);
      this.attributes = undefined;
    }
  }

  onStartTagSelfClosing(): void {
    const handler = this.handler;

    this.isRawText = false;

    if (handler.onStartTagSelfClosing !== undefined) {
      handler.onStartTagSelfClosing();
    }

    if (handler.onStartTag !== undefined) {
      handler.onStartTag(this.tagNameStack[this.tagNameStackCursor], this.attributes!, true);
      this.attributes = undefined;
    }

    --this.tagNameStackCursor;
  }

  onEndTagName(): void {
    const handler = this.handler;

    this.isRawText = false;

    if (handler.onEndTag !== undefined) {
      handler.onEndTag(this.tagNameStack[this.tagNameStackCursor]);
    }

    --this.tagNameStackCursor;
  }

  onAttributeName(startIndex: number, endIndex: number): void {
    this.attributeNameStartIndex = startIndex;
    this.attributeNameEndIndex = endIndex;
  }

  onAttributeValue(startIndex: number, endIndex: number, input: string): void {
    const handler = this.handler;
    const attributes = this.attributes;

    if (attributes === undefined && handler.onAttribute === undefined) {
      return;
    }

    const name = input.substring(this.attributeNameStartIndex, this.attributeNameEndIndex);
    // Called through a local, so the decoder gets `this` undefined
    const decodeAttribute = this.decodeAttribute;
    const value = decodeAttribute(input.substring(startIndex, endIndex));

    if (attributes !== undefined) {
      // Assigning __proto__ would set the prototype rather than add an attribute
      if (name === '__proto__') {
        Object.defineProperty(attributes, name, { value, writable: true, enumerable: true, configurable: true });
      } else {
        attributes[name] = value;
      }
    }

    if (handler.onAttribute !== undefined) {
      handler.onAttribute(name, value);
    }
  }

  onComment(startIndex: number, endIndex: number, input: string): void {
    if (this.handler.onComment !== undefined) {
      this.handler.onComment(input.substring(startIndex, endIndex));
    }
  }

  onProcessingInstructionTarget(startIndex: number, endIndex: number): void {
    this.piTargetStartIndex = startIndex;
    this.piTargetEndIndex = endIndex;
  }

  onProcessingInstructionData(startIndex: number, endIndex: number, input: string): void {
    if (this.handler.onProcessingInstruction !== undefined) {
      this.handler.onProcessingInstruction(
        input.substring(this.piTargetStartIndex, this.piTargetEndIndex),
        input.substring(startIndex, endIndex)
      );
    }
  }

  onCDATASection(startIndex: number, endIndex: number, input: string): void {
    if (this.handler.onCDATASection !== undefined) {
      this.handler.onCDATASection(input.substring(startIndex, endIndex));
    }
  }

  onDoctypeName(startIndex: number, endIndex: number, input: string): void {
    if (this.handler.onDoctype !== undefined) {
      this.handler.onDoctype(input.substring(startIndex, endIndex));
    }
  }
}

keepHiddenClasses(new SAXTokenHandler({}, resolveParserOptions({})));
