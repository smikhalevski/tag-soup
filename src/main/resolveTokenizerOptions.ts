import type { TagKind, TagParsingOptions, TokenizerContextOptions, TokenizerOptions } from './types.ts';
import { getCaseInsensitiveHashCode, getCaseSensitiveHashCode } from './utils.ts';

export interface TokenReaderOptions {
  /**
   * If `true` then tag names are hashed with and compared in case-insensitive manner.
   */
  areTagNamesCaseInsensitive: boolean;

  /**
   * @see {@link TokenizerOptions.isStrict}
   */
  isStrict: boolean;

  /**
   * If `true` then the input is read as a fragment, so it doesn't have a prologue: leading spaces aren't skipped and
   * DOCTYPE isn't recognized.
   */
  isFragment: boolean;
}

export interface ResolvedTokenizerContextOptions {
  /**
   * The map from a hash code of a tag to resolved options of the tag in this context. Contexts with the same
   * {@link TokenizerContextOptions.tags tags} share the map.
   */
  tagsMap: Map<number, ResolvedTagParsingOptions> | undefined;

  /**
   * @see {@link TokenizerContextOptions.areSelfClosingTagsRecognized}
   */
  areSelfClosingTagsRecognized: boolean;

  /**
   * @see {@link TokenizerContextOptions.areCDATASectionsRecognized}
   */
  areCDATASectionsRecognized: boolean;

  /**
   * @see {@link TokenizerContextOptions.areProcessingInstructionsRecognized}
   */
  areProcessingInstructionsRecognized: boolean;
}

export interface ResolvedTokenizerOptions extends TokenReaderOptions {
  /**
   * Context options that are applied outside of foreign tags. Parsers and tokenizers initialize
   * {@link TokenizerState.context} with these options.
   */
  initialContext: ResolvedTokenizerContextOptions;

  /**
   * A zero for each {@link ResolvedTagParsingOptions.tagGroupIdBitIndex bit of tag group IDs}.
   * {@link createTokenizerWriter} copies this array to count enclosing tags by the bit of their group ID, which is
   * faster than creating an array of zeros on every call.
   */
  initialEnclosingTagCounts: number[];

  /**
   * @see {@link TokenizerOptions.areUnbalancedStartTagsImplicitlyEnded}
   */
  areUnbalancedStartTagsImplicitlyEnded: boolean;

  /**
   * @see {@link TokenizerOptions.areUnbalancedEndTagsIgnored}
   */
  areUnbalancedEndTagsIgnored: boolean;
}

export interface ResolvedTagParsingOptions {
  /**
   * @see {@link TagParsingOptions.kind}
   */
  kind: TagKind;

  /**
   * Resolved {@link TagParsingOptions.foreignContext}, or `undefined` if the tag isn't foreign.
   */
  foreignContext: ResolvedTokenizerContextOptions | undefined;

  /**
   * @see {@link TagParsingOptions.isImplicitEndingBoundary}
   */
  isImplicitEndingBoundary: boolean;

  /**
   * @see {@link TagParsingOptions.isImplicitlyStarted}
   */
  isImplicitlyStarted: boolean;

  /**
   * IDs of groups of tags that are implicitly ended when this tag is started. Collected from
   * {@link TagParsingOptions.implicitlyEndedBy} of those tags in all contexts, since tags are ended by name.
   */
  implicitlyEndedTagGroupIds: number[];

  /**
   * Bits that represent {@link implicitlyEndedTagGroupIds}.
   *
   * @see {@link tagGroupIdBitIndex}
   */
  implicitlyEndedTagGroupIdMask: number;

  /**
   * The ID of the group of this tag if it can be implicitly ended, or -1 otherwise. Tags with the same
   * {@link TagParsingOptions.implicitlyEndedBy} array are in one group, since they are ended by the same tags. IDs are
   * unique across contexts, so open tags of all contexts are counted together.
   *
   * @see {@link implicitlyEndedTagGroupIdMask}
   */
  tagGroupId: number;

  /**
   * The index of the bit that represents {@link tagGroupId} in bitmasks, or -1 if the tag can't be implicitly ended.
   *
   * @see {@link getTagGroupIdBitIndex}
   */
  tagGroupIdBitIndex: number;

  /**
   * `true` if the tag is `raw_text` or `script_data`, so parsers don't decode its text.
   */
  isRawText: boolean;
}

/**
 * Converts human-readable tokenizer options into options consumed by a tokenizer.
 */
export function resolveTokenizerOptions(options: TokenizerOptions): ResolvedTokenizerOptions {
  const {
    areTagNamesCaseInsensitive = false,
    areUnbalancedStartTagsImplicitlyEnded = false,
    areUnbalancedEndTagsIgnored = false,
    isStrict = false,
  } = options;

  const getTagHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const toHashCode = (str: string) => getTagHashCode(str, 0, str.length);

  const contextMap = new Map<TokenizerContextOptions, ResolvedTokenizerContextOptions>();

  const initialContext = resolveTokenizerContextOptions(options, contextMap);

  const initialEnclosingTagCounts = resolveTagOptions(contextMap, toHashCode);

  return {
    initialContext,
    initialEnclosingTagCounts,
    areUnbalancedStartTagsImplicitlyEnded,
    areUnbalancedEndTagsIgnored,
    areTagNamesCaseInsensitive,
    isStrict,
    isFragment: false,
  };
}

/**
 * Resolves tags of each context into a map, so {@link readTokens} looks up a start tag once. Contexts with the same
 * tags share the map. Foreign contexts of tags are added to the context map and resolved too. Tags that can be
 * implicitly ended are grouped by tags that end them, and groups get sequential IDs, so open tags can be counted in a
 * single array. Tags are ended by name, so a tag that ends other tags has the same implicitly ended tag group IDs in
 * every map.
 *
 * Returns a zero for each bit of group IDs.
 *
 * @see {@link getTagGroupIdBitIndex}
 */
function resolveTagOptions(
  contextMap: Map<TokenizerContextOptions, ResolvedTokenizerContextOptions>,
  toHashCode: (str: string) => number
): number[] {
  const resolvedTagsMap = new Map<Record<string, TagParsingOptions>, Map<number, ResolvedTagParsingOptions>>();

  // The map from a hash code of a tag to IDs of groups of tags that it ends
  const implicitlyEndedTagGroupIdsMap = new Map<number, number[]>();

  // The map from a list of tags that implicitly end a tag to the ID of the group of tags with this list, so tags that
  // end them check one ID, like br that ends both svg and math in HTML
  const tagGroupIdMap = new Map<string[], number>();

  let tagGroupCount = 0;

  function getResolvedTagParsingOptions(tagsMap: Map<number, ResolvedTagParsingOptions>, tagHashCode: number) {
    let resolvedTagParsingOptions = tagsMap.get(tagHashCode);

    if (resolvedTagParsingOptions === undefined) {
      resolvedTagParsingOptions = {
        kind: 'normal',
        foreignContext: undefined,
        isImplicitEndingBoundary: false,
        isImplicitlyStarted: false,
        implicitlyEndedTagGroupIds: [],
        implicitlyEndedTagGroupIdMask: 0,
        tagGroupId: -1,
        tagGroupIdBitIndex: -1,
        isRawText: false,
      };
      tagsMap.set(tagHashCode, resolvedTagParsingOptions);
    }

    return resolvedTagParsingOptions;
  }

  function resolveTagParsingOptions(tags: Record<string, TagParsingOptions>) {
    const tagsMap = new Map<number, ResolvedTagParsingOptions>();

    for (const [tagName, tagParsingOptions] of Object.entries(tags)) {
      const {
        kind = 'normal',
        foreignContext,
        implicitlyEndedBy,
        isImplicitEndingBoundary = false,
        isImplicitlyStarted = false,
      } = tagParsingOptions;

      const resolvedTagParsingOptions = getResolvedTagParsingOptions(tagsMap, toHashCode(tagName));

      resolvedTagParsingOptions.kind = kind;
      resolvedTagParsingOptions.isRawText = kind === 'raw_text' || kind === 'script_data';
      resolvedTagParsingOptions.isImplicitEndingBoundary = isImplicitEndingBoundary;
      resolvedTagParsingOptions.isImplicitlyStarted = isImplicitlyStarted;

      if (foreignContext !== undefined) {
        resolvedTagParsingOptions.foreignContext = resolveTokenizerContextOptions(foreignContext, contextMap);
      }

      if (implicitlyEndedBy === undefined || implicitlyEndedBy.length === 0) {
        continue;
      }

      let tagGroupId = tagGroupIdMap.get(implicitlyEndedBy);

      if (tagGroupId === undefined) {
        tagGroupId = tagGroupCount++;
        tagGroupIdMap.set(implicitlyEndedBy, tagGroupId);

        // Tags that end this group keep its ID, so they know which tags to end when they are started
        for (const endingTagName of implicitlyEndedBy) {
          const endingTagHashCode = toHashCode(endingTagName);

          let implicitlyEndedTagGroupIds = implicitlyEndedTagGroupIdsMap.get(endingTagHashCode);

          if (implicitlyEndedTagGroupIds === undefined) {
            implicitlyEndedTagGroupIds = [];
            implicitlyEndedTagGroupIdsMap.set(endingTagHashCode, implicitlyEndedTagGroupIds);
          }
          implicitlyEndedTagGroupIds.push(tagGroupId);
        }
      }

      resolvedTagParsingOptions.tagGroupId = tagGroupId;
      resolvedTagParsingOptions.tagGroupIdBitIndex = getTagGroupIdBitIndex(tagGroupId);
    }
    return tagsMap;
  }

  // Contexts that are added to the map while tags are resolved are visited too
  for (const [tokenizerContextOptions, resolvedTokenizerContextOptions] of contextMap) {
    const { tags = {} } = tokenizerContextOptions;

    let resolvedTagParsingOptionsMap = resolvedTagsMap.get(tags);

    if (resolvedTagParsingOptionsMap === undefined) {
      resolvedTagParsingOptionsMap = resolveTagParsingOptions(tags);
      resolvedTagsMap.set(tags, resolvedTagParsingOptionsMap);
    }

    resolvedTokenizerContextOptions.tagsMap = resolvedTagParsingOptionsMap;
  }

  // A tag started in any context ends tags of other contexts, like br ends svg in HTML
  for (const tagOptionsMap of resolvedTagsMap.values()) {
    for (const [tagHashCode, implicitlyEndedTagGroupIds] of implicitlyEndedTagGroupIdsMap) {
      const resolvedTagOptions = getResolvedTagParsingOptions(tagOptionsMap, tagHashCode);

      resolvedTagOptions.implicitlyEndedTagGroupIds = implicitlyEndedTagGroupIds;

      for (const implicitlyEndedTagGroupId of implicitlyEndedTagGroupIds) {
        resolvedTagOptions.implicitlyEndedTagGroupIdMask |= 1 << getTagGroupIdBitIndex(implicitlyEndedTagGroupId);
      }
    }
  }

  // Start tags aren't looked up if options don't mention any tags
  for (const context of contextMap.values()) {
    if (context.tagsMap !== undefined && context.tagsMap.size === 0) {
      context.tagsMap = undefined;
    }
  }

  const initialOpenTagCounts: number[] = [];

  // Groups that share a bit share a count
  for (let i = 0; i < tagGroupCount; ++i) {
    initialOpenTagCounts[getTagGroupIdBitIndex(i)] = 0;
  }

  return initialOpenTagCounts;
}

/**
 * Resolves context options once for each object, their tags are resolved by {@link resolveTagOptions}.
 */
function resolveTokenizerContextOptions(
  options: TokenizerContextOptions,
  resolvedOptionsMap: Map<TokenizerContextOptions, ResolvedTokenizerContextOptions>
): ResolvedTokenizerContextOptions {
  let resolvedOptions = resolvedOptionsMap.get(options);

  if (resolvedOptions !== undefined) {
    return resolvedOptions;
  }

  const {
    areSelfClosingTagsRecognized = false,
    areCDATASectionsRecognized = false,
    areProcessingInstructionsRecognized = false,
  } = options;

  resolvedOptions = {
    tagsMap: undefined,
    areSelfClosingTagsRecognized,
    areCDATASectionsRecognized,
    areProcessingInstructionsRecognized,
  };

  resolvedOptionsMap.set(options, resolvedOptions);

  return resolvedOptions;
}

/**
 * Returns the index of the bit that represents a tag group ID in bitmasks. IDs that don't fit into 30 bits share the
 * last bit, so bitmasks are small integers, which V8 doesn't allocate. Tags with a shared bit can be considered open
 * while they aren't, which costs a search for tags to end, but doesn't change the result.
 */
function getTagGroupIdBitIndex(tagGroupId: number): number {
  return tagGroupId < 29 ? tagGroupId : 29;
}
