export function identity(str: string): string {
  return str;
}

const keptInstances: object[] = [];

/**
 * Keeps instances alive while the module is loaded, one per class that token handlers use.
 *
 * A major garbage collection that finds no instance of a class drops its hidden class, which discards optimized
 * `readTokens` code that inlines methods or constructors of the class, so the next few parses are slow. A kept instance
 * keeps the hidden class.
 */
export function keepHiddenClasses(...instances: object[]): void {
  keptInstances.push(...instances);
}

/**
 * Returns the lower case char code of an ASCII letter, and any other char code as is.
 */
export function toLowerCaseCharCode(charCode: number): number {
  // Lower case letters are the most common, and they're above "Z", so the first comparison passes them
  return charCode > /* Z */ 90 || charCode < /* A */ 65 ? charCode : charCode + 32;
}

/**
 * Converts ASCII letters to lower case. Unlike `String.prototype.toLowerCase`, other chars stay as is, since only ASCII
 * letters are case-insensitive in tag names.
 */
export function toASCIILowerCase(str: string): string {
  return str.replace(/[A-Z]+/g, substring => substring.toLowerCase());
}

// ----------------------------------------------------------
// String equality
// ----------------------------------------------------------

// Tag names are compared by four functions, case-sensitive or not, and comparing all chars or skipping the last one for
// names with equal hash codes. Each has its own loop, since a flag or a callback would be checked at every char of a
// hot loop.

/**
 * Returns `true` if two tag names are equal. Names can be in different strings, since an enclosing tag can be started
 * in a previous chunk.
 */
export type TagNameEqualityComparer = (
  input1: string,
  startIndex1: number,
  endIndex1: number,
  input2: string,
  startIndex2: number,
  endIndex2: number
) => boolean;

/**
 * Like {@link TagNameEqualityComparer}, but skips the last chars, so it's correct only for names with equal hash codes.
 * The alias only names this precondition, TypeScript doesn't enforce it.
 *
 * @see {@link areCaseSensitiveHashedSubstringsEqual}
 */
export type HashedTagNameEqualityComparer = TagNameEqualityComparer;

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

/**
 * Returns `true` if two substrings with equal {@link getCaseSensitiveHashCode case-sensitive hash codes} are equal.
 *
 * The last chars aren't compared: a hash code is the hash of the chars before the last one, times 33, plus the last
 * char, modulo 2^30. Char codes are below 2^30, so equal hash codes and equal preceding chars mean equal last chars.
 */
export function areCaseSensitiveHashedSubstringsEqual(
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

  for (let i = startIndex1, j = startIndex2; i < endIndex1 - 1; ++i, ++j) {
    if (str1.charCodeAt(i) !== str2.charCodeAt(j)) {
      return false;
    }
  }

  return true;
}

/**
 * Returns `true` if two substrings with equal {@link getCaseInsensitiveHashCode case-insensitive hash codes} are equal,
 * ignoring the case of ASCII letters. Like {@link areCaseSensitiveHashedSubstringsEqual}, it skips the last chars,
 * which are equal in lower case.
 */
export function areCaseInsensitiveHashedSubstringsEqual(
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

  for (let i = startIndex1, j = startIndex2; i < endIndex1 - 1; ++i, ++j) {
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
 * Returns the hash code of a tag name.
 */
export type TagNameHashFunction = (input: string, startIndex: number, endIndex: number) => number;

/**
 * Returns the case-insensitive djb2 hash code of a substring: start with 5381, then for each char multiply by 33 and
 * add the lower case char code. It's cut to 30 bits, so V8 keeps it as a small integer, which isn't allocated.
 *
 * readTokens hashes start tag names inline with the same formula, keep them in sync.
 */
export function getCaseInsensitiveHashCode(input: string, startIndex: number, endIndex: number): number {
  let hashCode = 5_381;

  for (let i = startIndex; i < endIndex; ++i) {
    hashCode = ((hashCode << 5) + hashCode + toLowerCaseCharCode(input.charCodeAt(i))) | 0;
  }

  return hashCode & 0x3fffffff;
}

/**
 * Returns the case-sensitive djb2 hash code of a substring, see {@link getCaseInsensitiveHashCode}. readTokens hashes
 * start tag names inline with the same formula, keep them in sync.
 */
export function getCaseSensitiveHashCode(input: string, startIndex: number, endIndex: number): number {
  let hashCode = 5_381;

  for (let i = startIndex; i < endIndex; ++i) {
    hashCode = ((hashCode << 5) + hashCode + input.charCodeAt(i)) | 0;
  }

  return hashCode & 0x3fffffff;
}
