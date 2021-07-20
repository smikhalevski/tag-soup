import {IArrayLike, IDataToken, IDomHandler, IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';

/**
 * Creates a new streaming forgiving DOM parser.
 *
 * @template Node The type of object that describes a node in the DOM tree.
 * @template Element The type of object that describes an element in the DOM tree.
 * @template Text The type of object that describes a text node in the DOM tree.
 */
export function createDomParser<Node, ContainerNode extends Node>(handler: IDomHandler<Node, ContainerNode>, options: IParserOptions): IParser<Array<Node>> {
  let ancestors: IArrayLike<ContainerNode> = {length: 0};
  let nodes: Array<Node> = [];

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

    if (elementCallback == null) {
      throw new Error('Missing `element` callback');
    }
    if (appendChildCallback == null) {
      throw new Error('Missing `appendChild` callback');
    }

    const pushNode = (node: Node) => {
      if (ancestors.length !== 0) {
        appendChildCallback(ancestors[ancestors.length - 1], node);
      } else {
        nodes.push(node);
      }
    };

    const createDataTokenCallback = (callback: ((token: IDataToken) => Node) | undefined): ((token: IDataToken) => void) | undefined => {
      return callback != null ? (token) => pushNode(callback(token)) : undefined;
    };

    return {

      startTag(token) {
        const element = elementCallback(token);
        pushNode(element);

        if (!token.selfClosing) {
          ancestors[ancestors.length++] = element;
        }
      },

      endTag(token) {
        --ancestors.length;
        containerEndCallback?.(ancestors[ancestors.length], token);
      },

      doctype(token) {
        if (documentCallback && nodes.length === 0) {
          const element = documentCallback(token);
          pushNode(element);
          ancestors[ancestors.length++] = element;
        }
      },

      text: createDataTokenCallback(textCallback),
      processingInstruction: createDataTokenCallback(processingInstructionCallback),
      cdata: createDataTokenCallback(cdataCallback),
      comment: createDataTokenCallback(commentCallback),
    };
  };

  const saxParser = createSaxParser(createSaxHandler(handler), options);

  const write = (chunk: string): Array<Node> => {
    saxParser.write(chunk);
    return nodes;
  };

  const parse = (chunk: string): Array<Node> => {
    let result;
    try {
      saxParser.parse(chunk);
      result = nodes;
    } finally {
      reset();
    }
    return result;
  };

  const reset = (): void => {
    saxParser.reset();
    ancestors.length = 0;
    nodes = [];
  };

  return {
    reset,
    write,
    parse,
  };
}
