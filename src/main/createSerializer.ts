import {
  type CDATASection,
  type Comment,
  type DocumentType,
  type Element,
  Node,
  type ProcessingInstruction,
  type Text,
} from 'flyweight-dom';
import { resolveSerializerOptions, type SerializerConfig } from './resolveSerializerOptions.ts';
import type { SerializerOptions } from './types.ts';
import { toLowerCase } from './utils.ts';

/**
 * Creates a serializer that converts a DOM node to an HTML/XML string.
 *
 * @example
 * import { createSerializer, HTMLDOMParser } from 'tag-soup';
 * import { escapeXML } from 'speedy-entities';
 *
 * const serialize = createSerializer({
 *   tags: {
 *     br: { kind: 'void' },
 *   },
 *   encodeText: escapeXML,
 *   encodeAttribute: escapeXML,
 * });
 *
 * serialize(HTMLDOMParser.parseFragment('<p>hello<br></p>'));
 * // ⮕ '<p>hello<br></p>'
 *
 * @param options Serializer options.
 * @returns The new serializer.
 * @see {@link toHTML}
 * @see {@link toXML}
 * @group Serializer
 */
export function createSerializer(options: SerializerOptions = {}): (node: Node) => string {
  const config = resolveSerializerOptions(options);

  return node => serializeNode(config, node);
}

/**
 * Serializes a node. Functions append markup to the output and return it, so the output is concatenated in document
 * order once, rather than each element building its own string that its parent appends.
 */
const serializeNode = (config: SerializerConfig, node: Node): string => {
  switch (node.nodeType) {
    case Node.TEXT_NODE:
      return config.encodeText((node as Text).data);

    case Node.ELEMENT_NODE:
      return writeElement(config, node as Element, '');

    default:
      return writeLeaf(config, node, '');
  }
};

/**
 * Writes children of a node to the output, and returns the output.
 *
 * @param config The serializer config.
 * @param parentNode The node whose children are written.
 * @param isRawText If `true` then text children aren't encoded.
 * @param output The output written so far.
 */
const writeChildren = (config: SerializerConfig, parentNode: Node, isRawText: boolean, output: string): string => {
  const { encodeText } = config;

  for (let child = parentNode.firstChild; child !== null; child = child.nextSibling) {
    switch (child.nodeType) {
      // Text is the most common child, so it's written here, without a call
      case Node.TEXT_NODE:
        output += isRawText ? (child as Text).data : encodeText((child as Text).data);
        break;

      case Node.ELEMENT_NODE:
        output = writeElement(config, child as Element, output);
        break;

      default:
        output = writeLeaf(config, child, output);
        break;
    }
  }

  return output;
};

/**
 * Writes an element and its descendants to the output, and returns the output.
 */
const writeElement = (config: SerializerConfig, element: Element, output: string): string => {
  const { encodeAttribute } = config;
  const { tagName, attributes } = element;

  output += '<' + tagName;

  for (const name in attributes) {
    output += ' ' + name + '="' + encodeAttribute(attributes[name]) + '"';
  }

  const normalizedTagName = config.areTagNamesCaseInsensitive ? toLowerCase(tagName) : tagName;

  if (element.firstChild === null) {
    if (config.voidTagNameSet.has(normalizedTagName)) {
      return output + '>';
    }
    return output + (config.areSelfClosingTagsSupported ? '/>' : '></' + tagName + '>');
  }

  output += '>';

  return writeChildren(config, element, config.rawTextTagNameSet.has(normalizedTagName), output) + '</' + tagName + '>';
};

/**
 * Writes a node that isn't an element or a text node to the output, and returns the output.
 */
const writeLeaf = (config: SerializerConfig, node: Node, output: string): string => {
  switch (node.nodeType) {
    case Node.COMMENT_NODE:
      return output + '<!--' + (node as Comment).data + '-->';

    case Node.CDATA_SECTION_NODE:
      return output + '<![CDATA[' + (node as CDATASection).data + ']]>';

    case Node.DOCUMENT_TYPE_NODE:
      return writeDoctype(node as DocumentType, output);

    case Node.PROCESSING_INSTRUCTION_NODE: {
      const { target, data } = node as ProcessingInstruction;

      return output + '<?' + target + (data.length !== 0 ? ' ' + data : '') + '?>';
    }

    case Node.DOCUMENT_NODE:
    case Node.DOCUMENT_FRAGMENT_NODE:
      return writeChildren(config, node, false, output);
  }
  return output;
};

/**
 * Writes a DOCTYPE to the output, and returns the output. The system identifier follows `SYSTEM` only if there's no
 * public identifier.
 */
const writeDoctype = (doctype: DocumentType, output: string): string => {
  const { name, publicId, systemId } = doctype;

  output += '<!DOCTYPE ' + name;

  if (publicId.length !== 0) {
    output += ' PUBLIC "' + publicId + '"';
  } else if (systemId.length !== 0) {
    output += ' SYSTEM';
  }

  if (systemId.length !== 0) {
    output += ' "' + systemId + '"';
  }

  return output + '>';
};
