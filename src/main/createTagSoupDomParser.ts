import {createDomParser, DomParser, DomParserDialectOptions} from './createDomParser';
import {Attribute} from './createSaxParser';

export const enum TagSoupNodeType {
  ELEMENT = 1,
  TEXT = 3,
  PROCESSING_INSTRUCTION = 7,
  CDATA_SECTION = 4,
  DOCUMENT_TYPE = 10,
  COMMENT = 8,
}

export interface TagSoupNode {
  nodeType: number;
  parent: TagSoupElement | null;
  start: number;
  end: number;
  data?: string;
}

export interface TagSoupElement extends TagSoupNode {
  nodeType: TagSoupNodeType.ELEMENT;
  tagName: string;
  attrs: Array<Attribute>;
  children: Array<TagSoupNode>;
}

export interface TagSoupText extends TagSoupNode {
  nodeType: TagSoupNodeType.TEXT;
  data: string;
}

export function createTagSoupElement(tagName: string, attrs: Array<Attribute>, start: number, end: number, children: Array<TagSoupNode>): TagSoupElement {
  return {nodeType: 1, parent: null, children, tagName, attrs, start, end};
}

export function createTagSoupText(value: string, start: number, end: number): TagSoupText {
  return {nodeType: 3, parent: null, data: value, start, end};
}

export function createTagSoupNode(nodeType: number, data: string, start: number, end: number): TagSoupNode {
  return {nodeType, parent: null, start, end, data};
}

export interface TagSoupDomParserOptions extends DomParserDialectOptions<TagSoupElement> {
}

export function createTagSoupDomParser(options: TagSoupDomParserOptions = {}): DomParser<TagSoupNode, TagSoupElement, TagSoupText> {
  const {
    xmlEnabled,
    decodeAttr,
    decodeText,
    renameTag,
    renameAttr,
    selfClosingEnabled,
    getContentMode,
    isEmittedAsText,
    isIgnored,
    isImplicitEnd,
  } = options;

  return createDomParser<TagSoupNode, TagSoupElement, TagSoupText>({
    xmlEnabled,
    decodeAttr,
    decodeText,
    renameTag,
    renameAttr,
    selfClosingEnabled,
    getContentMode: getTagType,
    isEmittedAsText,
    isIgnored,
    isImplicitEnd,

    createElement(tagName, attrs, selfClosing, start, end) {
      return createTagSoupElement(tagName, attrs, start, end, []);
    },

    appendChild(element, childNode) {
      childNode.parent = element;
      element.children.push(childNode);
    },

    setEndOffsets(node, start, end) {
      node.end = end;
    },

    createTextNode: createTagSoupText,

    createProcessingInstruction(data, start, end) {
      return createTagSoupNode(TagSoupNodeType.PROCESSING_INSTRUCTION, data, start, end);
    },

    createCdataSection(data, start, end) {
      return createTagSoupNode(TagSoupNodeType.CDATA_SECTION, data, start, end);
    },

    createDocumentType(data, start, end) {
      return createTagSoupNode(TagSoupNodeType.DOCUMENT_TYPE, data, start, end);
    },

    createComment(data, start, end) {
      return createTagSoupNode(TagSoupNodeType.COMMENT, data, start, end);
    },
  });
}
