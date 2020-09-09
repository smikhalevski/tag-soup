import {Attribute, DataCallback, SaxParser, SaxParserCallbacks, SaxParserOptions} from './createSaxParser';
import {createForgivingSaxParser, ForgivingSaxParserOptions} from './createForgivingSaxParser';

export interface CustomSaxParserOptions extends SaxParserOptions {
  [saxParserOption: string]: unknown;
}

export interface DomParserDialectOptions<Element> extends ForgivingSaxParserOptions {

  /**
   * Factory that creates an instance of a SAX parser that would be used for actual parsing of the input strings. By
   * default, a forgiving SAX parser is used.
   *
   * Note: DOM parser expects underlying SAX parser to emit tags in correct order. No additional checks are made while
   * constructing a tree of elements.
   */
  saxParserFactory?: (options: CustomSaxParserOptions) => SaxParser;

  /**
   * If you use your custom implementation of the SAX parser, you can provide additional options to it using this
   * indexer.
   */
  [saxParserOption: string]: unknown;
}

export type ElementFactory<Element> = (tagName: string, attrs: Array<Attribute>, selfClosing: boolean, start: number, end: number) => Element;

export type DataNodeFactory<Node> = (data: string, start: number, end: number) => Node;

export interface DomParserFactoryCallbacks<Node, Element extends Node, Text extends Node> {
  createElement: ElementFactory<Element>;
  appendChild: (element: Element, childNode: Node) => void;

  /**
   * Triggered when container element end tag is emitted. Use this to update source end offset of the container element.
   */
  onContainerEnd?: (element: Element, start: number, end: number) => void;

  createTextNode?: DataNodeFactory<Text>;
  createProcessingInstruction?: DataNodeFactory<Node>;
  createCdataSection?: DataNodeFactory<Node>;
  createDocumentType?: DataNodeFactory<Node>;
  createComment?: DataNodeFactory<Node>;
}

export interface DomParserOptions<Node, Element extends Node, Text extends Node> extends DomParserDialectOptions<Element>, DomParserFactoryCallbacks<Node, Element, Text> {
}

export interface DomParser<Node, Element extends Node = Node, Text extends Node = Node> {

  resetStream(): void;

  writeStream(str: string): Array<Node>;

  commit(str?: string): Array<Node>;
}

/**
 * Creates a streaming DOM parser (which is essentially a thin wrapper around a SAX parser).
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

  const resetStream = () => {
    saxParser.resetStream();
    elements = [];
    depth = 0;
    nodes = [];
  };

  return {
    resetStream,

    writeStream(str) {
      saxParser.commit(str);
      return nodes;
    },

    commit(str) {
      saxParser.commit(str);
      const result = nodes;
      resetStream();
      return result;
    },
  };
}
