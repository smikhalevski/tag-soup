import {createSaxParser, SaxParserDialectOptions, SaxParserOptions} from './createSaxParser';

export interface DomParserDialectOptions<Element> extends SaxParserDialectOptions {

  /**
   * Source of ignored tag is rendered as a text node. Children of the ignored tag are left intact.
   */
  isIgnoredTag?: (tagName: string) => boolean;
  isRemovedTag?: (tagName: string) => boolean;
  isVoidElement?: (element: Element) => boolean;

  /**
   * If `true` then `element` is rendered as a sibling of the `hostElement`, otherwise `element` is appended as a child
   * to `hostElement`.
   */
  isImplicitEnd?: (hostElement: Element, element: Element) => boolean;
}

export type ElementFactory<Element> = (tagName: string, start: number, end: number) => Element;

export type TextNodeFactory<Text> = (data: string, start: number, end: number) => Text;

export type DataNodeFactory<Node> = (data: string, start: number, end: number) => Node;

export interface DomParserFactoryCallbacks<Node, Element extends Node, Text extends Node> {
  createElement: ElementFactory<Element>;
  createTextNode: TextNodeFactory<Text>;
  appendChild: (element: Element, childNode: Node) => void;
  appendData: (textNode: Text, data: string) => void;

  createProcessingInstruction?: DataNodeFactory<Node>;
  createCdataSection?: DataNodeFactory<Node>;
  createDocumentType?: DataNodeFactory<Node>;
  createComment?: DataNodeFactory<Node>;

  /**
   * Clones an element without children.
   */
  cloneElement?: (element: Element, start: number, end: number) => Element;
  setAttribute?: (element: Element, name: string, value: string, start: number, end: number) => void;
  setEndOffset?: (node: Node, end: number) => void;
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
    xmlEnabled,
    decodeAttr,
    decodeText,
    renameTag,
    renameAttr,
    selfClosingEnabled,
    isRawTag,

    isIgnoredTag,
    isRemovedTag,
    isVoidElement,
    isImplicitEnd,

    createElement,
    createTextNode,
    appendChild,
    appendData,

    createProcessingInstruction,
    createCdataSection,
    createDocumentType,
    createComment,

    cloneElement,
    setAttribute,
    setEndOffset,
  } = options;

  const tagNameStack: Array<string> = [];
  const elementStack: Array<Element> = [];

  let tail = '';
  let offset = 0;
  let lastIndex = -1;
  let index = -1;
  let textNode: Text | undefined;
  let nodes: Array<Node> = [];

  const reset = () => {
    tagNameStack.length = elementStack.length = 0;
    lastIndex = index = -1;
    textNode = undefined;
    nodes = [];
  };

  const appendNode = (node: Node): void => {
    if (index !== lastIndex) {
      if (index === -1) {
        nodes.push(elementStack[0]);
        index = 0;
      }
      for (let i = index; i < lastIndex; i++) {
        appendChild(elementStack[i], elementStack[i + 1]);
      }
      index = lastIndex;
    }
    if (index === -1) {
      nodes.push(node);
    } else {
      appendChild(elementStack[index], node);
    }
  };

  const appendText = (data: string, start: number, end: number): void => {
    if (textNode) {
      appendData(textNode, data);
      setEndOffset?.(textNode, end);
    } else {
      appendNode(createTextNode(data, start, end));
    }
  };

  const saxParserOptions: SaxParserOptions = {
    xmlEnabled,
    decodeAttr,
    decodeText,
    renameTag,
    renameAttr,
    selfClosingEnabled,
    isRawTag,

    onStartTag(tagName, selfClosing, start, end) {console.log(nodes)
      if (isRemovedTag?.(tagName)) {
        return;
      }
      if (isIgnoredTag?.(tagName)) {
        appendText(tail.substring(start - offset, end - offset), start, end);
        return;
      }

      textNode = undefined;
      const element = createElement(tagName, start, end);

      // if (lastIndex > 0 && isImplicitEnd?.(elementStack[lastIndex - 1], element)) {
      //   if (index !== lastIndex) {
      //     lastIndex--;
      //   }
      // }


      appendNode(element);

      if (!isVoidElement?.(element)) {
        lastIndex = ++index;
        tagNameStack[index] = tagName;
        elementStack[index] = element;
      }
    },

    onAttribute(name, value, start, end) {
      setAttribute?.(elementStack[index], name, value, start, end);
    },

    onEndTag(tagName, selfClosing, start, end) {
      if (isRemovedTag?.(tagName)) {
        return;
      }
      if (isIgnoredTag?.(tagName)) {
        appendText(tail.substring(start - offset, end - offset), start, end);
        return;
      }

      let i = lastIndex;
      for (; i >= 0 && tagNameStack[i] !== tagName; i--) {
      }
      if (i === -1) {
        // No start tag
        return;
      }
      textNode = undefined;
      setEndOffset?.(elementStack[i], end);

      if (cloneElement) {
        for (let j = i; j < lastIndex; j++) {
          const element = elementStack[j + 1];
          setEndOffset?.(element, start);
          tagNameStack[j] = tagNameStack[j + 1];
          elementStack[j] = cloneElement(element, end, end);
        }
        if (i <= index) {
          index = i - 1;
        }
        lastIndex--;
      } else {
        index = lastIndex = i - 1;
      }
    },

    onText: appendText,
  };

  const saxParser = createSaxParser(saxParserOptions);

  return {
    resetStream() {
      saxParser.resetStream();
      reset();
    },

    writeStream(str) {
      tail = saxParser.tail + str;
      offset = saxParser.offset;

      saxParser.writeStream(str);

      return nodes;
    },

    commit(str = '') {
      tail = saxParser.tail + str;
      offset = saxParser.offset;

      saxParser.commit(str);

      if (setEndOffset) {
        const end = offset + tail.length;

        for (let i = index; i >= 0; i--) {
          setEndOffset(elementStack[i], end);
        }
      }

      const outputNodes = nodes;
      reset();
      return outputNodes;
    },
  };
}
