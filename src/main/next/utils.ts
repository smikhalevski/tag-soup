export function getCaseInsensitiveHashCode(input: string, offset: number, length: number): number {
  let hashCode = 0;
  for (let i = 0; i < length; ++i) {
    const charCode = input.charCodeAt(offset + i);
    hashCode = (hashCode << 5) - hashCode + (charCode < 65 || charCode > 90 ? charCode : charCode + 32);
  }
  return hashCode | 0;
}

export function getCaseSensitiveHashCode(input: string, offset: number, length: number): number {
  let hashCode = 0;
  for (let i = 0; i < length; ++i) {
    hashCode = (hashCode << 5) - hashCode + input.charCodeAt(offset + i);
  }
  return hashCode | 0;
}

export function die(message?: string): never {
  throw new Error(message);
}

export function toHashCodeSet(values: string[], getHashCode: typeof getCaseInsensitiveHashCode): Set<number>;

export function toHashCodeSet(values: string[] | undefined, getHashCode: typeof getCaseInsensitiveHashCode): Set<number> | null;

export function toHashCodeSet(values: string[] | undefined, getHashCode: typeof getCaseInsensitiveHashCode): Set<number> | null {
  if (!values) {
    return null;
  }
  return new Set(values.map((value) => getHashCode(value, 0, value.length)));
}

export function toHashCodeMap(values: Record<string, string[]> | undefined, getHashCode: typeof getCaseInsensitiveHashCode): Map<number, Set<number>> | null {
  if (!values) {
    return null;
  }
  const map = new Map<number, Set<number>>();

  for (const [key, value] of Object.entries(values)) {
    if (value.length !== 0) {
      map.set(getHashCode(key, 0, key.length), toHashCodeSet(value, getHashCode));
    }
  }
  return map;
}
