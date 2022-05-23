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
