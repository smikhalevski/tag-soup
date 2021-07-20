import {createDomParser} from './createDomParser';
import {IParser, IParserOptions, IDomHandler, IDataToken} from './parser-types';
import {xmlParserOptions} from './createXmlSaxParser';
import {DomNodeType, IDomAttributeMap, IDomElement, IDomNode, IDomText} from './dom-types';
import {Comment, Element, Node, NodeWithChildren, DataNode, Document, ProcessingInstruction, Text} from 'domhandler';
import {ElementType} from 'domelementtype';

export function createXmlDomParser<Node, ContainerNode extends Node>(handler: IDomHandler<Node, ContainerNode>, options?: IParserOptions): IParser<Array<Node>> {
  return createDomParser(handler, Object.assign({}, xmlParserOptions, options));
}








// tagName
// parentNode
// previousSibling
// nextSibling
// nodeValue
// firstChild
// childNodes
// lastChild






class Node2 implements Node {
  type: any;
  nodeType: any;
  parent: any;
  get parentNode(): any {
    return undefined;
  }
  prev: any;
  next: any;

  startIndex: any;
  endIndex: any;

  get previousSibling(): any {
    return undefined;
  }
  get nextSibling(): any {
    return undefined;
  }
  get cloneNode(): any {
    return undefined;
  }
  get firstChild(): any {
    return undefined;
  }
  get lastChild(): any {
    return undefined;
  }
  get childNodes(): any {
    return undefined;
  }

}

class Element2 extends Node2 implements Element {

  name: any;
  attribs: any;
  tagName: any;
  get attributes(): any {
    return undefined;
  }
  children: any;
}

export const domHandler: IDomHandler<Node, NodeWithChildren> = {

  element(token): Element {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < token.attributes.length; ++i) {
      const a = token.attributes[i];
      attributes[a.name] = a.value || '';
    }
    const el = new Element2();
    el.attribs = attributes;
    return el;

    // const node = new Element(token.name, attributes);
    // node.startIndex = token.start;
    // node.endIndex = token.end;
    // return node;
  },

  appendChild(elementNode, childNode) {
    // elementNode.children.push(childNode);
    // childNode.parent = elementNode;
  },

  document(doctypeToken) {
  //   return new Document([]);
    return new Element2();
  },
  //
  // containerEnd(elementNode, token) {
  //   elementNode.endIndex = token.end;
  // },
  //
  text(token) {
  //   const node = new Text(token.data);
  //   node.startIndex = token.start;
  //   node.endIndex = token.end;
  //   return node;
    return new Node2();
  },
  //
  comment(token) {
  //   const node = new Comment(token.data);
  //   node.startIndex = token.start;
  //   node.endIndex = token.end;
  //   return node;
    return new Node2();
  },
  //
  processingInstruction(token) {
  //   return new ProcessingInstruction('', '');
    return new Node2();
  },
  //
  cdata(token) {
  //   const textNode = new Text(token.data);
  //   textNode.startIndex = token.dataStart;
  //   textNode.endIndex = token.dataEnd;
  //
  //   const cdataNode = new NodeWithChildren(ElementType.CDATA, [textNode]);
  //   cdataNode.startIndex = token.start;
  //   cdataNode.endIndex = token.end;
  //   return cdataNode;
    return new Element2();
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
