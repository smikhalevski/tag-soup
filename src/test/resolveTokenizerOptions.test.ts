import { describe, expect, test } from 'vitest';
import type { TagParsingOptions } from '../main/index.ts';
import {
  resolveTokenizerOptions,
  type TagParsingConfig,
  type TokenizerContext,
} from '../main/resolveTokenizerOptions.ts';

// Returns the config of a tag from the tag config table of a context
function getTagConfig(context: TokenizerContext, tagName: string): TagParsingConfig {
  return context.tagConfigTable.find(tagConfig => tagConfig?.tagName === tagName)!;
}

describe('resolveTokenizerOptions', () => {
  test('throws if tag names normalize to the same name', () => {
    expect(() => resolveTokenizerOptions({ areTagNamesCaseInsensitive: true, tags: { aaa: {}, AAA: {} } })).toThrow(
      'The tag "AAA" is duplicated.'
    );
  });

  test('does not throw if tag names differ in case and tag names are case-sensitive', () => {
    expect(() => resolveTokenizerOptions({ tags: { aaa: {}, AAA: {} } })).not.toThrow();
  });

  test('throws if tag names of a foreign context normalize to the same name', () => {
    expect(() =>
      resolveTokenizerOptions({
        areTagNamesCaseInsensitive: true,
        tags: { aaa: { foreignContext: { tags: { bbb: {}, BBB: {} } } } },
      })
    ).toThrow(new Error('The tag "BBB" is duplicated.'));
  });

  test('does not throw if tag names of different contexts normalize to the same name', () => {
    expect(() =>
      resolveTokenizerOptions({
        areTagNamesCaseInsensitive: true,
        tags: { aaa: { foreignContext: { tags: { AAA: {} } } } },
      })
    ).not.toThrow();
  });

  test('does not throw if tag names differ only in the case of non-ASCII letters', () => {
    expect(() => resolveTokenizerOptions({ areTagNamesCaseInsensitive: true, tags: { ä: {}, Ä: {} } })).not.toThrow();
  });

  test('puts tags that are implicitly ended by the same tags in one group', () => {
    const { rootContext } = resolveTokenizerOptions({
      tags: {
        aaa: { implicitEndingTagNames: ['eee', 'fff'] },
        bbb: { implicitEndingTagNames: ['FFF', 'eee', 'fff'] },
        ccc: { implicitEndingTagNames: ['eee'] },
        ddd: { implicitEndingTagNames: [] },
      },
      areTagNamesCaseInsensitive: true,
    });

    expect(getTagConfig(rootContext, 'aaa').groupBit).toBe(1);
    expect(getTagConfig(rootContext, 'bbb').groupBit).toBe(1);
    expect(getTagConfig(rootContext, 'ccc').groupBit).toBe(2);
    expect(getTagConfig(rootContext, 'ddd').groupBit).toBe(0);

    // Tags that end groups get configs with the bits of the groups that they end
    expect(getTagConfig(rootContext, 'eee').endedGroupBits).toBe(3);
    expect(getTagConfig(rootContext, 'fff').endedGroupBits).toBe(1);
    expect(getTagConfig(rootContext, 'aaa').endedGroupBits).toBe(0);
  });

  test('shares a bit between groups from the 30th up', () => {
    const tags: Record<string, TagParsingOptions> = {};

    for (let i = 0; i < 32; ++i) {
      tags['a' + i] = { implicitEndingTagNames: ['b' + i] };
    }

    const { rootContext } = resolveTokenizerOptions({ tags });

    expect(getTagConfig(rootContext, 'a0').groupBit).toBe(1);
    expect(getTagConfig(rootContext, 'a28').groupBit).toBe(1 << 28);
    expect(getTagConfig(rootContext, 'a29').groupBit).toBe(1 << 29);
    expect(getTagConfig(rootContext, 'a30').groupBit).toBe(1 << 29);
    expect(getTagConfig(rootContext, 'a31').groupBit).toBe(1 << 29);
    expect(getTagConfig(rootContext, 'b31').endedGroupBits).toBe(1 << 29);
  });

  test('shares the tag config table between contexts with the same tags', () => {
    const tags: Record<string, TagParsingOptions> = { aaa: { kind: 'void' } };

    tags.bbb = { foreignContext: { tags, areSelfClosingTagsRecognized: true } };

    const { rootContext } = resolveTokenizerOptions({ tags });

    const foreignContext = getTagConfig(rootContext, 'bbb').foreignContext!;

    expect(foreignContext).not.toBe(rootContext);
    expect(foreignContext.areSelfClosingTagsRecognized).toBe(true);
    expect(foreignContext.tagConfigTable).toBe(rootContext.tagConfigTable);
  });
});
