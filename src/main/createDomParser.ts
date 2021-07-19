import {IParser, IParserOptions, IDomHandler, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {IDataToken} from './token-types';

/**
 * Creates a new streaming forgiving DOM parser.
 *
 * @template Node The type of object that describes a node in the DOM tree.
 * @template Element The type of object that describes an element in the DOM tree.
 * @template Text The type of object that describes a text node in the DOM tree.
 */
export function createDomParser<Node, ContainerNode extends Node>(options: IParserOptions): IParser<IDomHandler<Node, ContainerNode>, Array<Node>> {
  let ancestors: Array<ContainerNode> = [];
  let nestingDepth = 0;
  let nodes: Array<Node> = [];

  const saxParser = createSaxParser(options);

  const createSaxHandler = (handler: IDomHandler<Node, ContainerNode>): ISaxHandler => {
    const {
      element: elementCallback,
      containerEnd: containerEndCallback,
      appendChild: appendChildCallback,
      text: textCallback,
      document: documentCallback,
      comment: commentCallback,
      processingInstruction: processingInstructionCallback,
      cdata: cdataCallback,
    } = handler;

    const pushNode = (node: Node) => {
      if (nestingDepth > 0) {
        appendChildCallback(ancestors[nestingDepth - 1], node);
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
          ancestors[nestingDepth] = element;
          nestingDepth++;
        }
      },

      endTag(token) {
        nestingDepth--;
        containerEndCallback?.(ancestors[nestingDepth], token);
      },

      text: createDataTokenCallback(textCallback),
      processingInstruction: createDataTokenCallback(processingInstructionCallback),
      cdata: createDataTokenCallback(cdataCallback),
      doctype(token) {
        if (documentCallback) {
          const element = documentCallback(token);
          pushNode(element);

          ancestors[nestingDepth] = element;
          nestingDepth++;
        }
      },
      comment: createDataTokenCallback(commentCallback),
    };
  };

  const write = (handler: IDomHandler<Node, ContainerNode>, chunk: string) => {
    saxParser.write(createSaxHandler(handler), chunk);
    return nodes;
  };

  const parse = (handler: IDomHandler<Node, ContainerNode>, str: string) => {
    saxParser.parse(createSaxHandler(handler), str);
    const result = nodes;
    reset();
    return result;
  };

  const reset = () => {
    saxParser.reset();
    ancestors = [];
    nestingDepth = 0;
    nodes = [];
  };

  return {
    reset,
    write,
    parse,
  };
}
