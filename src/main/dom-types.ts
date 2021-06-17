import {Maybe} from './parser-utils';

export const enum DomNodeType {
  ELEMENT = 1,
  TEXT = 3,
  PROCESSING_INSTRUCTION = 7,
  CDATA_SECTION = 4,
  DOCUMENT_TYPE = 10,
  COMMENT = 8,
}

export interface IDomNode {
  nodeType: number;
  parent: IDomElement | null;
  start: number;
  end: number;
  data?: string;
}

export interface IDomAttributeMap {
  [attrName: string]: Maybe<string>;
}

export interface IDomElement extends IDomNode {
  nodeType: DomNodeType.ELEMENT;
  tagName: string;
  attrs: IDomAttributeMap;
  selfClosing: boolean;
  children: Array<IDomNode>;
}

export interface IDomText extends IDomNode {
  nodeType: DomNodeType.TEXT;
  data: string;
}
