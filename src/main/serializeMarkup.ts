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
import type { ResolvedSerializerOptions, ResolvedTagSerializationOptions } from './resolveSerializerOptions.ts';
import { areCaseInsensitiveStringsEqual, getCaseInsensitiveHashCode, getCaseSensitiveHashCode } from './utils.ts';

/**
 * Serializes a DOM node as an HTML/XML string.
 *
 * @param node The DOM node to serialize.
 * @param options Serializer options.
 * @returns The serialized node.
 * @internal
 */
export function serializeMarkup(node: Node, options: ResolvedSerializerOptions): string {
  const { areSelfClosingTagsSupported, encodeText, encodeAttribute } = options;

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

    const tagOptions = getTagOptions(options, node.tagName);

    if (node.firstChild !== null) {
      output += '>';

      // Text inside raw text tags isn't encoded
      const isRawText = tagOptions !== undefined && tagOptions.isRawText;

      for (let child: ChildNode | null = node.firstChild; child !== null; child = child.nextSibling) {
        // Text children are written here, rather than serialized recursively
        if (child.nodeType === Node.TEXT_NODE) {
          output += isRawText ? (child as Text).data : encodeText((child as Text).data);
        } else {
          output += serializeMarkup(child, options);
        }
      }

      output += '</' + node.tagName + '>';
    } else if (tagOptions !== undefined && tagOptions.kind === 'void') {
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
      output += serializeMarkup(child, options);
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
 * Returns resolved options of a tag, or `undefined` if the tag has no options.
 */
function getTagOptions(
  options: ResolvedSerializerOptions,
  tagName: string
): ResolvedTagSerializationOptions | undefined {
  const { tagsMap, areTagNamesCaseInsensitive } = options;

  if (tagsMap === undefined) {
    return;
  }

  const tagOptionsList = tagsMap.get(
    areTagNamesCaseInsensitive
      ? getCaseInsensitiveHashCode(tagName, 0, tagName.length)
      : getCaseSensitiveHashCode(tagName, 0, tagName.length)
  );

  if (tagOptionsList === undefined) {
    return;
  }

  for (const tagOptions of tagOptionsList) {
    if (
      areTagNamesCaseInsensitive
        ? areCaseInsensitiveStringsEqual(tagOptions.tagName, tagName)
        : tagOptions.tagName === tagName
    ) {
      return tagOptions;
    }
  }
  return;
}
