import { Node } from 'flyweight-dom';
import type { TagKind } from './createTokenizer.ts';
import { type ResolvedSerializerOptions, serializeMarkup } from './serializeMarkup.ts';
import { getCaseInsensitiveHashCode, getCaseSensitiveHashCode } from './tokenizeMarkup.ts';

/**
 * Options of {@link createSerializer}.
 *
 * @group Serializer
 */
export interface SerializerOptions {
  /**
   * The map from a tag name to options of the tag. Tag options of a parser can be passed here too, so parsers and
   * serializers can share them.
   *
   * @example
   * {
   *   br: { kind: 'void' },
   *   script: { kind: 'raw_text' },
   * }
   */
  tags?: Record<string, TagSerializationOptions>;

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
   * By default, text content and attribute values aren't encoded.
   *
   * @param text The text to encode.
   */
  encodeText?: (text: string) => string;
}

/**
 * Options of a tag that serializers use. {@link TagParsingOptions} have the same {@link kind} option, so tag options
 * of a parser can be passed to a serializer as well.
 *
 * @see {@link SerializerOptions.tags}
 * @group Serializer
 */
export interface TagSerializationOptions {
  /**
   * The kind of the tag:
   *
   * - `'normal'`: children of the tag are written, and its text content is encoded with
   *   {@link SerializerOptions.encodeText}.
   * - `'void'`: the tag is written without an end tag, and its children are ignored.
   * - `'raw_text'`: text content of the tag is written as is, without {@link SerializerOptions.encodeText}.
   * - `'escapable_raw_text'`: same as `'normal'`. This kind is accepted, so parsers and serializers can share tag
   *   options.
   * - `'script_data'`: same as `'raw_text'`.
   *
   * @default 'normal'
   */
  kind?: TagKind;
}

/**
 * Creates a serializer that converts a DOM node to an HTML/XML string.
 *
 * @example
 * import { createSerializer, HTMLDOMParser } from 'tag-soup';
 * import { escapeXML } from 'speedy-entities';
 *
 * const serialize = createSerializer({
 *   tags: { br: { kind: 'void' } },
 *   encodeText: escapeXML,
 * });
 *
 * serialize(HTMLDOMParser.parseFragment('<p>hello<br></p>'));
 * // ⮕ '<p>hello<br></p>'
 *
 * @param options Serializer options.
 * @returns The new serializer.
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
 * @param options Serializer options.
 * @internal
 */
export function resolveSerializerOptions(options: SerializerOptions): ResolvedSerializerOptions {
  const { tags = {}, areTagNamesCaseInsensitive, areSelfClosingTagsSupported, encodeText } = options;

  const getHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const toHashCode = (str: string) => getHashCode(str, 0, str.length);

  const voidTagSet = new Set<number>();
  const rawTextTagSet = new Set<number>();

  for (const [tagName, tagOptions] of Object.entries(tags)) {
    if (tagOptions.kind === 'void') {
      voidTagSet.add(toHashCode(tagName));
    } else if (tagOptions.kind === 'raw_text' || tagOptions.kind === 'script_data') {
      rawTextTagSet.add(toHashCode(tagName));
    }
  }

  return {
    toHashCode,
    // Tag names aren't hashed if there are no tags to look up
    voidTagSet: voidTagSet.size !== 0 ? voidTagSet : undefined,
    rawTextTagSet: rawTextTagSet.size !== 0 ? rawTextTagSet : undefined,
    areSelfClosingTagsSupported,
    encodeText,
  };
}
