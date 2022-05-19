export function caseInsensitiveHashCodeAt(input: string, offset: number, length: number): number {
  let hashCode = 0;
  for (let i = 0; i < length; ++i) {
    const charCode = input.charCodeAt(i);
    hashCode = ((hashCode << 5) - hashCode) + (charCode < 65 || charCode > 90 ? charCode : charCode + 32);
  }
  return hashCode;
}

export function caseSensitiveHashCodeAt(input: string, offset: number, length: number): number {
  let hashCode = 0;
  for (let i = 0; i < length; ++i) {
    hashCode = ((hashCode << 5) - hashCode) + input.charCodeAt(i);
  }
  return hashCode;
}
