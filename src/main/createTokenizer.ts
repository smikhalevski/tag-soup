import {
  type ContextualTokenReaderOptions,
  getCaseInsensitiveHashCode,
  getCaseSensitiveHashCode,
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
   * when the foreign tag is closed. Options can reference each other, so foreign content may contain tags that switch
   * back to the outer options.
   *
   * For example, in HTML `svg` content is parsed with XML rules, while `foreignObject` inside `svg` switches back to
   * HTML rules:
   *
   * ```ts
   * const htmlOptions: TokenizerOptions = { voidTags: ['br'] };
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
   * The list of tags that can't have content. An end tag is inserted right after the start tag of a void tag.
   *
   * @example
   * ['link', 'meta']
   * @see [HTML5 Void Elements](https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#void-elements)
   */
  voidTags?: string[];

  /**
   * The list of tags whose content is read as text until the matching end tag. Parsers don't decode this text.
   *
   * @example
   * ['script', 'style']
   * @see [HTML5 Raw Text Elements](https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#raw-text-elements)
   */
  rawTextTags?: string[];

  /**
   * The list of tags whose content is read as text until the matching end tag. Unlike {@link rawTextTags}, parsers
   * decode this text.
   *
   * @example
   * ['textarea', 'title']
   * @see [HTML5 Escapable Raw Text Elements](https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#escapable-raw-text-elements)
   */
  escapableRawTextTags?: string[];

  /**
   * The map from a tag (A) to a list of tags that must be closed if tag (A) is opened.
   *
   * For example, in HTML `p` and `h1` tags have the following semantics:
   *
   * ```html
   * <p><h1>  →  <p></p><h1></h1>
   *                ^^^^ p is implicitly closed by h1
   * ```
   *
   * To achieve this behavior, set this option to:
   *
   * ```ts
   * // h1 implicitly closes p
   * { h1: ['p'] }
   * ```
   *
   * Use in conjunction with {@link areUnbalancedStartTagsImplicitlyClosed} and {@link implicitClosingBoundaryTags}.
   */
  implicitlyClosedTags?: Record<string, string[]>;

  /**
   * The list of tags that limit {@link implicitlyClosedTags}: tags outside the nearest boundary tag aren't implicitly
   * closed. A boundary tag that must be implicitly closed itself doesn't limit anything.
   *
   * For example, in HTML `li` closes `li`, but only inside the nearest list:
   *
   * ```html
   * <ul><li><ul><li>  →  <ul><li><ul><li></li></ul></li></ul>
   *                                  ^^^^ outer li isn't closed by the nested li
   * ```
   *
   * To achieve this behavior, set this option to:
   *
   * ```ts
   * ['ul', 'ol']
   * ```
   */
  implicitClosingBoundaryTags?: string[];

  /**
   * The list of tags for which a start tag is inserted if an unbalanced end tag is met. Otherwise,
   * a {@link ParserError} is thrown.
   *
   * You can ignore unbalanced end tags with {@link areUnbalancedEndTagsIgnored}.
   *
   * For example, in HTML `p` and `br` tags follow these semantics:
   *
   * ```html
   * </p>   →  <p></p>
   *           ^^^ p is implicitly opened
   *
   * </br>  →  <br/>
   *              ^ br is implicitly opened
   * ```
   *
   * To achieve this behavior, set this option to:
   *
   * ```ts
   * ['p', 'br']
   * ```
   *
   * @see {@link areUnbalancedEndTagsIgnored}
   */
  implicitlyOpenedTags?: string[];

  /**
   * If `true` then ASCII alpha characters are case-insensitive in tag names.
   *
   * @default false
   */
  areTagNamesCaseInsensitive?: boolean;

  /**
   * If `true` then start tags that aren't closed before the end tag of an ancestor, or before the end of the input,
   * are implicitly closed. Otherwise, a {@link ParserError} is thrown.
   *
   * Use in conjunction with {@link areUnbalancedEndTagsIgnored}.
   *
   * ```html
   * <a><b></a>  →  <a><b></b></a>
   *                      ^^^^ b is implicitly closed
   * ```
   *
   * @default false
   */
  areUnbalancedStartTagsImplicitlyClosed?: boolean;

  /**
   * If `true` then end tags that don't have a corresponding start tag are ignored. Otherwise,
   * a {@link ParserError} is thrown.
   *
   * Use in conjunction with {@link areUnbalancedStartTagsImplicitlyClosed}.
   *
   * ```html
   * <a></b></a> → <a></a>
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
 * A tokenizer that reads tokens from text and returns them by invoking a callback.
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
 * const tokenizer = createTokenizer({ voidTags: ['br'] });
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
    voidTags,
    rawTextTags,
    escapableRawTextTags,
    implicitlyClosedTags,
    implicitClosingBoundaryTags,
    implicitlyOpenedTags,
    areTagNamesCaseInsensitive,
    areUnbalancedStartTagsImplicitlyClosed,
    areUnbalancedEndTagsIgnored,
    isStrict,
  } = options;

  const getHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const toHashCode = (str: string) => getHashCode(str, 0, str.length);

  return {
    ...resolveContextualTokenReaderOptions(options, toHashCode, new Map()),
    getTagHashCode: getHashCode,
    voidTagSet: voidTags !== undefined ? new Set(voidTags.map(toHashCode)) : undefined,
    rawTextTagSet: rawTextTags !== undefined ? new Set(rawTextTags.map(toHashCode)) : undefined,
    escapableRawTextTagSet:
      escapableRawTextTags !== undefined ? new Set(escapableRawTextTags.map(toHashCode)) : undefined,
    implicitlyClosedTagMap:
      implicitlyClosedTags !== undefined
        ? new Map(
            Object.entries(implicitlyClosedTags).map(entry => [toHashCode(entry[0]), new Set(entry[1].map(toHashCode))])
          )
        : undefined,
    implicitClosingBoundaryTagSet:
      implicitClosingBoundaryTags !== undefined ? new Set(implicitClosingBoundaryTags.map(toHashCode)) : undefined,
    implicitlyOpenedTagSet:
      implicitlyOpenedTags !== undefined ? new Set(implicitlyOpenedTags.map(toHashCode)) : undefined,
    isFragment: false,
    areUnbalancedStartTagsImplicitlyClosed,
    areUnbalancedEndTagsIgnored,
    isStrict,
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
