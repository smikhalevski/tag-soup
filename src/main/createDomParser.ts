import {IArrayLike, IDataToken, IDomHandler, IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';

/**
 * Creates a new stateful DOM parser.
 *
 * @template Node The type of object that describes a node in the DOM tree.
 * @template ContainerNode The type of object that describes an element or a document in the DOM tree.
 */
export function createDomParser<Node, ContainerNode extends Node>(handler: IDomHandler<Node, ContainerNode>, options?: IParserOptions): IParser<Array<Node>> {

  const nodes: Array<Node> = [];

  const saxParser = createSaxParser(createSaxHandler(nodes, handler), options);

  const write = (sourceChunk: string): Array<Node> => {
    saxParser.write(sourceChunk);
    return nodes.slice(0);
  };

  const parse = (source: string): Array<Node> => {
    saxParser.parse(source);
    const result = nodes.slice(0);
    reset();
    return result;
  };

  const reset = (): void => {
    saxParser.reset();
    nodes.length = 0;
  };

  return {
    write,
    parse,
    reset,
  };
}

function createSaxHandler<Node, ContainerNode extends Node>(nodes: Array<Node>, handler: IDomHandler<Node, ContainerNode>): ISaxHandler {

  const {
    element: elementFactory,
    containerEnd: containerEndCallback,
    appendChild: appendChildCallback,
    text: textFactory,
    document: documentFactory,
    comment: commentFactory,
    processingInstruction: processingInstructionFactory,
    cdata: cdataFactory,
    sourceEnd: sourceEndCallback,
    reset: resetCallback,
  } = handler;

  const ancestors: IArrayLike<ContainerNode> = {length: 0};

  if (typeof elementFactory !== 'function') {
    throw new Error('"element" callback must be a function');
  }
  if (typeof appendChildCallback !== 'function') {
    throw new Error('"appendChild" callback must be a function');
  }

  const pushNode = (node: Node): void => {
    if (ancestors.length !== 0) {
      appendChildCallback(ancestors[ancestors.length - 1], node);
    } else {
      nodes.push(node);
    }
  };

  const createDataTokenCallback = (dataFactory: ((token: IDataToken) => Node) | undefined): ((token: IDataToken) => void) | undefined => {
    return dataFactory != null ? (token) => pushNode(dataFactory(token)) : undefined;
  };

  return {

    startTag(token) {
      const node = elementFactory(token);
      pushNode(node);

      if (!token.selfClosing) {
        ancestors[ancestors.length++] = node;
      }
    },

    endTag(token) {
      --ancestors.length;
      containerEndCallback?.(ancestors[ancestors.length], token);
    },

    doctype(token) {
      if (documentFactory && nodes.length === 0) {
        const node = documentFactory(token);
        pushNode(node);
        ancestors[ancestors.length++] = node;
      }
    },

    text: createDataTokenCallback(textFactory),
    processingInstruction: createDataTokenCallback(processingInstructionFactory),
    cdata: createDataTokenCallback(cdataFactory),
    comment: createDataTokenCallback(commentFactory),

    reset() {
      ancestors.length = 0;
      resetCallback?.();
    },
    sourceEnd: sourceEndCallback,
  };
}
