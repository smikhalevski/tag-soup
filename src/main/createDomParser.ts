import {IParser, IParserOptions, IXmlDomHandler, IXmlSaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {IDataToken} from './token-types';

/**
 * Creates a new streaming forgiving DOM parser.
 *
 * @template Node The type of object that describes a node in the DOM tree.
 * @template Element The type of object that describes an element in the DOM tree.
 * @template Text The type of object that describes a text node in the DOM tree.
 */
export function createDomParser<Node, Element extends Node = Node, Text extends Node = Node>(options: IParserOptions): IParser<IXmlDomHandler<Node, Element, Text>, Array<Node>> {
  let elements: Array<Element> = [];
  let depth = 0;
  let nodes: Array<Node> = [];

  const saxParser = createSaxParser(options);

  const createSaxHandler = (handler: IXmlDomHandler<Node, Element, Text>): IXmlSaxHandler => {
    const {
      element: elementCallback,
      elementEnd: elementEndCallback,
      elementChild: elementChildCallback,
      text: textCallback,
      doctype: doctypeCallback,
      comment: commentCallback,
      processingInstruction: processingInstructionCallback,
      cdata: cdataCallback,
    } = handler;

    const pushNode = (node: Node) => {
      if (depth > 0) {
        elementChildCallback(elements[depth - 1], node);
      } else {
        nodes.push(node);
      }
    };

    const createDataTokenCallback = (callback: ((token: IDataToken) => Node) | undefined): ((token: IDataToken) => void) | undefined => {
      if (callback) {
        return (token) => pushNode(callback(token));
      }
    };

    return {

      startTag(token) {
        const element = elementCallback(token);
        pushNode(element);

        if (!token.selfClosing) {
          elements[depth] = element;
          depth++;
        }
      },

      endTag(token) {
        depth--;
        elementEndCallback?.(elements[depth], token);
      },

      text: createDataTokenCallback(textCallback),
      processingInstruction: createDataTokenCallback(processingInstructionCallback),
      cdata: createDataTokenCallback(cdataCallback),
      doctype: createDataTokenCallback(doctypeCallback),
      comment: createDataTokenCallback(commentCallback),
    };
  };

  const write = (handler: IXmlDomHandler<Node, Element, Text>, chunk: string) => {
    saxParser.write(createSaxHandler(handler), chunk);
    return nodes;
  };

  const parse = (handler: IXmlDomHandler<Node, Element, Text>, str: string) => {
    saxParser.parse(createSaxHandler(handler), str);
    const result = nodes;
    reset();
    return result;
  };

  const reset = () => {
    saxParser.reset();
    elements = [];
    depth = 0;
    nodes = [];
  };

  return {
    reset,
    write,
    parse,
  };
}
