import { Node } from 'flyweight-dom';
import { type ResolvedSerializerOptions, serializeMarkup } from './serializeMarkup.ts';
import { getCaseInsensitiveHashCode, getCaseSensitiveHashCode } from './tokenizeMarkup.ts';

/**
 * Options of {@link createSerializer}.
 *
 * @group Serializer
 */
export interface SerializerOptions {
  /**
   * The list of tags that can't have content. Void tags are written without an end tag, and their children are ignored.
   *
   * @example
   * ['link', 'meta']
   * @see [HTML5 Void Elements](https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#void-elements)
   */
  voidTags?: string[];

  /**
   * The list of tags whose text content is written as is, without {@link encodeText}.
   *
   * @example
   * ['script', 'style']
   * @see [HTML5 Raw Text Elements](https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#raw-text-elements)
   */
  rawTextTags?: string[];

  /**
   * If `true` then ASCII alpha characters are case-insensitive in tag names.
   *
   * @default false
   */
  areTagNamesCaseInsensitive?: boolean;

  /**
   * If `true` then elements without children are written as self-closing tags (`<a/>`), otherwise as a start tag
   * followed by an end tag (`<a></a>`). Void tags are always written without an end tag.
   *
   * @default false
   */
  areSelfClosingTagsSupported?: boolean;

  /**
   * Encodes text content and attribute values. Use this method to encode HTML/XML entities. Comments, CDATA sections
   * and processing instructions are written as is.
   *
   * @param text Text to encode.
   * @default No encoding
   */
  encodeText?: (text: string) => string;
}

/**
 * Creates a serializer that converts a DOM node to an HTML/XML string.
 *
 * @example
 * import { createSerializer, HTMLDOMParser } from 'tag-soup';
 * import { escapeXML } from 'speedy-entities';
 *
 * const serialize = createSerializer({
 *   voidTags: ['br'],
 *   encodeText: escapeXML,
 * });
 *
 * serialize(HTMLDOMParser.parseFragment('<p>hello<br></p>'));
 * // ⮕ '<p>hello<br></p>'
 *
 * @param options Serialization options.
 * @returns The serializer function.
 * @see {@link toHTML}
 * @see {@link toXML}
 * @group Serializer
 */
export function createSerializer(options: SerializerOptions = {}): (node: Node) => string {
  const resolvedOptions = resolveSerializerOptions(options);

  return node => serializeMarkup(node, resolvedOptions);
}

/**
 * Converts human-readable serializer options into options consumed by {@link serializeMarkup}.
 *
 * @param options Serialization options.
 * @internal
 */
export function resolveSerializerOptions(options: SerializerOptions): ResolvedSerializerOptions {
  const { voidTags, rawTextTags, areTagNamesCaseInsensitive, areSelfClosingTagsSupported, encodeText } = options;

  const getHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const toHashCode = (str: string) => getHashCode(str, 0, str.length);

  return {
    toHashCode,
    voidTagSet: voidTags !== undefined ? new Set(voidTags.map(toHashCode)) : undefined,
    rawTextTagSet: rawTextTags !== undefined ? new Set(rawTextTags.map(toHashCode)) : undefined,
    areSelfClosingTagsSupported,
    encodeText,
  };
}
