import {
  CDATASection,
  ChildNode,
  Comment,
  Document,
  DocumentFragment,
  DocumentType,
  Element,
  Node,
  ProcessingInstruction,
  Text,
} from 'flyweight-dom';
import type { SerializerConfig, TagSerializationConfig } from './resolveSerializerOptions.ts';
import { areCaseInsensitiveStringsEqual, getCaseInsensitiveHashCode, getCaseSensitiveHashCode } from './utils.ts';

/**
 * Serializes a DOM node as an HTML/XML string.
 *
 * @param node The DOM node to serialize.
 * @param config The serializer config.
 * @returns The serialized node.
 * @internal
 */
export function serializeMarkup(node: Node, config: SerializerConfig): string {
  const { areSelfClosingTagsSupported, encodeText, encodeAttribute } = config;

  // Text is the most common node, and comparing the node type is faster than instanceof checks that walk the prototype
  // chain
  if (node.nodeType === Node.TEXT_NODE) {
    return encodeText((node as Text).data);
  }

  if (node instanceof Element) {
    let output = '<' + node.tagName;

    for (const name in node.attributes) {
      output += ' ' + name + '="' + encodeAttribute(node.attributes[name]) + '"';
    }

    const tagConfig = getTagConfig(config, node.tagName);

    if (node.firstChild !== null) {
      output += '>';

      // Text inside raw text tags isn't encoded
      const isRawText = tagConfig !== undefined && tagConfig.isRawText;

      for (let child: ChildNode | null = node.firstChild; child !== null; child = child.nextSibling) {
        // Text children are written here, rather than serialized recursively
        if (child.nodeType === Node.TEXT_NODE) {
          output += isRawText ? (child as Text).data : encodeText((child as Text).data);
        } else {
          output += serializeMarkup(child, config);
        }
      }

      output += '</' + node.tagName + '>';
    } else if (tagConfig !== undefined && tagConfig.kind === 'void') {
      output += '>';
    } else if (areSelfClosingTagsSupported) {
      output += '/>';
    } else {
      output += '></' + node.tagName + '>';
    }

    return output;
  }

  if (node instanceof CDATASection) {
    return '<![CDATA[' + node.data + ']]>';
  }

  if (node instanceof Document || node instanceof DocumentFragment) {
    let output = '';

    for (let child = node.firstChild; child !== null; child = child.nextSibling) {
      output += serializeMarkup(child, config);
    }

    return output;
  }

  if (node instanceof Comment) {
    return '<!--' + node.data + '-->';
  }

  if (node instanceof DocumentType) {
    return '<!DOCTYPE ' + node.name + '>';
  }

  if (node instanceof ProcessingInstruction) {
    return '<?' + node.target + (node.data.length !== 0 ? ' ' + node.data : '') + '?>';
  }

  return '';
}

/**
 * Returns the config of a tag, or `undefined` if options don't mention the tag.
 */
function getTagConfig(config: SerializerConfig, tagName: string): TagSerializationConfig | undefined {
  const { tagConfigsMap, areTagNamesCaseInsensitive } = config;

  if (tagConfigsMap === undefined) {
    return;
  }

  const tagConfigs = tagConfigsMap.get(
    areTagNamesCaseInsensitive
      ? getCaseInsensitiveHashCode(tagName, 0, tagName.length)
      : getCaseSensitiveHashCode(tagName, 0, tagName.length)
  );

  if (tagConfigs === undefined) {
    return;
  }

  for (const tagConfig of tagConfigs) {
    if (
      areTagNamesCaseInsensitive
        ? areCaseInsensitiveStringsEqual(tagConfig.tagName, tagName)
        : tagConfig.tagName === tagName
    ) {
      return tagConfig;
    }
  }
  return;
}
