import {createDomParser} from './createDomParser';
import {IParser, IParserOptions, IXmlDomHandler} from './parser-types';
import {xmlParserOptions} from './createXmlSaxParser';
import {DomNodeType, IDomAttributeMap, IDomElement, IDomNode, IDomText} from './dom-types';
import {IDataToken} from './token-types';

export function createXmlDomParser<Node, Element extends Node = Node, Text extends Node = Node>(options?: IParserOptions): IParser<IXmlDomHandler<Node, Element, Text>, Array<Node>> {
  return createDomParser<Node, Element, Text>(Object.assign({}, xmlParserOptions, options));
}

export const cheerioDomHandler: IXmlDomHandler<IDomNode, IDomElement, IDomText> = {

  element(token): IDomElement {
    const attributeMap: IDomAttributeMap = Object.create(null);

    for (let i = 0; i < token.attributes.length; i++) {
      const attribute = token.attributes[i];
      attributeMap[attribute.name] = attribute.value;
    }

    return {
      nodeType: DomNodeType.ELEMENT,
      parent: null,
      tagName: token.name,
      attributes: attributeMap,
      selfClosing: token.selfClosing,
      children: [],
      start: token.start,
      end: token.end,
    };
  },

  elementChild(element, childNode) {
    childNode.parent = element;
    element.children.push(childNode);
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

  processingInstruction: (token) => createDomNode(DomNodeType.PROCESSING_INSTRUCTION, token),
  cdata: (token) => createDomNode(DomNodeType.CDATA_SECTION, token),
  doctype: (token) => createDomNode(DomNodeType.DOCUMENT_TYPE, token),
  comment: (token) => createDomNode(DomNodeType.COMMENT, token),
};

function createDomNode(nodeType: number, token: IDataToken): IDomNode {
  return {
    nodeType,
    data: token.data,
    parent: null,
    start: token.start,
    end: token.end,
  };
}
