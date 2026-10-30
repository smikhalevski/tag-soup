import { decodeXML, escapeXML } from 'speedy-entities';
import { type ParserOptions } from './types.js';
import { createDOMParser } from './createDOMParser.js';
import { createSAXParser } from './createSAXParser.js';
import { createSerializer, type SerializerOptions } from './createSerializer.js';
import { createTokenizer } from './createTokenizer.js';

const xmlParserOptions: ParserOptions = {
  areSelfClosingTagsRecognized: true,
  areProcessingInstructionsRecognized: true,
  areCDATASectionsRecognized: true,
  isStrict: true,
  decodeText: decodeXML,
};

const xmlSerializerOptions: SerializerOptions = {
  areSelfClosingTagsSupported: true,
  encodeText: escapeXML,
};

/**
 * Tokenizes XML markup as a stream of tokens.
 *
 * @throws {@link ParserError} If markup isn't well-formed XML.
 * @group Tokenizer
 */
export const XMLTokenizer = createTokenizer(xmlParserOptions);

/**
 * Parses XML markup as DOM. Decodes XML entities with
 * [`decodeXML`](https://smikhalevski.github.io/speedy-entities/variables/decodeXML.html).
 *
 * @throws {@link ParserError} If markup isn't well-formed XML.
 * @group DOM
 */
export const XMLDOMParser = createDOMParser(xmlParserOptions);

/**
 * Parses XML markup and calls {@link SAXHandler} methods when tokens are read. Decodes XML entities with
 * [`decodeXML`](https://smikhalevski.github.io/speedy-entities/variables/decodeXML.html).
 *
 * @throws {@link ParserError} If markup isn't well-formed XML.
 * @group SAX
 */
export const XMLSAXParser = createSAXParser(xmlParserOptions);

/**
 * Serializes DOM node as XML string. Encodes text with
 * [`escapeXML`](https://smikhalevski.github.io/speedy-entities/functions/escapeXML.html). Elements without children
 * are written as self-closing tags.
 *
 * @group Serializer
 */
export const toXML = createSerializer(xmlSerializerOptions);
