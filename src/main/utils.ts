export function toSet(str: string): Set<string> {
  return new Set(str.split(' '));
}

export function toMap<V>(record: Record<string, V>): Map<string, V> {
  const map = new Map<string, V>();
  for (const key in record) {
    if (record.hasOwnProperty(key)) {
      map.set(key, record[key]);
    }
  }
  return map;
}

export function shallowCopy<T extends object>(value: T | null | undefined): T {
  return Object.assign({}, value);
}
