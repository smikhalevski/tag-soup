import {createDomParser, DomParser, DomParserDialectOptions, DomParserFactoryCallbacks} from './createDomParser';

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

export interface DomAttributeMap {
  [attrName: string]: string;
}

export interface DomElement extends DomNode {
  nodeType: DomNodeType.ELEMENT;
  tagName: string;
  attrs: DomAttributeMap;
  selfClosing: boolean;
  children: Array<DomNode>;
}

export interface DomText extends DomNode {
  nodeType: DomNodeType.TEXT;
  data: string;
}

function createDomNode(nodeType: number, data: string, start: number, end: number): DomNode {
  return {nodeType, parent: null, start, end, data};
}

/**
 * Creates preconfigured Cheerio-compatible XML DOM parser that returns a tree of {@link DomNode}s.
 */
export function createXmlDomParser(options: DomParserDialectOptions<DomElement> = {}): DomParser<DomNode, DomElement, DomText> {

  const domParserFactoryCallbacks: DomParserFactoryCallbacks<DomNode, DomElement, DomText> = {

    createElement(tagName, attrs, selfClosing, start, end) {
      const attrMap: DomAttributeMap = {};
      for (let i = 0, l = attrs.length; i < l; i++) {
        const attr = attrs[i];
        attrMap[attr.name] = attr.value;
      }
      return {
        nodeType: DomNodeType.ELEMENT,
        parent: null,
        tagName,
        attrs: attrMap,
        selfClosing,
        children: [],
        start,
        end,
      };
    },

    appendChild(element, childNode) {
      childNode.parent = element;
      element.children.push(childNode);
    },

    onContainerEnd(element, start, end) {
      element.end = end;
    },

    createTextNode(value, start, end) {
      return {
        nodeType: DomNodeType.TEXT,
        parent: null,
        data: value,
        start,
        end,
      };
    },

    createProcessingInstruction: (data, start, end) => createDomNode(DomNodeType.PROCESSING_INSTRUCTION, data, start, end),
    createCdataSection: (data, start, end) => createDomNode(DomNodeType.CDATA_SECTION, data, start, end),
    createDocumentType: (data, start, end) => createDomNode(DomNodeType.DOCUMENT_TYPE, data, start, end),
    createComment: (data, start, end) => createDomNode(DomNodeType.COMMENT, data, start, end),
  };

  return createDomParser(Object.assign({}, options, domParserFactoryCallbacks));
}
