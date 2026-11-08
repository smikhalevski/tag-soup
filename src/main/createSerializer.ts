import { Node } from 'flyweight-dom';
import {
  type ResolvedSerializerOptions,
  type ResolvedTagSerializationOptions,
  serializeMarkup,
} from './serializeMarkup.ts';
import { getCaseInsensitiveHashCode, getCaseSensitiveHashCode, type TagKind } from './tokenizeMarkup.ts';

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
   * The kind of the tag.
   *
   * @see {@link TagKind}
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

  const getTagHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const tagOptionsMap = new Map<number, ResolvedTagSerializationOptions[]>();

  for (const [tagName, tagOptions] of Object.entries(tags)) {
    const { kind = 'normal' } = tagOptions;

    // Tags of these kinds are written the same way as tags that options don't mention
    if (kind === 'normal' || kind === 'escapable_raw_text') {
      continue;
    }

    const resolvedTagOptions = {
      tagName,
      kind,
      isRawText: kind === 'raw_text' || kind === 'script_data',
    };

    const tagHashCode = getTagHashCode(tagName, 0, tagName.length);

    const tagOptionsList = tagOptionsMap.get(tagHashCode);

    if (tagOptionsList !== undefined) {
      tagOptionsList.push(resolvedTagOptions);
    } else {
      tagOptionsMap.set(tagHashCode, [resolvedTagOptions]);
    }
  }

  return {
    areTagNamesCaseInsensitive,
    // Tag names aren't hashed if there are no tags to look up
    tagOptionsMap: tagOptionsMap.size !== 0 ? tagOptionsMap : undefined,
    areSelfClosingTagsSupported,
    encodeText,
  };
}
