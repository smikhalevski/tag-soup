import {createDomParser} from './createDomParser';
import {IParser, IParserOptions, IDomHandler} from './parser-types';
import {xmlParserOptions} from './createXmlSaxParser';
import {DomNodeType, IDomAttributeMap, IDomElement, IDomNode, IDomText} from './dom-types';
import {IDataToken} from './token-types';
import {Comment, Element, Node, NodeWithChildren, Document, ProcessingInstruction, Text} from 'domhandler';
import {ElementType} from 'domelementtype';

export function createXmlDomParser<Node, ContainerNode extends Node>(options?: IParserOptions): IParser<IDomHandler<Node, ContainerNode>, Array<Node>> {
  return createDomParser<Node, ContainerNode>(Object.assign({}, xmlParserOptions, options));
}

export const domHandler: IDomHandler<Node, NodeWithChildren> = {

  element(token) {
    const attributes = Object.create(null);
    for (const attributeToken of token.attributes) {
      attributes[attributeToken.name] = attributeToken.value;
    }
    const node = new Element(token.name, attributes);
    node.startIndex = token.start;
    node.endIndex = token.end;
    return node;
  },

  appendChild(elementNode, childNode) {
    elementNode.children.push(childNode);
    childNode.parent = elementNode;
  },

  document(doctypeToken) {
    return new Document([]);
  },

  containerEnd(elementNode, token) {
    elementNode.endIndex = token.end;
  },

  text(token) {
    const node = new Text(token.data);
    node.startIndex = token.start;
    node.endIndex = token.end;
    return node;
  },

  comment(token) {
    const node = new Comment(token.data);
    node.startIndex = token.start;
    node.endIndex = token.end;
    return node;
  },

  processingInstruction(token) {
    return new ProcessingInstruction('', '');
  },

  cdata(token) {
    const textNode = new Text(token.data);
    textNode.startIndex = token.dataStart;
    textNode.endIndex = token.dataEnd;

    const cdataNode = new NodeWithChildren(ElementType.CDATA, [textNode]);
    cdataNode.startIndex = token.start;
    cdataNode.endIndex = token.end;
    return cdataNode;
  },
};


// export const cheerioDomHandler: IDomHandler<IDomNode, IDomElement, IDomText> = {
//
//   element(token): IDomElement {
//     const attributeMap: IDomAttributeMap = Object.create(null);
//
//     for (let i = 0; i < token.attributes.length; i++) {
//       const attribute = token.attributes[i];
//       attributeMap[attribute.name] = attribute.value;
//     }
//
//     return {
//       nodeType: DomNodeType.ELEMENT,
//       parent: null,
//       tagName: token.name,
//       attributes: attributeMap,
//       selfClosing: token.selfClosing,
//       children: [],
//       start: token.start,
//       end: token.end,
//     };
//   },
//
//   appendChild(element, childNode) {
//     childNode.parent = element;
//     element.children.push(childNode);
//   },
//
//   text(token) {
//     return {
//       nodeType: DomNodeType.TEXT,
//       parent: null,
//       data: token.data,
//       start: token.start,
//       end: token.end,
//     };
//   },
//
//   processingInstruction: (token) => createDomNode(DomNodeType.PROCESSING_INSTRUCTION, token),
//   cdata: (token) => createDomNode(DomNodeType.CDATA_SECTION, token),
//   doctype: (token) => createDomNode(DomNodeType.DOCUMENT_TYPE, token),
//   comment: (token) => createDomNode(DomNodeType.COMMENT, token),
// };
//
// function createDomNode(nodeType: number, token: IDataToken): IDomNode {
//   return {
//     nodeType,
//     data: token.data,
//     parent: null,
//     start: token.start,
//     end: token.end,
//   };
// }
