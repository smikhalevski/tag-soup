export type Maybe<T> = T | null | undefined;

export type Rewriter = (str: string) => string;

export type FromCharName = (name: string, terminated: boolean) => Maybe<string>;

export type FromCharCode = (charCode: number) => Maybe<string>;

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Char codes that are reused across parsers.
 */
export const enum CharCode {
  EQ = 61,
  GT = 62,
  LT = 60,
  QUOT = 34,
  APOS = 39,
  NUM = 35,
  SEMI = 59,
  SLASH = 47,
  X = 120,
}

/**
 * Creates a new object that has the same fields as `src` but no prototype chain. Use this for creating fast lookup
 * maps.
 */
export function pure<T>(src: T): T {
  return Object.assign(Object.create(null), src);
}
