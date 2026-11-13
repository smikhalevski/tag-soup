import {
  CDATASection,
  ChildNode,
  Comment,
  DocumentType,
  Element,
  Node,
  ProcessingInstruction,
  Text,
} from 'flyweight-dom';
import type { SerializerConfig, TagSerializationConfig } from './resolveSerializerOptions.ts';
import { resolveSerializerOptions } from './resolveSerializerOptions.ts';
import type { SerializerOptions } from './types.ts';
import { areCaseInsensitiveStringsEqual, getCaseInsensitiveHashCode, getCaseSensitiveHashCode } from './utils.ts';

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

  return node => serializeMarkup(node, config);
}

function serializeMarkup(anyNode: Node, config: SerializerConfig): string {
  const { areSelfClosingTagsSupported, encodeText, encodeAttribute } = config;

  // Text is the most common node, and a node type check is faster than instanceof, which walks the prototype chain
  if (anyNode.nodeType === Node.TEXT_NODE) {
    return encodeText((anyNode as Text).data);
  }

  if (anyNode.nodeType === Node.ELEMENT_NODE) {
    const node = anyNode as Element;

    let output = '<' + node.tagName;

    for (const name in node.attributes) {
      output += ' ' + name + '="' + encodeAttribute(node.attributes[name]) + '"';
    }

    const tagConfig = getTagConfig(config, node.tagName);

    if (node.firstChild !== null) {
      output += '>';

      // Text inside raw text tags isn't encoded
      const isRawText = tagConfig?.isRawText === true;

      for (let child: ChildNode | null = node.firstChild; child !== null; child = child.nextSibling) {
        // Text children are written here, which saves a recursive call
        if (child.nodeType === Node.TEXT_NODE) {
          output += isRawText ? (child as Text).data : encodeText((child as Text).data);
        } else {
          output += serializeMarkup(child, config);
        }
      }

      output += '</' + node.tagName + '>';
    } else if (tagConfig?.kind === 'void') {
      output += '>';
    } else if (areSelfClosingTagsSupported) {
      output += '/>';
    } else {
      output += '></' + node.tagName + '>';
    }

    return output;
  }

  if (anyNode.nodeType === Node.CDATA_SECTION_NODE) {
    return '<![CDATA[' + (anyNode as CDATASection).data + ']]>';
  }

  if (anyNode.nodeType === Node.DOCUMENT_NODE || anyNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    let output = '';

    for (let child = anyNode.firstChild; child !== null; child = child.nextSibling) {
      output += serializeMarkup(child, config);
    }

    return output;
  }

  if (anyNode.nodeType === Node.COMMENT_NODE) {
    return '<!--' + (anyNode as Comment).data + '-->';
  }

  if (anyNode.nodeType === Node.DOCUMENT_TYPE_NODE) {
    return '<!DOCTYPE ' + (anyNode as DocumentType).name + '>';
  }

  if (anyNode.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
    const node = anyNode as ProcessingInstruction;

    return '<?' + node.target + (node.data.length !== 0 ? ' ' + node.data : '') + '?>';
  }

  return '';
}

/**
 * Returns the config of a tag, or `undefined` if it has none.
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
}
