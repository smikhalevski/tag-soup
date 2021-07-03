import {createDomParser} from './createDomParser';
import {IDataToken} from './token-types';
import {IDomParser, IDomParserDialectOptions, IDomParserFactoryCallbacks} from './dom-parser-types';
import {DomNodeType, IDomAttrMap, IDomElement, IDomNode, IDomText} from './dom-types';

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
    const attrMap: IDomAttrMap = {};
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
