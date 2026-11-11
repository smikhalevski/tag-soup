import type { TagKind, TagParsingOptions, TokenizerContextOptions, TokenizerOptions } from './types.ts';
import {
  areCaseInsensitiveHashedSubstringsEqual,
  areCaseInsensitiveSubstringsEqual,
  areCaseSensitiveHashedSubstringsEqual,
  areCaseSensitiveSubstringsEqual,
  getCaseInsensitiveHashCode,
  getCaseSensitiveHashCode,
  type HashedTagNameEqualityComparer,
  identity,
  type TagNameEqualityComparer,
  type TagNameHashFunction,
  toASCIILowerCase,
} from './utils.ts';

// Groups from the 30th up share bit 29, the highest bit of a positive small integer, which V8 doesn't allocate
const LAST_GROUP_BIT_INDEX = 29;

// The empty set of ending tag names, shared by tags that can't be implicitly ended
const noTagNames: ReadonlySet<string> = new Set();

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
   * @see {@link TagParsingOptions.implicitlyEndedBy}
   */
  implicitlyEndedBy: ReadonlySet<string>;

  /**
   * The bit of the group of this tag, or 0 if the tag can't be implicitly ended. Tags with the same set of
   * {@link implicitlyEndedBy} names are in one group. Groups of all contexts are numbered together, so one bitmask
   * covers enclosing tags of any context. Groups from the 30th up share bit 29.
   */
  groupBit: number;

  /**
   * Bits of the groups that this tag implicitly ends when it's started, in any context, since tags are ended by name.
   * They rule out most enclosing tags before {@link implicitlyEndedBy} is checked. A shared bit only costs a check.
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
  initialContext: TokenizerContext;

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
   * Compares tag names, case-insensitive if {@link areTagNamesCaseInsensitive} is `true`.
   */
  areTagNamesEqual: TagNameEqualityComparer;

  /**
   * Like {@link areTagNamesEqual}, but only for names with equal hash codes, since it skips the last char.
   */
  areHashedTagNamesEqual: HashedTagNameEqualityComparer;

  /**
   * Returns the hash code of a tag name, case-insensitive if {@link areTagNamesCaseInsensitive} is `true`.
   */
  getTagHashCode: TagNameHashFunction;

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
  const normalizeTagName = areTagNamesCaseInsensitive ? toASCIILowerCase : identity;
  const getTagHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;
  const areTagNamesEqual = areTagNamesCaseInsensitive
    ? areCaseInsensitiveSubstringsEqual
    : areCaseSensitiveSubstringsEqual;
  const areHashedTagNamesEqual = areTagNamesCaseInsensitive
    ? areCaseInsensitiveHashedSubstringsEqual
    : areCaseSensitiveHashedSubstringsEqual;

  const contextMap = new Map<TokenizerContextOptions, TokenizerContext>();

  const initialContext = resolveTokenizerContextOptions(options, contextMap);

  resolveContextTags(contextMap, normalizeTagName, getTagHashCode);

  return {
    initialContext,
    areUnbalancedStartTagsImplicitlyEnded,
    areUnbalancedEndTagsIgnored,
    areTagNamesCaseInsensitive,
    areTagNamesEqual,
    areHashedTagNamesEqual,
    getTagHashCode,
    isStrict,
    isFragment: false,
  };
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
   * @see {@link TagParsingConfig.implicitlyEndedBy}
   */
  implicitlyEndedBy: ReadonlySet<string>;
}

/**
 * Options of a tag, read once.
 */
interface ResolvedTagOptions {
  /**
   * @see {@link TagParsingOptions.kind}
   */
  kind: TagKind;

  /**
   * @see {@link TagParsingConfig.foreignContext}
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
   * The group of the tag, or `undefined` if the tag can't be implicitly ended.
   */
  group: TagGroup | undefined;
}

// Options of a tag without options, like a tag that only ends tags of other contexts
const noTagOptions: ResolvedTagOptions = {
  kind: 'normal',
  foreignContext: undefined,
  isImplicitEndingBoundary: false,
  isImplicitlyStarted: false,
  group: undefined,
};

/**
 * Builds the tag config table of each context, so {@link readTokens} looks up a start tag once. Foreign contexts of
 * tags are added to the context map and resolved too. Contexts with the same {@link TokenizerContextOptions.tags tags}
 * share the configs and the table.
 *
 * Tag names are normalized, and if several names in one tags record normalize to the same name, the last one wins.
 * Tags that can be implicitly ended are grouped by the names of the tags that end them, and each group gets a bit, so
 * the groups of all enclosing tags fit into one bitmask.
 *
 * Options are read once and the results are kept, so a getter or a proxy that returns new objects on every read works
 * too.
 *
 * @param contextMap Contexts by their options. Contexts added while tags are resolved are resolved too.
 * @param normalizeTagName Returns a tag name in lower case if tag names are case-insensitive, or as is.
 * @see {@link createTagConfigTable}
 */
function resolveContextTags(
  contextMap: Map<TokenizerContextOptions, TokenizerContext>,
  normalizeTagName: (tagName: string) => string,
  getTagHashCode: TagNameHashFunction
): void {
  type TagsRecord = Record<string, TagParsingOptions> | undefined;

  // The tags record of each context, read in pass 1
  const contextTagsMap = new Map<TokenizerContextOptions, TagsRecord>();

  // Tag options by normalized tag name, for each tags record
  const tagOptionsMaps = new Map<TagsRecord, Map<string, ResolvedTagOptions>>();

  // Groups by the sorted normalized names of the tags that end them
  const groupMap = new Map<string, TagGroup>();

  // Bits of the groups that a tag implicitly ends, by normalized tag name
  const endedGroupBitsMap = new Map<string, number>();

  // Returns the group of tags that are implicitly ended by tags with normalized names
  const getOrCreateGroup = (endingTagNames: string[]): TagGroup => {
    const tagNames = Array.from(new Set(endingTagNames)).sort();
    const groupKey = JSON.stringify(tagNames);

    let group = groupMap.get(groupKey);

    if (group === undefined) {
      group = {
        groupBit: 1 << Math.min(groupMap.size, LAST_GROUP_BIT_INDEX),
        implicitlyEndedBy: new Set(tagNames),
      };

      groupMap.set(groupKey, group);

      // Each tag that ends this group gets its bit, so it knows which tags to end when it's started
      for (const tagName of tagNames) {
        endedGroupBitsMap.set(tagName, (endedGroupBitsMap.get(tagName) || 0) | group.groupBit);
      }
    }
    return group;
  };

  const resolveTagOptions = (tagOptions: TagParsingOptions): ResolvedTagOptions => {
    const {
      kind = 'normal',
      foreignContext,
      implicitlyEndedBy,
      isImplicitEndingBoundary = false,
      isImplicitlyStarted = false,
    } = tagOptions;

    // Any iterable is accepted, like a Set, although the type is an array
    const endingTagNames = implicitlyEndedBy !== undefined ? Array.from(implicitlyEndedBy, normalizeTagName) : [];

    return {
      kind,
      foreignContext:
        foreignContext !== undefined ? resolveTokenizerContextOptions(foreignContext, contextMap) : undefined,
      isImplicitEndingBoundary,
      isImplicitlyStarted,

      // Created in pass 1, so its ending tags get their bits before configs are created
      group: endingTagNames.length !== 0 ? getOrCreateGroup(endingTagNames) : undefined,
    };
  };

  const createTagConfig = (tagName: string, tagOptions: ResolvedTagOptions): TagParsingConfig => {
    const { kind, foreignContext, isImplicitEndingBoundary, isImplicitlyStarted, group } = tagOptions;

    return {
      tagName,
      tagHashCode: getTagHashCode(tagName, 0, tagName.length),
      kind,
      foreignContext,
      isImplicitEndingBoundary,
      isImplicitlyStarted,
      implicitlyEndedBy: group !== undefined ? group.implicitlyEndedBy : noTagNames,
      groupBit: group !== undefined ? group.groupBit : 0,
      endedGroupBits: endedGroupBitsMap.get(tagName) || 0,
      isRawText: kind === 'raw_text' || kind === 'script_data',
    };
  };

  // Pass 1 reads tag options, resolves foreign contexts and creates groups. The loop also visits contexts that are added
  // to the map meanwhile.
  for (const contextOptions of contextMap.keys()) {
    const { tags } = contextOptions;

    contextTagsMap.set(contextOptions, tags);

    if (tagOptionsMaps.has(tags)) {
      continue;
    }

    // If several names normalize to the same name, only the options of the last one are read
    const lastTagOptionsMap = new Map<string, TagParsingOptions>();

    if (tags !== undefined) {
      for (const [tagName, tagOptions] of Object.entries(tags)) {
        lastTagOptionsMap.set(normalizeTagName(tagName), tagOptions);
      }
    }

    const tagOptionsMap = new Map<string, ResolvedTagOptions>();

    for (const [tagName, tagOptions] of lastTagOptionsMap) {
      tagOptionsMap.set(tagName, resolveTagOptions(tagOptions));
    }

    tagOptionsMaps.set(tags, tagOptionsMap);
  }

  // Pass 2 creates configs. Tags are ended by name in any context, like br ends svg in HTML, so every table gets a
  // config for each tag that ends a group, and its bits are known only after pass 1.
  const tagConfigTableMap = new Map<TagsRecord, TagConfigTable>();

  for (const [tags, tagOptionsMap] of tagOptionsMaps) {
    const tagConfigs: TagParsingConfig[] = [];

    for (const [tagName, tagOptions] of tagOptionsMap) {
      tagConfigs.push(createTagConfig(tagName, tagOptions));
    }

    for (const tagName of endedGroupBitsMap.keys()) {
      if (!tagOptionsMap.has(tagName)) {
        tagConfigs.push(createTagConfig(tagName, noTagOptions));
      }
    }

    tagConfigTableMap.set(tags, createTagConfigTable(tagConfigs));
  }

  for (const [contextOptions, context] of contextMap) {
    context.tagConfigTable = tagConfigTableMap.get(contextTagsMap.get(contextOptions))!;
  }
}

/**
 * Creates a hash table of tag configs: an array whose length is a power of two, at least twice the number of configs.
 *
 * A config is stored in the slot given by the low bits of its hash code, or in the next empty slot after it, wrapping
 * around at the end. A lookup starts at the same slot and moves forward until it finds the config with the hash code
 * and the name, or an empty slot. At least half of the slots are empty, so lookups are short and always stop. Without
 * configs the table has two empty slots, so a lookup needs no check.
 *
 * Unlike a Map by hash code, the table keeps configs of tags with equal hash codes, and it's looked up as fast.
 *
 * @see {@link getTagConfig}
 */
function createTagConfigTable(tagConfigs: TagParsingConfig[]): TagConfigTable {
  let tableLength = 2;

  while (tableLength < tagConfigs.length * 2) {
    tableLength *= 2;
  }

  const tagConfigTable = new Array<TagParsingConfig | undefined>(tableLength).fill(undefined);

  for (const tagConfig of tagConfigs) {
    let index = tagConfig.tagHashCode & (tableLength - 1);

    while (tagConfigTable[index] !== undefined) {
      index = (index + 1) & (tableLength - 1);
    }

    tagConfigTable[index] = tagConfig;
  }

  return tagConfigTable;
}

/**
 * Returns the context of context options, created once per options object. {@link resolveContextTags} adds its tags.
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
    // Tables are created when configs of all contexts are known
    tagConfigTable: [],
    areSelfClosingTagsRecognized,
    areCDATASectionsRecognized,
    areProcessingInstructionsRecognized,
  };

  contextMap.set(contextOptions, context);

  return context;
}
