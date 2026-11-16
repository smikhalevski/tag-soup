import { decodeXML, escapeXML } from 'speedy-entities';
import { createDOMParserFromConfig } from './createDOMParser.ts';
import { createSAXParserFromConfig } from './createSAXParser.ts';
import { createSerializer } from './createSerializer.ts';
import { createTokenizer } from './createTokenizer.ts';
import { resolveParserOptions } from './resolveParserOptions.ts';
import { type SerializerOptions, type TokenizerOptions } from './types.ts';

const xmlTokenizerOptions: TokenizerOptions = {
  areCDATASectionsRecognized: true,
  areSelfClosingTagsRecognized: true,
  processingInstructionSyntax: 'xml',
  isStrict: true,
};

const xmlSerializerOptions: SerializerOptions = {
  areSelfClosingTagsSupported: true,
  encodeText: escapeXML,
  encodeAttribute: escapeXML,
};

/**
 * Reads tokens from XML markup.
 *
 * @group Tokenizer
 */
export const XMLTokenizer = createTokenizer(xmlTokenizerOptions);

const xmlParserConfig = resolveParserOptions({
  tokenizer: XMLTokenizer,
  decodeText: decodeXML,
  decodeAttribute: decodeXML,
  areNamespacesRecognized: true,
});

/**
 * Parses XML markup as a DOM. Decodes XML entities with
 * [`decodeXML`](https://smikhalevski.github.io/speedy-entities/functions/decodeXML.html), and resolves namespaces of
 * elements from `xmlns` and `xmlns:*` attributes.
 *
 * @group DOM
 */
export const XMLDOMParser = createDOMParserFromConfig(xmlParserConfig);

/**
 * Parses XML markup and calls {@link SAXHandler} methods when tokens are read. Decodes XML entities with
 * [`decodeXML`](https://smikhalevski.github.io/speedy-entities/functions/decodeXML.html), and resolves namespaces of
 * tags from `xmlns` and `xmlns:*` attributes.
 *
 * @group SAX
 */
export const XMLSAXParser = createSAXParserFromConfig(xmlParserConfig);

/**
 * Serializes a DOM node as an XML string. Encodes text and attribute values with
 * [`escapeXML`](https://smikhalevski.github.io/speedy-entities/functions/escapeXML.html). Elements without children
 * are written as self-closing tags.
 *
 * @group Serializer
 */
export const toXML = createSerializer(xmlSerializerOptions);
