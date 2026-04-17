import { decodeXML, escapeXML } from 'speedy-entities';
import { ParserOptions } from './types.js';
import { createDOMParser } from './createDOMParser.js';
import { createSAXParser } from './createSAXParser.js';
import { createSerializer, SerializerOptions } from './createSerializer.js';
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
 * @group Tokenizer
 */
export const XMLTokenizer = createTokenizer(xmlParserOptions);

/**
 * Parses XML markup as DOM.
 *
 * @group DOM
 */
export const XMLDOMParser = createDOMParser(xmlParserOptions);

/**
 * Parses XML markup as a stream of tokens.
 *
 * @group SAX
 */
export const XMLSAXParser = createSAXParser(xmlParserOptions);

/**
 * Serializes DOM node as XML string.
 *
 * @group DOM
 */
export const toXML = createSerializer(xmlSerializerOptions);
