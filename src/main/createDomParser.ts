import {createSaxParser, SaxParserDialectOptions, SaxParserOptions} from './createSaxParser';

export interface DomParserDialectOptions<Element> extends SaxParserDialectOptions {

  /**
   * If returns `true` then tag with given name is rendered as text while its children are left intact.
   */
  isIgnoredTag?: (tagName: string) => boolean;

  /**
   * If returns `true` then tag with given name is replaced with its children.
   */
  isOmittedTag?: (tagName: string) => boolean;

  /**
   * If returns `true` then element cannot have children and if it does they are rendered as its siblings.
   */
  isVoidElement?: (element: Element) => boolean;

  /**
   * If returns `true` then `element` is rendered as sibling of `parentElement` instead of being added as a child to
   * `parentElement`.
   */
  isImplicitClose?: (parentElement: Element, element: Element) => boolean;
}

export type ElementFactory<Element> = (tagName: string, start: number, end: number) => Element;

export type TextNodeFactory<Text> = (data: string, start: number, end: number) => Text;

export type DataNodeFactory<Node> = (data: string, start: number, end: number) => Node;

export interface DomParserFactoryCallbacks<Node, Element extends Node, Text extends Node> {
  createElement: ElementFactory<Element>;
  createTextNode: TextNodeFactory<Text>;
  createProcessingInstruction?: DataNodeFactory<Node>;
  createCdataSection?: DataNodeFactory<Node>;
  createDocumentType?: DataNodeFactory<Node>;
  createComment?: DataNodeFactory<Node>;

  /**
   * Clones an element with a single child.
   */
  cloneElement?: (element: Element, childNode: Node, start: number, end: number) => Element;
  setAttribute?: (element: Element, name: string, value: string, start: number, end: number) => void;
  appendChild: (element: Element, childNode: Node) => void;
  appendData: (textNode: Text, data: string) => void;
  getParentElement: (node: Node) => Element | null;
  getTagName: (element: Element) => string;
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
    isOmittedTag,
    isVoidElement,
    isImplicitClose,

    createElement,
    createTextNode,
    createProcessingInstruction,
    createCdataSection,
    createDocumentType,
    createComment,

    cloneElement,
    setAttribute,
    appendChild,
    appendData,
    getParentElement,
    getTagName,
    setEndOffset,
  } = options;

  let str: string;
  let offset = 0;
  let nodeList: Array<Node> = [];
  let hostEl: Element | null;
  let orphanEl: Element | null;
  let textNode: Text | null;
  let treeStarted = false;

  const pushChild = (node: Node, closeImplied: boolean, start: number): void => {
    if (cloneElement != null) {
      for (let el = orphanEl, parentEl; el != null && (parentEl = getParentElement(el)) !== hostEl; el = parentEl) {
        if (closeImplied && parentEl != null && isImplicitClose?.(parentEl, node as Element)) {
          break;
        }
        node = cloneElement(el, node, start, start);
      }
      orphanEl = null;
    }
    if (hostEl != null) {
      appendChild(hostEl, node);
    } else {
      nodeList.push(node);
    }
    treeStarted = true;
  };

  const pushData = (data: string, start: number, end: number): void => {
    if (textNode != null && orphanEl == null) {
      appendData(textNode, data);
      setEndOffset?.(textNode, end);
      return;
    }

    textNode = createTextNode(data, start, end);
    pushChild(textNode, false, start);

    hostEl = getParentElement(textNode);
  };

  const saxParserOptions: SaxParserOptions = {
    xmlEnabled,
    decodeAttr,
    decodeText,
    renameTag,
    renameAttr,
    selfClosingEnabled,
    isRawTag,

    onStartTag(tagName, selfClosing, start, end) {
      if (isOmittedTag?.(tagName)) {
        return;
      }
      if (isIgnoredTag?.(tagName)) {
        pushData(str.substring(start - offset, end - offset), start, end);
        return;
      }

      const el = createElement(tagName, start, end);
      if (hostEl != null && isImplicitClose?.(hostEl, el)) {
        setEndOffset?.(hostEl, start);
        hostEl = getParentElement(hostEl);
      }
      pushChild(el, true, start);

      hostEl = selfClosing || isVoidElement?.(el) ? getParentElement(el) : el;
      textNode = null;
    },

    onAttribute(name, value, start, end) {
      if (hostEl) {
        setAttribute?.(hostEl, name, value, start, end);
      }
    },

    onEndTag(tagName, selfClosing, start, end) {
      if (isOmittedTag?.(tagName)) {
        return;
      }
      if (isIgnoredTag?.(tagName)) {
        pushData(str.substring(start - offset, end - offset), start, end);
        return;
      }
      if (selfClosing || hostEl == null) {
        return;
      }

      for (let el: Element | null = hostEl; el != null; el = getParentElement(el)) {
        if (getTagName(el) === tagName) {
          if (el !== hostEl) {

            if (cloneElement != null) {
              orphanEl = hostEl;
            }

            if (setEndOffset != null) {
              for (let orphanEl: Node | null = hostEl; orphanEl != null && orphanEl !== el; orphanEl = getParentElement(orphanEl)) {
                setEndOffset(orphanEl, start);
              }
            }
          }

          setEndOffset?.(el, end);

          hostEl = getParentElement(el);
          textNode = null;
          break;
        }
      }
    },

    onText: pushData,
  };

  if (createProcessingInstruction) {
    saxParserOptions.onProcessingInstruction = (value, start, end) => {
      pushChild(createProcessingInstruction(value, start, end), false, start);
    };
  }

  if (createCdataSection) {
    saxParserOptions.onCdataSection = (value, start, end) => {
      pushChild(createCdataSection(value, start, end), false, start);
    };
  }

  if (createDocumentType) {
    saxParserOptions.onDocumentType = (value, start, end) => {
      if (!treeStarted) {
        nodeList.push(createDocumentType(value, start, end));
      }
    };
  }

  if (createComment) {
    saxParserOptions.onComment = (value, start, end) => {
      pushChild(createComment(value, start, end), false, start);
    };
  }

  const saxParser = createSaxParser(saxParserOptions);

  const reset = () => {
    str = '';
    offset = 0;
    nodeList = [];
    hostEl = null;
    orphanEl = null;
    textNode = null;
    treeStarted = false;
  };

  return {
    resetStream() {
      saxParser.resetStream();
      reset();
    },

    writeStream(s) {
      str = saxParser.tail + s;
      offset = saxParser.offset;

      saxParser.writeStream(str);
      return nodeList;
    },

    commit(s = '') {
      str = saxParser.tail + s;
      offset = saxParser.offset;

      saxParser.commit(str);

      if (setEndOffset != null) {
        const charCount = offset + str.length;
        for (let el: Element | null = hostEl; el != null; el = getParentElement(el)) {
          setEndOffset(el, charCount);
        }
      }

      const result = nodeList;
      reset();
      return result;
    },
  };
}
