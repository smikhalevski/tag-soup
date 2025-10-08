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
 * Options of {@link serializeMarkup}.
 */
export interface SerializerOptions {
  /**
   * The list of tags that can't have any contents (since there's no end tag, no content can be put between the start
   * tag and the end tag).
   *
   * @example
   * ['link', 'meta']
   * @see [HTML5 Void Elements](https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#void-elements)
   */
  voidTags?: string[];

  /**
   * If `true` then self-closing tags are recognized, otherwise they are treated as start tags.
   *
   * @default false
   */
  isSelfClosingTagsSupported?: boolean;

  /**
   * Encodes text content. Use this method to encode HTML/XML entities.
   *
   * @param text Text to encode.
   */
  encodeText?: (text: string) => string;
}

/**
 * Serializes DOM node as HTML/XML string.
 *
 * @param node DOM node to serialize.
 * @param options Serialization options.
 * @see {@link toHTML}
 * @see {@link toXML}
 */
export function serializeMarkup(node: Node, options: SerializerOptions = {}): string {
  const { voidTags, isSelfClosingTagsSupported, encodeText = identity } = options;

  if (node instanceof Element) {
    let xml = '<' + node.tagName;

    for (const name in node.attributes) {
      xml += ' ' + name + '="' + encodeText(node.attributes[name]) + '"';
    }

    if (node.firstChild !== null) {
      xml += '>';

      for (let child: ChildNode | null = node.firstChild; child !== null; child = child.nextSibling) {
        xml += serializeMarkup(child, options);
      }

      xml += '</' + node.tagName + '>';
    } else if (voidTags !== undefined && voidTags.includes(node.tagName)) {
      xml += '>';
    } else if (isSelfClosingTagsSupported) {
      xml += '/>';
    } else {
      xml += '</' + node.tagName + '>';
    }

    return xml;
  }

  if (node instanceof CDATASection) {
    return '<![CDATA[' + node.data + ']]>';
  }

  if (node instanceof Document || node instanceof DocumentFragment) {
    let xml = '';

    for (let child = node.firstChild; child !== null; child = child.nextSibling) {
      xml += serializeMarkup(child, options);
    }

    return xml;
  }

  if (node instanceof Comment) {
    return '<!--' + node.data + '-->';
  }

  if (node instanceof DocumentType) {
    return '<!DOCTYPE ' + node.name + '>';
  }

  if (node instanceof ProcessingInstruction) {
    return '<?' + node.target + ' ' + node.data + '?>';
  }

  if (node instanceof Text) {
    return encodeText(node.data);
  }

  return '';
}

function identity(value: string): string {
  return value;
}
