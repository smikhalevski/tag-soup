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

const tokenHandler: LexerHandler<DOMParserContext> = (type, chunk, offset, length, parserContext, state) => {
  let data;

  switch (type) {
    case 'START_TAG_OPENING':
      const element = new Element(chunk.substr(offset + 1, length - 1));
      appendNode(parserContext, element);
      parserContext.node = element;
      break;

    case 'START_TAG_CLOSING':
      if (parserContext.attributeName !== null) {
        (parserContext.node as Element).setAttribute(parserContext.attributeName, '');
        parserContext.attributeName = null;
      }
      break;

    case 'START_TAG_SELF_CLOSING':
      if (parserContext.attributeName !== null) {
        (parserContext.node as Element).setAttribute(parserContext.attributeName, '');
        parserContext.attributeName = null;
      }
      parserContext.node = parserContext.node!.parentNode;
      break;

    case 'ATTRIBUTE_NAME':
      parserContext.attributeName = chunk.substr(offset, length);
      break;

    case 'ATTRIBUTE_VALUE':
      data = chunk.substr(offset + 1, length - 2);

      (parserContext.node as Element).setAttribute(
        parserContext.attributeName!,
        parserContext.decodeAttributeValue !== undefined ? parserContext.decodeAttributeValue(data) : data
      );
      parserContext.attributeName = null;
      break;

    case 'ATTRIBUTE_UNQUOTED_VALUE':
      data = chunk.substr(offset + 1, length - 2);

      (parserContext.node as Element).setAttribute(
        parserContext.attributeName!,
        parserContext.decodeAttributeValue !== undefined ? parserContext.decodeAttributeValue(data) : data
      );
      parserContext.attributeName = null;
      break;

    case 'END_TAG_OPENING':
    // case 'END_TAG_CLOSING':
    case 'IMPLICIT_END_TAG':
      parserContext.node = parserContext.node!.parentNode;
      break;

    case 'IMPLICIT_START_TAG':
      appendNode(parserContext, new Element(chunk.substr(offset + 2, length - 2)));
      break;

    case 'DTD':
    case 'COMMENT':
      data = chunk.substr(offset + 4, length - 7);

      appendNode(
        parserContext,
        new Comment(parserContext.decodeText !== undefined ? parserContext.decodeText(data) : data)
      );
      break;

    case 'PROCESSING_INSTRUCTION':
      appendNode(parserContext, new ProcessingInstruction(chunk.substr(offset + 2, length - 4)));
      break;

    case 'CDATA_SECTION':
      data = chunk.substr(offset + 9, length - 12);

      appendNode(
        parserContext,
        new CDATASection(parserContext.decodeText !== undefined ? parserContext.decodeText(data) : data)
      );
      break;

    case 'DOCTYPE':
      const { node } = parserContext;

      if (node !== null && node.nodeType === 1 /*Node.ELEMENT_NODE*/) {
        break;
      }

      const documentType = new DocumentType('html');
      const document = new Document();

      document.appendChild(documentType);

      if (node !== null) {
        document.appendChild(node);
      }
      parserContext.node = document;
      break;

    case 'TEXT':
      data = chunk.substr(offset, length);

      appendNode(
        parserContext,
        new Text(parserContext.decodeText !== undefined ? parserContext.decodeText(data) : data)
      );
      break;
  }
};

function appendNode(context: DOMParserContext, node: Node): void {
  if (context.node === null) {
    context.node = new DocumentFragment();
  }
  context.node.appendChild(node);
}
