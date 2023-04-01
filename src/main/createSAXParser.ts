import { LexerHandler } from './lexer-types';
import { createLexer } from './createLexer';
import { ParserOptions } from './createDOMParser';

export interface SAXHandler {
  startTag(tagName: string, attributes: { [attributeName: string]: string } | null): void;

  endTag(): void;

  comment(value: string): void;

  processingInstruction(value: string): void;

  cdata(value: string): void;

  doctype(value: string): void;

  text(value: string): void;
}

interface SAXParserContext {
  handler: SAXHandler;
  tagName: string | null;
  attributes: { [name: string]: string } | null;
  attributeName: string | null;
  decodeText?: (value: string) => string;
  decodeAttributeValue?: (value: string) => string;
}

export type SAXParser = (input: string, handler: SAXHandler) => void;

export function createSAXParser(options: ParserOptions = {}): SAXParser {
  const { decodeText, decodeAttributeValue } = options;

  const lexer = createLexer<SAXParserContext>(options);

  return (input, handler) => {
    lexer(input, tokenHandler, {
      handler,
      tagName: null,
      attributes: null,
      attributeName: null,
      decodeText,
      decodeAttributeValue,
    });
  };
}

const tokenHandler: LexerHandler<SAXParserContext> = (type, chunk, offset, length, parserContext, state) => {
  let data;

  switch (type) {
    case 'START_TAG_OPENING':
      parserContext.tagName = chunk.substr(offset + 1, length - 1);
      break;

    case 'START_TAG_CLOSING':
      if (parserContext.attributeName !== null) {
        parserContext.attributes![parserContext.attributeName!] = '';
        parserContext.attributeName = null;
      }

      parserContext.handler.startTag(parserContext.tagName!, parserContext.attributes);
      break;

    case 'START_TAG_SELF_CLOSING':
      if (parserContext.attributeName !== null) {
        parserContext.attributes![parserContext.attributeName!] = '';
        parserContext.attributeName = null;
      }
      parserContext.handler.startTag(parserContext.tagName!, parserContext.attributes);
      parserContext.handler.endTag();
      break;

    case 'ATTRIBUTE_NAME':
      parserContext.attributeName = chunk.substr(offset, length);
      break;

    case 'ATTRIBUTE_VALUE':
      data = chunk.substr(offset + 1, length - 2);

      parserContext.attributes![parserContext.attributeName!] =
        parserContext.decodeAttributeValue !== undefined ? parserContext.decodeAttributeValue(data) : data;

      parserContext.attributeName = null;
      break;

    case 'ATTRIBUTE_UNQUOTED_VALUE':
      data = chunk.substr(offset + 1, length - 2);

      parserContext.attributes![parserContext.attributeName!] =
        parserContext.decodeAttributeValue !== undefined ? parserContext.decodeAttributeValue(data) : data;

      parserContext.attributeName = null;
      break;

    case 'END_TAG_OPENING':
    // case 'END_TAG_CLOSING':
    case 'IMPLICIT_END_TAG':
      parserContext.handler.endTag();
      break;

    case 'IMPLICIT_START_TAG':
      parserContext.handler.startTag(chunk.substr(offset + 2, length - 2), null);
      break;

    case 'DTD':
    case 'COMMENT':
      data = chunk.substr(offset + 4, length - 7);

      parserContext.handler.comment(parserContext.decodeText !== undefined ? parserContext.decodeText(data) : data);
      break;

    case 'PROCESSING_INSTRUCTION':
      parserContext.handler.processingInstruction(chunk.substr(offset + 2, length - 4));
      break;

    case 'CDATA_SECTION':
      data = chunk.substr(offset + 9, length - 12);

      parserContext.handler.cdata(parserContext.decodeText !== undefined ? parserContext.decodeText(data) : data);
      break;

    case 'DOCTYPE':
      parserContext.handler.doctype('html');
      break;

    case 'TEXT':
      data = chunk.substr(offset, length);

      parserContext.handler.text(parserContext.decodeText !== undefined ? parserContext.decodeText(data) : data);
      break;
  }
};
