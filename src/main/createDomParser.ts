import {createForgivingSaxParser} from './createForgivingSaxParser';
import {IDataToken, IStartTagToken, ITagToken} from './token-types';
import {
  DataTokenCallback,
  IForgivingSaxParserDialectOptions,
  ISaxParser,
  ISaxParserCallbacks,
  ISaxParserOptions,
} from './sax-parser-types';

export interface ICustomSaxParserOptions extends ISaxParserOptions {
  [saxParserOption: string]: any;
}

export interface IDomParserDialectOptions<Element> extends IForgivingSaxParserDialectOptions {

  /**
   * The factory that creates an instance of a SAX parser that would be used for actual parsing of the input strings.
   *
   * **Note:** DOM parser expects underlying SAX parser to emit tags in the correct order. No additional checks are
   * made while constructing a tree of elements.
   *
   * @default {@link createForgivingSaxParser}
   */
  saxParserFactory?: (options: ICustomSaxParserOptions) => ISaxParser;

  /**
   * If you use your custom implementation of the SAX parser with {@link saxParserFactory}, you can provide additional
   * options to it using this indexer.
   */
  [saxParserOption: string]: unknown;
}

/**
 * Callback that creates a DOM node from the data token.
 */
export type DataNodeFactory<Node> = (token: IDataToken) => Node;

export interface IDomParserFactoryCallbacks<Node, Element extends Node, Text extends Node> {

  /**
   * Creates a new element.
   *
   * @see onContainerEnd
   */
  createElement(token: IStartTagToken): Element;

  /**
   * Appends `childNode` as the last child to an `element`.
   */
  appendChild(element: Element, childNode: Node): void;

  /**
   * Triggered when the end tag of the container was fully read from source.
   *
   * @param element The element for which the end tag was read.
   * @param token The token that closes the element.
   */
  onContainerEnd?: (element: Element, token: ITagToken) => void;

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
 * @template Node The type of object that describes a node in the DOM tree.
 * @template Element The type of object that describes an element in the DOM tree.
 * @template Text The type of object that describes a text node in the DOM tree.
 */
export interface IDomParserOptions<Node, Element extends Node, Text extends Node> extends IDomParserDialectOptions<Element>, IDomParserFactoryCallbacks<Node, Element, Text> {
}

/**
 * The DOM parser that creates a tree of nodes that describe the input source.
 *
 * @template Node The type of object that describes a node in the DOM tree.
 * @template Element The type of object that describes an element in the DOM tree.
 * @template Text The type of object that describes a text node in the DOM tree.
 *
 * @see createDomParser
 * @see createXmlDomParser
 * @see createHtmlDomParser
 */
export interface IDomParser<Node, Element extends Node = Node, Text extends Node = Node> {

  /**
   * Returns the buffered string that would be used during the next {@link write} or {@link parse} call.
   */
  getBuffer(): string;

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
   * @returns The list of nodes that were parsed after the last call of {@link reset} or {@link parse}. The reference
   *     to the same array is returned until {@link reset} is called.
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
 * @template Node The type of object that describes a node in the DOM tree.
 * @template Element The type of object that describes an element in the DOM tree.
 * @template Text The type of object that describes a text node in the DOM tree.
 */
export function createDomParser<Node, Element extends Node = Node, Text extends Node = Node>(options: IDomParserOptions<Node, Element, Text>): IDomParser<Node, Element, Text> {
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

  const createDataTokenCallback = (factory: DataNodeFactory<Node> | undefined): DataTokenCallback | undefined => {
    if (factory) {
      return (token) => pushNode(factory(token));
    }
  };

  const saxParserCallbacks: ISaxParserCallbacks = {

    onStartTag(token) {
      const element = createElement(token);
      pushNode(element);

      if (!token.selfClosing) {
        elements[depth] = element;
        depth++;
      }
    },

    onEndTag(token) {
      depth--;
      onContainerEnd?.(elements[depth], token);
    },

    onText: createDataTokenCallback(createTextNode),
    onProcessingInstruction: createDataTokenCallback(createProcessingInstruction),
    onCdataSection: createDataTokenCallback(createCdataSection),
    onDocumentType: createDataTokenCallback(createDocumentType),
    onComment: createDataTokenCallback(createComment),
  };

  const saxParser = saxParserFactory(Object.assign({}, options, saxParserCallbacks));

  const reset = () => {
    saxParser.reset();
    elements = [];
    depth = 0;
    nodes = [];
  };

  return {

    getBuffer() {
      return saxParser.getBuffer();
    },

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
