import {IArrayLike, IDataToken, IDomHandler, IParser, IParserOptions, ISaxHandler} from './parser-types';
import {createSaxParser} from './createSaxParser';

/**
 * Creates a new stateful DOM parser.
 *
 * @template Node The type of object that describes a node in the DOM tree.
 * @template ContainerNode The type of object that describes an element or a document in the DOM tree.
 *
 * @param handler The handler that provides factories and callbacks that produce the DOM tree.
 * @param options The parser options.
 * @returns The new parser that produces a DOM tree during parsing.
 */
export function createDomParser<Node, ContainerNode extends Node>(handler: IDomHandler<Node, ContainerNode>, options?: IParserOptions): IParser<Array<Node>> {

  let nodes: Array<Node> = [];

  const saxParser = createSaxParser(createSaxHandler(nodes, handler, (node) => nodes.push(node)), options);

  const write = (sourceChunk: string): Array<Node> => {
    saxParser.write(sourceChunk);
    return nodes;
  };

  const parse = (source: string): Array<Node> => {
    saxParser.parse(source);
    const result = nodes;
    reset();
    return result;
  };

  const reset = (): void => {
    saxParser.reset();
    nodes = [];
  };

  return {
    write,
    parse,
    reset,
  };
}

function createSaxHandler<Node, ContainerNode extends Node>(nodes: Array<Node>, handler: IDomHandler<Node, ContainerNode>, pushRootNode: (node: Node) => void): ISaxHandler {

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
    throw new Error('Missing element factory');
  }
  if (typeof appendChildCallback !== 'function') {
    throw new Error('Missing appendChild callback');
  }

  const pushNode = (node: Node): void => {
    if (ancestors.length !== 0) {
      appendChildCallback(ancestors[ancestors.length - 1], node);
    } else {
      pushRootNode(node);
    }
  };

  const createDataTokenCallback = <Token extends IDataToken>(dataFactory: ((token: Token) => Node) | undefined): ((token: Token) => void) | undefined => {
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

    sourceEnd: sourceEndCallback,

    reset() {
      ancestors.length = 0;
      resetCallback?.();
    },
  };
}
