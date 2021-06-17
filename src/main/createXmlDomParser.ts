import {createDomParser} from './createDomParser';
import {Maybe} from './parser-utils';
import {IDataToken} from './token-types';
import {IDomParser, IDomParserDialectOptions, IDomParserFactoryCallbacks} from './dom-parser-types';

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

function createDomNode(nodeType: number, token: IDataToken): IDomNode {
  return {
    nodeType,
    data: token.data,
    parent: null,
    start: token.start,
    end: token.end,
  };
}

const domParserFactoryCallbacks: IDomParserFactoryCallbacks<IDomNode, IDomElement, IDomText> = {

  createElement(token) {
    const attrMap: IDomAttributeMap = {};
    for (let i = 0, l = token.attrs.length; i < l; i++) {
      const attr = token.attrs[i];
      attrMap[attr.name] = attr.value;
    }
    return {
      nodeType: DomNodeType.ELEMENT,
      parent: null,
      tagName: token.name,
      attrs: attrMap,
      selfClosing: token.selfClosing,
      children: [],
      start: token.start,
      end: token.end,
    };
  },

  appendChild(element, childNode) {
    childNode.parent = element;
    element.children.push(childNode);
  },

  onContainerEnd(element, token) {
    element.end = token.end;
  },

  createTextNode(token) {
    return {
      nodeType: DomNodeType.TEXT,
      parent: null,
      data: token.data,
      start: token.start,
      end: token.end,
    };
  },

  createProcessingInstruction: (token) => createDomNode(DomNodeType.PROCESSING_INSTRUCTION, token),
  createCdataSection: (token) => createDomNode(DomNodeType.CDATA_SECTION, token),
  createDocumentType: (token) => createDomNode(DomNodeType.DOCUMENT_TYPE, token),
  createComment: (token) => createDomNode(DomNodeType.COMMENT, token),
};

/**
 * Creates preconfigured Cheerio-compatible XML DOM parser that returns a tree of {@link IDomNode}s.
 */
export function createXmlDomParser(options: IDomParserDialectOptions<IDomElement> = {}): IDomParser<IDomNode, IDomElement, IDomText> {
  return createDomParser(Object.assign({}, options, domParserFactoryCallbacks));
}
