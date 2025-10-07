import {
  CDATASection,
  Comment,
  Document,
  DocumentFragment,
  DocumentType,
  Element,
  Node,
  ProcessingInstruction,
  Text,
} from 'flyweight-dom';
import { escapeXML } from 'speedy-entities';

export function toXML(node: Node): string {
  if (node instanceof Element) {
    let xml = '<' + node.tagName;

    for (const name in node.attributes) {
      xml += ' ' + name + '="' + escapeXML(node.attributes[name]) + '"';
    }

    xml += node.firstChild !== null ? '>' : '/>';

    for (let child = node.firstChild; child !== null; child = child.nextSibling) {
      xml += toXML(child);
    }

    xml += node.firstChild !== null ? '</' + node.tagName + '>' : '';

    return xml;
  }

  if (node instanceof CDATASection) {
    return '<![CDATA[' + node.data + ']]>';
  }

  if (node instanceof Document || node instanceof DocumentFragment) {
    let xml = '';

    for (let child = node.firstChild; child !== null; child = child.nextSibling) {
      xml += toXML(child);
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
    return escapeXML(node.data);
  }

  return '';
}
