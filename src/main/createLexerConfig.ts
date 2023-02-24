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
    rootTag: -1,
    voidTags,
    cdataTags,
    implicitStartTags: toHashCodeSet(options.implicitStartTags, getHashCode),
    implicitEndTagMap: toImplicitEndTagMap(options.implicitEndTags, getHashCode),
    foreignTagConfigMap: null,
    selfClosingTagsEnabled: Boolean(options.selfClosingTagsEnabled),
    getHashCode,
  };

  const foreignTagConfigMap = toForeignTagConfigMap(options.foreignTags, getHashCode, config);

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

function toImplicitEndTagMap(
  implicitEndTags: LexerOptions['implicitEndTags'],
  getHashCode: GetHashCode
): LexerConfig['implicitEndTagMap'] {
  if (!implicitEndTags) {
    return null;
  }
  const implicitEndTagMap = new Map<number, Set<number>>();

  for (const tagName in implicitEndTags) {
    const hashCodes = toHashCodeSet(implicitEndTags[tagName], getHashCode);

    if (hashCodes !== null) {
      implicitEndTagMap.set(getHashCode(tagName, 0, tagName.length), hashCodes);
    }
  }
  if (implicitEndTagMap.size === 0) {
    return null;
  }
  return implicitEndTagMap;
}

function toForeignTagConfigMap(
  foreignTags: LexerOptions['foreignTags'],
  getHashCode: GetHashCode,
  parentConfig: LexerConfig
): LexerConfig['foreignTagConfigMap'] {
  if (!foreignTags) {
    return null;
  }
  const foreignTagConfigMap = new Map<number, LexerConfig>();

  for (const tagName in foreignTags) {
    const foreignConfig = createLexerConfig(foreignTags[tagName], parentConfig);

    foreignConfig.rootTag = foreignConfig.getHashCode(tagName, 0, tagName.length);

    foreignTagConfigMap.set(getHashCode(tagName, 0, tagName.length), foreignConfig);
  }
  if (foreignTagConfigMap.size === 0) {
    return null;
  }
  return foreignTagConfigMap;
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
