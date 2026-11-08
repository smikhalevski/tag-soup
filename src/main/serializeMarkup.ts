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
import {
  areCaseInsensitiveStringsEqual,
  getCaseInsensitiveHashCode,
  getCaseSensitiveHashCode,
  type TagKind,
} from './tokenizeMarkup.ts';

/**
 * Options of {@link serializeMarkup} produced by {@link resolveSerializerOptions}. Tags are represented by hash codes.
 *
 * @see {@link ResolvedSerializerOptions.areTagNamesCaseInsensitive}
 * @internal
 */
export interface ResolvedSerializerOptions {
  /**
   * If `true` then tag names are hashed with {@link getCaseInsensitiveHashCode} and compared with
   * {@link areCaseInsensitiveStringsEqual}, otherwise with {@link getCaseSensitiveHashCode} and compared as is.
   *
   * @default false
   */
  areTagNamesCaseInsensitive?: boolean;

  /**
   * The map from a hash code of a tag name to resolved options of tags with this hash code. Different names can have
   * equal hash codes, so tags with the same hash code share an array, and their names are compared. Tags that are
   * written the same way as tags that options don't mention aren't in the map.
   */
  tagOptionsMap?: Map<number, ResolvedTagSerializationOptions[]>;

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
 * Options of a tag consumed by {@link serializeMarkup}. All of them are kept in one object, so the tag of an element is
 * looked up once, rather than once per option.
 *
 * @internal
 */
export interface ResolvedTagSerializationOptions {
  /**
   * The name of the tag, which is compared with names of elements that have the same hash code.
   */
  tagName: string;

  /**
   * @see {@link TagSerializationOptions.kind}
   */
  kind: TagKind;

  /**
   * `true` if the tag is `raw_text` or `script_data`, so its text isn't encoded.
   */
  isRawText: boolean;
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
  const { areSelfClosingTagsSupported, encodeText = identity } = options;

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
  const { tagOptionsMap, areTagNamesCaseInsensitive } = options;

  if (tagOptionsMap === undefined) {
    return;
  }

  const tagOptionsList = tagOptionsMap.get(
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

function identity(value: string): string {
  return value;
}
