import {
  CDATASection,
  Comment,
  Document,
  DocumentFragment,
  DocumentType,
  Element,
  type ParentNode,
  ProcessingInstruction,
  Text,
} from 'flyweight-dom';
import { NamespaceStack } from './NamespaceStack.ts';
import { type ParserConfig, resolveParserOptions } from './resolveParserOptions.ts';
import { type ParserOptions, type ParserWriter, type TokenHandler, type TokenizerWriter } from './types.ts';
import { retainHiddenClasses } from './utils.ts';

/**
 * Parses text as a DOM.
 *
 * @see {@link createDOMParser}
 * @group DOM
 */
export interface DOMParser {
  /**
   * Parses text as a document.
   *
   * Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @param input The text to parse.
   * @returns The document node.
   * @throws {@link MarkupSyntaxError} If input is malformed and parser options don't allow to recover.
   */
  parseDocument(input: string): Document;

  /**
   * Parses text as a document fragment.
   *
   * DOCTYPE isn't recognized.
   *
   * @param input The text to parse.
   * @returns The document fragment node.
   * @throws {@link MarkupSyntaxError} If input is malformed and parser options don't allow to recover.
   */
  parseFragment(input: string): DocumentFragment;

  /**
   * Creates a writer that parses a document written in chunks.
   *
   * Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @example
   * const writer = HTMLDOMParser.createDocumentWriter();
   *
   * writer.write('<p>Hello, ');
   * writer.write('Bob!');
   *
   * writer.end();
   * // ⮕ Document
   *
   * @returns The new writer.
   */
  createDocumentWriter(): ParserWriter<Document>;

  /**
   * Creates a writer that parses a document fragment written in chunks.
   *
   * DOCTYPE isn't recognized.
   *
   * @returns The new writer.
   */
  createFragmentWriter(): ParserWriter<DocumentFragment>;
}

/**
 * Creates a parser that parses text as a DOM.
 *
 * @example
 * import { HTMLDOMParser } from 'tag-soup';
 *
 * HTMLDOMParser.parseFragment('Hello, <b>Bob</b>!');
 * // ⮕ DocumentFragment
 *
 * @param options Parser options.
 * @returns The new DOM parser.
 * @group DOM
 */
export function createDOMParser(options: ParserOptions = {}): DOMParser {
  const config = resolveParserOptions(options);

  const { tokenizer } = config;

  return {
    parseDocument(input) {
      const tokenHandler = createDOMTokenHandler(new Document(), config);

      tokenizer.tokenizeDocument(input, tokenHandler);

      return tokenHandler.rootNode;
    },

    parseFragment(input) {
      const tokenHandler = createDOMTokenHandler(new DocumentFragment(), config);

      tokenizer.tokenizeFragment(input, tokenHandler);

      return tokenHandler.rootNode;
    },

    createDocumentWriter() {
      const tokenHandler = createDOMTokenHandler(new Document(), config);

      return createDOMParserWriter(tokenHandler, tokenizer.createDocumentWriter(tokenHandler));
    },

    createFragmentWriter() {
      const tokenHandler = createDOMTokenHandler(new DocumentFragment(), config);

      return createDOMParserWriter(tokenHandler, tokenizer.createFragmentWriter(tokenHandler));
    },
  };
}

/**
 * Creates a writer that passes chunks of text to a tokenizer writer, and returns the root node that the token handler
 * has built.
 *
 * @param tokenHandler The handler that the tokenizer writer passes tokens to.
 * @param tokenizerWriter The writer that reads tokens from chunks.
 */
function createDOMParserWriter<TRootNode extends Document | DocumentFragment>(
  tokenHandler: DOMTokenHandler<TRootNode>,
  tokenizerWriter: TokenizerWriter
): ParserWriter<TRootNode> {
  return {
    write(chunk) {
      tokenizerWriter.write(chunk);
    },

    end(chunk) {
      tokenizerWriter.end(chunk);
      return tokenHandler.rootNode;
    },
  };
}

/**
 * Creates a handler that builds a DOM from tokens, and resolves namespaces if
 * {@link ParserConfig.areNamespacesRecognized} is `true`.
 *
 * @param rootNode The node that top-level nodes are appended to.
 * @param config The config from {@link resolveParserOptions}.
 */
function createDOMTokenHandler<TRootNode extends Document | DocumentFragment>(
  rootNode: TRootNode,
  config: ParserConfig
): DOMTokenHandler<TRootNode> {
  return config.areNamespacesRecognized
    ? new NamespaceDOMTokenHandler(rootNode, config)
    : new DOMTokenHandler(rootNode, config);
}

/**
 * Builds a DOM from tokens. Elements have no namespace.
 */
class DOMTokenHandler<TRootNode extends Document | DocumentFragment> implements TokenHandler {
  renameTag: (name: string) => string;
  renameAttribute: (name: string) => string;
  decodeText: (text: string) => string;
  decodeAttribute: (value: string) => string;
  rootNode: TRootNode;
  parentNode: ParentNode;

  constructor(rootNode: TRootNode, config: ParserConfig) {
    this.renameTag = config.renameTag;
    this.renameAttribute = config.renameAttribute;
    this.decodeText = config.decodeText;
    this.decodeAttribute = config.decodeAttribute;
    this.parentNode = rootNode;
    this.rootNode = rootNode;
  }

  onText(input: string, startIndex: number, endIndex: number, isRawText: boolean): void {
    const text = input.substring(startIndex, endIndex);

    this.parentNode.appendChild(new Text(isRawText ? text : (0, this.decodeText)(text)));
  }

  onStartTagName(input: string, startIndex: number, endIndex: number): void {
    const element = new Element((0, this.renameTag)(input.substring(startIndex, endIndex)));

    this.parentNode.appendChild(element);
    this.parentNode = element;
  }

  onStartTagSelfClosing(): void {
    this.parentNode = this.parentNode.parentNode!;
  }

  onEndTagName(): void {
    this.parentNode = this.parentNode.parentNode!;
  }

  onAttribute(
    input: string,
    nameStartIndex: number,
    nameEndIndex: number,
    valueStartIndex: number,
    valueEndIndex: number
  ): void {
    (this.parentNode as Element).setAttribute(
      (0, this.renameAttribute)(input.substring(nameStartIndex, nameEndIndex)),
      (0, this.decodeAttribute)(input.substring(valueStartIndex, valueEndIndex))
    );
  }

  onComment(input: string, startIndex: number, endIndex: number): void {
    this.parentNode.appendChild(new Comment(input.substring(startIndex, endIndex)));
  }

  onProcessingInstruction(
    input: string,
    targetStartIndex: number,
    targetEndIndex: number,
    dataStartIndex: number,
    dataEndIndex: number
  ): void {
    this.parentNode.appendChild(
      new ProcessingInstruction(
        input.substring(targetStartIndex, targetEndIndex),
        input.substring(dataStartIndex, dataEndIndex)
      )
    );
  }

  onCDATASection(input: string, startIndex: number, endIndex: number): void {
    this.parentNode.appendChild(new CDATASection(input.substring(startIndex, endIndex)));
  }

  onDoctypeName(input: string, startIndex: number, endIndex: number): void {
    this.parentNode.appendChild(new DocumentType(input.substring(startIndex, endIndex)));
  }
}

/**
 * Builds a DOM from tokens, and resolves namespaces of elements from `xmlns` and `xmlns:*` attributes.
 *
 * An element can declare the namespace of its own tag name, and the namespace of an element can't be changed. So the
 * tag name and attributes are kept until the start tag is closed, and the element is created then.
 *
 * It's a separate class, so {@link DOMTokenHandler} doesn't get a callback per start tag closing.
 */
class NamespaceDOMTokenHandler<TRootNode extends Document | DocumentFragment> extends DOMTokenHandler<TRootNode> {
  namespaceStack = new NamespaceStack();

  /**
   * The renamed tag name of the start tag being read.
   */
  tagName = '';

  /**
   * Attributes of the start tag being read, or `undefined` if no attributes were read yet. Chunks can end inside a
   * start tag, so values are kept instead of indices, which point to the input of one chunk.
   */
  attributes: Record<string, string> | undefined = undefined;

  onStartTagName(input: string, startIndex: number, endIndex: number): void {
    this.tagName = (0, this.renameTag)(input.substring(startIndex, endIndex));
  }

  onStartTagClosing(): void {
    this.parentNode = this.appendElement();
    this.namespaceStack.startElement();
  }

  onStartTagSelfClosing(): void {
    this.appendElement();

    // Removes namespaces that the element has declared
    this.namespaceStack.startElement();
    this.namespaceStack.endElement();
  }

  onEndTagName(): void {
    this.parentNode = this.parentNode.parentNode!;
    this.namespaceStack.endElement();
  }

  onAttribute(
    input: string,
    nameStartIndex: number,
    nameEndIndex: number,
    valueStartIndex: number,
    valueEndIndex: number
  ): void {
    const name = (0, this.renameAttribute)(input.substring(nameStartIndex, nameEndIndex));
    const value = (0, this.decodeAttribute)(input.substring(valueStartIndex, valueEndIndex));

    let attributes = this.attributes;

    if (attributes === undefined) {
      attributes = this.attributes = {};
    }

    // Assigning __proto__ would set the prototype rather than add an attribute
    if (name === '__proto__') {
      Object.defineProperty(attributes, name, { value, writable: true, enumerable: true, configurable: true });
    } else {
      attributes[name] = value;
    }

    this.namespaceStack.declareNamespace(name, value);
  }

  /**
   * Creates the element of the start tag being read, and appends it to the parent node. The element owns the
   * attributes object, so the next start tag gets a new one.
   */
  appendElement(): Element {
    const element = new Element(this.tagName, this.attributes, this.namespaceStack.getNamespaceURI(this.tagName));

    this.attributes = undefined;
    this.parentNode.appendChild(element);

    return element;
  }
}

// Options of the token handlers that are kept only to retain their hidden classes
const retainedParserOptions = resolveParserOptions({});

retainHiddenClasses(
  new DOMTokenHandler(new Document(), retainedParserOptions),
  new NamespaceDOMTokenHandler(new Document(), retainedParserOptions),
  new DocumentFragment(),
  new Element(''),
  new Text(''),
  new Comment(''),
  new CDATASection(''),
  new ProcessingInstruction('', ''),
  new DocumentType('')
);
