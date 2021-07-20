import {allCharBy, CharCodeChecker} from 'tokenizer-dsl';
import {CharCode} from './CharCode';

/**
 * Returns the string that corresponds to the entity with the given name.
 *
 * @param name The name of the entity to decode.
 * @param terminated `true` if an entity was terminated with a semicolon.
 */
export type FromEntityName = (name: string, terminated: boolean) => string | null | undefined;

// [0-9]
const isNumberChar: CharCodeChecker = (c) => c >= 48 && c <= 57;

// [0-9A-Fa-f]
const isHexNumberChar: CharCodeChecker = (c) =>
    isNumberChar(c)
    || c >= CharCode['a'] && c <= CharCode['f']
    || c >= CharCode['A'] && c <= CharCode['F'];

// [0-9A-Za-z]
const isAlphaNumericChar: CharCodeChecker = (c) =>
    isNumberChar(c)
    || c >= CharCode['a'] && c <= CharCode['z']
    || c >= CharCode['A'] && c <= CharCode['Z'];

const takeNumber = allCharBy(isNumberChar);

const takeHexNumber = allCharBy(isHexNumberChar);

/**
 * Creates an HTML/XML entity decoder.
 */
export function createDecoder(fromEntityName: FromEntityName, fromCharCode = String.fromCharCode): (str: string) => string {

  return (str) => {
    let result = '';

    let x = 0;
    let i = 0;

    const charCount = str.length;

    while (i < charCount) {

      let j = str.indexOf('&', i);
      if (j === -1) {
        break;
      }

      i = j;

      let char;
      let k;

      if (str.charCodeAt(++j) === CharCode['#']) {
        // Numeric character reference
        let radix;

        if (str.charCodeAt(++j) === CharCode['x']) {
          k = takeHexNumber(str, ++j);
          radix = 16;
        } else {
          k = takeNumber(str, j);
          radix = 10;
        }
        if (k !== j) {
          char = fromCharCode(parseInt(str.substring(j, k), radix));
        }
        if (str.charCodeAt(k) === CharCode[';']) {
          k++;
        }
      } else {
        // Named character reference
        k = j;

        let name;
        while (k < charCount && char == null && isAlphaNumericChar(str.charCodeAt(k))) {
          name = str.substring(j, ++k);
          char = fromEntityName(name, false);
        }

        if (str.charCodeAt(k) === CharCode[';']) {
          if (char == null && name != null) {
            char = fromEntityName(name, true);
          }
          k++;
        }
      }

      if (char != null) {
        result += str.substring(x, i) + char;
        x = k;
      }
      i = k;
    }
    if (x === 0) {
      return str;
    }
    if (x !== charCount) {
      result += str.substr(x);
    }
    return result;
  };
}
