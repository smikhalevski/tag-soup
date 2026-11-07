import { f } from 'flyweight-dom/dsl';
import { escapeXML } from 'speedy-entities';
import { describe, expect, test } from 'vitest';
import { createSerializer } from '../main/createSerializer.ts';

describe('createSerializer', () => {
  // "aQ" and "b0" have the same hash code

  test('writes an end tag of a tag that has the same hash code as a void tag but a different name', () => {
    expect(createSerializer({ tags: { aQ: { kind: 'void' } } })(f.f(f.aQ(), f.b0()))).toBe('<aQ><b0></b0>');
  });

  test('encodes text of a tag that has the same hash code as a raw text tag but a different name', () => {
    const serialize = createSerializer({ tags: { aQ: { kind: 'raw_text' } }, encodeText: escapeXML });

    expect(serialize(f.f(f.aQ('<'), f.b0('<')))).toBe('<aQ><</aQ><b0>&lt;</b0>');
  });

  test('writes void tags that have the same hash code', () => {
    const serialize = createSerializer({ tags: { aQ: { kind: 'void' }, b0: { kind: 'void' } } });

    expect(serialize(f.f(f.aQ(), f.b0()))).toBe('<aQ><b0>');
  });

  test('compares tag names ignoring case', () => {
    const serialize = createSerializer({ tags: { aaa: { kind: 'void' } }, areTagNamesCaseInsensitive: true });

    expect(serialize(f.f(f.AAA()))).toBe('<AAA>');
  });
});
