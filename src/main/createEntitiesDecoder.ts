import {allCharBy, CharCodeChecker} from './dsl-utils';
import {fromXmlCharName} from './fromXmlCharName';
import {CharCode, FromCharCode, FromCharName, Rewriter} from './parser-utils';

// [0-9]
const isNumberChar: CharCodeChecker = (c) => c > 47 && c < 58;

// [0-9A-Fa-f]
const isHexNumberChar: CharCodeChecker = (c) => isNumberChar(c) || c > 64 && c < 73 || c > 96 && c < 105;

// [0-9A-Za-z]
const isAlphaNumericChar: CharCodeChecker = (c) => isNumberChar(c) || c > 64 && c < 91 || c > 96 && c < 123;

const takeNumber = allCharBy(isNumberChar);

const takeHexNumber = allCharBy(isHexNumberChar);

export interface EntitiesDecoderOptions {

  /**
   * Receives an entity name ("lt", "gt", etc.) and returns a string replacement for it.
   *
   * @default {@link fromXmlCharName}
   * @see createFromHtmlCharName
   */
  fromCharName?: FromCharName;

  /**
   * Receives a numeric code point and should return a string replacement for it.
   *
   * @default String.fromCharCode
   */
  fromCharCode?: FromCharCode;
}

/**
 * Creates a {@link Rewriter} that maps an encoded HTML entity into a corresponding char.
 *
 * @example
 * createEntitiesDecoder()("&#60;") // → "<"
 * createEntitiesDecoder({fromCharName: createFromHtmlCharName()})("&AMP") // → "&"
 */
export function createEntitiesDecoder(options: EntitiesDecoderOptions = {}): Rewriter {
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

      if (str.charCodeAt(++j) === CharCode.NUM) {
        // Numeric character reference
        let base;

        if (str.charCodeAt(++j) === CharCode.X) {
          k = takeHexNumber(str, ++j);
          base = 16;
        } else {
          k = takeNumber(str, j);
          base = 10;
        }
        if (k !== j) {
          char = fromCharCode(parseInt(str.substring(j, k), base));
        }
        if (str.charCodeAt(k) === CharCode.SEMI) {
          k++;
        }
      } else {
        // Named character reference
        k = j;

        while (k < charCount && char == null && isAlphaNumericChar(str.charCodeAt(k))) {
          char = fromCharName(str.substring(j, ++k), false);
        }

        if (str.charCodeAt(k) === CharCode.SEMI) {
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
