import { LexerHandler, LexerOptions } from './lexer-types';
import {
  CDATASection,
  Comment,
  Document,
  DocumentFragment,
  DocumentType,
  Element,
  Node,
  ProcessingInstruction,
  Text,
} from 'flyweight-dom';
import { createLexer } from './createLexer';

export interface ParserOptions extends LexerOptions {
  decodeText?: (value: string) => string;
  decodeAttributeValue?: (value: string) => string;
}

interface DOMParserContext {
  node: Node | null;
  attributeName: string | null;
  decodeText?: (value: string) => string;
  decodeAttributeValue?: (value: string) => string;
}

export type DOMParser = (input: string) => Document | DocumentFragment;

export function createDOMParser(options: ParserOptions = {}): DOMParser {
  const { decodeText, decodeAttributeValue } = options;

  const lexer = createLexer<DOMParserContext>(options);

  return input => {
    const context: DOMParserContext = {
      node: null,
      attributeName: null,
      decodeText,
      decodeAttributeValue,
    };
    lexer(input, tokenHandler, context);

    if (context.node === null) {
      return new DocumentFragment();
    }

    return context.node as Document | DocumentFragment;
  };
}

const tokenHandler: LexerHandler<DOMParserContext> = (type, chunk, offset, length, context, state) => {
  let data;

  switch (type) {
    case 'START_TAG_OPENING':
      const element = new Element(chunk.substr(offset + 1, length - 1));
      appendNode(context, element);
      context.node = element;
      break;

    case 'START_TAG_CLOSING':
      // if (context.attributeName !== null) {
      //   (context.node as Element).setAttribute(context.attributeName, '');
      //   context.attributeName = null;
      // }
      break;

    case 'START_TAG_SELF_CLOSING':
      // if (context.attributeName !== null) {
      //   (context.node as Element).setAttribute(context.attributeName, '');
      //   context.attributeName = null;
      // }
      context.node = context.node!.parentNode;
      break;

    case 'ATTRIBUTE_NAME':
      context.attributeName = chunk.substr(offset, length);
      break;

    case 'ATTRIBUTE_VALUE':
      data = chunk.substr(offset + 1, length - 2);

      // (context.node as Element).setAttribute(
      //   context.attributeName!,
      //   context.decodeAttributeValue !== undefined ? context.decodeAttributeValue(data) : data
      // );
      context.attributeName = null;
      break;

    case 'ATTRIBUTE_UNQUOTED_VALUE':
      data = chunk.substr(offset + 1, length - 2);

      // (context.node as Element).setAttribute(
      //   context.attributeName!,
      //   context.decodeAttributeValue !== undefined ? context.decodeAttributeValue(data) : data
      // );
      context.attributeName = null;
      break;

    case 'END_TAG_OPENING':
    // case 'END_TAG_CLOSING':
    case 'IMPLICIT_END_TAG':
      context.node = context.node!.parentNode;
      break;

    case 'IMPLICIT_START_TAG':
      appendNode(context, new Element(chunk.substr(offset + 2, length - 2)));
      break;

    case 'COMMENT':
      data = chunk.substr(offset + 4, length - 7);

      // appendNode(context, new Comment(context.decodeText !== undefined ? context.decodeText(data) : data));
      appendNode(context, new Comment(data));
      break;

    case 'PROCESSING_INSTRUCTION':
      appendNode(context, new ProcessingInstruction(chunk.substr(offset + 2, length - 4)));
      break;

    case 'CDATA_SECTION':
      data = chunk.substr(offset + 9, length - 12);

      // appendNode(context, new CDATASection(context.decodeText !== undefined ? context.decodeText(data) : data));
      appendNode(context, new CDATASection(data));
      break;

    case 'DOCTYPE':
      const { node } = context;

      if (node !== null && node.nodeType === 1 /*Node.ELEMENT_NODE*/) {
        break;
      }

      const documentType = new DocumentType('html');
      const document = new Document();

      document.appendChild(documentType);

      if (node !== null) {
        document.appendChild(node);
      }
      context.node = document;
      break;

    // case 'DTD':
    case 'TEXT':
      data = chunk.substr(offset, length);

      appendNode(context, new Text(data));
      // appendNode(context, new Text(context.decodeText !== undefined ? context.decodeText(data) : data));
      break;
  }
};

function appendNode(context: DOMParserContext, node: Node): void {
  if (context.node === null) {
    context.node = new DocumentFragment();
  }
  context.node.appendChild(node);
}
