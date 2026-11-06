import {
  areCaseInsensitiveSubstringsEqual,
  areCaseSensitiveSubstringsEqual,
  type ContextualTokenReaderOptions,
  getCaseInsensitiveHashCode,
  getCaseSensitiveHashCode,
  type ResolvedTagOptions,
  type ResolvedTokenizerOptions,
  type TokenCallback,
  tokenizeMarkup,
} from './tokenizeMarkup.ts';

/**
 * Options of {@link createTokenizer} that can be changed by {@link foreignTags foreign tags}.
 *
 * @group Tokenizer
 */
export interface ContextualTokenizerOptions {
  /**
   * The map from a foreign tag name to options that are applied to its attributes and content. Options are restored
   * when the foreign tag is ended. Options can reference each other, so foreign content may contain tags that switch
   * back to the outer options.
   *
   * For example, in HTML `svg` content is parsed with XML rules, while `foreignObject` inside `svg` switches back to
   * HTML rules:
   *
   * ```ts
   * const htmlOptions: TokenizerOptions = { tags: { br: { kind: 'void' } } };
   *
   * htmlOptions.foreignTags = {
   *   svg: {
   *     areSelfClosingTagsRecognized: true,
   *     foreignTags: { foreignObject: htmlOptions },
   *   },
   * };
   * ```
   */
  foreignTags?: Record<string, ContextualTokenizerOptions>;

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
   * The map from a tag name to options of the tag.
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
 * The kind of a tag, which defines what the tag can contain:
 *
 * - `'normal'`: tags and text.
 * - `'void'`: nothing, the tag can't have content.
 * - `'raw_text'`: text up to the matching end tag. Entities in this text aren't decoded or encoded.
 * - `'escapable_raw_text'`: same as `'raw_text'`, but entities are decoded and encoded.
 *
 * @see [HTML Normal Elements](https://html.spec.whatwg.org/multipage/syntax.html#normal-elements)
 * @see [HTML Void Elements](https://html.spec.whatwg.org/multipage/syntax.html#void-elements)
 * @see [HTML Raw Text Elements](https://html.spec.whatwg.org/multipage/syntax.html#raw-text-elements)
 * @see [HTML Escapable Raw Text Elements](https://html.spec.whatwg.org/multipage/syntax.html#escapable-raw-text-elements)
 * @group Tokenizer
 */
export type TagKind = 'normal' | 'void' | 'raw_text' | 'escapable_raw_text';

/**
 * Options of a tag that tokenizers and parsers use.
 *
 * @see {@link TokenizerOptions.tags}
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
   *
   * @default 'normal'
   */
  kind?: TagKind;

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
   * To achieve this behavior, set {@link TokenizerOptions.tags tags} to:
   *
   * ```ts
   * { p: { implicitlyEndedBy: ['h1'] } }
   * ```
   *
   * Use in conjunction with {@link TokenizerOptions.areUnbalancedStartTagsImplicitlyEnded} and
   * {@link isImplicitEndingBoundary}.
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
   * To achieve this behavior, set {@link TokenizerOptions.tags tags} to:
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
   * To achieve this behavior, set {@link TokenizerOptions.tags tags} to:
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
  };
}

/**
 * Converts human-readable tokenizer options into options consumed by {@link tokenizeMarkup}.
 *
 * @param options Tokenizer options.
 * @internal
 */
export function resolveTokenizerOptions(options: TokenizerOptions): ResolvedTokenizerOptions {
  const {
    tags = {},
    areTagNamesCaseInsensitive,
    areUnbalancedStartTagsImplicitlyEnded,
    areUnbalancedEndTagsIgnored,
    isStrict,
  } = options;

  const getTagHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const toHashCode = (str: string) => getTagHashCode(str, 0, str.length);

  // Foreign tag options can reference each other, so each of them is resolved once
  const contextMap = new Map<ContextualTokenizerOptions, ContextualTokenReaderOptions>();

  const context = resolveContextualTokenReaderOptions(options, toHashCode, contextMap);

  const { tagOptionsMap, initialOpenTagCounts } = resolveTagOptions(tags, contextMap.values(), toHashCode);

  return {
    getTagHashCode,
    areTagNamesEqual: areTagNamesCaseInsensitive ? areCaseInsensitiveSubstringsEqual : areCaseSensitiveSubstringsEqual,
    tagOptionsMap,
    context,
    isFragment: false,
    isStrict,
    initialOpenTagCounts,
    areUnbalancedStartTagsImplicitlyEnded,
    areUnbalancedEndTagsIgnored,
  };
}

/**
 * Resolves options of each tag into a single map, so {@link tokenizeMarkup} looks up a start tag once. Tags that can be
 * implicitly ended get sequential IDs, so open tags can be counted in an array. Tags that are foreign in any of the
 * resolved contexts are marked as foreign.
 */
function resolveTagOptions(
  tags: Record<string, TagParsingOptions>,
  contexts: Iterable<ContextualTokenReaderOptions>,
  toHashCode: (str: string) => number
) {
  const resolvedTagOptionsMap = new Map<number, ResolvedTagOptions>();

  let endableTagCount = 0;

  function getResolvedTagOptions(tagHashCode: number) {
    let resolvedTagOptions = resolvedTagOptionsMap.get(tagHashCode);

    if (resolvedTagOptions === undefined) {
      resolvedTagOptions = {
        isVoid: false,
        isRawText: false,
        isEscapableRawText: false,
        isForeign: false,
        isImplicitEndingBoundary: false,
        isImplicitlyStarted: false,
        endedTagIds: [],
        endableTagId: -1,
      };
      resolvedTagOptionsMap.set(tagHashCode, resolvedTagOptions);
    }
    return resolvedTagOptions;
  }

  for (const [tagName, tagOptions] of Object.entries(tags)) {
    const {
      kind = 'normal',
      implicitlyEndedBy = [],
      isImplicitEndingBoundary = false,
      isImplicitlyStarted = false,
    } = tagOptions;

    const resolvedTagOptions = getResolvedTagOptions(toHashCode(tagName));

    resolvedTagOptions.isVoid = kind === 'void';
    resolvedTagOptions.isRawText = kind === 'raw_text';
    resolvedTagOptions.isEscapableRawText = kind === 'escapable_raw_text';
    resolvedTagOptions.isImplicitEndingBoundary = isImplicitEndingBoundary;
    resolvedTagOptions.isImplicitlyStarted = isImplicitlyStarted;

    // Tags that end this tag keep its ID, so they know which tags to end when they are started
    for (const endingTagName of implicitlyEndedBy) {
      if (resolvedTagOptions.endableTagId === -1) {
        resolvedTagOptions.endableTagId = endableTagCount++;
      }
      getResolvedTagOptions(toHashCode(endingTagName)).endedTagIds.push(resolvedTagOptions.endableTagId);
    }
  }

  // Contexts are already resolved, so foreign tags are taken from them rather than from options
  for (const context of contexts) {
    if (context.foreignTagMap !== undefined) {
      for (const tagHashCode of context.foreignTagMap.keys()) {
        getResolvedTagOptions(tagHashCode).isForeign = true;
      }
    }
  }

  const initialOpenTagCounts: number[] = [];

  for (let i = 0; i < endableTagCount; ++i) {
    initialOpenTagCounts.push(0);
  }

  return {
    // Start tags aren't looked up if options don't mention any tags
    tagOptionsMap: resolvedTagOptionsMap.size !== 0 ? resolvedTagOptionsMap : undefined,
    initialOpenTagCounts,
  };
}

function resolveContextualTokenReaderOptions(
  options: ContextualTokenizerOptions,
  toHashCode: (str: string) => number,
  resolvedOptionsMap: Map<ContextualTokenizerOptions, ContextualTokenReaderOptions>
): ContextualTokenReaderOptions {
  const alreadyResolvedOptions = resolvedOptionsMap.get(options);

  if (alreadyResolvedOptions !== undefined) {
    return alreadyResolvedOptions;
  }

  const {
    foreignTags,
    areSelfClosingTagsRecognized = false,
    areCDATASectionsRecognized = false,
    areProcessingInstructionsRecognized = false,
  } = options;

  const resolvedOptions: ContextualTokenReaderOptions = {
    foreignTagMap: undefined,
    areSelfClosingTagsRecognized,
    areCDATASectionsRecognized,
    areProcessingInstructionsRecognized,
  };

  resolvedOptionsMap.set(options, resolvedOptions);

  if (foreignTags === undefined) {
    return resolvedOptions;
  }

  resolvedOptions.foreignTagMap = new Map(
    Object.entries(foreignTags).map(entry => [
      toHashCode(entry[0]),
      resolveContextualTokenReaderOptions(entry[1], toHashCode, resolvedOptionsMap),
    ])
  );

  return resolvedOptions;
}
