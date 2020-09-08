/**
 * Decodes known XML entity names to corresponding chars.
 *
 * @see createEntitiesDecoder
 */
export function fromXmlCharName(name: string, terminated: boolean): string | undefined {
  if (terminated) {
    return xmlEntities[name];
  }
}

export const xmlEntities: Record<string, string> = {
  amp: '&',
  gt: '>',
  lt: '<',
  quot: '"',
  apos: '\'',
};
