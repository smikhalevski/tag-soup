import { Node } from 'flyweight-dom';
import { getCaseInsensitiveHashCode, getCaseSensitiveHashCode } from './tokenizeMarkup.js';
import { type ResolvedSerializerOptions, serializeMarkup } from './serializeMarkup.js';

/**
 * Options of {@link createSerializer}.
 *
 * @group Serializer
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
   * The list of tags which text content is written as is, without {@link encodeText}.
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
   * Encodes text content. Use this method to encode HTML/XML entities.
   *
   * @param text Text to encode.
   */
  encodeText?: (text: string) => string;
}

/**
 * Serializes DOM node as HTML/XML string.
 *
 * @param options Serialization options.
 * @see {@link toHTML}
 * @see {@link toXML}
 * @group Serializer
 */
export function createSerializer(options: SerializerOptions = {}): (node: Node) => string {
  const resolvedOptions = resolveSerializerOptions(options);

  return node => serializeMarkup(node, resolvedOptions);
}

export function resolveSerializerOptions(options: SerializerOptions): ResolvedSerializerOptions {
  const { voidTags, rawTextTags, areTagNamesCaseInsensitive, areSelfClosingTagsSupported, encodeText } = options;

  const getHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const toHashCode = (str: string) => getHashCode(str, 0, str.length);

  return {
    toHashCode,
    voidTags: voidTags && new Set(voidTags.map(toHashCode)),
    rawTextTags: rawTextTags && new Set(rawTextTags.map(toHashCode)),
    areSelfClosingTagsSupported,
    encodeText,
  };
}
