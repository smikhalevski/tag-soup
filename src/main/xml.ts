import { decodeXML, escapeXML } from 'speedy-entities';
import { createDOMParser } from './createDOMParser.ts';
import { createSAXParser } from './createSAXParser.ts';
import { createSerializer } from './createSerializer.ts';
import { createTokenizer } from './createTokenizer.ts';
import { type ParserOptions, type SerializerOptions } from './types.ts';

const xmlParserOptions: ParserOptions = {
  areSelfClosingTagsRecognized: true,
  areProcessingInstructionsRecognized: true,
  areCDATASectionsRecognized: true,
  isStrict: true,
  decodeText: decodeXML,
  decodeAttribute: decodeXML,
};

const xmlSerializerOptions: SerializerOptions = {
  areSelfClosingTagsSupported: true,
  encodeText: escapeXML,
  encodeAttribute: escapeXML,
};

/**
 * Tokenizes XML markup as a stream of tokens.
 *
 * @throws {@link MarkupSyntaxError} If markup isn't well-formed XML.
 * @group Tokenizer
 */
export const XMLTokenizer = createTokenizer(xmlParserOptions);

/**
 * Parses XML markup as a DOM. Decodes XML entities with
 * [`decodeXML`](https://smikhalevski.github.io/speedy-entities/functions/decodeXML.html).
 *
 * @throws {@link MarkupSyntaxError} If markup isn't well-formed XML.
 * @group DOM
 */
export const XMLDOMParser = createDOMParser(xmlParserOptions);

/**
 * Parses XML markup and calls {@link SAXHandler} methods when tokens are read. Decodes XML entities with
 * [`decodeXML`](https://smikhalevski.github.io/speedy-entities/functions/decodeXML.html).
 *
 * @throws {@link MarkupSyntaxError} If markup isn't well-formed XML.
 * @group SAX
 */
export const XMLSAXParser = createSAXParser(xmlParserOptions);

/**
 * Serializes a DOM node as an XML string. Encodes text and attribute values with
 * [`escapeXML`](https://smikhalevski.github.io/speedy-entities/functions/escapeXML.html). Elements without children
 * are written as self-closing tags.
 *
 * @group Serializer
 */
export const toXML = createSerializer(xmlSerializerOptions);
