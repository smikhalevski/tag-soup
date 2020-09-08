import {Attribute, SaxParserCallbacks} from './createSaxParser';
import {createForgivingSaxParser, ForgivingSaxParserDialectOptions} from './createForgivingSaxParser';

export interface DomParserDialectOptions<Element> extends ForgivingSaxParserDialectOptions {
}

export type ElementFactory<Element> = (tagName: string, attrs: Array<Attribute>, selfClosing: boolean, start: number, end: number) => Element;

export type TextNodeFactory<Text> = (data: string, start: number, end: number) => Text;

export type DataNodeFactory<Node> = (data: string, start: number, end: number) => Node;

export interface DomParserFactoryCallbacks<Node, Element extends Node, Text extends Node> {
  createElement: ElementFactory<Element>;
  setEndOffsets?: (node: Node, start: number, end: number) => void;
  appendChild: (element: Element, childNode: Node) => void;

  createTextNode: TextNodeFactory<Text>;
  createProcessingInstruction?: DataNodeFactory<Node>;
  createCdataSection?: DataNodeFactory<Node>;
  createDocumentType?: DataNodeFactory<Node>;
  createComment?: DataNodeFactory<Node>;
}

export interface DomParserOptions<Node, Element extends Node, Text extends Node> extends DomParserDialectOptions<Element>, DomParserFactoryCallbacks<Node, Element, Text> {
}

export interface DomParser<Node, Element extends Node = Node, Text extends Node = Node> {

  resetStream(): void;

  writeStream(str: string): Array<Node>;

  commit(str?: string): Array<Node>;
}

export function createDomParser<Node, Element extends Node = Node, Text extends Node = Node>(options: DomParserOptions<Node, Element, Text>): DomParser<Node, Element, Text> {
  const {
    createElement,
    setEndOffsets,
    appendChild,
    createTextNode,
    createProcessingInstruction,
    createCdataSection,
    createDocumentType,
    createComment,
  } = options;

  let nodes: Array<Node> = [];

  const elementStack: Array<Element> = [];
  let depth = 0;

  const pushChild = (node: Node) => {
    if (depth !== 0) {
      appendChild(elementStack[depth - 1], node);
    } else {
      nodes.push(node);
    }
  };

  const overrides: SaxParserCallbacks = {
    onStartTag(tagName, attrs, selfClosing, tagType, start, end) {
      const element = createElement(tagName, attrs, selfClosing, start, end);
      pushChild(element);

      if (!selfClosing) {
        elementStack[depth++] = element;
      }
    },
    onEndTag(tagName, start, end) {
      setEndOffsets?.(elementStack[depth - 1], start, end);
      depth--;
    },
  };

  if (createTextNode) {
    overrides.onText = (data, start, end) => pushChild(createTextNode(data, start, end));
  }
  if (createProcessingInstruction) {
    overrides.onProcessingInstruction = (data, start, end) => pushChild(createProcessingInstruction(data, start, end));
  }
  if (createCdataSection) {
    overrides.onCdataSection = (data, start, end) => pushChild(createCdataSection(data, start, end));
  }
  if (createDocumentType) {
    overrides.onDocumentType = (data, start, end) => pushChild(createDocumentType(data, start, end));
  }
  if (createComment) {
    overrides.onComment = (data, start, end) => pushChild(createComment(data, start, end));
  }

  const saxParser = createForgivingSaxParser(Object.assign({}, options, overrides));

  return {
    resetStream() {
      saxParser.resetStream();
      depth = 0;
      nodes = [];
    },
    writeStream(str) {
      saxParser.commit(str);
      return nodes;
    },
    commit(str) {
      saxParser.commit(str);
      return nodes;
    },
  };
}
