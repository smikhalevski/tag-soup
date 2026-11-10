export function identity(str: string): string {
  return str;
}

/**
 * Throws an error if a condition isn't met.
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Returns char code of a lower case ASCII char.
 */
export function toLowerCaseCharCode(charCode: number): number {
  // Lower-case letters are the most common, and they're above "Z"
  return charCode > /* Z */ 90 || charCode < /* A */ 65 ? charCode : charCode + 32;
}

/**
 * Returns a string with ASCII letters in lower case. Unlike `String.prototype.toLowerCase`, other chars are returned as
 * is, since only ASCII letters are case-insensitive in tag names.
 */
export function toASCIILowerCase(str: string): string {
  return str.replace(/[A-Z]+/g, substring => substring.toLowerCase());
}

// ----------------------------------------------------------
// String equality
// ----------------------------------------------------------

/**
 * Returns `true` if two strings are equal, ignoring the case of ASCII letters.
 */
export function areCaseInsensitiveStringsEqual(str1: string, str2: string): boolean {
  if (str1.length !== str2.length) {
    return false;
  }

  for (let i = 0; i < str1.length; ++i) {
    const charCode1 = str1.charCodeAt(i);
    const charCode2 = str2.charCodeAt(i);

    if (charCode1 !== charCode2 && toLowerCaseCharCode(charCode1) !== toLowerCaseCharCode(charCode2)) {
      return false;
    }
  }

  return true;
}

/**
 * Returns `true` if two substrings are equal.
 */
export function areCaseSensitiveSubstringsEqual(
  str1: string,
  startIndex1: number,
  endIndex1: number,
  str2: string,
  startIndex2: number,
  endIndex2: number
): boolean {
  if (endIndex1 - startIndex1 !== endIndex2 - startIndex2) {
    return false;
  }

  for (let i = startIndex1, j = startIndex2; i < endIndex1; ++i, ++j) {
    if (str1.charCodeAt(i) !== str2.charCodeAt(j)) {
      return false;
    }
  }

  return true;
}

/**
 * Returns `true` if two substrings are equal, ignoring the case of ASCII letters.
 */
export function areCaseInsensitiveSubstringsEqual(
  str1: string,
  startIndex1: number,
  endIndex1: number,
  str2: string,
  startIndex2: number,
  endIndex2: number
): boolean {
  if (endIndex1 - startIndex1 !== endIndex2 - startIndex2) {
    return false;
  }

  for (let i = startIndex1, j = startIndex2; i < endIndex1; ++i, ++j) {
    const charCode1 = str1.charCodeAt(i);
    const charCode2 = str2.charCodeAt(j);

    if (charCode1 !== charCode2 && toLowerCaseCharCode(charCode1) !== toLowerCaseCharCode(charCode2)) {
      return false;
    }
  }

  return true;
}

// ----------------------------------------------------------
// String hash code
// ----------------------------------------------------------

/**
 * Returns case-insensitive djb2 hash of a substring. The hash is computed in 32 bits and truncated to 30 bits, so V8
 * stores it as a small integer, which isn't allocated and is faster to look up in a Set or a Map.
 */
export function getCaseInsensitiveHashCode(input: string, startIndex: number, endIndex: number): number {
  let hashCode = 5_381;

  for (let i = startIndex; i < endIndex; ++i) {
    hashCode = ((hashCode << 5) + hashCode + toLowerCaseCharCode(input.charCodeAt(i))) | 0;
  }

  return hashCode & 0x3fffffff;
}

/**
 * Returns case-sensitive djb2 hash of a substring. The hash is computed in 32 bits and truncated to 30 bits, so V8
 * stores it as a small integer, which isn't allocated and is faster to look up in a Set or a Map.
 */
export function getCaseSensitiveHashCode(input: string, startIndex: number, endIndex: number): number {
  let hashCode = 5_381;

  for (let i = startIndex; i < endIndex; ++i) {
    hashCode = ((hashCode << 5) + hashCode + input.charCodeAt(i)) | 0;
  }

  return hashCode & 0x3fffffff;
}
