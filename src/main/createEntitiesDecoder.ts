import {allCharBy, CharCodeChecker} from 'tokenizer-dsl';
import {CharCode} from './CharCode';
import {FromCharCode, FromCharName} from './decoder-types';

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
 * Creates a rewriter that maps an encoded HTML entities in given string into corresponding chars.
 */
export function createEntitiesDecoder(fromCharName: FromCharName = fromXmlCharName, fromCharCode: FromCharCode = String.fromCharCode): (str: string) => string {

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
          char = fromCharName(name, false);
        }

        if (str.charCodeAt(k) === CharCode[';']) {
          if (char == null && name != null) {
            char = fromCharName(name, true);
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

const fromXmlCharName: FromCharName = (name, terminated) => terminated ? xmlEntities[name] : undefined;

const xmlEntities: Record<string, string> = {
  amp: '&',
  gt: '>',
  lt: '<',
  quot: '"',
  apos: '\'',
};
