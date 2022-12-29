import { GetHashCode, LexerConfig, LexerOptions } from './lexer-types';

/**
 * @internal
 * Converts user-provided lexer options to a normalized configuration object.
 */
export function createLexerConfig(options: LexerOptions, parentConfig: LexerConfig | null): LexerConfig {
  const getHashCode = options.caseInsensitiveTagsEnabled ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const voidTags = toHashCodeSet(options.voidTags, getHashCode);
  const cdataTags = exclude(toHashCodeSet(options.cdataTags, getHashCode), voidTags);

  const config: LexerConfig = {
    parentConfig,
    voidTags,
    cdataTags,
    implicitStartTags: toHashCodeSet(options.implicitStartTags, getHashCode),
    implicitEndTagMap: toHashCodeMapOfHashCodeSet(options.implicitEndTags, getHashCode),
    foreignTagConfigMap: null,
    selfClosingTagsEnabled: Boolean(options.selfClosingTagsEnabled),
    getHashCode,
  };

  const foreignTagConfigMap = toHashCodeMapOfLexerConfig(options.foreignTags, getHashCode, config);

  config.foreignTagConfigMap = exclude(exclude(foreignTagConfigMap, voidTags), cdataTags);

  return config;
}

function exclude<T extends Set<number> | Map<number, unknown>>(source: T | null, subset: Set<number> | null): T | null {
  if (!source || !subset) {
    return source;
  }
  subset.forEach(value => {
    source.delete(value);
  });
  if (source.size === 0) {
    return null;
  }
  return source;
}

function toHashCodeSet(values: string[] | undefined, getHashCode: GetHashCode): Set<number> | null {
  if (!values) {
    return null;
  }
  const hashCodes = new Set<number>();

  for (const value of values) {
    // The defencive check of input options
    // noinspection SuspiciousTypeOfGuard
    if (typeof value === 'string') {
      hashCodes.add(getHashCode(value, 0, value.length));
    }
  }
  if (hashCodes.size === 0) {
    return null;
  }
  return hashCodes;
}

function toHashCodeMapOfHashCodeSet(
  values: Record<string, string[]> | undefined,
  getHashCode: GetHashCode
): Map<number, Set<number>> | null {
  if (!values) {
    return null;
  }
  const map = new Map<number, Set<number>>();

  for (const key in values) {
    const hashCodes = toHashCodeSet(values[key], getHashCode);

    if (hashCodes) {
      map.set(getHashCode(key, 0, key.length), hashCodes);
    }
  }
  if (map.size === 0) {
    return null;
  }
  return map;
}

function toHashCodeMapOfLexerConfig(
  values: Record<string, LexerOptions> | undefined,
  getHashCode: GetHashCode,
  parentConfig: LexerConfig
): Map<number, LexerConfig> | null {
  if (!values) {
    return null;
  }
  const map = new Map<number, LexerConfig>();

  for (const key in values) {
    map.set(getHashCode(key, 0, key.length), createLexerConfig(values[key], parentConfig));
  }
  if (map.size === 0) {
    return null;
  }
  return map;
}

export const getCaseInsensitiveHashCode: GetHashCode = (input, offset, length) => {
  let hashCode = 0;
  for (let i = 0; i < length; ++i) {
    const charCode = input.charCodeAt(offset + i);
    hashCode = (hashCode << 5) - hashCode + (charCode < 65 || charCode > 90 ? charCode : charCode + 32);
  }
  return hashCode | 0;
};

export const getCaseSensitiveHashCode: GetHashCode = (input, offset, length) => {
  let hashCode = 0;
  for (let i = 0; i < length; ++i) {
    hashCode = (hashCode << 5) - hashCode + input.charCodeAt(offset + i);
  }
  return hashCode | 0;
};
