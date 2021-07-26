import {createDomParser} from './createDomParser';
import {IDataToken, IDomHandler, IParser, IParserOptions} from './parser-types';
import {xmlParserOptions} from './createXmlSaxParser';
import {IContainerNode, IDataNode, IDocument, IElement, INode, NodeType} from './dom-types';
import {objectCopy} from './misc';

/**
 * Creates a pre-configured XML DOM parser that uses {@link domHandler}.
 *
 * @see {@link domHandler}
 */
export function createXmlDomParser(): IParser<Array<INode>>;

/**
 * Creates a pre-configured XML DOM parser.
 *
 * @param handler The parsing handler.
 * @param options Options that override the defaults.
 *
 * @see {@link domHandler}
 */
export function createXmlDomParser<Node, ContainerNode extends Node>(handler: IDomHandler<Node, ContainerNode>, options?: IParserOptions): IParser<Array<Node>>;

export function createXmlDomParser(handler = domHandler, options?: IParserOptions) {
  return createDomParser(handler, objectCopy(xmlParserOptions, options));
}

/**
 * The default DOM handler.
 */
export const domHandler: IDomHandler<INode, IContainerNode> = {

  element(token): IElement {
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

  document(token): IDocument {
    return {
      nodeType: NodeType.DOCUMENT,
      parent: null,
      children: [],
      start: token.start,
      end: token.end,
    };
  },

  text: (token) => createDataNode(NodeType.TEXT, token),
  processingInstruction: (token) => createDataNode(NodeType.PROCESSING_INSTRUCTION, token),
  cdata: (token) => createDataNode(NodeType.CDATA_SECTION, token),
  comment: (token) => createDataNode(NodeType.COMMENT, token),
};

function createDataNode(nodeType: NodeType, token: IDataToken): IDataNode {
  return {
    nodeType,
    data: token.data,
    parent: null,
    start: token.start,
    end: token.end,
  };
}
