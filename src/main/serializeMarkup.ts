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
export interface ResolvedSerializerOptions {
  toHashCode: (str: string) => number;
  voidTags?: Set<number>;
  isSelfClosingTagsSupported?: boolean;
  encodeText?: (text: string) => string;
}

/**
 * Serializes DOM node as HTML/XML string.
 *
 * @param node DOM node to serialize.
 * @param options Serialization options.
 */
export function serializeMarkup(node: Node, options: ResolvedSerializerOptions): string {
  const { toHashCode, voidTags, isSelfClosingTagsSupported, encodeText = identity } = options;

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
    } else if (voidTags !== undefined && voidTags.has(toHashCode(node.tagName))) {
      xml += '>';
    } else if (isSelfClosingTagsSupported) {
      xml += '/>';
    } else {
      xml += '></' + node.tagName + '>';
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
