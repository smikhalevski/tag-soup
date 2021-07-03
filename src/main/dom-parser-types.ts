import {IDataToken, IStartTagToken, ITagToken} from './token-types';
import {IForgivingSaxParserDialectOptions, ISaxParser, ISaxParserOptions} from './sax-parser-types';

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
   * @param chunk The source chunk to parse.
   * @returns The list of nodes that were parsed after the last call of {@link reset} or {@link parse}. The reference
   *     to the same array is returned until {@link reset} is called.
   */
  write(chunk: string): Array<Node>;

  /**
   * Parses the given source. If there's a leftover in the buffer after the last {@link write} call it is also used
   * for parsing. Parser is reset after this method completes.
   *
   * @param str The source to parse.
   * @returns The list of all nodes that were parsed.
   */
  parse(str?: string): Array<Node>;
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

export interface IDomParserDialectOptions<Element> extends IForgivingSaxParserDialectOptions {

  /**
   * The factory that creates an instance of a SAX parser that would be used for actual parsing of the input strings.
   *
   * **Note:** DOM parser expects underlying SAX parser to emit tags in the correct order. No additional checks are
   * made while constructing a tree of elements.
   *
   * @default {@link createForgivingSaxParser}
   */
  saxParserFactory?: (options: ISaxParserOptions) => ISaxParser;
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
