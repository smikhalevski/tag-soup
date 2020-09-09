import {createDomParser, DomParser, DomParserDialectOptions, DomParserFactoryCallbacks} from './createDomParser';
import {Attribute} from './createSaxParser';

export const enum DomNodeType {
  ELEMENT = 1,
  TEXT = 3,
  PROCESSING_INSTRUCTION = 7,
  CDATA_SECTION = 4,
  DOCUMENT_TYPE = 10,
  COMMENT = 8,
}

export interface DomNode {
  nodeType: number;
  parent: DomElement | null;
  start: number;
  end: number;
  data?: string;
}

export interface DomAttrMap {
  [attrName: string]: string;
}

export interface DomElement extends DomNode {
  nodeType: DomNodeType.ELEMENT;
  tagName: string;
  attrs: DomAttrMap;
  selfClosing: boolean;
  children: Array<DomNode>;
}

export interface DomText extends DomNode {
  nodeType: DomNodeType.TEXT;
  data: string;
}

export function createDomElement(tagName: string, attrs: ArrayLike<Attribute>, selfClosing: boolean, start: number, end: number): DomElement {
  const attrMap: DomAttrMap = {};
  for (let i = 0, l = attrs.length; i < l; i++) {
    const attr = attrs[i];
    attrMap[attr.name] = attr.value;
  }
  return {nodeType: DomNodeType.ELEMENT, parent: null, tagName, attrs: attrMap, selfClosing, children: [], start, end};
}

export function createDomText(value: string, start: number, end: number): DomText {
  return {nodeType: DomNodeType.TEXT, parent: null, data: value, start, end};
}

export function createDomNode(nodeType: number, data: string, start: number, end: number): DomNode {
  return {nodeType, parent: null, start, end, data};
}

/**
 * Creates preconfigured DOM parser that returns a tree of {@link DomNode}s.
 */
export function createXmlDomParser(options: DomParserDialectOptions<DomElement> = {}): DomParser<DomNode, DomElement, DomText> {

  const domParserFactoryCallbacks: DomParserFactoryCallbacks<DomNode, DomElement, DomText> = {
    createElement: createDomElement,

    appendChild(element, childNode) {
      childNode.parent = element;
      element.children.push(childNode);
    },

    onContainerEnd(element, start, end) {
      element.end = end;
    },

    createTextNode: createDomText,
    createProcessingInstruction: (data, start, end) => createDomNode(DomNodeType.PROCESSING_INSTRUCTION, data, start, end),
    createCdataSection: (data, start, end) => createDomNode(DomNodeType.CDATA_SECTION, data, start, end),
    createDocumentType: (data, start, end) => createDomNode(DomNodeType.DOCUMENT_TYPE, data, start, end),
    createComment: (data, start, end) => createDomNode(DomNodeType.COMMENT, data, start, end),
  };

  return createDomParser(Object.assign({}, options, domParserFactoryCallbacks));
}
