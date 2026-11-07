/**
 * The error thrown by a tokenizer or a parser if an {@link ParserError.input input} is malformed.
 *
 * Forgiving parsers, like {@link HTMLDOMParser}, never throw this error.
 *
 * @example
 * try {
 *   XMLDOMParser.parseFragment('<p>hello</br>');
 * } catch (error) {
 *   if (error instanceof ParserError) {
 *     error.input.substring(error.startIndex, error.endIndex);
 *     // ⮕ 'br'
 *   }
 * }
 *
 * @group Parser
 */
export class ParserError extends SyntaxError {
  /**
   * Creates a new {@link ParserError} instance.
   *
   * @param message The error message.
   * @param input The text where an error was detected.
   * @param startIndex The index of the first char in text where an error was detected, inclusive, or -1 if unknown.
   * @param endIndex The index of the last char in text where an error was detected, exclusive. Equals to
   * `startIndex` if the error points to a position rather than to a range of chars.
   */
  constructor(
    message: string,
    public input: string,
    public startIndex = -1,
    public endIndex = startIndex
  ) {
    super(message);
  }
}

/**
 * @internal
 */
ParserError.prototype.name = 'ParserError';

/**
 * A token that can be read from text. Indices passed to {@link TokenCallback} along with a token point to:
 *
 * - `TEXT`: text between tags.
 * - `START_TAG_NAME`: the tag name in a start tag, `p` in `<p>`.
 * - `START_TAG_CLOSING`: the `>` that closes a start tag.
 * - `START_TAG_SELF_CLOSING`: the `/>` that closes a self-closing tag.
 * - `END_TAG_NAME`: the tag name in an end tag, `p` in `</p>`.
 * - `ATTRIBUTE_NAME`: an attribute name.
 * - `ATTRIBUTE_VALUE`: an attribute value without quotes. Entities aren't decoded.
 * - `COMMENT`: comment content between `<!--` and `-->`.
 * - `PROCESSING_INSTRUCTION_TARGET`: the target of a processing instruction, `xml` in `<?xml version="1.0"?>`.
 * - `PROCESSING_INSTRUCTION_DATA`: the data of a processing instruction, `version="1.0"` in `<?xml version="1.0"?>`.
 * - `CDATA_SECTION`: CDATA section content between `<![CDATA[` and `]]>`.
 * - `DOCTYPE_NAME`: the name in a DOCTYPE declaration, `html` in `<!DOCTYPE html>`.
 *
 * End tags that are inserted by a tokenizer, for void tags and implicitly ended tags, have equal start and end
 * indices.
 *
 * @group Tokenizer
 */
export type Token =
  | 'TEXT'
  | 'START_TAG_NAME'
  | 'START_TAG_CLOSING'
  | 'START_TAG_SELF_CLOSING'
  | 'END_TAG_NAME'
  | 'ATTRIBUTE_NAME'
  | 'ATTRIBUTE_VALUE'
  | 'COMMENT'
  | 'PROCESSING_INSTRUCTION_TARGET'
  | 'PROCESSING_INSTRUCTION_DATA'
  | 'CDATA_SECTION'
  | 'DOCTYPE_NAME';

/**
 * A callback that is invoked when a token is read from text.
 *
 * @param token The token that was read.
 * @param startIndex The start index of the first meaningful token char, inclusive.
 * @param endIndex The end index of the last meaningful token char, exclusive.
 * @group Tokenizer
 */
export type TokenCallback = (token: Token, startIndex: number, endIndex: number) => void;

/**
 * Options of {@link tokenizeMarkup} produced by {@link resolveTokenizerOptions}. Tags are represented by hash codes
 * returned by {@link TokenReaderOptions.getTagHashCode}.
 *
 * @internal
 */
export interface ResolvedTokenizerOptions extends TokenReaderOptions {
  /**
   * A zero for each {@link ResolvedTagOptions.endableTagId endable tag ID}. {@link tokenizeMarkup} copies this array
   * to count open tags, which is faster than creating an array of zeros on every call.
   */
  initialOpenTagCounts?: number[];

  /**
   * @see {@link TokenizerOptions.areUnbalancedStartTagsImplicitlyEnded}
   */
  areUnbalancedStartTagsImplicitlyEnded?: boolean;

  /**
   * @see {@link TokenizerOptions.areUnbalancedEndTagsIgnored}
   */
  areUnbalancedEndTagsIgnored?: boolean;
}

/**
 * Options of a tag consumed by {@link tokenizeMarkup}. All of them are kept in one object, so a start tag is looked up
 * once, rather than once per option.
 *
 * Options are resolved separately for each {@link ContextualTokenizerOptions.tags} object. Tags that only end tags of
 * any context, and {@link ContextualTokenizerOptions.foreignTags foreign tags} of contexts with this object, have
 * resolved options too.
 *
 * @internal
 */
export interface ResolvedTagOptions {
  /**
   * `true` if {@link TagParsingOptions.kind} is `'void'`.
   */
  isVoid: boolean;

  /**
   * `true` if {@link TagParsingOptions.kind} is `'raw_text'` or `'script_data'`.
   */
  isRawText: boolean;

  /**
   * `true` if {@link TagParsingOptions.kind} is `'escapable_raw_text'`.
   */
  isEscapableRawText: boolean;

  /**
   * `true` if {@link TagParsingOptions.kind} is `'script_data'`.
   */
  isScriptData: boolean;

  /**
   * `true` if the tag is one of {@link ContextualTokenizerOptions.foreignTags} in any context with the same tags. Other
   * tags aren't looked up in {@link ContextualTokenReaderOptions.foreignTagMap}.
   */
  isForeign: boolean;

  /**
   * @see {@link TagParsingOptions.isImplicitEndingBoundary}
   */
  isImplicitEndingBoundary: boolean;

  /**
   * @see {@link TagParsingOptions.isImplicitlyStarted}
   */
  isImplicitlyStarted: boolean;

  /**
   * IDs of tags that are implicitly ended when this tag is started. Collected from
   * {@link TagParsingOptions.implicitlyEndedBy} of those tags in all contexts, since tags are ended by name.
   */
  endedTagIds: number[];

  /**
   * The ID of this tag if it can be implicitly ended, or -1 otherwise. Tags that can be implicitly ended have IDs, so
   * {@link tokenizeMarkup} can count open tags with each name, and skip searching for tags to end if none of them is
   * open. IDs are unique across contexts, so open tags of all contexts are counted in one array.
   */
  endableTagId: number;
}

/**
 * The state of a single {@link readTokens} or {@link tokenizeMarkup} call, shared with the callback. Options are shared
 * by all calls, so everything that changes during a call is kept here.
 *
 * @internal
 */
export interface TokenizerState {
  /**
   * The hash code of the start tag name, set before a `START_TAG_NAME` token is passed to a callback, so the callback
   * doesn't have to hash the name again.
   */
  tagHashCode: number;

  /**
   * Resolved options of the start tag, or `undefined` if options don't mention the tag. Set before a `START_TAG_NAME`
   * token is passed to a callback, so the callback doesn't have to look the tag up again. {@link tokenizeMarkup} looks
   * the tag up again if implicit ending switches the context.
   */
  tagOptions: ResolvedTagOptions | undefined;

  /**
   * Contextual options of the content that is being read. Starts as {@link TokenReaderOptions.context}.
   * {@link tokenizeMarkup} switches it when a foreign tag is started or ended, and {@link readTokens} reads it on every
   * use.
   */
  context: ContextualTokenReaderOptions;
}

/**
 * Reads tokens from text and returns them by invoking a callback.
 *
 * Tokens are _guaranteed_ to be balanced: each start tag is followed by a matching end tag. Missing tokens are inserted
 * if needed. Foreign tags switch contextual options for their content.
 *
 * @example
 * tokenizeMarkup(
 *   'Hello, <b>Bob</b>!',
 *   (token, startIndex, endIndex) => {
 *     // Handle token here
 *   },
 *   resolveTokenizerOptions({ tags: { br: { kind: 'void' } } })
 * );
 *
 * @param input The text to read tokens from.
 * @param callback The callback that is invoked when a token is read.
 * @param options Tokenizer options prepared by {@link resolveTokenizerOptions}.
 * @param state The state of the call, which is shared with the callback.
 * @throws {@link ParserError} If input is malformed and options don't allow to recover.
 * @internal
 */
export function tokenizeMarkup(
  input: string,
  callback: TokenCallback,
  options: ResolvedTokenizerOptions = { context: {} },
  state: TokenizerState = { tagHashCode: 0, tagOptions: undefined, context: options.context }
): void {
  const {
    getTagHashCode = getCaseSensitiveHashCode,
    areTagNamesEqual = areCaseSensitiveSubstringsEqual,
    initialOpenTagCounts,
    areUnbalancedStartTagsImplicitlyEnded = false,
    areUnbalancedEndTagsIgnored = false,
    isFragment = false,
    isStrict = false,
  } = options;

  const tagHashCodeStack = [0, 0, 0, 0, 0, 0, 0, 0];

  // Positions of start tag names in the input, to compare them with end tag names
  const tagNameStartIndexStack = [0, 0, 0, 0, 0, 0, 0, 0];
  const tagNameEndIndexStack = [0, 0, 0, 0, 0, 0, 0, 0];

  // Resolved options of open tags, or undefined for tags that options don't mention
  const tagOptionsStack: Array<ResolvedTagOptions | undefined> = [];

  // The number of open tags by endable tag ID
  const openTagCounts = initialOpenTagCounts !== undefined ? initialOpenTagCounts.slice() : [];

  // Contextual options that are applied to children of the tag at the same index in tagHashCodeStack
  const contextStack: ContextualTokenReaderOptions[] = [];

  let tagHashCodeStackCursor = -1;
  let isStartTagOpened = false;
  let isRootElementRead = false;

  function popTag(): void {
    const tagOptions = tagOptionsStack[tagHashCodeStackCursor];

    if (tagOptions !== undefined && tagOptions.endableTagId !== -1) {
      --openTagCounts[tagOptions.endableTagId];
    }

    --tagHashCodeStackCursor;

    state.context = tagHashCodeStackCursor !== -1 ? contextStack[tagHashCodeStackCursor] : options.context;
  }

  // Returns the index of the nearest open start tag that has the same name as the end tag, or -1 if there's none
  function getStartTagIndex(endTagHashCode: number, endTagNameStartIndex: number, endTagNameEndIndex: number): number {
    for (let index = tagHashCodeStackCursor; index !== -1; --index) {
      if (
        tagHashCodeStack[index] === endTagHashCode &&
        areTagNamesEqual(
          input,
          tagNameStartIndexStack[index],
          tagNameEndIndexStack[index],
          endTagNameStartIndex,
          endTagNameEndIndex
        )
      ) {
        return index;
      }
    }
    return -1;
  }

  function isAnyTagOpen(endableTagIds: number[]): boolean {
    for (const endableTagId of endableTagIds) {
      if (openTagCounts[endableTagId] !== 0) {
        return true;
      }
    }
    return false;
  }

  function insertImplicitEndTags(endedTagIds: number[], insertionIndex: number): void {
    // Tags outside the nearest boundary aren't ended, unless the boundary itself must be ended
    let index = tagHashCodeStackCursor;

    while (
      index !== -1 &&
      (!isImplicitEndingBoundary(tagOptionsStack[index]) || isImplicitlyEnded(tagOptionsStack[index], endedTagIds))
    ) {
      --index;
    }

    // Find the outermost tag that must be ended
    ++index;

    while (index <= tagHashCodeStackCursor && !isImplicitlyEnded(tagOptionsStack[index], endedTagIds)) {
      ++index;
    }

    while (index <= tagHashCodeStackCursor) {
      callback(TOKEN_END_TAG_NAME, insertionIndex, insertionIndex);
      popTag();
    }
  }

  const tokenCallback: TokenCallback = (token, startIndex, endIndex) => {
    switch (token) {
      case TOKEN_START_TAG_NAME: {
        // Hashed and looked up by readTokens
        const startTagHashCode = state.tagHashCode;
        let startTagOptions = state.tagOptions;

        // Usually none of the tags that must be ended is open, so the stack isn't searched
        if (startTagOptions !== undefined && isAnyTagOpen(startTagOptions.endedTagIds)) {
          insertImplicitEndTags(startTagOptions.endedTagIds, startIndex - 1);

          // Ended foreign tags restore outer options, so the start tag is read with tags of the restored context
          startTagOptions = getTagOptions(state.context, startTagHashCode);
          state.tagOptions = startTagOptions;
        }

        if (isStrict && !isFragment && tagHashCodeStackCursor === -1) {
          if (isRootElementRead) {
            throw new ParserError('Expected a single root element.', input, startIndex - 1, endIndex);
          }
          isRootElementRead = true;
        }

        callback(TOKEN_START_TAG_NAME, startIndex, endIndex);

        // Most tags aren't foreign in any context, so they aren't looked up in the current one
        const foreignContext =
          startTagOptions !== undefined && startTagOptions.isForeign && state.context.foreignTagMap !== undefined
            ? state.context.foreignTagMap.get(startTagHashCode)
            : undefined;

        if (foreignContext !== undefined) {
          state.context = foreignContext;
        }

        tagHashCodeStack[++tagHashCodeStackCursor] = startTagHashCode;
        tagNameStartIndexStack[tagHashCodeStackCursor] = startIndex;
        tagNameEndIndexStack[tagHashCodeStackCursor] = endIndex;
        tagOptionsStack[tagHashCodeStackCursor] = startTagOptions;
        contextStack[tagHashCodeStackCursor] = state.context;

        if (startTagOptions !== undefined && startTagOptions.endableTagId !== -1) {
          ++openTagCounts[startTagOptions.endableTagId];
        }

        isStartTagOpened = true;
        break;
      }

      case TOKEN_START_TAG_CLOSING: {
        isStartTagOpened = false;

        callback(TOKEN_START_TAG_CLOSING, startIndex, endIndex);

        const startTagOptions = tagOptionsStack[tagHashCodeStackCursor];

        if (startTagOptions !== undefined && startTagOptions.isVoid) {
          callback(TOKEN_END_TAG_NAME, endIndex, endIndex);
          popTag();
        }
        break;
      }

      case TOKEN_START_TAG_SELF_CLOSING:
        isStartTagOpened = false;

        callback(TOKEN_START_TAG_SELF_CLOSING, startIndex, endIndex);
        popTag();
        break;

      case TOKEN_END_TAG_NAME: {
        // Names are compared without hash codes here, since equal names have equal hash codes
        if (
          tagHashCodeStackCursor !== -1 &&
          areTagNamesEqual(
            input,
            tagNameStartIndexStack[tagHashCodeStackCursor],
            tagNameEndIndexStack[tagHashCodeStackCursor],
            startIndex,
            endIndex
          )
        ) {
          // The end tag of the innermost open tag
          callback(TOKEN_END_TAG_NAME, startIndex, endIndex);
          popTag();
          break;
        }

        const endTagHashCode = getTagHashCode(input, startIndex, endIndex);

        // Include "</"
        const endTagStartIndex = startIndex - 2;

        const startTagIndex = getStartTagIndex(endTagHashCode, startIndex, endIndex);

        // Found a start tag
        if (startTagIndex !== -1) {
          if (!areUnbalancedStartTagsImplicitlyEnded && startTagIndex !== tagHashCodeStackCursor) {
            throw new ParserError('Expected an end tag.', input, endTagStartIndex);
          }

          // Insert end tags for tags that were started after the matching start tag
          while (startTagIndex < tagHashCodeStackCursor) {
            callback(TOKEN_END_TAG_NAME, endTagStartIndex, endTagStartIndex);
            popTag();
          }

          callback(TOKEN_END_TAG_NAME, startIndex, endIndex);
          popTag();
          break;
        }

        // Like a start tag, an unbalanced end tag has options of the context it's read in
        const endTagOptions = getTagOptions(state.context, endTagHashCode);

        if (endTagOptions === undefined || !endTagOptions.isImplicitlyStarted) {
          if (!areUnbalancedEndTagsIgnored) {
            throw new ParserError('Unexpected end tag.', input, startIndex, endIndex);
          }
          break;
        }

        if (isAnyTagOpen(endTagOptions.endedTagIds)) {
          insertImplicitEndTags(endTagOptions.endedTagIds, endTagStartIndex);
        }

        state.tagHashCode = endTagHashCode;
        state.tagOptions = endTagOptions;

        callback(TOKEN_START_TAG_NAME, startIndex, endIndex);
        callback(TOKEN_START_TAG_CLOSING, endIndex, endIndex + 1);
        callback(TOKEN_END_TAG_NAME, startIndex, endIndex);
        break;
      }

      default:
        callback(token, startIndex, endIndex);
        break;
    }
  };

  readTokens(input, tokenCallback, options, state);

  if (tagHashCodeStackCursor !== -1 && !areUnbalancedStartTagsImplicitlyEnded) {
    throw new ParserError('Unexpected end of the document.', input, input.length);
  }

  // The input ended inside a start tag
  if (isStartTagOpened) {
    tokenCallback(TOKEN_START_TAG_CLOSING, input.length, input.length);
  }

  while (tagHashCodeStackCursor !== -1) {
    callback(TOKEN_END_TAG_NAME, input.length, input.length);
    popTag();
  }
}

/**
 * Returns resolved options of a tag in a context, or `undefined` if the tag has no options there.
 */
function getTagOptions(context: ContextualTokenReaderOptions, tagHashCode: number): ResolvedTagOptions | undefined {
  return context.tagOptionsMap !== undefined ? context.tagOptionsMap.get(tagHashCode) : undefined;
}

/**
 * Returns `true` if a tag limits implicit ending.
 *
 * @see {@link TagParsingOptions.isImplicitEndingBoundary}
 */
function isImplicitEndingBoundary(tagOptions: ResolvedTagOptions | undefined): boolean {
  return tagOptions !== undefined && tagOptions.isImplicitEndingBoundary;
}

/**
 * Returns `true` if a tag must be implicitly ended.
 */
function isImplicitlyEnded(tagOptions: ResolvedTagOptions | undefined, endedTagIds: number[]): boolean {
  return tagOptions !== undefined && endedTagIds.includes(tagOptions.endableTagId);
}

const SCOPE_PROLOGUE = 0;
const SCOPE_TEXT = 1;
const SCOPE_START_TAG = 2;

const TOKEN_TEXT = 'TEXT';
const TOKEN_START_TAG_NAME = 'START_TAG_NAME';
const TOKEN_START_TAG_CLOSING = 'START_TAG_CLOSING';
const TOKEN_START_TAG_SELF_CLOSING = 'START_TAG_SELF_CLOSING';
const TOKEN_END_TAG_NAME = 'END_TAG_NAME';
const TOKEN_ATTRIBUTE_NAME = 'ATTRIBUTE_NAME';
const TOKEN_ATTRIBUTE_VALUE = 'ATTRIBUTE_VALUE';
const TOKEN_COMMENT = 'COMMENT';
const TOKEN_PROCESSING_INSTRUCTION_TARGET = 'PROCESSING_INSTRUCTION_TARGET';
const TOKEN_PROCESSING_INSTRUCTION_DATA = 'PROCESSING_INSTRUCTION_DATA';
const TOKEN_CDATA_SECTION = 'CDATA_SECTION';
const TOKEN_DOCTYPE_NAME = 'DOCTYPE_NAME';

/**
 * Options that are applied depending on the enclosing foreign tag.
 *
 * @see {@link ContextualTokenizerOptions}
 * @internal
 */
export interface ContextualTokenReaderOptions {
  /**
   * The map from a hash code of a tag to resolved options of the tag in this context. Contexts with the same
   * {@link ContextualTokenizerOptions.tags tags} share the map.
   */
  tagOptionsMap?: Map<number, ResolvedTagOptions>;

  /**
   * The map from a hash code of a foreign tag to options applied to its content. Foreign tags are tracked by
   * {@link tokenizeMarkup}, {@link readTokens} ignores them.
   */
  foreignTagMap?: Map<number, ContextualTokenReaderOptions>;

  /**
   * @see {@link ContextualTokenizerOptions.areSelfClosingTagsRecognized}
   */
  areSelfClosingTagsRecognized?: boolean;

  /**
   * @see {@link ContextualTokenizerOptions.areCDATASectionsRecognized}
   */
  areCDATASectionsRecognized?: boolean;

  /**
   * @see {@link ContextualTokenizerOptions.areProcessingInstructionsRecognized}
   */
  areProcessingInstructionsRecognized?: boolean;
}

/**
 * Returns `true` if two tag names in the input are equal.
 *
 * @internal
 */
export type TagNameEqualityComparer = (
  input: string,
  startIndex1: number,
  endIndex1: number,
  startIndex2: number,
  endIndex2: number
) => boolean;

/**
 * Options of {@link readTokens}.
 *
 * @internal
 */
export interface TokenReaderOptions {
  /**
   * Returns a hash code of a tag name. Tags are compared by their hash codes.
   *
   * @default getCaseSensitiveHashCode
   */
  getTagHashCode?: (input: string, startIndex: number, endIndex: number) => number;

  /**
   * Returns `true` if two tag names are equal. End tags are matched with start tags by name, since different names can
   * have equal hash codes.
   *
   * @default areCaseSensitiveSubstringsEqual
   */
  areTagNamesEqual?: TagNameEqualityComparer;

  /**
   * Contextual options that are applied outside of foreign tags.
   */
  context: ContextualTokenReaderOptions;

  /**
   * If `true` then the input is read as a fragment, so it doesn't have a prologue: leading spaces aren't skipped and
   * DOCTYPE isn't recognized.
   *
   * @default false
   */
  isFragment?: boolean;

  /**
   * @see {@link TokenizerOptions.isStrict}
   */
  isStrict?: boolean;
}

/**
 * Reads tokens from text and returns them by invoking a callback.
 *
 * Tokens are returned in the order they appear in text, nothing is inserted, so start and end tags may be unbalanced.
 * Use {@link tokenizeMarkup} to get balanced tokens.
 *
 * Contextual options are read from {@link TokenizerState.context} on every use, and options of a start tag are read
 * from {@link TokenizerState.tagOptions} after the `START_TAG_NAME` callback, so the callback can change both.
 *
 * @param input The text to read tokens from.
 * @param callback The callback that is invoked when a token is read.
 * @param options Token reader options.
 * @param state The state of the call, which is shared with the callback.
 * @throws {@link ParserError} If {@link TokenReaderOptions.isStrict} is `true` and input is malformed.
 * @internal
 */
export function readTokens(
  input: string,
  callback: TokenCallback,
  options: TokenReaderOptions = { context: {} },
  state: TokenizerState = { tagHashCode: 0, tagOptions: undefined, context: options.context }
): void {
  const {
    getTagHashCode = getCaseSensitiveHashCode,
    areTagNamesEqual = areCaseSensitiveSubstringsEqual,
    isFragment,
    isStrict = false,
  } = options;

  let scope = isFragment ? SCOPE_TEXT : SCOPE_PROLOGUE;
  let textStartIndex = isFragment ? 0 : skipSpaces(input, 0);

  const inputLength = input.length;

  const skipName = isStrict ? skipXMLName : skipHTMLName;
  const skipAttributeName = isStrict ? skipXMLName : skipHTMLAttributeName;

  let enclosingRawTextTagHashCode = 0;
  let enclosingRawTextTagNameStartIndex = 0;
  let enclosingRawTextTagNameEndIndex = 0;
  let isEnclosingRawTextTagScriptData = false;

  // The index of the end tag that ends the enclosing script data
  let scriptDataEndIndex = -1;

  for (let index = textStartIndex, nextIndex = index; index < inputLength; index = nextIndex) {
    let charCode = input.charCodeAt(index);

    if (scope === SCOPE_START_TAG) {
      // ----------------------------------------------------------
      // Self-closing start tag
      // ----------------------------------------------------------

      if (
        state.context.areSelfClosingTagsRecognized &&
        charCode === /* / */ 47 &&
        getCharCodeAt(input, index + 1) === /* > */ 62
      ) {
        // Skip "/>"
        nextIndex += 2;

        callback(TOKEN_START_TAG_SELF_CLOSING, index, nextIndex);

        // Self-closing raw text tag has no content
        enclosingRawTextTagHashCode = 0;

        scope = SCOPE_TEXT;
        textStartIndex = nextIndex;
        nextIndex = skipUntilTagOpening(input, nextIndex);
        continue;
      }

      // ----------------------------------------------------------
      // Closing of a start tag
      // ----------------------------------------------------------

      if (charCode === /* > */ 62) {
        // Skip ">"
        ++nextIndex;

        callback(TOKEN_START_TAG_CLOSING, index, nextIndex);

        scope = SCOPE_TEXT;
        textStartIndex = nextIndex;

        // Script data can contain end tags that don't end it, so the end tag that does is searched for in advance
        if (enclosingRawTextTagHashCode !== 0 && isEnclosingRawTextTagScriptData) {
          nextIndex = scriptDataEndIndex = getScriptDataEndIndex(
            input,
            nextIndex,
            enclosingRawTextTagNameStartIndex,
            enclosingRawTextTagNameEndIndex,
            areTagNamesEqual
          );
        } else {
          nextIndex = skipUntilTagOpening(input, nextIndex);
        }
        continue;
      }

      // ----------------------------------------------------------
      // Attribute
      // ----------------------------------------------------------

      nextIndex = skipAttributeName(input, index);

      // No attribute name
      if (nextIndex === index) {
        // Skip illegal char
        if (!isStrict) {
          textStartIndex = ++nextIndex;
          continue;
        }

        throw new ParserError(
          'Expected an attribute name' +
            (state.context.areSelfClosingTagsRecognized ? ", a self-closing start tag ('/>')," : '') +
            " or a start tag closing ('>').",
          input,
          index,
          index + 1
        );
      }

      callback(TOKEN_ATTRIBUTE_NAME, index, nextIndex);

      nextIndex = skipSpaces(input, nextIndex);

      // No attribute value
      if (getCharCodeAt(input, nextIndex) !== /* = */ 61) {
        if (!isStrict) {
          callback(TOKEN_ATTRIBUTE_VALUE, nextIndex, nextIndex);
          continue;
        }

        throw new ParserError(
          "Expected an attribute value separated by an equals sign ('=').",
          input,
          nextIndex,
          nextIndex + 1
        );
      }

      // Skip "="
      ++nextIndex;

      nextIndex = skipSpaces(input, nextIndex);

      const quoteCharCode = getCharCodeAt(input, nextIndex);

      // ----------------------------------------------------------
      // Unquoted attribute value
      // ----------------------------------------------------------

      if (quoteCharCode !== /* " */ 34 && quoteCharCode !== /* ' */ 39) {
        if (isStrict) {
          throw new ParserError(
            'Expected a double-quoted (\'"\') or a single-quoted ("\'") attribute value.',
            input,
            nextIndex,
            nextIndex + 1
          );
        }

        callback(TOKEN_ATTRIBUTE_VALUE, nextIndex, (nextIndex = skipUnquotedAttributeValue(input, nextIndex)));

        textStartIndex = nextIndex = skipSpaces(input, nextIndex);
        continue;
      }

      // ----------------------------------------------------------
      // Quoted attribute value
      // ----------------------------------------------------------

      // Skip opening quote char
      const attributeValueStartIndex = ++nextIndex;

      nextIndex = getIndexOfOrLength(input, quoteCharCode === /* " */ 34 ? '"' : "'", nextIndex);

      if (isStrict && nextIndex === inputLength) {
        throw new ParserError(
          quoteCharCode === /* " */ 34
            ? "Expected the attribute value to be closed with a double-quote ('\"')."
            : 'Expected the attribute value to be closed with a single-quote ("\'").',
          input,
          attributeValueStartIndex,
          inputLength
        );
      }

      callback(TOKEN_ATTRIBUTE_VALUE, attributeValueStartIndex, nextIndex);

      // Skip closing quote char
      ++nextIndex;

      textStartIndex = nextIndex = skipSpaces(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // Skip to the next tag
    // ----------------------------------------------------------

    if (charCode !== /* < */ 60) {
      scope = SCOPE_TEXT;
      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // Skip "<"
    ++nextIndex;

    charCode = getCharCodeAt(input, nextIndex);

    // ----------------------------------------------------------
    // Processing instruction
    // ----------------------------------------------------------

    if (
      state.context.areProcessingInstructionsRecognized &&
      enclosingRawTextTagHashCode === 0 &&
      charCode === /* ? */ 63
    ) {
      if (textStartIndex !== index) {
        scope = SCOPE_TEXT;
        callback(TOKEN_TEXT, textStartIndex, index);
      }

      // Skip "?"
      ++nextIndex;

      const targetStartIndex = nextIndex;

      nextIndex = skipName(input, nextIndex);

      // No target
      if (isStrict && targetStartIndex === nextIndex) {
        throw new ParserError(
          'Expected a processing instruction target.',
          input,
          targetStartIndex,
          targetStartIndex + 1
        );
      }

      callback(TOKEN_PROCESSING_INSTRUCTION_TARGET, targetStartIndex, nextIndex);

      // https://www.w3.org/TR/xml/#sec-pi
      nextIndex = skipSpaces(input, nextIndex);

      const dataEndIndex = getIndexOfOrLength(input, '?>', nextIndex);

      if (isStrict && dataEndIndex === inputLength) {
        throw new ParserError("Expected the processing instruction to be closed with '?>'.", input, index, inputLength);
      }

      callback(TOKEN_PROCESSING_INSTRUCTION_DATA, nextIndex, (nextIndex = dataEndIndex));

      // Skip "?>"
      nextIndex += 2;

      textStartIndex = nextIndex =
        scope === SCOPE_PROLOGUE ? skipSpaces(input, nextIndex) : skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // DOCTYPE
    // ----------------------------------------------------------

    if (scope === SCOPE_PROLOGUE && enclosingRawTextTagHashCode === 0 && isDoctypeSectionOpening(input, nextIndex)) {
      // Skip "!DOCTYPE"
      nextIndex += 8;

      nextIndex = skipSpaces(input, nextIndex);

      callback(TOKEN_DOCTYPE_NAME, nextIndex, (nextIndex = skipName(input, nextIndex)));

      textStartIndex = nextIndex = skipSpaces(input, skipUntilTagClosing(input, nextIndex) + 1);
      continue;
    }

    // ----------------------------------------------------------
    // CDATA section
    // ----------------------------------------------------------

    if (
      state.context.areCDATASectionsRecognized &&
      enclosingRawTextTagHashCode === 0 &&
      isCDATASectionOpening(input, nextIndex, isStrict)
    ) {
      if (textStartIndex !== index) {
        callback(TOKEN_TEXT, textStartIndex, index);
      }

      // Skip "![CDATA["
      nextIndex += 8;

      const cdataSectionEndIndex = getIndexOfOrLength(input, ']]>', nextIndex);

      if (isStrict && cdataSectionEndIndex === inputLength) {
        throw new ParserError("Expected the CDATA section to be closed with ']]>'.", input, index, inputLength);
      }

      callback(TOKEN_CDATA_SECTION, nextIndex, (nextIndex = cdataSectionEndIndex));

      scope = SCOPE_TEXT;
      textStartIndex = nextIndex += 3;
      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // Comment
    // ----------------------------------------------------------

    if (
      enclosingRawTextTagHashCode === 0 &&
      charCode === /* ! */ 33 &&
      nextIndex + 2 < inputLength &&
      input.charCodeAt(nextIndex + 1) === /* - */ 45 &&
      input.charCodeAt(nextIndex + 2) === /* - */ 45
    ) {
      if (textStartIndex !== index) {
        scope = SCOPE_TEXT;
        callback(TOKEN_TEXT, textStartIndex, index);
      }

      // Skip "!--"
      nextIndex += 3;

      const commentEndIndex = isStrict
        ? getIndexOfOrLength(input, '-->', nextIndex)
        : getHTMLCommentEndIndex(input, nextIndex);

      if (isStrict && commentEndIndex === inputLength) {
        throw new ParserError("Expected the comment to be closed with '-->'.", input, index, inputLength);
      }

      callback(TOKEN_COMMENT, nextIndex, commentEndIndex);

      // Skip the comment closing, which ends with the first ">" after the comment
      textStartIndex = nextIndex = skipUntilTagClosing(input, commentEndIndex) + 1;

      if (scope === SCOPE_PROLOGUE) {
        textStartIndex = nextIndex = skipSpaces(input, nextIndex);
        continue;
      }

      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // Quirky comment
    // ----------------------------------------------------------

    if (enclosingRawTextTagHashCode === 0 && (charCode === /* ? */ 63 || charCode === /* ! */ 33)) {
      if (textStartIndex !== index) {
        scope = SCOPE_TEXT;
        callback(TOKEN_TEXT, textStartIndex, index);
      }

      if (isStrict) {
        throw new ParserError(
          charCode === /* ? */ 63
            ? 'Processing instructions are forbidden.'
            : "Expected a comment ('<!--')" +
                (isFragment || scope !== SCOPE_PROLOGUE ? '' : ", a doctype declaration ('<!DOCTYPE')") +
                (state.context.areCDATASectionsRecognized ? ", or a CDATA section ('<![CDATA[[')" : '') +
                '.',
          input,
          nextIndex - 1,
          nextIndex + 1
        );
      }

      // Skip "!", unlike "?" it isn't a part of the comment
      if (charCode === /* ! */ 33) {
        ++nextIndex;
      }

      callback(TOKEN_COMMENT, nextIndex, (nextIndex = skipUntilTagClosing(input, nextIndex)));

      // Skip ">"
      textStartIndex = ++nextIndex;

      if (scope === SCOPE_PROLOGUE) {
        textStartIndex = nextIndex = skipSpaces(input, nextIndex);
        continue;
      }

      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // End tag
    // ----------------------------------------------------------

    if (charCode === /* / */ 47) {
      // Skip "/"
      const tagNameStartIndex = ++nextIndex;

      nextIndex = skipName(input, nextIndex);

      // No tag name
      if (tagNameStartIndex === nextIndex) {
        if (isStrict) {
          throw new ParserError('Expected a name for the end tag.', input, tagNameStartIndex, tagNameStartIndex + 1);
        }

        // "</" is a part of raw text, and of text at the end of the input
        if (enclosingRawTextTagHashCode !== 0 || nextIndex === inputLength) {
          nextIndex = skipUntilTagOpening(input, nextIndex);
          continue;
        }

        if (textStartIndex !== index) {
          callback(TOKEN_TEXT, textStartIndex, index);
        }

        // "</>" is ignored, and anything else is a comment, like "#" in "</#>"
        if (input.charCodeAt(nextIndex) !== /* > */ 62) {
          callback(TOKEN_COMMENT, nextIndex, (nextIndex = skipUntilTagClosing(input, nextIndex)));
        }

        // Skip ">"
        textStartIndex = ++nextIndex;

        if (scope === SCOPE_PROLOGUE) {
          textStartIndex = nextIndex = skipSpaces(input, nextIndex);
          continue;
        }

        nextIndex = skipUntilTagOpening(input, nextIndex);
        continue;
      }

      // End of prolog
      scope = SCOPE_TEXT;

      // Doesn't match the current raw text tag, the end tag of script data is already checked
      if (
        enclosingRawTextTagHashCode !== 0 &&
        index !== scriptDataEndIndex &&
        !isRawTextTagNameAt(
          input,
          tagNameStartIndex,
          enclosingRawTextTagNameStartIndex,
          enclosingRawTextTagNameEndIndex,
          areTagNamesEqual
        )
      ) {
        // The name can contain the opening of the end tag, like in "</a</script>"
        nextIndex = skipUntilTagOpening(input, tagNameStartIndex);
        continue;
      }

      if (textStartIndex !== index) {
        callback(TOKEN_TEXT, textStartIndex, index);
      }

      callback(TOKEN_END_TAG_NAME, tagNameStartIndex, nextIndex);

      // End the raw text tag
      enclosingRawTextTagHashCode = 0;

      if (!isStrict) {
        // Skip unparsable characters after the tag name
        textStartIndex = nextIndex = skipUntilTagClosing(input, nextIndex) + 1;
        nextIndex = skipUntilTagOpening(input, nextIndex);
        continue;
      }

      nextIndex = skipSpaces(input, nextIndex);

      if (getCharCodeAt(input, nextIndex) !== /* > */ 62) {
        throw new ParserError("Expected a closing angle bracket ('>').", input, nextIndex, nextIndex + 1);
      }

      // Skip ">"
      textStartIndex = ++nextIndex;
      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // Start tag
    // ----------------------------------------------------------

    // Start tags are ignored inside raw text tags
    if (enclosingRawTextTagHashCode !== 0) {
      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    const tagNameStartIndex = nextIndex;

    nextIndex = skipName(input, nextIndex);

    // No tag name
    if (tagNameStartIndex === nextIndex) {
      if (isStrict) {
        throw new ParserError('Expected a name for the start tag.', input, tagNameStartIndex, tagNameStartIndex + 1);
      }

      // "<" is a part of text, which ends the prolog
      scope = SCOPE_TEXT;
      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    if (textStartIndex !== index) {
      callback(TOKEN_TEXT, textStartIndex, index);
    }

    const startTagHashCode = getTagHashCode(input, tagNameStartIndex, nextIndex);

    // The callback reads options of the start tag from the state, rather than looking the tag up
    state.tagHashCode = startTagHashCode;
    state.tagOptions = getTagOptions(state.context, startTagHashCode);

    callback(TOKEN_START_TAG_NAME, tagNameStartIndex, nextIndex);

    // The callback can switch the context, which changes options of the start tag
    const startTagOptions = state.tagOptions;

    if (startTagOptions !== undefined && (startTagOptions.isRawText || startTagOptions.isEscapableRawText)) {
      // Start of the raw text tag
      enclosingRawTextTagHashCode = startTagHashCode;
      enclosingRawTextTagNameStartIndex = tagNameStartIndex;
      enclosingRawTextTagNameEndIndex = nextIndex;
      isEnclosingRawTextTagScriptData = startTagOptions.isScriptData;
    }

    scope = SCOPE_START_TAG;
    textStartIndex = nextIndex = skipSpaces(input, nextIndex);
  }

  // The input may end inside a start tag, after an attribute without a value
  if (scope !== SCOPE_START_TAG && textStartIndex < inputLength) {
    callback(TOKEN_TEXT, textStartIndex, inputLength);
  }
}

/**
 * Returns `true` if the name of a raw text tag starts at index, and is followed by a space, `/` or `>`. Raw text is
 * ended only by such end tags, so `</script` at the end of the input, or `</scripts>`, is a part of the text.
 *
 * @param input The input to read the name from.
 * @param index The index in the input where the name may start.
 * @param tagNameStartIndex The index in the input where the name of the raw text tag starts.
 * @param tagNameEndIndex The index in the input where the name of the raw text tag ends.
 * @param areTagNamesEqual Compares tag names.
 */
function isRawTextTagNameAt(
  input: string,
  index: number,
  tagNameStartIndex: number,
  tagNameEndIndex: number,
  areTagNamesEqual: TagNameEqualityComparer
): boolean {
  const endIndex = index + tagNameEndIndex - tagNameStartIndex;
  const charCode = getCharCodeAt(input, endIndex);

  return (
    (isSpaceChar(charCode) || charCode === /* / */ 47 || charCode === /* > */ 62) &&
    areTagNamesEqual(input, tagNameStartIndex, tagNameEndIndex, index, endIndex)
  );
}

/**
 * Returns the index of the end tag that ends script data, or the input length if script data isn't ended.
 *
 * After `<!--` script data is escaped, and a start tag with the name of the script data tag makes it double escaped.
 * End tags don't end double escaped script data, the end tag of the double escaped start tag makes it escaped again,
 * and `-->` ends escaping.
 *
 * @param input The input that contains script data.
 * @param index The index in the input where script data starts.
 * @param tagNameStartIndex The index in the input where the name of the script data tag starts.
 * @param tagNameEndIndex The index in the input where the name of the script data tag ends.
 * @param areTagNamesEqual Compares tag names.
 * @see [HTML Script Data State](https://html.spec.whatwg.org/multipage/parsing.html#script-data-state)
 */
function getScriptDataEndIndex(
  input: string,
  index: number,
  tagNameStartIndex: number,
  tagNameEndIndex: number,
  areTagNamesEqual: TagNameEqualityComparer
): number {
  // Most "<" in script data aren't followed by the tag name, so the first char is compared before the whole name. It's
  // compared ignoring case, which is enough to skip a char for case-sensitive names too.
  const tagNameCharCode = getUncheckedCaseInsensitiveCharCodeAt(input, tagNameStartIndex);

  let isEscaped = false;
  let isDoubleEscaped = false;

  // The index of "-->" that ends escaping, it is searched for once per "<!--"
  let commentClosingIndex = 0;

  while (true) {
    const tagOpeningIndex = skipUntilTagOpening(input, index);

    // "-->" before the tag opening ends escaping
    if (isEscaped && commentClosingIndex < tagOpeningIndex) {
      isEscaped = false;
      isDoubleEscaped = false;
    }

    // There's no tag opening, or the input ends with it
    if (tagOpeningIndex + 1 >= input.length) {
      return input.length;
    }

    // Skip "<"
    index = tagOpeningIndex + 1;

    if (input.charCodeAt(index) === /* / */ 47) {
      if (
        index + 1 < input.length &&
        getUncheckedCaseInsensitiveCharCodeAt(input, index + 1) === tagNameCharCode &&
        isRawTextTagNameAt(input, index + 1, tagNameStartIndex, tagNameEndIndex, areTagNamesEqual)
      ) {
        if (!isDoubleEscaped) {
          return tagOpeningIndex;
        }
        isDoubleEscaped = false;
      }
      continue;
    }

    if (!isEscaped) {
      if (
        index + 2 < input.length &&
        input.charCodeAt(index) === /* ! */ 33 &&
        input.charCodeAt(index + 1) === /* - */ 45 &&
        input.charCodeAt(index + 2) === /* - */ 45
      ) {
        isEscaped = true;

        // Dashes of "<!--" can be a part of "-->", so "<!-->" doesn't escape anything
        commentClosingIndex = getIndexOfOrLength(input, '-->', index + 1);
      }
      continue;
    }

    if (
      getUncheckedCaseInsensitiveCharCodeAt(input, index) === tagNameCharCode &&
      isRawTextTagNameAt(input, index, tagNameStartIndex, tagNameEndIndex, areTagNamesEqual)
    ) {
      isDoubleEscaped = true;
    }
  }
}

/**
 * Returns the index where the content of an HTML comment ends.
 *
 * A comment is closed by `-->` or `--!>`, and `<!-->` and `<!--->` are empty comments. If the comment isn't closed,
 * its content ends with the input, except for `-`, `--` or `--!`, which start a comment closing.
 *
 * @param input The input that contains the comment.
 * @param index The index in the input where the comment content starts, after `<!--`.
 * @see [HTML Comment Start State](https://html.spec.whatwg.org/multipage/parsing.html#comment-start-state)
 */
function getHTMLCommentEndIndex(input: string, index: number): number {
  // "<!-->"
  if (index < input.length && input.charCodeAt(index) === /* > */ 62) {
    return index;
  }

  // "<!--->"
  if (
    index + 1 < input.length &&
    input.charCodeAt(index) === /* - */ 45 &&
    input.charCodeAt(index + 1) === /* > */ 62
  ) {
    return index;
  }

  const contentStartIndex = index;

  while (true) {
    index = input.indexOf('--', index);

    if (index === -1) {
      // The comment isn't closed, but a dash at the end of the input can start a comment closing
      if (input.length > contentStartIndex && input.charCodeAt(input.length - 1) === /* - */ 45) {
        return input.length - 1;
      }
      return input.length;
    }

    // The comment closing starts with the last two dashes in a row, like in "--->"
    while (index + 2 < input.length && input.charCodeAt(index + 2) === /* - */ 45) {
      ++index;
    }

    // The comment isn't closed, and ends with "--"
    if (index + 2 === input.length) {
      return index;
    }

    const charCode = input.charCodeAt(index + 2);

    // "-->", "--!>", or the comment isn't closed and ends with "--!"
    if (
      charCode === /* > */ 62 ||
      (charCode === /* ! */ 33 && (index + 3 === input.length || input.charCodeAt(index + 3) === /* > */ 62))
    ) {
      return index;
    }

    // Skip "--" that isn't a comment closing
    index += 2;
  }
}

/**
 * Returns case-insensitive djb2 hash of a substring. The hash is computed in 32 bits and truncated to 30 bits, so V8
 * stores it as a small integer, which isn't allocated and is faster to look up in a Set or a Map.
 */
export function getCaseInsensitiveHashCode(input: string, startIndex: number, endIndex: number): number {
  let hashCode = 5_381;

  for (let i = startIndex; i < endIndex; ++i) {
    hashCode = ((hashCode << 5) + hashCode + toLowerCaseCharCode(input.charCodeAt(i))) | 0;
  }

  return hashCode & 0x3fffffff;
}

/**
 * Returns case-sensitive djb2 hash of a substring. The hash is computed in 32 bits and truncated to 30 bits, so V8
 * stores it as a small integer, which isn't allocated and is faster to look up in a Set or a Map.
 */
export function getCaseSensitiveHashCode(input: string, startIndex: number, endIndex: number): number {
  let hashCode = 5_381;

  for (let i = startIndex; i < endIndex; ++i) {
    hashCode = ((hashCode << 5) + hashCode + input.charCodeAt(i)) | 0;
  }

  return hashCode & 0x3fffffff;
}

/**
 * Returns `true` if two substrings are equal, ignoring the case of ASCII letters.
 */
export function areCaseInsensitiveSubstringsEqual(
  input: string,
  startIndex1: number,
  endIndex1: number,
  startIndex2: number,
  endIndex2: number
): boolean {
  if (endIndex1 - startIndex1 !== endIndex2 - startIndex2) {
    return false;
  }

  for (let i = startIndex1, j = startIndex2; i < endIndex1; ++i, ++j) {
    const charCode1 = input.charCodeAt(i);
    const charCode2 = input.charCodeAt(j);

    // Case is folded only if chars differ, since end tags usually repeat start tags exactly
    if (charCode1 !== charCode2 && toLowerCaseCharCode(charCode1) !== toLowerCaseCharCode(charCode2)) {
      return false;
    }
  }

  return true;
}

/**
 * Returns `true` if two substrings are equal.
 */
export function areCaseSensitiveSubstringsEqual(
  input: string,
  startIndex1: number,
  endIndex1: number,
  startIndex2: number,
  endIndex2: number
): boolean {
  if (endIndex1 - startIndex1 !== endIndex2 - startIndex2) {
    return false;
  }

  for (let i = startIndex1, j = startIndex2; i < endIndex1; ++i, ++j) {
    if (input.charCodeAt(i) !== input.charCodeAt(j)) {
      return false;
    }
  }

  return true;
}

function getCharCodeAt(input: string, index: number): number {
  return index < input.length ? input.charCodeAt(index) : -1;
}

function getIndexOfOrLength(input: string, searchString: string, index: number): number {
  index = input.indexOf(searchString, index);

  return index !== -1 ? index : input.length;
}

function toLowerCaseCharCode(charCode: number): number {
  return charCode < /* A */ 65 || charCode > /* Z */ 90 ? charCode : charCode + 32;
}

function getUncheckedCaseInsensitiveCharCodeAt(input: string, index: number): number {
  return toLowerCaseCharCode(input.charCodeAt(index));
}

/**
 * Returns `true` if case-insensitive "!DOCTYPE" starts at index.
 */
function isDoctypeSectionOpening(input: string, index: number): boolean {
  return (
    index + 7 < input.length &&
    input.charCodeAt(index) === /* ! */ 33 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 1) === /* d */ 100 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 2) === /* o */ 111 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 3) === /* c */ 99 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 4) === /* t */ 116 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 5) === /* y */ 121 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 6) === /* p */ 112 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 7) === /* e */ 101
  );
}

/**
 * Returns `true` if "![CDATA[" starts at index.
 */
function isCDATASectionOpening(input: string, index: number, isCaseSensitive: boolean): boolean {
  if (isCaseSensitive) {
    return input.startsWith('![CDATA[', index);
  }

  return (
    index + 7 < input.length &&
    input.charCodeAt(index) === /* ! */ 33 &&
    input.charCodeAt(index + 1) === /* [ */ 91 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 2) === /* c */ 99 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 3) === /* d */ 100 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 4) === /* a */ 97 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 5) === /* t */ 116 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 6) === /* a */ 97 &&
    input.charCodeAt(index + 7) === /* [ */ 91
  );
}

// ----------------------------------------------------------
// Check chars
// ----------------------------------------------------------

// https://www.w3.org/TR/xml/#NT-S
function isSpaceChar(charCode: number): boolean {
  return charCode === /* \s */ 32 || charCode === /* \n */ 10 || charCode === /* \t */ 9 || charCode === /* \r */ 13;
}

// https://www.w3.org/TR/xml/#NT-NameStartChar
function isXMLNameStartChar(charCode: number): boolean {
  return (
    (charCode >= /* a */ 97 && charCode <= /* z */ 122) ||
    (charCode >= /* A */ 65 && charCode <= /* Z */ 90) ||
    charCode === /* _ */ 95 ||
    charCode === /* : */ 58 ||
    (charCode >= 0x000c0 && charCode <= 0x000d6) ||
    (charCode >= 0x000d8 && charCode <= 0x000f6) ||
    (charCode >= 0x000f8 && charCode <= 0x002ff) ||
    (charCode >= 0x00370 && charCode <= 0x0037d) ||
    (charCode >= 0x0037f && charCode <= 0x01fff) ||
    (charCode >= 0x0200c && charCode <= 0x0200d) ||
    (charCode >= 0x02070 && charCode <= 0x0218f) ||
    (charCode >= 0x02c00 && charCode <= 0x02fef) ||
    (charCode >= 0x03001 && charCode <= 0x0d7ff) ||
    (charCode >= 0x0f900 && charCode <= 0x0fdcf) ||
    (charCode >= 0x0fdf0 && charCode <= 0x0fffd) ||
    (charCode >= 0x10000 && charCode <= 0xeffff)
  );
}

// https://www.w3.org/TR/xml/#NT-NameChar
function isXMLNameChar(charCode: number): boolean {
  return (
    isXMLNameStartChar(charCode) ||
    charCode === /* - */ 45 ||
    charCode === /* . */ 46 ||
    charCode === 0xb7 ||
    (charCode >= /* 0 */ 48 && charCode <= /* 9 */ 57) ||
    (charCode >= 0x0300 && charCode <= 0x036f) ||
    (charCode >= 0x203f && charCode <= 0x2040)
  );
}

function isHTMLNameChar(charCode: number): boolean {
  return !(charCode === /* / */ 47 || charCode === /* > */ 62 || isSpaceChar(charCode));
}

function isHTMLAttributeNameChar(charCode: number): boolean {
  return !(charCode === /* / */ 47 || charCode === /* > */ 62 || charCode === /* = */ 61 || isSpaceChar(charCode));
}

// https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(unquoted)-state
function isUnquotedAttributeValueChar(charCode: number): boolean {
  return !(charCode === /* > */ 62 || isSpaceChar(charCode));
}

// ----------------------------------------------------------
// Skip char sequences
// ----------------------------------------------------------

// Skip functions have their own loops rather than a shared loop that accepts a char predicate, since V8 doesn't inline
// a predicate that is passed as an argument

function skipSpaces(input: string, index: number): number {
  while (index < input.length && isSpaceChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
}

// https://www.w3.org/TR/xml/#NT-Name
function skipXMLName(input: string, index: number): number {
  if (!isXMLNameStartChar(getCharCodeAt(input, index))) {
    return index;
  }

  // Skip the start char
  ++index;

  while (index < input.length && isXMLNameChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
}

function skipHTMLName(input: string, index: number): number {
  if (!isXMLNameStartChar(getCharCodeAt(input, index))) {
    return index;
  }

  // Skip the start char
  ++index;

  while (index < input.length && isHTMLNameChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
}

function skipHTMLAttributeName(input: string, index: number): number {
  while (index < input.length && isHTMLAttributeNameChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
}

function skipUnquotedAttributeValue(input: string, index: number): number {
  while (index < input.length && isUnquotedAttributeValueChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
}

function skipUntilTagOpening(input: string, index: number): number {
  return getIndexOfOrLength(input, '<', index);
}

function skipUntilTagClosing(input: string, index: number): number {
  return getIndexOfOrLength(input, '>', index);
}
