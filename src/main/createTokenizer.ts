import {
  type ContextualTokenReaderOptions,
  getCaseInsensitiveHashCode,
  getCaseSensitiveHashCode,
  type ResolvedTokenizerOptions,
  type TokenCallback,
  tokenizeMarkup,
} from './tokenizeMarkup.js';

/**
 * Options of the {@link createTokenizer} that are applied depending on a context.
 *
 * @group Tokenizer
 */
export interface ContextualTokenizerOptions {
  /**
   * The map from a foreign tag name to a tokenizer options applied to the tag children.
   */
  foreignTags?: Record<string, ContextualTokenizerOptions>;

  /**
   * If `true` then self-closing tags are recognized, otherwise they are treated as start tags.
   *
   * @default false
   */
  areSelfClosingTagsRecognized?: boolean;

  /**
   * If `true` then CDATA sections are recognized.
   *
   * @default false
   */
  areCDATASectionsRecognized?: boolean;

  /**
   * If `true` then processing instructions are recognized.
   *
   * @default false
   */
  areProcessingInstructionsRecognized?: boolean;
}

/**
 * Options of the {@link createTokenizer}.
 *
 * @group Tokenizer
 */
export interface TokenizerOptions extends ContextualTokenizerOptions {
  /**
   * The list of tags that can't have any contents (since there's no end tag, no content can be put between the start
   * tag and the end tag).
   *
   * @example
   * ['link', 'meta']
   * @see [HTML5 Void Elements](https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#void-elements)
   */
  voidTags?: string[];

  /**
   * The list of tags which content is interpreted as plain text.
   *
   * @example
   * ['script', 'style']
   * @see [HTML5 Raw Text Elements](https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#raw-text-elements)
   */
  rawTextTags?: string[];

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
   * Use in conjunctions with {@link areUnbalancedStartTagsImplicitlyClosed}.
   */
  implicitlyClosedTags?: Record<string, string[]>;

  /**
   * The list of tags for which a start tag is inserted if an unbalanced end tag is met. Otherwise,
   * a {@link ParserError} is thrown.
   *
   * You can ignore unbalanced end tags with {@link areUnbalancedEndTagsIgnored}.
   *
   * For example, in HTML `p` and `br` tags follow this semantics:
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
   * If `true` then unbalanced start tags are forcefully closed. Otherwise, a {@link ParserError} is thrown.
   *
   * Use in conjunctions with {@link areUnbalancedEndTagsIgnored}.
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
   * Use in conjunctions with {@link areUnbalancedStartTagsImplicitlyClosed}.
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
   * If `true` then tag names and attributes are processed with XML constraints.
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
   * Reads tokens from text and returns them by invoking a callback.
   *
   * @param text The text string to read tokens from.
   * @param callback The callback that is invoked when a token is read.
   */
  tokenizeDocument(text: string, callback: TokenCallback): void;

  /**
   * Reads tokens from text and returns them by invoking a callback.
   *
   * @param text The text string to read tokens from.
   * @param callback The callback that is invoked when a token is read.
   */
  tokenizeFragment(text: string, callback: TokenCallback): void;
}

/**
 * Reads tokens from text and returns them by invoking a callback.
 *
 * Tokens are _guaranteed_ to be returned in correct order. Missing tokens are inserted to restore the correct order if
 * needed.
 *
 * @example
 * import { createTokenizer, htmlTokenizerOptions } from 'tag-soup';
 *
 * const tokenizer = createTokenizer(htmlTokenizerOptions);
 *
 * tokenizer.tokenize(
 *   'Hello, <b>Bob</b>!',
 *   (token, startIndex, endIndex) => {
 *     // Handle token here
 *   },
 * );
 *
 * @param options Tokenizer options.
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
 */
export function resolveTokenizerOptions(options: TokenizerOptions): ResolvedTokenizerOptions {
  const {
    voidTags,
    rawTextTags,
    implicitlyClosedTags,
    implicitlyOpenedTags,
    areTagNamesCaseInsensitive,
    areUnbalancedStartTagsImplicitlyClosed,
    areUnbalancedEndTagsIgnored,
    isStrict,
  } = options;

  const getHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;

  const toHashCode = (str: string) => getHashCode(str, 0, str.length);

  return {
    ...resolveContextualTokenReaderOptions(options, undefined, toHashCode, new Map()),
    readTag: getHashCode,
    voidTags: voidTags && new Set(voidTags.map(toHashCode)),
    rawTextTags: rawTextTags && new Set(rawTextTags.map(toHashCode)),
    implicitlyClosedTags:
      implicitlyClosedTags &&
      new Map(
        Object.entries(implicitlyClosedTags).map(entry => [toHashCode(entry[0]), new Set(entry[1].map(toHashCode))])
      ),
    implicitlyOpenedTags: implicitlyOpenedTags && new Set(implicitlyOpenedTags.map(toHashCode)),
    isFragment: false,
    areUnbalancedStartTagsImplicitlyClosed,
    areUnbalancedEndTagsIgnored,
    isStrict,
  };
}

function resolveContextualTokenReaderOptions(
  options: ContextualTokenizerOptions,
  parentOptions: ContextualTokenReaderOptions | undefined,
  toHashCode: (str: string) => number,
  resolvedOptionsCache: Map<ContextualTokenizerOptions, ContextualTokenReaderOptions>
): ContextualTokenReaderOptions {
  const alreadyResolvedOptions = resolvedOptionsCache.get(options);

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
    foreignTags: undefined,
    parentOptions,
    areSelfClosingTagsRecognized,
    areCDATASectionsRecognized,
    areProcessingInstructionsRecognized,
  };

  resolvedOptionsCache.set(options, resolvedOptions);

  if (foreignTags === undefined) {
    return resolvedOptions;
  }

  resolvedOptions.foreignTags = new Map(
    Object.entries(foreignTags).map(entry => [
      toHashCode(entry[0]),
      resolveContextualTokenReaderOptions(entry[1], resolvedOptions, toHashCode, resolvedOptionsCache),
    ])
  );

  return resolvedOptions;
}
