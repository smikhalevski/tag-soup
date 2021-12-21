/**
 * Type of nodes in the DOM tree.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType#node_type_constants Node type constants on MDN}
 */
export const enum NodeType {
  ELEMENT = 1,
  TEXT = 3,
  PROCESSING_INSTRUCTION = 7,
  CDATA_SECTION = 4,
  DOCUMENT = 9,
  COMMENT = 8,
}

/**
 * A node of the DOM tree.
 */
export type Node = DataNode | ContainerNode;

export type ContainerNode = IDocumentNode | IElementNode;

/**
 * The data node of the DOM tree.
 */
export type DataNode =
    | ITextNode
    | ICdataSectionNode
    | IProcessingInstructionNode
    | ICommentNode;

/**
 * The DOM node.
 */
export interface INode {

  /**
   * The type of the node.
   */
  nodeType: NodeType;

  /**
   * The parent of the node.
   */
  parent: IContainerNode | null;

  /**
   * The index where the node starts.
   */
  start: number;

  /**
   * The index where the node ends.
   */
  end: number;
}

/**
 * The DOM node that can have children.
 */
export interface IContainerNode extends INode {

  /**
   * The list of node children.
   */
  children: Array<Node>;
}

/**
 * The DOM node that contains textual data.
 */
export interface IDataNode extends INode {

  /**
   * The text contained the the node.
   */
  data: string;
}

/**
 * The root node of the document.
 */
export interface IDocumentNode extends IContainerNode {
  nodeType: NodeType.DOCUMENT;

  /**
   * The doctype string `<!DOCTYPE … >`.
   */
  doctype: string;
}

export interface IElementNode extends IContainerNode {
  nodeType: NodeType.ELEMENT;

  /**
   * The name of element tag.
   *
   * @see {@link IStartTagToken.name}
   */
  tagName: string;

  /**
   * The mapping from the attribute name to its value. If value of the attribute was omitted and name is followed by
   * "=" char like `foo=` then `null`. If value is omitted and name isn't followed by a "=" char like `foo` then
   * `undefined`.
   */
  attributes: Record<string, string | null | undefined>;

  /**
   * If `true` then the element was represented as a self-closing tag in the source.
   *
   * @see {@link IStartTagToken.selfClosing}
   */
  selfClosing: boolean;
}

/**
 * The text node.
 */
export interface ITextNode extends IDataNode {
  nodeType: NodeType.TEXT;
}

/**
 * The CDATA section node `<![CDATA[ … ]]>`.
 */
export interface ICdataSectionNode extends IDataNode {
  nodeType: NodeType.CDATA_SECTION;
}

/**
 * The processing instruction node `<?xml-stylesheet … ?>`.
 */
export interface IProcessingInstructionNode extends IDataNode {
  nodeType: NodeType.PROCESSING_INSTRUCTION;
}

/**
 * The comment node `<!-- … -->`.
 */
export interface ICommentNode extends IDataNode {
  nodeType: NodeType.COMMENT;
}
