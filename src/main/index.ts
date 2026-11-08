export { createDOMParser, type DOMParser } from './createDOMParser.ts';
export { createSAXParser, type SAXParser, type SAXHandler } from './createSAXParser.ts';
export { createSerializer } from './createSerializer.ts';
export { createTokenizer, type Tokenizer } from './createTokenizer.ts';
export { ParserError } from './tokenizeMarkup.ts';
export { HTMLTokenizer, HTMLDOMParser, HTMLSAXParser, toHTML } from './html.ts';
export { XMLTokenizer, XMLDOMParser, XMLSAXParser, toXML } from './xml.ts';
export type {
  ParserOptions,
  TagParsingOptions,
  TokenizerOptions,
  ContextualTokenizerOptions,
  TagKind,
  TokenCallback,
  Token,
  TokenizerWriter,
  ParserWriter,
  TagSerializationOptions,
  SerializerOptions,
} from './types.ts';
