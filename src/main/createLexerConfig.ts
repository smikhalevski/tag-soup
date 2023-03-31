import { GetHashCode, LexerConfig, LexerOptions } from './lexer-types';

/**
 * Converts user-provided lexer options to a normalized configuration object.
 */
export function createLexerConfig(
  options: LexerOptions,
  getHashCode: GetHashCode,
  parentConfig: LexerConfig | null
): LexerConfig {
  const voidTags = toHashCodeSet(options.voidTags, getHashCode);
  const cdataTags = exclude(toHashCodeSet(options.cdataTags, getHashCode), voidTags);

  const config: LexerConfig = {
    parentConfig,
    rootTag: 0,
    voidTags,
    cdataTags,
    implicitStartTags: toHashCodeSet(options.implicitStartTags, getHashCode),
    implicitEndTagMap: toImplicitEndTagMap(options.implicitEndTags, getHashCode),
    foreignTagMap: null,
    selfClosingTagsEnabled: Boolean(options.selfClosingTagsEnabled),
  };

  config.foreignTagMap = exclude(
    exclude(toForeignTagMap(options.foreignTags, getHashCode, config), voidTags),
    cdataTags
  );

  return config;
}

function exclude<T extends Set<number> | Map<number, unknown>>(source: T | null, subset: Set<number> | null): T | null {
  if (source && subset) {
    subset.forEach(value => {
      source.delete(value);
    });
    if (source.size === 0) {
      return null;
    }
  }
  return source;
}

function toHashCodeSet(values: string[] | undefined, getHashCode: GetHashCode): Set<number> | null {
  let hashCodes: Set<number> | null = null;

  if (values) {
    for (const value of values) {
      (hashCodes ||= new Set()).add(getHashCode(value, 0, value.length));
    }
  }
  return hashCodes;
}

function toImplicitEndTagMap(
  implicitEndTags: LexerOptions['implicitEndTags'],
  getHashCode: GetHashCode
): LexerConfig['implicitEndTagMap'] {
  let implicitEndTagMap = null;

  if (implicitEndTags) {
    for (const tagName in implicitEndTags) {
      const hashCodes = toHashCodeSet(implicitEndTags[tagName], getHashCode);

      if (hashCodes !== null) {
        (implicitEndTagMap ||= new Map()).set(getHashCode(tagName, 0, tagName.length), hashCodes);
      }
    }
  }
  return implicitEndTagMap;
}

function toForeignTagMap(
  foreignTags: LexerOptions['foreignTags'],
  getHashCode: GetHashCode,
  parentConfig: LexerConfig
): LexerConfig['foreignTagMap'] {
  let foreignTagMap = null;

  if (foreignTags) {
    for (const tagName in foreignTags) {
      const foreignConfig = createLexerConfig(foreignTags[tagName], getHashCode, parentConfig);

      foreignConfig.rootTag = getHashCode(tagName, 0, tagName.length);

      (foreignTagMap ||= new Map()).set(getHashCode(tagName, 0, tagName.length), foreignConfig);
    }
  }
  return foreignTagMap;
}

export const getCaseInsensitiveHashCode: GetHashCode = (input, offset, length) => {
  let hashCode = 0;
  for (let i = 0; i < length; ++i) {
    const charCode = input.charCodeAt(offset + i);
    hashCode = (hashCode << 5) - hashCode + (charCode < 65 || charCode > 90 ? charCode : charCode + 32);
  }
  return hashCode >>> 0;
};

export const getCaseSensitiveHashCode: GetHashCode = (input, offset, length) => {
  let hashCode = 0;
  for (let i = 0; i < length; ++i) {
    hashCode = (hashCode << 5) - hashCode + input.charCodeAt(offset + i);
  }
  return hashCode >>> 0;
};
