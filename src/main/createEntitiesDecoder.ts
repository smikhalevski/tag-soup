import {allCharBy, CharCodeChecker} from 'tokenizer-dsl';
import {CharCode, FromCharCode, FromCharName, fromXmlCharName, Rewriter} from './parser-utils';

// [0-9]
const isNumberChar: CharCodeChecker = (c) => c >= CharCode['+0'] && c <= CharCode['+9'];

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

export interface IEntitiesDecoderOptions {

  /**
   * Receives an entity name ("lt", "gt", etc.) and returns a string replacement for it.
   *
   * @see {@link createFromHtmlCharName}
   */
  fromCharName?: FromCharName;

  /**
   * Receives a numeric code point and should return a string replacement for it.
   *
   * @default String.fromCharCode
   * @see {@link createFromCharCode}
   */
  fromCharCode?: FromCharCode;
}

/**
 * Creates a rewriter that maps an encoded HTML entities in given string into corresponding chars.
 */
export function createEntitiesDecoder(options: IEntitiesDecoderOptions = {}): Rewriter {
  const {
    fromCharName = fromXmlCharName,
    fromCharCode = String.fromCharCode,
  } = options;

  return (str) => {
    const charCount = str.length;

    let i = 0;

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
        let base;

        if (str.charCodeAt(++j) === CharCode['x']) {
          k = takeHexNumber(str, ++j);
          base = 16;
        } else {
          k = takeNumber(str, j);
          base = 10;
        }
        if (k !== j) {
          char = fromCharCode(parseInt(str.substring(j, k), base));
        }
        if (str.charCodeAt(k) === CharCode[';']) {
          k++;
        }
      } else {
        // Named character reference
        k = j;

        while (k < charCount && char == null && isAlphaNumericChar(str.charCodeAt(k))) {
          char = fromCharName(str.substring(j, ++k), false);
        }

        if (str.charCodeAt(k) === CharCode[';']) {
          if (k !== j && char == null) {
            char = fromCharName(str.substring(j, k), true);
          }
          k++;
        }
      }

      if (char == null) {
        i = k;
      } else {
        str = str.substr(0, i) + char + str.substr(k);
        i += char.length;
      }
    }

    return str;
  }
}
