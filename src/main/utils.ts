export function identity(str: string): string {
  return str;
}

const retainedInstances: object[] = [];

/**
 * Keeps instances alive while the module is loaded, one per class that parsers use.
 *
 * A major garbage collection that finds no instance of a class drops its hidden class, which discards optimized code
 * that inlines methods or constructors of the class, so the next few parses are slow. A kept instance keeps the hidden
 * class.
 */
export function retainHiddenClasses(...instances: object[]): void {
  retainedInstances.push(...instances);
}

/**
 * Adds an attribute to a record. Assigning `__proto__` would set the prototype of the record rather than add an
 * attribute, so this name is defined as an own property instead.
 */
export function assignAttribute(attributes: Record<string, string>, name: string, value: string): void {
  if (name === '__proto__') {
    Object.defineProperty(attributes, name, { value, writable: true, enumerable: true, configurable: true });
  } else {
    attributes[name] = value;
  }
}

/**
 * Returns the lower case char code of an ASCII letter, and any other char code as is.
 */
export function toLowerCaseCharCode(charCode: number): number {
  // Lower case letters are the most common, and they're above "Z", so the first comparison passes them
  return charCode > /* Z */ 90 || charCode < /* A */ 65 ? charCode : charCode + 32;
}

const asciiChars: string[] = [];

for (let charCode = /* a */ 97; charCode <= /* z */ 122; ++charCode) {
  asciiChars.push(String.fromCharCode(charCode));
}

/**
 * Returns a string with ASCII letters in lower case, and other chars as is.
 */
export function toLowerCase(str: string): string {
  let lowerCaseStr = '';
  let startIndex = 0;

  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);

    if (charCode >= /* A */ 65 && charCode <= /* Z */ 90) {
      lowerCaseStr += str.slice(startIndex, i) + asciiChars[charCode - /* A */ 65];
      startIndex = i + 1;
    }
  }

  return startIndex === 0 ? str : lowerCaseStr + str.slice(startIndex);
}

// ----------------------------------------------------------
// String hash code
// ----------------------------------------------------------

/**
 * Returns the ASCII case-insensitive djb2 hash code of a substring.
 */
export function getCaseInsensitiveHashCode(str: string, startIndex: number, endIndex: number): number {
  let hashCode = 5_381;

  for (let i = startIndex; i < endIndex; ++i) {
    hashCode = ((hashCode << 5) + hashCode + toLowerCaseCharCode(str.charCodeAt(i))) | 0;
  }

  return hashCode & 0x3fffffff;
}

/**
 * Returns the case-sensitive djb2 hash code of a substring.
 */
export function getCaseSensitiveHashCode(str: string, startIndex: number, endIndex: number): number {
  let hashCode = 5_381;

  for (let i = startIndex; i < endIndex; ++i) {
    hashCode = ((hashCode << 5) + hashCode + str.charCodeAt(i)) | 0;
  }

  return hashCode & 0x3fffffff;
}
