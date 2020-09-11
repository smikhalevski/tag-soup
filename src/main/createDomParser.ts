import {Attribute, DataCallback, SaxParser, SaxParserCallbacks, SaxParserOptions} from './createSaxParser';
import {createForgivingSaxParser, ForgivingSaxParserDialectOptions} from './createForgivingSaxParser';

export interface CustomSaxParserOptions extends SaxParserOptions {

  /**
   * If you use your custom implementation of the SAX parser with {@link DomParserDialectOptions.saxParserFactory},
   * you can provide additional options to it using this indexer.
   */
  [saxParserOption: string]: unknown;
}

export interface DomParserDialectOptions<Element> extends ForgivingSaxParserDialectOptions, CustomSaxParserOptions {

  /**
   * The factory that creates an instance of a SAX parser that would be used for actual parsing of the input strings.
   *
   * **Note:** DOM parser expects underlying SAX parser to emit tags in the correct order. No additional checks are
   * made while constructing a tree of elements.
   *
   * @default {@link createForgivingSaxParser}
   */
  saxParserFactory?(options: CustomSaxParserOptions): SaxParser;
}

export type DataNodeFactory<Node> = (data: string, start: number, end: number) => Node;

export interface DomParserFactoryCallbacks<Node, Element extends Node, Text extends Node> {

  /**
   * Creates a new element.
   *
   * @param tagName The tag name of an element.
   * @param attrs An array-like object that holds pooled objects that would be revoked after this callback finishes. To
   *     preserve parsed attributes make a deep copy of `attrs`. Object pooling is used to reduce memory consumption
   *     during parsing by avoiding excessive object allocation.
   * @param selfClosing `true` if tag is self-closing, `false` otherwise. Ensure that {@link selfClosingEnabled} or
   *     {@link xmlEnabled} is set to `true` to support self-closing tags.
   * @param start The index of a char at which the start tag declaration starts in the source.
   * @param end The index of a char at which the start tag declaration ends (exclusive) in the source.
   * @see {@link onContainerEnd}
   */
  createElement(tagName: string, attrs: ArrayLike<Attribute>, selfClosing: boolean, start: number, end: number): Element;

  /**
   * Appends `childNode` as the last child to an `element`.
   */
  appendChild(element: Element, childNode: Node): void;

  /**
   * Triggered when the end tag of the container is read from source.
   *
   * @param element The element for which the end tag was read.
   * @param start The index of a char at which the end tag declaration starts in the source.
   * @param end The index of a char at which the end tag declaration ends (exclusive) in the source.
   */
  onContainerEnd?(element: Element, start: number, end: number): void;

  /**
   * Factory that creates a new text node.
   */
  createTextNode?: DataNodeFactory<Text>;

  /**
   * Factory that creates a new processing instruction.
   */
  createProcessingInstruction?: DataNodeFactory<Node>;

  /**
   * Factory that creates a new CDATA section node.
   */
  createCdataSection?: DataNodeFactory<Node>;

  /**
   * Factory that creates a new DOCTYPE node.
   */
  createDocumentType?: DataNodeFactory<Node>;

  /**
   * Factory that creates a new comment node.
   */
  createComment?: DataNodeFactory<Node>;
}

/**
 * Options required to create a new DOM parser.
 *
 * @param Node The type of object that describes a node in the DOM tree.
 * @param Element The type of object that describes an element in the DOM tree.
 * @param Text The type of object that describes a text node in the DOM tree.
 */
export interface DomParserOptions<Node, Element extends Node, Text extends Node> extends DomParserDialectOptions<Element>, DomParserFactoryCallbacks<Node, Element, Text> {
}

/**
 * The DOM parser that creates a tree of nodes that describe the input source.
 *
 * @param Node The type of object that describes a node in the DOM tree.
 * @param Element The type of object that describes an element in the DOM tree.
 * @param Text The type of object that describes a text node in the DOM tree.
 *
 * @see {@link createDomParser}
 * @see {@link createXmlDomParser}
 * @see {@link createHtmlDomParser}
 */
export interface DomParser<Node, Element extends Node = Node, Text extends Node = Node> {

  /**
   * Resets the internal state of the parser.
   */
  reset(): void;

  /**
   * Try to parse a given source chunk. If there's an ambiguity during parsing then the parser is paused until the next
   * {@link write} or {@link parse} invocation. The part of chunk that was not parsed is appended to internal
   * buffer.
   *
   * @param sourceChunk The source chunk to parse.
   * @returns The list of nodes that were parsed after the last call of {@link reset} or {@link parse}.
   */
  write(sourceChunk: string): Array<Node>;

  /**
   * Parses the given source. If there's a leftover in the buffer after the last {@link write} call it is also used
   * for parsing. Parser is reset after this method completes.
   *
   * @param source The source to parse.
   * @returns The list of all nodes that were parsed.
   */
  parse(source?: string): Array<Node>;
}

/**
 * Creates a new streaming DOM parser.
 *
 * DOM parser is essentially a thin wrapper around a SAX parser that listens to its events and reconstructs the tree of
 * nodes.
 *
 * @param Node The type of object that describes a node in the DOM tree.
 * @param Element The type of object that describes an element in the DOM tree.
 * @param Text The type of object that describes a text node in the DOM tree.
 */
export function createDomParser<Node, Element extends Node = Node, Text extends Node = Node>(options: DomParserOptions<Node, Element, Text>): DomParser<Node, Element, Text> {
  const {
    saxParserFactory = createForgivingSaxParser,

    createElement,
    appendChild,
    onContainerEnd,

    createTextNode,
    createProcessingInstruction,
    createCdataSection,
    createDocumentType,
    createComment,
  } = options;

  let elements: Array<Element> = [];
  let depth = 0;
  let nodes: Array<Node> = [];

  const pushNode = (node: Node) => {
    if (depth > 0) {
      appendChild(elements[depth - 1], node);
    } else {
      nodes.push(node);
    }
  };

  const createDataCallback = (factory: DataNodeFactory<Node> | undefined): DataCallback | undefined => {
    if (factory) {
      return (data, start, end) => pushNode(factory(data, start, end));
    }
  };

  const saxParserCallbacks: SaxParserCallbacks = {

    onStartTag(tagName, attrs, selfClosing, start, end) {
      const element = createElement(tagName, attrs, selfClosing, start, end);
      pushNode(element);

      if (!selfClosing) {
        elements[depth] = element;
        depth++;
      }
    },

    onEndTag(tagName, start, end) {
      depth--;
      onContainerEnd?.(elements[depth], start, end);
    },

    onText: createDataCallback(createTextNode),
    onProcessingInstruction: createDataCallback(createProcessingInstruction),
    onCdataSection: createDataCallback(createCdataSection),
    onDocumentType: createDataCallback(createDocumentType),
    onComment: createDataCallback(createComment),
  };

  const saxParser = saxParserFactory(Object.assign({}, options, saxParserCallbacks));

  const reset = () => {
    saxParser.reset();
    elements = [];
    depth = 0;
    nodes = [];
  };

  return {
    reset,

    write(str) {
      saxParser.write(str);
      return nodes;
    },

    parse(str) {
      saxParser.parse(str);
      const result = nodes;
      reset();
      return result;
    },
  };
}
