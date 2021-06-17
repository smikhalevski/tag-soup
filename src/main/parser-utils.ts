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
  '\t' = 9,
  '\n' = 10,
  '\r' = 13,
  '=' = 61,
  '>' = 62,
  '<' = 60,
  '"' = 34,
  '\'' = 39,
  '#' = 35,
  ';' = 59,
  '/' = 47,
  '_' = 95,
  ':' = 58,
  '00' = 48,
  '09' = 57,
  'x' = 120,
  'a' = 97,
  'f' = 102,
  'z' = 122,
  'A' = 65,
  'F' = 70,
  'Z' = 90,
}

/**
 * Creates a new object that has the same fields as `src` but no prototype chain. Use this for creating fast lookup
 * maps.
 */
export function clearPrototype<T>(src: T): T {
  return Object.assign(Object.create(null), src);
}

export const fromXmlCharName: FromCharName = (name, terminated) => terminated ? xmlEntities[name] : undefined;

const xmlEntities = clearPrototype<Record<string, string>>({
  amp: '&',
  gt: '>',
  lt: '<',
  quot: '"',
  apos: '\'',
});

export function lowerCase(str: string): string {
  return str.toLowerCase();
}
