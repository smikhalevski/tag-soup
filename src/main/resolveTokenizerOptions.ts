import type { TagKind, TagParsingOptions, TokenizerContextOptions, TokenizerOptions } from './types.ts';
import {
  areCaseInsensitiveSubstringsEqual,
  areCaseSensitiveSubstringsEqual,
  getCaseInsensitiveHashCode,
  getCaseSensitiveHashCode,
  identity,
  type SubstringComparer,
  type SubstringHasher,
  toLowerCase,
} from './utils.ts';

/**
 * Resolved options of a tag in a context.
 */
export interface TagParsingConfig {
  /**
   * The tag name, in lower case if tag names are case-insensitive. A lookup by hash code compares it, since different
   * names can share a hash code.
   */
  tagName: string;

  /**
   * The hash code of {@link tagName}.
   */
  tagHashCode: number;

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
   * Names of tags that implicitly end this tag, normalized like {@link tagName}.
   *
   * @see {@link TagParsingOptions.implicitEndingTagNames}
   */
  implicitEndingTagNameSet: ReadonlySet<string>;

  /**
   * The bit of the group of this tag, or 0 if the tag can't be implicitly ended. Tags with the same set of
   * {@link implicitEndingTagNameSet} names are in one group. Groups of all contexts are numbered together, so one bitmask
   * covers enclosing tags of any context. Groups from the 30th up share bit 29.
   */
  groupBit: number;

  /**
   * Bits of the groups that this tag implicitly ends when it's started, in any context, since tags are ended by name.
   * They rule out most enclosing tags before {@link implicitEndingTagNameSet} is checked. A shared bit only costs a check.
   *
   * 0 until the groups of all contexts are created, then set by {@link resolveContexts}.
   */
  endedGroupBits: number;

  /**
   * `true` if the tag is `raw_text` or `script_data`, so parsers don't decode its text. Unlike raw text in
   * {@link readTokens}, which is any kind other than `normal` and `void`, `escapable_raw_text` is excluded.
   */
  isRawText: boolean;
}

/**
 * A hash table of tag configs by tag name hash code.
 *
 * @see {@link createTagConfigTable}
 */
export type TagConfigTable = Array<TagParsingConfig | undefined>;

/**
 * Resolved options of a context.
 */
export interface TokenizerContext {
  /**
   * The hash table of tag configs, with at least one empty slot. Every context has a config for each tag that
   * implicitly ends other tags. Contexts with the same {@link TokenizerContextOptions.tags tags} share the table.
   *
   * @see {@link createTagConfigTable}
   */
  tagConfigTable: TagConfigTable;

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

/**
 * Resolved tokenizer options.
 */
export interface TokenizerConfig {
  /**
   * The context outside of foreign tags, where {@link TagStack.context} starts.
   */
  rootContext: TokenizerContext;

  /**
   * @see {@link TokenizerOptions.areUnbalancedStartTagsImplicitlyEnded}
   */
  areUnbalancedStartTagsImplicitlyEnded: boolean;

  /**
   * @see {@link TokenizerOptions.areUnbalancedEndTagsIgnored}
   */
  areUnbalancedEndTagsIgnored: boolean;

  /**
   * If `true` then tag names are hashed and compared ignoring the case of ASCII letters.
   */
  areTagNamesCaseInsensitive: boolean;

  /**
   * Compares substrings, case-insensitive if {@link areTagNamesCaseInsensitive} is `true`. Comparisons of names with
   * equal hash codes pass end indices minus 1 to skip the last char, see {@link getCaseInsensitiveHashCode}.
   */
  areSubstringsEqual: SubstringComparer;

  /**
   * Returns the hash code of a tag name, case-insensitive if {@link areTagNamesCaseInsensitive} is `true`.
   */
  getSubstringHashCode: SubstringHasher;

  /**
   * @see {@link TokenizerOptions.isStrict}
   */
  isStrict: boolean;

  /**
   * If `true` then the input is a fragment, which has no prologue: leading spaces aren't skipped and DOCTYPE isn't
   * recognized. A strict tokenizer also allows several root elements in a fragment.
   */
  isFragment: boolean;
}

/**
 * Converts tokenizer options into a tokenizer config.
 */
export function resolveTokenizerOptions(options: TokenizerOptions): TokenizerConfig {
  const {
    areTagNamesCaseInsensitive = false,
    areUnbalancedStartTagsImplicitlyEnded = false,
    areUnbalancedEndTagsIgnored = false,
    isStrict = false,
  } = options;

  // Functions that depend on whether tag names are case-insensitive
  const normalizeTagName = areTagNamesCaseInsensitive ? toLowerCase : identity;
  const getSubstringHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;
  const areSubstringsEqual = areTagNamesCaseInsensitive
    ? areCaseInsensitiveSubstringsEqual
    : areCaseSensitiveSubstringsEqual;

  return {
    rootContext: resolveContexts(options, normalizeTagName, getSubstringHashCode),
    areUnbalancedStartTagsImplicitlyEnded,
    areUnbalancedEndTagsIgnored,
    areTagNamesCaseInsensitive,
    areSubstringsEqual,
    getSubstringHashCode,
    isStrict,
    isFragment: false,
  };
}

type TagMapping = Record<string, TagParsingOptions> | undefined;

/**
 * Contexts that share a {@link TokenizerContextOptions.tags tags} record, and the tag configs created from it.
 */
interface TagsEntry {
  contexts: TokenizerContext[];
  tagConfigMap: Map<string, TagParsingConfig>;
}

/**
 * Tags that are implicitly ended by the same tags.
 */
interface TagGroup {
  /**
   * @see {@link TagParsingConfig.groupBit}
   */
  groupBit: number;

  /**
   * @see {@link TagParsingConfig.implicitEndingTagNameSet}
   */
  implicitEndingTagNameSet: ReadonlySet<string>;
}

// Groups from the 30th up share bit 29, the highest bit of a positive small integer, which V8 doesn't allocate
const LAST_GROUP_BIT_INDEX = 29;

// The empty set of ending tag names, shared by tags that can't be implicitly ended
const emptyGroup: TagGroup = {
  groupBit: 0,
  implicitEndingTagNameSet: new Set(),
};

// Shared by configs that pass 2 creates for ending tags that have no options, so one isn't allocated per tag
const emptyTagOptions: TagParsingOptions = {};

/**
 * Resolves the initial context and the contexts of foreign tags reachable from it, and builds the tag config table of
 * each, so {@link readTokens} looks up a start tag once. Contexts with the same
 * {@link TokenizerContextOptions.tags tags} share the configs and the table.
 *
 * Tag names are normalized, and if several names in one tags record normalize to the same name, an error is thrown.
 * Tags that can be implicitly ended are grouped by the names of the tags that end them, and each group gets a bit, so
 * the groups of all enclosing tags fit into one bitmask.
 *
 * Options are read once and the results are kept, so a getter or a proxy that returns new objects on every read works
 * too.
 *
 * @param rootContextOptions Options of the context outside of foreign tags.
 * @param normalizeTagName Returns a tag name in lower case if tag names are case-insensitive, or as is.
 * @param getSubstringHashCode Returns the hash code of a tag name.
 * @returns The resolved initial context.
 * @see {@link createTagConfigTable}
 */
function resolveContexts(
  rootContextOptions: TokenizerContextOptions,
  normalizeTagName: (tagName: string) => string,
  getSubstringHashCode: SubstringHasher
): TokenizerContext {
  // Contexts by their options, filled while configs are created, since foreign tags reference contexts
  const contextMap = new Map<TokenizerContextOptions, TokenizerContext>();

  // Entries by tags record, which is read once, in pass 1
  const tagsEntryMap = new Map<TagMapping, TagsEntry>();

  // Groups by the sorted normalized names of the tags that end them
  const groupMap = new Map<string, TagGroup>();

  // Bits of the groups that a tag implicitly ends, by normalized tag name
  const endedGroupBitsMap = new Map<string, number>();

  /**
   * Returns the group of tags that are implicitly ended by the same tags, created once per set of names. A new group
   * gets its bit, and each of its ending tags gets the bit too, so it knows which tags to end when it's started.
   *
   * @param endingTagNames Normalized names of the tags that implicitly end the tags of the group. Sorted in place, so
   * callers must pass a fresh array.
   */
  const getOrCreateGroup = (endingTagNames: string[]): TagGroup => {
    const implicitEndingTagNameSet = new Set(endingTagNames.sort());
    const groupKey = Array.from(implicitEndingTagNameSet).join('\u0000');

    let group = groupMap.get(groupKey);

    if (group !== undefined) {
      return group;
    }

    group = {
      groupBit: 1 << Math.min(groupMap.size, LAST_GROUP_BIT_INDEX),
      implicitEndingTagNameSet,
    };

    groupMap.set(groupKey, group);

    // Each tag that ends this group gets its bit, so it knows which tags to end when it's started
    for (const tagName of implicitEndingTagNameSet) {
      endedGroupBitsMap.set(tagName, endedGroupBitsMap.get(tagName)! | group.groupBit);
    }
    return group;
  };

  /**
   * Creates the config of a tag. Options are read here, once, and a foreign context is added to the context map, so
   * pass 1 visits it.
   */
  const createTagConfig = (tagName: string, tagOptions: TagParsingOptions): TagParsingConfig => {
    const {
      kind = 'normal',
      foreignContext,
      implicitEndingTagNames,
      isImplicitEndingBoundary = false,
      isImplicitlyStarted = false,
    } = tagOptions;

    let group = emptyGroup;

    if (implicitEndingTagNames !== undefined) {
      const endingTagNames = Array.from(implicitEndingTagNames, normalizeTagName);

      if (endingTagNames.length !== 0) {
        group = getOrCreateGroup(endingTagNames);
      }
    }

    return {
      tagName,
      tagHashCode: getSubstringHashCode(tagName, 0, tagName.length),
      kind,
      foreignContext: foreignContext !== undefined ? getOrCreateContext(foreignContext, contextMap) : undefined,
      isImplicitEndingBoundary,
      isImplicitlyStarted,
      implicitEndingTagNameSet: group.implicitEndingTagNameSet,
      groupBit: group.groupBit,

      // Groups can be created after this config, so the bits are set in pass 2
      endedGroupBits: 0,
      isRawText: kind === 'raw_text' || kind === 'script_data',
    };
  };

  const rootContext = getOrCreateContext(rootContextOptions, contextMap);

  // Pass 1 creates configs, resolves foreign contexts and creates groups.
  // The loop also visits contexts that are added to the map meanwhile.
  for (const [contextOptions, context] of contextMap) {
    const { tags } = contextOptions;

    const tagsEntry = tagsEntryMap.get(tags);

    if (tagsEntry !== undefined) {
      tagsEntry.contexts.push(context);
      continue;
    }

    const tagConfigMap = new Map<string, TagParsingConfig>();

    tagsEntryMap.set(tags, { contexts: [context], tagConfigMap });

    if (tags === undefined) {
      continue;
    }

    for (const tagName of Object.keys(tags)) {
      const normalizedTagName = normalizeTagName(tagName);

      if (tagConfigMap.has(normalizedTagName)) {
        throw new Error('The tag "' + tagName + '" is duplicated.');
      }

      tagConfigMap.set(normalizedTagName, createTagConfig(normalizedTagName, tags[tagName]));
    }
  }

  // Pass 2 sets the bits of the groups that each tag ends, which are known only after pass 1.
  // Tags are ended by name in any context, like <br> ends <svg> in HTML, so every table also gets a config for each tag
  // that ends a group. Tags that end nothing keep 0 from createTagConfig.
  for (const { contexts, tagConfigMap } of tagsEntryMap.values()) {
    for (const [tagName, endedGroupBits] of endedGroupBitsMap) {
      let tagConfig = tagConfigMap.get(tagName);

      if (tagConfig === undefined) {
        tagConfig = createTagConfig(tagName, emptyTagOptions);
        tagConfigMap.set(tagName, tagConfig);
      }

      tagConfig.endedGroupBits = endedGroupBits;
    }

    const tagConfigTable = createTagConfigTable(tagConfigMap);

    for (const context of contexts) {
      context.tagConfigTable = tagConfigTable;
    }
  }

  return rootContext;
}

/**
 * Creates a hash table of tag configs: an array whose length is a power of two, at least twice the number of configs.
 *
 * A config is stored in the slot given by the low bits of its hash code, or in the next empty slot after it, wrapping
 * around at the end. A lookup starts at the same slot and moves forward until it finds the config with the hash code
 * and the name, or an empty slot. At least half of the slots are empty, so lookups are short and always stop. Without
 * configs the table has two empty slots, so a lookup needs no check.
 *
 * @param tagConfigMap The configs to store in the table, by normalized tag name.
 * @returns The hash table.
 */
function createTagConfigTable(tagConfigMap: ReadonlyMap<string, TagParsingConfig>): TagConfigTable {
  let tableLength = 2;

  while (tableLength < tagConfigMap.size * 2) {
    tableLength *= 2;
  }

  const tagConfigTable = [];

  for (let i = 0; i < tableLength; ++i) {
    tagConfigTable.push(undefined);
  }

  for (const tagConfig of tagConfigMap.values()) {
    let index = tagConfig.tagHashCode & (tableLength - 1);

    while (tagConfigTable[index] !== undefined) {
      index = (index + 1) & (tableLength - 1);
    }

    tagConfigTable[index] = tagConfig;
  }

  return tagConfigTable;
}

/**
 * Returns the context of context options, created once per options object. A created context has an empty tag config
 * table, which {@link resolveContexts} builds once the configs of all contexts are known.
 *
 * @param contextOptions Options of the context.
 * @param contextMap Contexts by their options, where the context is looked up and stored.
 * @returns The context.
 */
function getOrCreateContext(
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
    // Tables are created when configs of all contexts are known
    tagConfigTable: [],
    areSelfClosingTagsRecognized,
    areCDATASectionsRecognized,
    areProcessingInstructionsRecognized,
  };

  contextMap.set(contextOptions, context);

  return context;
}
