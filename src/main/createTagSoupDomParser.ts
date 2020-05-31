import {createDomParser, DomParser, DomParserDialectOptions} from './createDomParser';

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
  attrs: Record<string, string>;
  children: Array<TagSoupNode>;
}

export interface TagSoupText extends TagSoupNode {
  nodeType: TagSoupNodeType.TEXT;
  data: string;
}

export function createTagSoupElement(tagName: string, attrs: Record<string, string>, start: number, end: number, children: Array<TagSoupNode>): TagSoupElement {
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
    isRawTag,
    isOmittedTag,
    isIgnoredTag,
    isVoidElement,
    isImplicitClose,
  } = options;

  return createDomParser<TagSoupNode, TagSoupElement, TagSoupText>({
    xmlEnabled,
    decodeAttr,
    decodeText,
    renameTag,
    renameAttr,
    selfClosingEnabled,
    isRawTag,
    isOmittedTag,
    isIgnoredTag,
    isVoidElement,
    isImplicitClose,

    createElement(tagName, start, end) {
      return createTagSoupElement(tagName, {}, start, end, []);
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

    cloneElement(element, childNode, start, end) {
      const el = createTagSoupElement(element.tagName, Object.assign({}, element.attrs), start, end, [childNode]);
      childNode.parent = el;
      return el;
    },

    setAttribute(element, name, value, start, end) {
      element.attrs[name] = value;
    },

    appendChild(element, childNode): void {
      childNode.parent = element;
      element.children.push(childNode);
    },

    appendData(textNode, value): void {
      textNode.data += value;
    },

    getParentElement(node) {
      return node.parent;
    },

    getTagName(element) {
      return element.tagName;
    },

    setEndOffset(node, end) {
      node.end = end;
    },
  });
}
