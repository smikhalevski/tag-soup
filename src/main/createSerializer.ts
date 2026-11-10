import { Node } from 'flyweight-dom';
import { resolveSerializerOptions } from './resolveSerializerOptions.ts';
import { serializeMarkup } from './serializeMarkup.ts';
import type { SerializerOptions } from './types.ts';

/**
 * Creates a serializer that converts a DOM node to an HTML/XML string.
 *
 * @example
 * import { createSerializer, HTMLDOMParser } from 'tag-soup';
 * import { escapeXML } from 'speedy-entities';
 *
 * const serialize = createSerializer({
 *   tags: {
 *     br: { kind: 'void' },
 *   },
 *   encodeText: escapeXML,
 *   encodeAttribute: escapeXML,
 * });
 *
 * serialize(HTMLDOMParser.parseFragment('<p>hello<br></p>'));
 * // ⮕ '<p>hello<br></p>'
 *
 * @param options Serializer options.
 * @returns The new serializer.
 * @see {@link toHTML}
 * @see {@link toXML}
 * @group Serializer
 */
export function createSerializer(options: SerializerOptions = {}): (node: Node) => string {
  const config = resolveSerializerOptions(options);

  return node => serializeMarkup(node, config);
}
