import {createForgivingSaxParser} from './createForgivingSaxParser';
import {DataTokenCallback, IXmlSaxHandler} from './parser-types';
import {DataNodeCallback, IDomParser, IDomParserOptions} from './dom-parser-types';

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

  const createDataTokenCallback = (factory: DataNodeCallback<Node> | undefined): DataTokenCallback | undefined => {
    if (factory) {
      return (token) => pushNode(factory(token));
    }
  };

  const saxParserCallbacks: IXmlSaxHandler = {

    startTag(token) {
      const element = createElement(token);
      pushNode(element);

      if (!token.selfClosing) {
        elements[depth] = element;
        depth++;
      }
    },

    endTag(token) {
      depth--;
      onContainerEnd?.(elements[depth], token);
    },

    text: createDataTokenCallback(createTextNode),
    processingInstruction: createDataTokenCallback(createProcessingInstruction),
    cdata: createDataTokenCallback(createCdataSection),
    doctype: createDataTokenCallback(createDocumentType),
    comment: createDataTokenCallback(createComment),
  };

  const saxParser = saxParserFactory(Object.assign({}, options, saxParserCallbacks));

  const reset = () => {
    saxParser.reset();
    elements = [];
    depth = 0;
    nodes = [];
  };

  const getBuffer = () => saxParser.getBuffer();

  const write = (chunk: string) => {
    saxParser.write(chunk);
    return nodes;
  };

  const parse = (str: string) => {
    saxParser.parse(str);
    const result = nodes;
    reset();
    return result;
  };

  return {
    getBuffer,
    reset,
    write,
    parse,
  };
}
