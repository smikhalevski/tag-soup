import { NamespaceStack } from './NamespaceStack.ts';
import { type ParserConfig, resolveParserOptions } from './resolveParserOptions.ts';
import { type ParserOptions, type ParserWriter, type TokenHandler } from './types.ts';
import { retainHiddenClasses } from './utils.ts';

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
   * Attributes of the tag aren't read yet, and they can declare the namespace of the tag, so the namespace is passed
   * to {@link onStartTag}.
   *
   * @param tagName The start tag name, with its prefix if there's one.
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
   * @param tagName The start tag name, with its prefix if there's one.
   * @param attributes The decoded attribute values by attribute name, including attributes that declare namespaces.
   * @param isSelfClosing `true` if the tag is self-closing. {@link onEndTag} isn't called for self-closing tags.
   * @param namespaceURI The namespace that the prefix of the tag name is bound to, or the default namespace if the tag
   * name has no prefix. `null` if the tag has no namespace, or if
   * {@link ParserOptions.areNamespacesRecognized namespaces aren't recognized}.
   */
  onStartTag?(
    tagName: string,
    attributes: Record<string, string>,
    isSelfClosing: boolean,
    namespaceURI: string | null
  ): void;

  /**
   * Called when a tag is ended: by its end tag, implicitly, or right after the start tag of a void tag.
   *
   * **Note:** Not called for self-closing tags.
   *
   * @param tagName The name of the tag that is ended, with its prefix if there's one.
   * @param namespaceURI The namespace of the tag that is ended, the same that was passed to {@link onStartTag}.
   */
  onEndTag?(tagName: string, namespaceURI: string | null): void;

  /**
   * Called when an attribute and its value are read.
   *
   * Attributes that follow can declare the namespace of this attribute, so namespaces of attributes aren't resolved.
   *
   * @param name The attribute name, with its prefix if there's one.
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
  const config = resolveParserOptions(options);

  const { tokenizer } = config;

  return {
    parseDocument(input, handler) {
      tokenizer.tokenizeDocument(input, createSAXTokenHandler(handler, config));
    },

    parseFragment(input, handler) {
      tokenizer.tokenizeFragment(input, createSAXTokenHandler(handler, config));
    },

    createDocumentWriter(handler) {
      return tokenizer.createDocumentWriter(createSAXTokenHandler(handler, config));
    },

    createFragmentWriter(handler) {
      return tokenizer.createFragmentWriter(createSAXTokenHandler(handler, config));
    },
  };
}

/**
 * Creates a handler that calls {@link SAXHandler} methods for tokens, and resolves namespaces if
 * {@link ParserConfig.areNamespacesRecognized} is `true`.
 *
 * @param handler The handler whose methods are called.
 * @param config The config from {@link resolveParserOptions}.
 */
function createSAXTokenHandler(handler: SAXHandler, config: ParserConfig): SAXTokenHandler {
  // Namespaces are passed to onStartTag and onEndTag only, so they aren't resolved for a handler that has neither
  return config.areNamespacesRecognized && (handler.onStartTag !== undefined || handler.onEndTag !== undefined)
    ? new NamespaceSAXTokenHandler(handler, config)
    : new SAXTokenHandler(handler, config);
}

/**
 * Calls {@link SAXHandler} methods for tokens. Tags have no namespace.
 */
class SAXTokenHandler implements TokenHandler {
  handler: SAXHandler;
  renameTag: (name: string) => string;
  renameAttribute: (name: string) => string;
  decodeText: (text: string) => string;
  decodeAttribute: (value: string) => string;
  isTagNameStackUsed: boolean;
  tagNameStack = ['', '', '', '', '', '', '', '', ''];
  tagNameStackCursor = -1;
  attributes: Record<string, string> | undefined = undefined;

  constructor(handler: SAXHandler, config: ParserConfig) {
    this.handler = handler;
    this.renameTag = config.renameTag;
    this.renameAttribute = config.renameAttribute;
    this.decodeText = config.decodeText;
    this.decodeAttribute = config.decodeAttribute;
    this.isTagNameStackUsed = handler.onStartTag !== undefined || handler.onEndTag !== undefined;
  }

  onText(input: string, startIndex: number, endIndex: number, isRawText: boolean): void {
    const handler = this.handler;

    if (handler.onText !== undefined) {
      const text = input.substring(startIndex, endIndex);

      handler.onText(isRawText ? text : (0, this.decodeText)(text));
    }
  }

  onStartTagName(input: string, startIndex: number, endIndex: number): void {
    const handler = this.handler;

    let tagName;

    if (handler.onStartTagOpening !== undefined) {
      tagName = (0, this.renameTag)(input.substring(startIndex, endIndex));

      handler.onStartTagOpening(tagName);
    }

    if (this.isTagNameStackUsed) {
      this.tagNameStack[++this.tagNameStackCursor] =
        tagName ?? (0, this.renameTag)(input.substring(startIndex, endIndex));
    }

    if (handler.onStartTag !== undefined) {
      this.attributes = {};
    }
  }

  onStartTagClosing(): void {
    const handler = this.handler;

    handler.onStartTagClosing?.();

    if (handler.onStartTag !== undefined) {
      handler.onStartTag(this.tagNameStack[this.tagNameStackCursor], this.attributes!, false, null);
      this.attributes = undefined;
    }
  }

  onStartTagSelfClosing(): void {
    const handler = this.handler;

    handler.onStartTagSelfClosing?.();

    if (handler.onStartTag !== undefined) {
      handler.onStartTag(this.tagNameStack[this.tagNameStackCursor], this.attributes!, true, null);
      this.attributes = undefined;
    }

    --this.tagNameStackCursor;
  }

  onEndTagName(): void {
    this.handler.onEndTag?.(this.tagNameStack[this.tagNameStackCursor], null);

    --this.tagNameStackCursor;
  }

  onAttribute(
    input: string,
    nameStartIndex: number,
    nameEndIndex: number,
    valueStartIndex: number,
    valueEndIndex: number
  ): void {
    const handler = this.handler;
    const attributes = this.attributes;

    if (attributes === undefined && handler.onAttribute === undefined) {
      return;
    }

    const name = (0, this.renameAttribute)(input.substring(nameStartIndex, nameEndIndex));
    const value = (0, this.decodeAttribute)(input.substring(valueStartIndex, valueEndIndex));

    if (attributes !== undefined) {
      // Assigning __proto__ would set the prototype rather than add an attribute
      if (name === '__proto__') {
        Object.defineProperty(attributes, name, { value, writable: true, enumerable: true, configurable: true });
      } else {
        attributes[name] = value;
      }
    }

    handler.onAttribute?.(name, value);
  }

  onComment(input: string, startIndex: number, endIndex: number): void {
    this.handler.onComment?.(input.substring(startIndex, endIndex));
  }

  onProcessingInstruction(
    input: string,
    targetStartIndex: number,
    targetEndIndex: number,
    dataStartIndex: number,
    dataEndIndex: number
  ): void {
    this.handler.onProcessingInstruction?.(
      input.substring(targetStartIndex, targetEndIndex),
      input.substring(dataStartIndex, dataEndIndex)
    );
  }

  onCDATASection(input: string, startIndex: number, endIndex: number): void {
    this.handler.onCDATASection?.(input.substring(startIndex, endIndex));
  }

  onDoctypeName(input: string, startIndex: number, endIndex: number): void {
    this.handler.onDoctype?.(input.substring(startIndex, endIndex));
  }
}

/**
 * Calls {@link SAXHandler} methods for tokens, and resolves namespaces of tags from `xmlns` and `xmlns:*` attributes.
 *
 * A tag can declare the namespace of its own name, so the namespace is resolved when the start tag is closed, after
 * all attributes are read.
 *
 * It's a separate class, so {@link SAXTokenHandler} doesn't read attributes that the handler doesn't need.
 */
class NamespaceSAXTokenHandler extends SAXTokenHandler {
  namespaceStack = new NamespaceStack();

  /**
   * Namespaces of enclosing tags, by the index of the tag in {@link tagNameStack}. They are kept for end tags, since
   * resolving a namespace again is slower.
   */
  namespaceURIStack: Array<string | null> = [null, null, null, null, null, null, null, null, null];

  onStartTagClosing(): void {
    const handler = this.handler;

    handler.onStartTagClosing?.();

    const tagNameStackCursor = this.tagNameStackCursor;
    const tagName = this.tagNameStack[tagNameStackCursor];
    const namespaceURI = this.namespaceStack.getNamespaceURI(tagName);

    this.namespaceURIStack[tagNameStackCursor] = namespaceURI;

    if (handler.onStartTag !== undefined) {
      handler.onStartTag(tagName, this.attributes!, false, namespaceURI);
      this.attributes = undefined;
    }

    this.namespaceStack.startElement();
  }

  onStartTagSelfClosing(): void {
    const handler = this.handler;

    handler.onStartTagSelfClosing?.();

    const tagName = this.tagNameStack[this.tagNameStackCursor--];

    if (handler.onStartTag !== undefined) {
      handler.onStartTag(tagName, this.attributes!, true, this.namespaceStack.getNamespaceURI(tagName));
      this.attributes = undefined;
    }

    // Removes namespaces that the tag has declared
    this.namespaceStack.startElement();
    this.namespaceStack.endElement();
  }

  onEndTagName(): void {
    const tagNameStackCursor = this.tagNameStackCursor--;

    this.handler.onEndTag?.(this.tagNameStack[tagNameStackCursor], this.namespaceURIStack[tagNameStackCursor]);
    this.namespaceStack.endElement();
  }

  onAttribute(
    input: string,
    nameStartIndex: number,
    nameEndIndex: number,
    valueStartIndex: number,
    valueEndIndex: number
  ): void {
    const handler = this.handler;
    const attributes = this.attributes;

    // Each attribute is read, since it can declare a namespace
    const name = (0, this.renameAttribute)(input.substring(nameStartIndex, nameEndIndex));
    const value = (0, this.decodeAttribute)(input.substring(valueStartIndex, valueEndIndex));

    if (attributes !== undefined) {
      // Assigning __proto__ would set the prototype rather than add an attribute
      if (name === '__proto__') {
        Object.defineProperty(attributes, name, { value, writable: true, enumerable: true, configurable: true });
      } else {
        attributes[name] = value;
      }
    }

    this.namespaceStack.declareNamespace(name, value);

    handler.onAttribute?.(name, value);
  }
}

// Options of the token handlers that are kept only to retain their hidden classes
const retainedParserOptions = resolveParserOptions({});

retainHiddenClasses(
  new SAXTokenHandler({}, retainedParserOptions),
  new NamespaceSAXTokenHandler({}, retainedParserOptions)
);
