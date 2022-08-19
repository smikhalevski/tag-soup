import { LexerConfig, LexerOptions } from './lexer-types';
import { getCaseInsensitiveHashCode, getCaseSensitiveHashCode } from './utils';

export function createLexerConfig(options?: LexerOptions): LexerConfig {

  const getHashCode = !options || !options.caseInsensitiveTagsEnabled ? getCaseSensitiveHashCode : getCaseInsensitiveHashCode;

  const voidTags = toHashCodeSet(options?.voidTags, getHashCode);

  const cdataTags = toHashCodeSet(options?.cdataTags, getHashCode);
  const implicitStartTags = toHashCodeSet(options?.implicitStartTags, getHashCode);
  const implicitEndTagMap = toHashCodeMap(options?.implicitEndTagMap, getHashCode);
  const selfClosingTagsEnabled = options?.selfClosingTagsEnabled || false;

  return {
    voidTags,
    cdataTags,
    implicitStartTags,
    implicitEndTagMap,
    foreignTagConfigMap: new Map(),
    selfClosingTagsEnabled,
    endTagCdataModeEnabled: false,
    getHashCode,
  };
}

export function toHashCodeSet(values: string[], getHashCode: typeof getCaseInsensitiveHashCode): Set<number>;
export function toHashCodeSet(values: string[] | undefined, getHashCode: typeof getCaseInsensitiveHashCode): Set<number> | null;
export function toHashCodeSet(values: string[] | undefined, getHashCode: typeof getCaseInsensitiveHashCode): Set<number> | null {
  if (!values) {
    return null;
  }
  return new Set(values.map((value) => getHashCode(value, 0, value.length)));
}

export function toHashCodeMap(values: Record<string, string[]> | undefined, getHashCode: typeof getCaseInsensitiveHashCode): Map<number, Set<number>> | null {
  if (!values) {
    return null;
  }
  const map = new Map<number, Set<number>>();

  for (const [key, value] of Object.entries(values)) {
    if (value.length !== 0) {
      map.set(getHashCode(key, 0, key.length), toHashCodeSet(value, getHashCode));
    }
  }
  return map;
}