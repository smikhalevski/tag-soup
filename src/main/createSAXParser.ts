import { NamespaceStack } from './NamespaceStack.ts';
import { type ParserConfig, resolveParserOptions } from './resolveParserOptions.ts';
import { type ParserOptions, type ParserWriter, type TokenHandler } from './types.ts';
import { assignAttribute as importedAssignAttribute, retainHiddenClasses } from './utils.ts';

const assignAttribute = importedAssignAttribute;

/**
 * Handler whose methods are called during parsing. All methods are optional.
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
   * @param text The decoded text. Text of `raw_text` and `script_data` {@link TagParsingOptions.kind tags} isn't
   * decoded.
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
   * @param publicId The public identifier, or an empty string if there's none.
   * @param systemId The system identifier, or an empty string if there's none.
   */
  onDoctype?(name: string, publicId: string, systemId: string): void;

  /**
   * Called when a processing instruction is read.
   *
   * @param target The processing instruction target.
   * @param data The processing instruction data.
   */
  onProcessingInstruction?(target: string, data: string): void;
}

/**
 * Parses an input and calls {@link SAXHandler} methods when tokens are read.
 *
 * @see {@link createSAXParser}
 * @group SAX
 */
export interface SAXParser {
  /**
   * Parses an input as a document.
   *
   * Before the first tag or text, spaces are skipped and DOCTYPE is read.
   *
   * @param input The input to parse.
   * @param handler The handler whose methods are called.
   * @throws {@link MarkupSyntaxError} If the input is malformed and tokenizer options don't allow recovery.
   */
  parseDocument(input: string, handler: SAXHandler): void;

  /**
   * Parses an input as a document fragment.
   *
   * DOCTYPE isn't read.
   *
   * @param input The input to parse.
   * @param handler The handler whose methods are called.
   * @throws {@link MarkupSyntaxError} If the input is malformed and tokenizer options don't allow recovery.
   */
  parseFragment(input: string, handler: SAXHandler): void;

  /**
   * Creates a writer that parses a document written in chunks.
   *
   * Before the first tag or text, spaces are skipped and DOCTYPE is read.
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
   * @param handler The handler whose methods are called.
   * @returns The new writer.
   */
  createDocumentWriter(handler: SAXHandler): ParserWriter;

  /**
   * Creates a writer that parses a document fragment written in chunks.
   *
   * DOCTYPE isn't read.
   *
   * @param handler The handler whose methods are called.
   * @returns The new writer.
   */
  createFragmentWriter(handler: SAXHandler): ParserWriter;
}

/**
 * Creates a parser that parses an input and calls {@link SAXHandler} methods when tokens are read.
 *
 * @example
 * import { createSAXParser, HTMLTokenizer } from 'tag-soup';
 *
 * const parser = createSAXParser({ tokenizer: HTMLTokenizer });
 *
 * parser.parseFragment('Hello, <b>Bob</b>!', {
 *   onStartTagOpening(tagName) {
 *     // Handle the start tag
 *   },
 * });
 *
 * @param options Parser options.
 * @returns The new SAX parser.
 * @group SAX
 */
export function createSAXParser(options: ParserOptions = {}): SAXParser {
  return createSAXParserFromConfig(resolveParserOptions(options));
}

/**
 * Creates a SAX parser from a config. Built-in parsers use it to set config properties that have no option.
 *
 * @param config The config from {@link resolveParserOptions}.
 * @internal
 */
export function createSAXParserFromConfig(config: ParserConfig): SAXParser {
  const { tokenizer } = config;

  return {
    parseDocument(input, handler) {
      tokenizer.tokenizeDocument(input, createSAXTokenHandler(handler, config));
    },

    parseFragment(input, handler) {
      tokenizer.tokenizeFragment(input, createSAXTokenHandler(handler, config));
    },

    createDocumentWriter(handler) {
      const tokenHandler = createSAXTokenHandler(handler, config);

      return tokenizer.createDocumentWriter(tokenHandler);
    },

    createFragmentWriter(handler) {
      const tokenHandler = createSAXTokenHandler(handler, config);

      return tokenizer.createFragmentWriter(tokenHandler);
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
  areTagNamesKept: boolean;
  tagNames = ['', '', '', '', '', '', '', '', ''];
  lastTagNameIndex = -1;
  attributes: Record<string, string> | undefined = undefined;

  constructor(handler: SAXHandler, config: ParserConfig) {
    this.handler = handler;
    this.renameTag = config.renameTag;
    this.renameAttribute = config.renameAttribute;
    this.decodeText = config.decodeText;
    this.decodeAttribute = config.decodeAttribute;
    this.areTagNamesKept = handler.onStartTag !== undefined || handler.onEndTag !== undefined;
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

    if (this.areTagNamesKept) {
      this.tagNames[++this.lastTagNameIndex] = tagName ?? (0, this.renameTag)(input.substring(startIndex, endIndex));
    }

    if (handler.onStartTag !== undefined) {
      this.attributes = {};
    }
  }

  onStartTagClosing(): void {
    const handler = this.handler;

    handler.onStartTagClosing?.();

    if (handler.onStartTag !== undefined) {
      handler.onStartTag(this.tagNames[this.lastTagNameIndex], this.attributes!, false, null);
      this.attributes = undefined;
    }
  }

  onStartTagSelfClosing(): void {
    const handler = this.handler;

    handler.onStartTagSelfClosing?.();

    if (handler.onStartTag !== undefined) {
      handler.onStartTag(this.tagNames[this.lastTagNameIndex], this.attributes!, true, null);
      this.attributes = undefined;
    }

    --this.lastTagNameIndex;
  }

  onEndTagName(): void {
    this.handler.onEndTag?.(this.tagNames[this.lastTagNameIndex], null);

    --this.lastTagNameIndex;
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
      assignAttribute(attributes, name, value);
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

  onDoctype(
    input: string,
    nameStartIndex: number,
    nameEndIndex: number,
    publicIdStartIndex: number,
    publicIdEndIndex: number,
    systemIdStartIndex: number,
    systemIdEndIndex: number
  ): void {
    this.handler.onDoctype?.(
      input.substring(nameStartIndex, nameEndIndex),
      input.substring(publicIdStartIndex, publicIdEndIndex),
      input.substring(systemIdStartIndex, systemIdEndIndex)
    );
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
   * Namespaces of enclosing tags, by the index of the tag in {@link tagNames}. They are kept for end tags, since
   * resolving a namespace again is slower.
   */
  namespaceURIs: Array<string | null> = [null, null, null, null, null, null, null, null, null];

  onStartTagClosing(): void {
    const handler = this.handler;

    handler.onStartTagClosing?.();

    const lastTagNameIndex = this.lastTagNameIndex;
    const tagName = this.tagNames[lastTagNameIndex];
    const namespaceURI = this.namespaceStack.getNamespaceURI(tagName);

    this.namespaceURIs[lastTagNameIndex] = namespaceURI;

    if (handler.onStartTag !== undefined) {
      handler.onStartTag(tagName, this.attributes!, false, namespaceURI);
      this.attributes = undefined;
    }

    this.namespaceStack.startElement();
  }

  onStartTagSelfClosing(): void {
    const handler = this.handler;

    handler.onStartTagSelfClosing?.();

    const tagName = this.tagNames[this.lastTagNameIndex--];

    if (handler.onStartTag !== undefined) {
      handler.onStartTag(tagName, this.attributes!, true, this.namespaceStack.getNamespaceURI(tagName));
      this.attributes = undefined;
    }

    // Removes namespaces that the tag has declared
    this.namespaceStack.startElement();
    this.namespaceStack.endElement();
  }

  onEndTagName(): void {
    const lastTagNameIndex = this.lastTagNameIndex--;

    this.handler.onEndTag?.(this.tagNames[lastTagNameIndex], this.namespaceURIs[lastTagNameIndex]);
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
      assignAttribute(attributes, name, value);
    }

    this.namespaceStack.declareNamespace(name, value);

    handler.onAttribute?.(name, value);
  }
}

// The config of the token handlers that are kept only to retain their hidden classes
const retainedParserConfig = resolveParserOptions({});

retainHiddenClasses(
  new SAXTokenHandler({}, retainedParserConfig),
  new NamespaceSAXTokenHandler({}, retainedParserConfig)
);
