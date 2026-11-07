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

/**
 * Options of {@link serializeMarkup} produced by {@link resolveSerializerOptions}.
 *
 * @internal
 */
export interface ResolvedSerializerOptions {
  /**
   * Returns a hash code of a tag name. Tags are looked up by their hash codes.
   */
  toHashCode: (tagName: string) => number;

  /**
   * Returns `true` if two tag names are equal. Names of tags with the same hash code are compared, since different
   * names can have equal hash codes.
   */
  areTagNamesEqual: (tagName1: string, tagName2: string) => boolean;

  /**
   * The map from a hash code to names of tags whose {@link TagSerializationOptions.kind} is `'void'`.
   */
  voidTagNameMap?: Map<number, string[]>;

  /**
   * The map from a hash code to names of tags whose {@link TagSerializationOptions.kind} is `'raw_text'` or
   * `'script_data'`.
   */
  rawTextTagNameMap?: Map<number, string[]>;

  /**
   * @see {@link SerializerOptions.areSelfClosingTagsSupported}
   */
  areSelfClosingTagsSupported?: boolean;

  /**
   * @see {@link SerializerOptions.encodeText}
   */
  encodeText?: (text: string) => string;
}

/**
 * Serializes a DOM node as an HTML/XML string.
 *
 * @param node The DOM node to serialize.
 * @param options Serializer options.
 * @returns The serialized node.
 * @internal
 */
export function serializeMarkup(node: Node, options: ResolvedSerializerOptions): string {
  const { voidTagNameMap, rawTextTagNameMap, areSelfClosingTagsSupported, encodeText = identity } = options;

  // Text is the most common node, and comparing the node type is faster than instanceof checks that walk the prototype
  // chain
  if (node.nodeType === Node.TEXT_NODE) {
    return encodeText((node as Text).data);
  }

  if (node instanceof Element) {
    let output = '<' + node.tagName;

    for (const name in node.attributes) {
      output += ' ' + name + '="' + encodeText(node.attributes[name]) + '"';
    }

    if (node.firstChild !== null) {
      output += '>';

      // Text inside raw text tags isn't encoded
      const isRawText = hasTagName(rawTextTagNameMap, node.tagName, options);

      for (let child: ChildNode | null = node.firstChild; child !== null; child = child.nextSibling) {
        // Text children are written here, rather than serialized recursively
        if (child.nodeType === Node.TEXT_NODE) {
          output += isRawText ? (child as Text).data : encodeText((child as Text).data);
        } else {
          output += serializeMarkup(child, options);
        }
      }

      output += '</' + node.tagName + '>';
    } else if (hasTagName(voidTagNameMap, node.tagName, options)) {
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
 * Returns `true` if a map from a hash code to tag names contains the tag name.
 */
function hasTagName(
  tagNameMap: Map<number, string[]> | undefined,
  tagName: string,
  options: ResolvedSerializerOptions
): boolean {
  if (tagNameMap === undefined) {
    return false;
  }

  const tagNames = tagNameMap.get(options.toHashCode(tagName));

  if (tagNames === undefined) {
    return false;
  }

  for (const otherTagName of tagNames) {
    if (options.areTagNamesEqual(otherTagName, tagName)) {
      return true;
    }
  }
  return false;
}

function identity(value: string): string {
  return value;
}
