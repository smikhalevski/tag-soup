import {FromEntityName} from './createDecoder';

export const fromXmlEntityName: FromEntityName = (name, terminated) => terminated ? xmlEntities[name] : undefined;

export const xmlEntities: Record<string, string> = {
  amp: '&',
  gt: '>',
  lt: '<',
  quot: '"',
  apos: '\'',
};
