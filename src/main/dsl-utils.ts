/**
 * Takes string `str` and offset in this string `i` and returns the new offset in `str` if taker matched. If taker
 * didn't match then -1 must be returned. Taker may returns offsets that exceed string length.
 */
export type Taker = (str: string, i: number) => number;

export type CharCodeChecker = (c: number) => boolean;

export function char(charCode: number): Taker {
  return (str, i) => str.charCodeAt(i) === charCode ? i + 1 : -1;
}

export function charBy(charCodeChecker: CharCodeChecker): Taker {
  return (str, i) => charCodeChecker(str.charCodeAt(i)) ? i + 1 : -1;
}

export function substr(s: string, ignoreCase = false): Taker {
  const l = s.length;
  if (ignoreCase) {
    s = s.toLowerCase();
  }

  return (str, i) => {
    str = str.substr(i, l);
    if (ignoreCase) {
      str = str.toLowerCase();
    }
    return str === s ? i + l : -1;
  };
}

export function untilCharBy(charCodeChecker: CharCodeChecker, inclusive: boolean, openEnded: boolean): Taker {
  return (str, i) => {
    for (const l = str.length; i < l; i++) {
      if (charCodeChecker(str.charCodeAt(i))) {
        return inclusive ? i + 1 : i;
      }
    }
    return openEnded ? inclusive ? i + 1 : i : -1;
  };
}

export function untilSubstr(s: string, inclusive: boolean, openEnded: boolean): Taker {
  return (str, i) => {
    let j = str.indexOf(s, i);
    if (j === -1) {
      if (!openEnded) {
        return -1;
      }
      j = str.length;
    }
    return inclusive ? j + s.length : j;
  };
}

export function all(taker: Taker): Taker {
  return (str, i) => {
    const l = str.length;
    while (i < l) {
      const j = taker(str, i);

      if (j === -1 || j === i) {
        break;
      }
      i = j;
    }
    return i;
  };
}

/**
 * Performance optimization for `all(charBy(…))` composition.
 */
export function allCharBy(charCodeChecker: CharCodeChecker): Taker {
  return (str, i) => {
    const l = str.length;
    while (i < l && charCodeChecker(str.charCodeAt(i))) {
      i++;
    }
    return i;
  };
}

export function seq(...takers: Array<Taker>): Taker {
  const n = takers.length;

  return (str, i) => {
    for (let k = 0; k < n && i !== -1; i = takers[k++](str, i)) {
    }
    return i;
  };
}
