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
  areSelfClosingTagsSupported?: boolean;
  encodeText?: (text: string) => string;
}

/**
 * Serializes DOM node as HTML/XML string.
 *
 * @param node DOM node to serialize.
 * @param options Serialization options.
 */
export function serializeMarkup(node: Node, options: ResolvedSerializerOptions): string {
  const { toHashCode, voidTags, areSelfClosingTagsSupported, encodeText = identity } = options;

  if (node instanceof Element) {
    let output = '<' + node.tagName;

    for (const name in node.attributes) {
      output += ' ' + name + '="' + encodeText(node.attributes[name]) + '"';
    }

    if (node.firstChild !== null) {
      output += '>';

      for (let child: ChildNode | null = node.firstChild; child !== null; child = child.nextSibling) {
        output += serializeMarkup(child, options);
      }

      output += '</' + node.tagName + '>';
    } else if (voidTags !== undefined && voidTags.has(toHashCode(node.tagName))) {
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
