import type { SerializerOptions, TagKind } from './types.ts';
import { getCaseInsensitiveHashCode, getCaseSensitiveHashCode, identity } from './utils.ts';

export interface SerializerConfig {
  /**
   * The map from a hash code of a tag name to configs of tags with this hash code. Different names can have equal
   * hash codes, so tags with the same hash code share an array, and their names are compared. Tags that are written
   * the same way as tags that options don't mention aren't in the map.
   */
  tagConfigsMap: Map<number, TagSerializationConfig[]> | undefined;

  /**
   * If `true` then tag names are hashed with {@link getCaseInsensitiveHashCode} and compared with
   * {@link areCaseInsensitiveStringsEqual}, otherwise with {@link getCaseSensitiveHashCode} and compared as is.
   */
  areTagNamesCaseInsensitive: boolean;

  /**
   * @see {@link SerializerOptions.areSelfClosingTagsSupported}
   */
  areSelfClosingTagsSupported: boolean;

  /**
   * @see {@link SerializerOptions.encodeText}
   */
  encodeText: (text: string) => string;

  /**
   * @see {@link SerializerOptions.encodeAttribute}
   */
  encodeAttribute: (value: string) => string;
}

export interface TagSerializationConfig {
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
 * Converts serializer options into the config consumed by a serializer.
 */
export function resolveSerializerOptions(options: SerializerOptions): SerializerConfig {
  const {
    tags = {},
    areTagNamesCaseInsensitive = false,
    areSelfClosingTagsSupported = false,
    encodeText = identity,
    encodeAttribute = identity,
  } = options;

  const getTagHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const tagConfigsMap = new Map<number, TagSerializationConfig[]>();

  for (const [tagName, tagOptions] of Object.entries(tags)) {
    const { kind = 'normal' } = tagOptions;

    // Tags of these kinds are written the same way as tags that options don't mention
    if (kind === 'normal' || kind === 'escapable_raw_text') {
      continue;
    }

    const tagConfig = {
      tagName,
      kind,
      isRawText: kind === 'raw_text' || kind === 'script_data',
    };

    const tagHashCode = getTagHashCode(tagName, 0, tagName.length);

    const tagConfigs = tagConfigsMap.get(tagHashCode);

    if (tagConfigs !== undefined) {
      tagConfigs.push(tagConfig);
    } else {
      tagConfigsMap.set(tagHashCode, [tagConfig]);
    }
  }

  return {
    // Tag names aren't hashed if there are no tags to look up
    tagConfigsMap: tagConfigsMap.size !== 0 ? tagConfigsMap : undefined,
    areTagNamesCaseInsensitive,
    areSelfClosingTagsSupported,
    encodeText,
    encodeAttribute,
  };
}
