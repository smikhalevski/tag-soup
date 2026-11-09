import type { TagKind, TagParsingOptions, TokenizerContextOptions, TokenizerOptions } from './types.ts';
import { getCaseInsensitiveHashCode, getCaseSensitiveHashCode } from './utils.ts';

export interface TagParsingConfig {
  /**
   * @see {@link TagParsingOptions.kind}
   */
  kind: TagKind;

  /**
   * Resolved {@link TagParsingOptions.foreignContext}, or `undefined` if the tag isn't foreign.
   */
  foreignContext: TokenizerContext | undefined;

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
   * unique across contexts, so enclosing tags of all contexts are counted together.
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

export interface TokenizerContext {
  /**
   * The map from a hash code of a tag to the config of the tag in this context. Contexts with the same
   * {@link TokenizerContextOptions.tags tags} share the map.
   */
  tagConfigMap: Map<number, TagParsingConfig> | undefined;

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

export interface TokenizerConfig {
  /**
   * The context that is applied outside of foreign tags. Parsers and tokenizers initialize
   * {@link TokenizerState.context} with it.
   */
  initialContext: TokenizerContext;

  /**
   * A zero for each {@link TagParsingConfig.tagGroupIdBitIndex bit of tag group IDs}.
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

/**
 * Converts tokenizer options into the config consumed by a tokenizer.
 */
export function resolveTokenizerOptions(options: TokenizerOptions): TokenizerConfig {
  const {
    areTagNamesCaseInsensitive = false,
    areUnbalancedStartTagsImplicitlyEnded = false,
    areUnbalancedEndTagsIgnored = false,
    isStrict = false,
  } = options;

  const getTagHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const contextMap = new Map<TokenizerContextOptions, TokenizerContext>();

  const initialContext = resolveTokenizerContextOptions(options, contextMap);

  const initialEnclosingTagCounts = resolveContextTags(contextMap, getTagHashCode);

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
 * implicitly ended are grouped by tags that end them, and groups get sequential IDs, so enclosing tags can be counted
 * in a single array. Tags are ended by name, so a tag that ends other tags has the same implicitly ended tag group IDs
 * in every map.
 *
 * Returns a zero for each bit of group IDs.
 *
 * @see {@link getTagGroupIdBitIndex}
 */
function resolveContextTags(
  contextMap: Map<TokenizerContextOptions, TokenizerContext>,
  getTagHashCode: typeof getCaseSensitiveHashCode
): number[] {
  const tagConfigMapMap = new Map<Record<string, TagParsingOptions>, Map<number, TagParsingConfig>>();

  // The map from a hash code of a tag to IDs of groups of tags that it ends
  const implicitlyEndedTagGroupIdsMap = new Map<number, number[]>();

  // The map from a list of tags that implicitly end a tag to the ID of the group of tags with this list, so tags that
  // end them check one ID, like br that ends both svg and math in HTML
  const tagGroupIdMap = new Map<string[], number>();

  let tagGroupCount = 0;

  function getOrCreateTagConfig(tagConfigMap: Map<number, TagParsingConfig>, tagHashCode: number) {
    let tagConfig = tagConfigMap.get(tagHashCode);

    if (tagConfig === undefined) {
      tagConfig = {
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
      tagConfigMap.set(tagHashCode, tagConfig);
    }

    return tagConfig;
  }

  function resolveTags(tags: Record<string, TagParsingOptions>) {
    const tagConfigMap = new Map<number, TagParsingConfig>();

    for (const [tagName, tagOptions] of Object.entries(tags)) {
      const {
        kind = 'normal',
        foreignContext,
        implicitlyEndedBy,
        isImplicitEndingBoundary = false,
        isImplicitlyStarted = false,
      } = tagOptions;

      const tagConfig = getOrCreateTagConfig(tagConfigMap, getTagHashCode(tagName, 0, tagName.length));

      tagConfig.kind = kind;
      tagConfig.isRawText = kind === 'raw_text' || kind === 'script_data';
      tagConfig.isImplicitEndingBoundary = isImplicitEndingBoundary;
      tagConfig.isImplicitlyStarted = isImplicitlyStarted;

      if (foreignContext !== undefined) {
        tagConfig.foreignContext = resolveTokenizerContextOptions(foreignContext, contextMap);
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
          const endingTagHashCode = getTagHashCode(endingTagName, 0, endingTagName.length);

          let implicitlyEndedTagGroupIds = implicitlyEndedTagGroupIdsMap.get(endingTagHashCode);

          if (implicitlyEndedTagGroupIds === undefined) {
            implicitlyEndedTagGroupIds = [];
            implicitlyEndedTagGroupIdsMap.set(endingTagHashCode, implicitlyEndedTagGroupIds);
          }
          implicitlyEndedTagGroupIds.push(tagGroupId);
        }
      }

      tagConfig.tagGroupId = tagGroupId;
      tagConfig.tagGroupIdBitIndex = getTagGroupIdBitIndex(tagGroupId);
    }
    return tagConfigMap;
  }

  // Contexts that are added to the map while tags are resolved are visited too
  for (const [contextOptions, context] of contextMap) {
    const { tags = {} } = contextOptions;

    let tagConfigMap = tagConfigMapMap.get(tags);

    if (tagConfigMap === undefined) {
      tagConfigMap = resolveTags(tags);
      tagConfigMapMap.set(tags, tagConfigMap);
    }

    context.tagConfigMap = tagConfigMap;
  }

  // A tag started in any context ends tags of other contexts, like br ends svg in HTML
  for (const tagConfigMap of tagConfigMapMap.values()) {
    for (const [tagHashCode, implicitlyEndedTagGroupIds] of implicitlyEndedTagGroupIdsMap) {
      const tagConfig = getOrCreateTagConfig(tagConfigMap, tagHashCode);

      tagConfig.implicitlyEndedTagGroupIds = implicitlyEndedTagGroupIds;

      for (const implicitlyEndedTagGroupId of implicitlyEndedTagGroupIds) {
        tagConfig.implicitlyEndedTagGroupIdMask |= 1 << getTagGroupIdBitIndex(implicitlyEndedTagGroupId);
      }
    }
  }

  // Start tags aren't looked up if options don't mention any tags
  for (const context of contextMap.values()) {
    if (context.tagConfigMap !== undefined && context.tagConfigMap.size === 0) {
      context.tagConfigMap = undefined;
    }
  }

  const initialEnclosingTagCounts: number[] = [];

  // Groups that share a bit share a count
  for (let tagGroupId = 0; tagGroupId < tagGroupCount; ++tagGroupId) {
    initialEnclosingTagCounts[getTagGroupIdBitIndex(tagGroupId)] = 0;
  }

  return initialEnclosingTagCounts;
}

/**
 * Resolves context options once for each object, their tags are resolved by {@link resolveContextTags}.
 */
function resolveTokenizerContextOptions(
  contextOptions: TokenizerContextOptions,
  contextMap: Map<TokenizerContextOptions, TokenizerContext>
): TokenizerContext {
  let context = contextMap.get(contextOptions);

  if (context !== undefined) {
    return context;
  }

  const {
    areSelfClosingTagsRecognized = false,
    areCDATASectionsRecognized = false,
    areProcessingInstructionsRecognized = false,
  } = contextOptions;

  context = {
    tagConfigMap: undefined,
    areSelfClosingTagsRecognized,
    areCDATASectionsRecognized,
    areProcessingInstructionsRecognized,
  };

  contextMap.set(contextOptions, context);

  return context;
}

/**
 * Returns the index of the bit that represents a tag group ID in bitmasks. IDs that don't fit into 30 bits share the
 * last bit, so bitmasks are small integers, which V8 doesn't allocate. Tags with a shared bit can be considered
 * enclosing while they aren't, which costs a search for tags to end, but doesn't change the result.
 */
function getTagGroupIdBitIndex(tagGroupId: number): number {
  return tagGroupId < 29 ? tagGroupId : 29;
}
