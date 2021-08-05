import {createDomParser} from './createDomParser';
import {IDataToken, IDomHandler, IParser, IParserOptions} from './parser-types';
import {xmlParserOptions} from './createXmlSaxParser';
import {
  ContainerNode,
  ICdataSectionNode,
  ICommentNode,
  IDataNode,
  IDocumentNode,
  IElementNode,
  IProcessingInstructionNode,
  ITextNode,
  Node,
  NodeType,
} from './dom-types';

/**
 * Creates a pre-configured XML DOM parser that uses {@link domHandler}.
 *
 * @see {@link domHandler}
 */
export function createXmlDomParser(): IParser<Array<Node>>;

/**
 * Creates a pre-configured XML DOM parser.
 *
 * @param handler The parsing handler.
 * @param options Options that override the defaults.
 *
 * @see {@link domHandler}
 */
export function createXmlDomParser<Node, ContainerNode extends Node>(handler: IDomHandler<Node, ContainerNode>, options?: IParserOptions): IParser<Array<Node>>;

export function createXmlDomParser(handler?: IDomHandler<unknown, unknown>, options?: IParserOptions) {
  return createDomParser(handler || domHandler, {...xmlParserOptions, ...options});
}

/**
 * The default DOM handler.
 */
export const domHandler: IDomHandler<Node, ContainerNode> = {

  element(token): IElementNode {
    const attributes: Record<string, string | null | undefined> = Object.create(null);

    for (let i = 0; i < token.attributes.length; i++) {
      const attribute = token.attributes[i];
      attributes[attribute.name] = attribute.value;
    }

    return {
      nodeType: NodeType.ELEMENT,
      parent: null,
      tagName: token.name,
      attributes,
      selfClosing: token.selfClosing,
      children: [],
      start: token.start,
      end: token.end,
    };
  },

  appendChild(parentNode, node) {
    node.parent = parentNode;
    parentNode.children.push(node);
  },

  containerEnd(node, token) {
    node.end = token.end;
  },

  document(token): IDocumentNode {
    return {
      nodeType: NodeType.DOCUMENT,
      parent: null,
      doctype: token.data,
      children: [],
      start: token.start,
      end: token.end,
    };
  },

  text: (token) => createDataNode<ITextNode>(NodeType.TEXT, token),
  processingInstruction: (token) => createDataNode<IProcessingInstructionNode>(NodeType.PROCESSING_INSTRUCTION, token),
  cdata: (token) => createDataNode<ICdataSectionNode>(NodeType.CDATA_SECTION, token),
  comment: (token) => createDataNode<ICommentNode>(NodeType.COMMENT, token),
};

function createDataNode<DataNode extends IDataNode>(nodeType: DataNode['nodeType'], token: IDataToken): DataNode {
  return <DataNode>{
    nodeType,
    data: token.data,
    parent: null,
    start: token.start,
    end: token.end,
  };
}
