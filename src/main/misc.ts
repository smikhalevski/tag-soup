/**
 * Creates a shallow copy of a plain object.
 */
export function objectCopy<A, B>(a: A, b?: B): {} & A & B {
  return Object.assign({}, a, b);
}
