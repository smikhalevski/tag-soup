export { createDOMParser, type DOMParser } from './createDOMParser.ts';
export { createJSONParser, type JSONParser } from './createJSONParser.ts';
export { createSAXParser, type SAXParser, type SAXHandler } from './createSAXParser.ts';
export { createSerializer } from './createSerializer.ts';
export { createTokenizer, type Tokenizer } from './createTokenizer.ts';
export { MarkupSyntaxError } from './MarkupSyntaxError.ts';
export { HTMLTokenizer, HTMLDOMParser, HTMLSAXParser, HTMLJSONParser, toHTML } from './html.ts';
export { XMLTokenizer, XMLDOMParser, XMLSAXParser, XMLJSONParser, toXML } from './xml.ts';
export type {
  JSONParserOptions,
  JSONValue,
  ParserOptions,
  TagParsingOptions,
  TokenizerOptions,
  TokenizerContextOptions,
  TagKind,
  TokenCallback,
  TokenKind,
  TokenizerWriter,
  ParserWriter,
  TagSerializationOptions,
  SerializerOptions,
} from './types.ts';
