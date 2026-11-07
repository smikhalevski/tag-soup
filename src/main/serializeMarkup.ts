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
   * Returns a hash code of a tag name. Tags are compared by their hash codes.
   */
  toHashCode: (tagName: string) => number;

  /**
   * Hash codes of tags whose {@link TagSerializationOptions.kind} is `'void'`.
   */
  voidTagSet?: Set<number>;

  /**
   * Hash codes of tags whose {@link TagSerializationOptions.kind} is `'raw_text'` or `'script_data'`.
   */
  rawTextTagSet?: Set<number>;

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
  const { toHashCode, voidTagSet, rawTextTagSet, areSelfClosingTagsSupported, encodeText = identity } = options;

  if (node instanceof Element) {
    let output = '<' + node.tagName;

    for (const name in node.attributes) {
      output += ' ' + name + '="' + encodeText(node.attributes[name]) + '"';
    }

    if (node.firstChild !== null) {
      output += '>';

      // Text inside raw text tags isn't encoded
      const isRawText = rawTextTagSet !== undefined && rawTextTagSet.has(toHashCode(node.tagName));

      for (let child: ChildNode | null = node.firstChild; child !== null; child = child.nextSibling) {
        if (isRawText && child.nodeType === Node.TEXT_NODE) {
          output += (child as Text).data;
        } else {
          output += serializeMarkup(child, options);
        }
      }

      output += '</' + node.tagName + '>';
    } else if (voidTagSet !== undefined && voidTagSet.has(toHashCode(node.tagName))) {
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

  if (node instanceof Text) {
    return encodeText(node.data);
  }

  return '';
}

function identity(value: string): string {
  return value;
}
