import {
  type ContextualTokenReaderOptions,
  createTokenizerState,
  createTokenizerWriter,
  getCaseInsensitiveHashCode,
  getCaseSensitiveHashCode,
  getTagGroupIdBitIndex,
  type ResolvedTagOptions,
  type ResolvedTokenizerOptions,
  type TagKind,
  type TokenCallback,
  tokenizeMarkup,
  type TokenizerWriter,
} from './tokenizeMarkup.ts';

/**
 * Options of {@link createTokenizer} that can be changed by {@link TagParsingOptions.foreignContext foreign tags}.
 *
 * @group Tokenizer
 */
export interface ContextualTokenizerOptions {
  /**
   * The map from a tag name to options of the tag. These tags aren't applied to content of
   * {@link TagParsingOptions.foreignContext foreign tags}, which is read with tags of their own options.
   *
   * @example
   * {
   *   br: { kind: 'void' },
   *   script: { kind: 'raw_text' },
   *   p: { implicitlyEndedBy: ['div', 'p'], isImplicitlyStarted: true },
   * }
   */
  tags?: Record<string, TagParsingOptions>;

  /**
   * If `true` then self-closing tags (`<br/>`) are recognized, otherwise they are treated as start tags.
   *
   * @default false
   */
  areSelfClosingTagsRecognized?: boolean;

  /**
   * If `true` then CDATA sections (`<![CDATA[…]]>`) are recognized, otherwise they are treated as comments.
   *
   * @default false
   */
  areCDATASectionsRecognized?: boolean;

  /**
   * If `true` then processing instructions (`<?target data?>`) are recognized, otherwise they are treated as comments.
   *
   * @default false
   */
  areProcessingInstructionsRecognized?: boolean;
}

/**
 * Options of {@link createTokenizer}.
 *
 * @group Tokenizer
 */
export interface TokenizerOptions extends ContextualTokenizerOptions {
  /**
   * If `true` then ASCII alpha characters are case-insensitive in tag names.
   *
   * @default false
   */
  areTagNamesCaseInsensitive?: boolean;

  /**
   * If `true` then tags that aren't ended before the end tag of an ancestor, or before the end of the input, are
   * implicitly ended. Otherwise, a {@link ParserError} is thrown.
   *
   * Use in conjunction with {@link areUnbalancedEndTagsIgnored}.
   *
   * ```html
   * <a><b></a>  →  <a><b></b></a>
   *                      ^^^^ b is implicitly ended
   * ```
   *
   * @default false
   */
  areUnbalancedStartTagsImplicitlyEnded?: boolean;

  /**
   * If `true` then end tags that don't have a corresponding start tag are ignored. Otherwise,
   * a {@link ParserError} is thrown.
   *
   * Use in conjunction with {@link areUnbalancedStartTagsImplicitlyEnded}.
   *
   * ```html
   * <a></b></a>  →  <a></a>
   *    ^^^^ b is ignored
   * ```
   *
   * @default false
   */
  areUnbalancedEndTagsIgnored?: boolean;

  /**
   * If `true` then input is read with XML constraints, and a {@link ParserError} is thrown if input doesn't satisfy them:
   *
   * - tag names, attribute names and processing instruction targets must be valid XML names;
   * - attributes must have values in double or single quotes;
   * - comments, CDATA sections and processing instructions must be terminated;
   * - a document must have a single root element.
   *
   * @default false
   */
  isStrict?: boolean;
}

/**
 * Options of a tag that tokenizers and parsers use.
 *
 * @see {@link ContextualTokenizerOptions.tags}
 * @see {@link TagSerializationOptions}
 * @group Tokenizer
 */
export interface TagParsingOptions {
  /**
   * The kind of the tag:
   *
   * - `'normal'`: the tag can contain tags and text.
   * - `'void'`: an end tag is inserted right after the start tag.
   * - `'raw_text'`: the content is read as text until the matching end tag. Parsers don't decode this text.
   * - `'escapable_raw_text'`: same as `'raw_text'`, but parsers decode the text.
   * - `'script_data'`: same as `'raw_text'`, but after `<!--` a start tag of the same name hides end tags until its own
   *   end tag or `-->`. Browsers read `script` this way for compatibility with old scripts wrapped in comments:
   *
   * ```html
   * <script><!--<script></script></script>
   *                              ^^^^^^^^^ ends the script
   * ```
   *
   * In raw text of any kind, an end tag must be followed by a space, `/` or `>`, so `</script` at the end of the input
   * is text.
   *
   * @default 'normal'
   */
  kind?: TagKind;

  /**
   * Options that are applied to attributes and content of the tag, which makes it a foreign tag. Outer options are
   * restored when the tag is ended. Foreign options don't inherit outer options, but options can reference each
   * other, so foreign content may contain tags that switch back to outer options.
   *
   * For example, in HTML `svg` content is read with XML rules, while `foreignObject` inside `svg` switches back to HTML
   * rules:
   *
   * ```ts
   * const svgOptions: ContextualTokenizerOptions = { areSelfClosingTagsRecognized: true };
   *
   * const htmlOptions: TokenizerOptions = {
   *   tags: {
   *     br: { kind: 'void' },
   *     svg: { foreignContext: svgOptions },
   *   },
   * };
   *
   * svgOptions.tags = { foreignObject: { foreignContext: htmlOptions } };
   * ```
   */
  foreignContext?: ContextualTokenizerOptions;

  /**
   * The list of tags that implicitly end this tag when they are started.
   *
   * For example, in HTML `p` is implicitly ended by `h1`:
   *
   * ```html
   * <p><h1>  →  <p></p><h1></h1>
   *                ^^^^ p is implicitly ended by h1
   * ```
   *
   * To achieve this behavior, set {@link ContextualTokenizerOptions.tags tags} to:
   *
   * ```ts
   * { p: { implicitlyEndedBy: ['h1'] } }
   * ```
   *
   * Use in conjunction with {@link TokenizerOptions.areUnbalancedStartTagsImplicitlyEnded} and
   * {@link isImplicitEndingBoundary}.
   *
   * Tags are ended by name in any context. A tag inside a {@link foreignContext foreign tag} can end the foreign tag,
   * and then it's read with tags of the outer options. For example, in HTML `svg` is implicitly ended by `br`:
   *
   * ```html
   * <svg><br>text  →  <svg></svg><br/>text
   *                        ^^^^^^ svg is implicitly ended by br
   * ```
   *
   * To achieve this behavior, set {@link ContextualTokenizerOptions.tags tags} to:
   *
   * ```ts
   * {
   *   svg: { implicitlyEndedBy: ['br'], foreignContext: {} },
   *   br: { kind: 'void' },
   * }
   * ```
   */
  implicitlyEndedBy?: string[];

  /**
   * If `true` then the tag is a boundary for {@link implicitlyEndedBy implicit ending}: tags that are started inside
   * this tag don't implicitly end tags outside of it. A boundary tag that must be implicitly ended itself doesn't limit
   * anything.
   *
   * For example, in HTML `li` is implicitly ended by `li`, but only inside the nearest list:
   *
   * ```html
   * <ul><li><ul><li>  →  <ul><li><ul><li></li></ul></li></ul>
   *                                  ^^^^ outer li isn't ended by the nested li
   * ```
   *
   * To achieve this behavior, set {@link ContextualTokenizerOptions.tags tags} to:
   *
   * ```ts
   * {
   *   li: { implicitlyEndedBy: ['li'] },
   *   ul: { isImplicitEndingBoundary: true },
   *   ol: { isImplicitEndingBoundary: true },
   * }
   * ```
   *
   * @default false
   */
  isImplicitEndingBoundary?: boolean;

  /**
   * If `true` then a start tag is inserted if an unbalanced end tag of this tag is met. Otherwise, a {@link ParserError}
   * is thrown.
   *
   * You can ignore unbalanced end tags with {@link TokenizerOptions.areUnbalancedEndTagsIgnored}.
   *
   * For example, in HTML `p` and `br` tags follow these semantics:
   *
   * ```html
   * </p>   →  <p></p>
   *           ^^^ p is implicitly started
   *
   * </br>  →  <br/>
   *              ^ br is implicitly started
   * ```
   *
   * To achieve this behavior, set {@link ContextualTokenizerOptions.tags tags} to:
   *
   * ```ts
   * {
   *   p: { isImplicitlyStarted: true },
   *   br: { isImplicitlyStarted: true },
   * }
   * ```
   *
   * @default false
   */
  isImplicitlyStarted?: boolean;
}

/**
 * Reads tokens from text and returns them by invoking a callback.
 *
 * @see {@link createTokenizer}
 * @group Tokenizer
 */
export interface Tokenizer {
  /**
   * Reads tokens from a document. Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @param text The text to read tokens from.
   * @param callback The callback that is invoked when a token is read.
   * @throws {@link ParserError} If text is malformed and tokenizer options don't allow to recover.
   */
  tokenizeDocument(text: string, callback: TokenCallback): void;

  /**
   * Reads tokens from a document fragment. DOCTYPE isn't recognized.
   *
   * @param text The text to read tokens from.
   * @param callback The callback that is invoked when a token is read.
   * @throws {@link ParserError} If text is malformed and tokenizer options don't allow to recover.
   */
  tokenizeFragment(text: string, callback: TokenCallback): void;

  /**
   * Creates a writer that reads tokens from a document written in chunks. Leading spaces are skipped, and DOCTYPE is
   * recognized before the first tag or text.
   *
   * @example
   * const writer = HTMLTokenizer.createDocumentWriter((token, startIndex, endIndex, input) => {
   *   input.substring(startIndex, endIndex);
   *   // ⮕ The token text
   * });
   *
   * writer.write('<p>Hello, ');
   * writer.write('Bob!');
   * writer.end();
   *
   * @param callback The callback that is invoked when a token is read.
   * @returns The new writer.
   */
  createDocumentWriter(callback: TokenCallback): TokenizerWriter;

  /**
   * Creates a writer that reads tokens from a document fragment written in chunks. DOCTYPE isn't recognized.
   *
   * @param callback The callback that is invoked when a token is read.
   * @returns The new writer.
   */
  createFragmentWriter(callback: TokenCallback): TokenizerWriter;
}

/**
 * Creates a tokenizer that reads tokens from text and returns them by invoking a callback.
 *
 * Tokens are _guaranteed_ to be balanced: each start tag is followed by a matching end tag. Missing tokens are inserted
 * if needed.
 *
 * @example
 * import { createTokenizer } from 'tag-soup';
 *
 * const tokenizer = createTokenizer({ tags: { br: { kind: 'void' } } });
 *
 * tokenizer.tokenizeFragment(
 *   'Hello, <b>Bob</b>!',
 *   (token, startIndex, endIndex) => {
 *     // Handle token here
 *   },
 * );
 *
 * @param options Tokenizer options.
 * @returns The new tokenizer.
 * @group Tokenizer
 */
export function createTokenizer(options: TokenizerOptions = {}): Tokenizer {
  const documentOptions: ResolvedTokenizerOptions = resolveTokenizerOptions(options);

  const fragmentOptions: ResolvedTokenizerOptions = { ...documentOptions, isFragment: true };

  return {
    tokenizeDocument(text, callback) {
      return tokenizeMarkup(text, callback, documentOptions);
    },

    tokenizeFragment(text, callback) {
      return tokenizeMarkup(text, callback, fragmentOptions);
    },

    createDocumentWriter(callback) {
      return createTokenizerWriter(callback, documentOptions, createTokenizerState(documentOptions.initialContext));
    },

    createFragmentWriter(callback) {
      return createTokenizerWriter(callback, fragmentOptions, createTokenizerState(fragmentOptions.initialContext));
    },
  };
}

/**
 * Converts human-readable tokenizer options into options consumed by {@link tokenizeMarkup}.
 *
 * @param options Tokenizer options.
 * @internal
 */
export function resolveTokenizerOptions(options: TokenizerOptions): ResolvedTokenizerOptions {
  const { areTagNamesCaseInsensitive, areUnbalancedStartTagsImplicitlyEnded, areUnbalancedEndTagsIgnored, isStrict } =
    options;

  const getTagHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const toHashCode = (str: string) => getTagHashCode(str, 0, str.length);

  // Contextual options can reference each other, so each of them is resolved once
  const contextMap = new Map<ContextualTokenizerOptions, ContextualTokenReaderOptions>();

  const initialContext = resolveContextualTokenReaderOptions(options, contextMap);

  const initialOpenTagCounts = resolveTagOptions(contextMap, toHashCode);

  return {
    areTagNamesCaseInsensitive,
    initialContext,
    isFragment: false,
    isStrict,
    initialOpenTagCounts,
    areUnbalancedStartTagsImplicitlyEnded,
    areUnbalancedEndTagsIgnored,
  };
}

/**
 * Resolves tags of each context into a map, so {@link tokenizeMarkup} looks up a start tag once. Contexts with the same
 * tags share the map. Foreign contexts of tags are added to the context map and resolved too. Tags that can be
 * implicitly ended are grouped by tags that end them, and groups get sequential IDs, so open tags can be counted in a
 * single array. Tags are ended by name, so a tag that ends other tags has the same implicitly ended tag group IDs in
 * every map.
 *
 * Returns a zero for each bit of group IDs, see {@link getTagGroupIdBitIndex}.
 */
function resolveTagOptions(
  contextMap: Map<ContextualTokenizerOptions, ContextualTokenReaderOptions>,
  toHashCode: (str: string) => number
): number[] {
  const resolvedTagsMap = new Map<Record<string, TagParsingOptions>, Map<number, ResolvedTagOptions>>();

  // The map from a hash code of a tag to IDs of groups of tags that it ends
  const implicitlyEndedTagGroupIdsMap = new Map<number, number[]>();

  // The map from a list of tags that implicitly end a tag to the ID of the group of tags with this list, so tags that
  // end them check one ID, like br that ends both svg and math in HTML
  const tagGroupIdMap = new Map<string[], number>();

  let tagGroupCount = 0;

  function getResolvedTagOptions(tagOptionsMap: Map<number, ResolvedTagOptions>, tagHashCode: number) {
    let resolvedTagOptions = tagOptionsMap.get(tagHashCode);

    if (resolvedTagOptions === undefined) {
      resolvedTagOptions = {
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
      tagOptionsMap.set(tagHashCode, resolvedTagOptions);
    }
    return resolvedTagOptions;
  }

  function resolveTags(tags: Record<string, TagParsingOptions>) {
    const tagOptionsMap = new Map<number, ResolvedTagOptions>();

    for (const [tagName, tagOptions] of Object.entries(tags)) {
      const {
        kind = 'normal',
        foreignContext,
        implicitlyEndedBy,
        isImplicitEndingBoundary = false,
        isImplicitlyStarted = false,
      } = tagOptions;

      const resolvedTagOptions = getResolvedTagOptions(tagOptionsMap, toHashCode(tagName));

      resolvedTagOptions.kind = kind;
      resolvedTagOptions.isRawText = kind === 'raw_text' || kind === 'script_data';
      resolvedTagOptions.isImplicitEndingBoundary = isImplicitEndingBoundary;
      resolvedTagOptions.isImplicitlyStarted = isImplicitlyStarted;

      if (foreignContext !== undefined) {
        resolvedTagOptions.foreignContext = resolveContextualTokenReaderOptions(foreignContext, contextMap);
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

      resolvedTagOptions.tagGroupId = tagGroupId;
      resolvedTagOptions.tagGroupIdBitIndex = getTagGroupIdBitIndex(tagGroupId);
    }
    return tagOptionsMap;
  }

  // Contexts that are added to the map while tags are resolved are visited too
  for (const [contextualOptions, context] of contextMap) {
    const { tags = {} } = contextualOptions;

    let tagOptionsMap = resolvedTagsMap.get(tags);

    if (tagOptionsMap === undefined) {
      tagOptionsMap = resolveTags(tags);
      resolvedTagsMap.set(tags, tagOptionsMap);
    }

    context.tagOptionsMap = tagOptionsMap;
  }

  // A tag started in any context ends tags of other contexts, like br ends svg in HTML
  for (const tagOptionsMap of resolvedTagsMap.values()) {
    for (const [tagHashCode, implicitlyEndedTagGroupIds] of implicitlyEndedTagGroupIdsMap) {
      const resolvedTagOptions = getResolvedTagOptions(tagOptionsMap, tagHashCode);

      resolvedTagOptions.implicitlyEndedTagGroupIds = implicitlyEndedTagGroupIds;

      for (const implicitlyEndedTagGroupId of implicitlyEndedTagGroupIds) {
        resolvedTagOptions.implicitlyEndedTagGroupIdMask |= 1 << getTagGroupIdBitIndex(implicitlyEndedTagGroupId);
      }
    }
  }

  // Start tags aren't looked up if options don't mention any tags
  for (const context of contextMap.values()) {
    if (context.tagOptionsMap !== undefined && context.tagOptionsMap.size === 0) {
      context.tagOptionsMap = undefined;
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
 * Resolves contextual options once for each object, their tags are resolved by {@link resolveTagOptions}.
 */
function resolveContextualTokenReaderOptions(
  options: ContextualTokenizerOptions,
  resolvedOptionsMap: Map<ContextualTokenizerOptions, ContextualTokenReaderOptions>
): ContextualTokenReaderOptions {
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
    tagOptionsMap: undefined,
    areSelfClosingTagsRecognized,
    areCDATASectionsRecognized,
    areProcessingInstructionsRecognized,
  };

  resolvedOptionsMap.set(options, resolvedOptions);

  return resolvedOptions;
}
