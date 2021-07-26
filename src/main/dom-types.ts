export const enum NodeType {
  ELEMENT = 1,
  TEXT = 3,
  PROCESSING_INSTRUCTION = 7,
  CDATA_SECTION = 4,
  DOCUMENT = 9,
  COMMENT = 8,
}

export type Node =
    | IDocument
    | IElement
    | IText
    | ICdataSection
    | IProcessingInstruction
    | IComment;

export type DataNode =
    | IText
    | ICdataSection
    | IProcessingInstruction
    | IComment;

export interface INode {
  nodeType: NodeType;
  parent: IContainerNode | null;
  start: number;
  end: number;
}

export interface IContainerNode extends INode {
  children: Array<INode>;
}

export interface IDataNode extends INode {
  data: string;
}

export interface IDocument extends IContainerNode {
  nodeType: NodeType.DOCUMENT;
}

export interface IElement extends IContainerNode {
  nodeType: NodeType.ELEMENT;
  tagName: string;
  attributes: Record<string, string | null | undefined>;
  selfClosing: boolean;
}

export interface IText extends IDataNode {
  nodeType: NodeType.TEXT;
}

export interface ICdataSection extends IDataNode {
  nodeType: NodeType.CDATA_SECTION;
}

export interface IProcessingInstruction extends IDataNode {
  nodeType: NodeType.PROCESSING_INSTRUCTION;
}

export interface IComment extends IDataNode {
  nodeType: NodeType.COMMENT;
}
