import {FromCharCode, purify} from './parser-utils';

export interface FromCharCodeOptions {

  /**
   * If set to `true` then an error is thrown if decoder meets a disallowed character reference.
   *
   * **Note:** Using this option may slow decoding because additional checks are involved.
   *
   * @default false
   */
  strict?: boolean;

  /**
   * This char is returned for disallowed character references in non-strict mode.
   *
   * @default "\ufffd"
   */
  replacementChar?: string;
}

/**
 * Creates decoder for numeric-encoded XML entities.
 *
 * @see createEntitiesDecoder
 */
export function createFromCharCode(options: FromCharCodeOptions = {}): FromCharCode {
  const {
    strict = false,
    replacementChar = '\ufffd',
  } = options;

  return (codePoint) => {
    if (codePoint >= 0xd800 && codePoint <= 0xdfff || codePoint > 0x10ffff) {
      if (strict) {
        throw new Error('Character reference outside the permissible Unicode range');
      }
      return replacementChar;
    }
    if (codePoint in replacementCodePoints) {
      if (strict) {
        throw new Error('Disallowed character reference');
      }
      return replacementCodePoints[codePoint];
    }
    if (strict && errorCodePoints.includes(codePoint)) {
      throw new Error('Disallowed character reference');
    }
    if (codePoint > 0xffff) {
      codePoint -= 0x10000;
      return String.fromCharCode(codePoint >>> 10 & 0x3ff | 0xd800) + String.fromCharCode(0xdc00 | codePoint & 0x3ff);
    }
    return String.fromCharCode(codePoint);
  };
}

// https://github.com/mathiasbynens/he/blob/master/data/decode-map-overrides.json
const replacementCodePoints = purify<Record<number, string>>({
  0: '\ufffd',
  128: '\u20ac',
  130: '\u201a',
  131: '\u0192',
  132: '\u201e',
  133: '\u2026',
  134: '\u2020',
  135: '\u2021',
  136: '\u02c6',
  137: '\u2030',
  138: '\u0160',
  139: '\u2039',
  140: '\u0152',
  142: '\u017d',
  145: '\u2018',
  146: '\u2019',
  147: '\u201c',
  148: '\u201d',
  149: '\u2022',
  150: '\u2013',
  151: '\u2014',
  152: '\u02dc',
  153: '\u2122',
  154: '\u0161',
  155: '\u203a',
  156: '\u0153',
  158: '\u017e',
  159: '\u0178',
});

// https://github.com/mathiasbynens/he/blob/master/data/invalid-character-reference-code-points.json
const errorCodePoints = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  11,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
  127,
  128,
  129,
  130,
  131,
  132,
  133,
  134,
  135,
  136,
  137,
  138,
  139,
  140,
  141,
  142,
  143,
  144,
  145,
  146,
  147,
  148,
  149,
  150,
  151,
  152,
  153,
  154,
  155,
  156,
  157,
  158,
  159,
  64976,
  64977,
  64978,
  64979,
  64980,
  64981,
  64982,
  64983,
  64984,
  64985,
  64986,
  64987,
  64988,
  64989,
  64990,
  64991,
  64992,
  64993,
  64994,
  64995,
  64996,
  64997,
  64998,
  64999,
  65000,
  65001,
  65002,
  65003,
  65004,
  65005,
  65006,
  65007,
  65534,
  65535,
  131070,
  131071,
  196606,
  196607,
  262142,
  262143,
  327678,
  327679,
  393214,
  393215,
  458750,
  458751,
  524286,
  524287,
  589822,
  589823,
  655358,
  655359,
  720894,
  720895,
  786430,
  786431,
  851966,
  851967,
  917502,
  917503,
  983038,
  983039,
  1048574,
  1048575,
  1114110,
  1114111,
];
