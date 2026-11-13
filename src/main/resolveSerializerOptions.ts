import type { SerializerOptions, TagKind } from './types.ts';
import { getCaseInsensitiveHashCode, getCaseSensitiveHashCode, identity } from './utils.ts';

/**
 * Resolved serializer options.
 */
export interface SerializerConfig {
  /**
   * Tag configs by the hash code of the tag name, in arrays since names can share a hash code. Only `void`, `raw_text`
   * and `script_data` tags are here, since other tags are written like tags that options don't mention. `undefined` if
   * there are no such tags.
   */
  tagConfigsMap: Map<number, TagSerializationConfig[]> | undefined;

  /**
   * If `true` then tag names are hashed and compared ignoring the case of ASCII letters.
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

/**
 * Resolved serialization options of a tag.
 */
export interface TagSerializationConfig {
  /**
   * The tag name, compared with names of elements that have the same hash code.
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
 * Converts serializer options into a serializer config.
 */
export function resolveSerializerOptions(options: SerializerOptions): SerializerConfig {
  const {
    tags = {},
    areTagNamesCaseInsensitive = false,
    areSelfClosingTagsSupported = false,
    encodeText = identity,
    encodeAttribute = identity,
  } = options;

  const getSubstringHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const tagConfigsMap = new Map<number, TagSerializationConfig[]>();

  for (const [tagName, tagOptions] of Object.entries(tags)) {
    const { kind = 'normal' } = tagOptions;

    // Written like tags that options don't mention
    if (kind === 'normal' || kind === 'escapable_raw_text') {
      continue;
    }

    const tagConfig = {
      tagName,
      kind,
      isRawText: kind === 'raw_text' || kind === 'script_data',
    };

    const tagHashCode = getSubstringHashCode(tagName, 0, tagName.length);

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
