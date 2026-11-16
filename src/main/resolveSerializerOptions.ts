import type { SerializerOptions } from './types.ts';
import { identity, toLowerCase } from './utils.ts';

/**
 * Resolved serializer options.
 */
export interface SerializerConfig {
  /**
   * Names of `void` tags, in lower case if {@link areTagNamesCaseInsensitive tag names are case-insensitive}.
   */
  voidTagNameSet: Set<string>;

  /**
   * Names of `raw_text` and `script_data` tags, whose text isn't encoded, in lower case if
   * {@link areTagNamesCaseInsensitive tag names are case-insensitive}.
   */
  rawTextTagNameSet: Set<string>;

  /**
   * If `true` then tag names are compared ignoring the case of ASCII letters.
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

  const voidTagNameSet = new Set<string>();
  const rawTextTagNameSet = new Set<string>();

  for (const [tagName, tagOptions] of Object.entries(tags)) {
    const { kind = 'normal' } = tagOptions;

    // Other tags are written like tags that options don't mention
    if (kind !== 'void' && kind !== 'raw_text' && kind !== 'script_data') {
      continue;
    }

    const name = areTagNamesCaseInsensitive ? toLowerCase(tagName) : tagName;

    // Of the names that differ only in case, the first void or raw text one defines the tag
    if (voidTagNameSet.has(name) || rawTextTagNameSet.has(name)) {
      continue;
    }

    if (kind === 'void') {
      voidTagNameSet.add(name);
    } else {
      rawTextTagNameSet.add(name);
    }
  }

  return {
    voidTagNameSet,
    rawTextTagNameSet,
    areTagNamesCaseInsensitive,
    areSelfClosingTagsSupported,
    encodeText,
    encodeAttribute,
  };
}
