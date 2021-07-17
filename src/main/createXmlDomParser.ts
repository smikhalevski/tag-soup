import {createDomParser} from './createDomParser';
import {IDataToken} from './token-types';
import {IDomParser, IDomParserDialectOptions, IDomHandler} from './dom-parser-types';
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

const domParserFactoryCallbacks: IDomHandler<IDomNode, IDomElement, IDomText> = {

  element(token) {
    const attrMap: IDomAttrMap = {};
    for (let i = 0, l = token.attributes.length; i < l; i++) {
      const attr = token.attributes[i];
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

  child(element, childNode) {
    childNode.parent = element;
    element.children.push(childNode);
  },

  elementEnd(element, token) {
    element.end = token.end;
  },

  text(token) {
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
  doctype: (token) => createDomNode(DomNodeType.DOCUMENT_TYPE, token),
  comment: (token) => createDomNode(DomNodeType.COMMENT, token),
};

/**
 * Creates preconfigured Cheerio-compatible XML DOM parser that returns a tree of {@link IDomNode}s.
 */
export function createXmlDomParser(options: IDomParserDialectOptions<IDomElement> = {}): IDomParser<IDomNode, IDomElement, IDomText> {
  return createDomParser(Object.assign({}, options, domParserFactoryCallbacks));
}
