import {createDomParser, DomParser, DomParserDialectOptions, DomParserFactoryCallbacks} from './createDomParser';
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
  selfClosing: boolean;
  children: Array<TagSoupNode>;
}

export interface TagSoupText extends TagSoupNode {
  nodeType: TagSoupNodeType.TEXT;
  data: string;
}

export function createTagSoupElement(tagName: string, attrs: Array<Attribute>, selfClosing: boolean, start: number, end: number): TagSoupElement {
  return {nodeType: 1, parent: null, tagName, attrs, selfClosing, children: [], start, end};
}

export function createTagSoupText(value: string, start: number, end: number): TagSoupText {
  return {nodeType: 3, parent: null, data: value, start, end};
}

export function createTagSoupNode(nodeType: number, data: string, start: number, end: number): TagSoupNode {
  return {nodeType, parent: null, start, end, data};
}

export interface TagSoupDomParserOptions extends DomParserDialectOptions<TagSoupElement> {
}

/**
 * Creates preconfigured DOM parser that returns a tree of {@link TagSoupNode}s.
 */
export function createTagSoupDomParser(options: TagSoupDomParserOptions = {}): DomParser<TagSoupNode, TagSoupElement, TagSoupText> {

  const domParserFactoryCallbacks: DomParserFactoryCallbacks<TagSoupNode, TagSoupElement, TagSoupText> = {
    createElement: createTagSoupElement,

    appendChild(element, childNode) {
      childNode.parent = element;
      element.children.push(childNode);
    },

    onContainerEnd(element, start, end) {
      element.end = end;
    },

    createTextNode: createTagSoupText,
    createProcessingInstruction: (data, start, end) => createTagSoupNode(TagSoupNodeType.PROCESSING_INSTRUCTION, data, start, end),
    createCdataSection: (data, start, end) => createTagSoupNode(TagSoupNodeType.CDATA_SECTION, data, start, end),
    createDocumentType: (data, start, end) => createTagSoupNode(TagSoupNodeType.DOCUMENT_TYPE, data, start, end),
    createComment: (data, start, end) => createTagSoupNode(TagSoupNodeType.COMMENT, data, start, end),
  };

  return createDomParser(Object.assign({}, options, domParserFactoryCallbacks));
}
