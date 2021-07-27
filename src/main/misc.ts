/**
 * Creates a shallow copy of a plain object.
 *
 * @param values The list of objects to assign to the copy.
 */
export function objectCopy<T>(...values: Array<T>): T & {} {
  return Object.assign.apply(Object, [{}].concat(values) as [{}, ...Array<T>]);
}
