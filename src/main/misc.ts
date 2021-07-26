export function objectCopy<T>(...values: Array<T>): T & {} {
  values.unshift({} as T);
  return Object.assign.apply(Object, values as [{}, ...Array<T>]);
}
