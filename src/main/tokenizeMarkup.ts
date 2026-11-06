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
 * End tags that are inserted by a tokenizer, for void tags and implicitly closed tags, have equal start and end
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
   * Hash codes of {@link TokenizerOptions.voidTags}.
   */
  voidTagSet?: Set<number>;

  /**
   * The map from a hash code of a tag to hash codes of tags that it implicitly closes.
   *
   * @see {@link TokenizerOptions.implicitlyClosedTags}
   */
  implicitlyClosedTagMap?: Map<number, Set<number>>;

  /**
   * Hash codes of {@link TokenizerOptions.implicitClosingBoundaryTags}.
   */
  implicitClosingBoundaryTagSet?: Set<number>;

  /**
   * Hash codes of {@link TokenizerOptions.implicitlyOpenedTags}.
   */
  implicitlyOpenedTagSet?: Set<number>;

  /**
   * @see {@link TokenizerOptions.areUnbalancedStartTagsImplicitlyClosed}
   */
  areUnbalancedStartTagsImplicitlyClosed?: boolean;

  /**
   * @see {@link TokenizerOptions.areUnbalancedEndTagsIgnored}
   */
  areUnbalancedEndTagsIgnored?: boolean;
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
 *   resolveTokenizerOptions({ voidTags: ['br'] })
 * );
 *
 * @param input The text to read tokens from.
 * @param callback The callback that is invoked when a token is read.
 * @param options Tokenizer options prepared by {@link resolveTokenizerOptions}.
 * @throws {@link ParserError} If input is malformed and options don't allow to recover.
 * @internal
 */
export function tokenizeMarkup(input: string, callback: TokenCallback, options: ResolvedTokenizerOptions = {}): void {
  const {
    getTagHashCode = getCaseSensitiveHashCode,
    areTagNamesEqual = areCaseSensitiveSubstringsEqual,
    voidTagSet,
    implicitlyClosedTagMap,
    implicitClosingBoundaryTagSet,
    implicitlyOpenedTagSet,
    areUnbalancedStartTagsImplicitlyClosed = false,
    areUnbalancedEndTagsIgnored = false,
    isFragment = false,
    isStrict = false,
  } = options;

  // readTokens reads contextual options on every use, so they are switched here when a foreign tag is opened or closed
  const readerOptions: TokenReaderOptions = { ...options };

  const tagHashCodeStack = [0, 0, 0, 0, 0, 0, 0, 0];

  // Positions of start tag names in the input, to compare them with end tag names
  const tagNameStartIndexStack = [0, 0, 0, 0, 0, 0, 0, 0];
  const tagNameEndIndexStack = [0, 0, 0, 0, 0, 0, 0, 0];

  // Contextual options that are applied to children of the tag at the same index in tagHashCodeStack
  const contextStack: ContextualTokenReaderOptions[] = [];

  let tagHashCodeStackCursor = -1;
  let context: ContextualTokenReaderOptions = options;
  let isStartTagOpened = false;
  let isRootElementRead = false;

  function switchContext(nextContext: ContextualTokenReaderOptions): void {
    if (context === nextContext) {
      return;
    }

    context = nextContext;

    readerOptions.areSelfClosingTagsRecognized = nextContext.areSelfClosingTagsRecognized;
    readerOptions.areCDATASectionsRecognized = nextContext.areCDATASectionsRecognized;
    readerOptions.areProcessingInstructionsRecognized = nextContext.areProcessingInstructionsRecognized;
  }

  function popTag(): void {
    --tagHashCodeStackCursor;

    switchContext(tagHashCodeStackCursor !== -1 ? contextStack[tagHashCodeStackCursor] : options);
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

  function insertImplicitEndTags(implicitlyClosedTagSet: Set<number> | undefined, insertionIndex: number): void {
    if (implicitlyClosedTagSet === undefined) {
      return;
    }

    let index = -1;

    if (implicitClosingBoundaryTagSet !== undefined) {
      // Tags outside the nearest boundary aren't closed, unless the boundary itself must be closed
      index = tagHashCodeStackCursor;

      while (
        index !== -1 &&
        (!implicitClosingBoundaryTagSet.has(tagHashCodeStack[index]) ||
          implicitlyClosedTagSet.has(tagHashCodeStack[index]))
      ) {
        --index;
      }
    }

    // Find the outermost tag that must be closed
    ++index;

    while (index <= tagHashCodeStackCursor && !implicitlyClosedTagSet.has(tagHashCodeStack[index])) {
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
        const startTagHashCode = getTagHashCode(input, startIndex, endIndex);

        if (implicitlyClosedTagMap !== undefined) {
          insertImplicitEndTags(implicitlyClosedTagMap.get(startTagHashCode), startIndex - 1);
        }

        if (isStrict && !isFragment && tagHashCodeStackCursor === -1) {
          if (isRootElementRead) {
            throw new ParserError('Expected a single root element.', input, startIndex - 1, endIndex);
          }
          isRootElementRead = true;
        }

        callback(TOKEN_START_TAG_NAME, startIndex, endIndex);

        const foreignContext =
          context.foreignTagMap !== undefined ? context.foreignTagMap.get(startTagHashCode) : undefined;

        tagHashCodeStack[++tagHashCodeStackCursor] = startTagHashCode;
        tagNameStartIndexStack[tagHashCodeStackCursor] = startIndex;
        tagNameEndIndexStack[tagHashCodeStackCursor] = endIndex;
        contextStack[tagHashCodeStackCursor] = foreignContext !== undefined ? foreignContext : context;

        switchContext(contextStack[tagHashCodeStackCursor]);

        isStartTagOpened = true;
        break;
      }

      case TOKEN_START_TAG_CLOSING:
        isStartTagOpened = false;

        callback(TOKEN_START_TAG_CLOSING, startIndex, endIndex);

        if (voidTagSet !== undefined && voidTagSet.has(tagHashCodeStack[tagHashCodeStackCursor])) {
          callback(TOKEN_END_TAG_NAME, endIndex, endIndex);
          popTag();
        }
        break;

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
          // Correctly closed parent tag
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
          if (!areUnbalancedStartTagsImplicitlyClosed && startTagIndex !== tagHashCodeStackCursor) {
            throw new ParserError('Expected an end tag.', input, endTagStartIndex);
          }

          // Insert unbalanced end tags before the opened start tag
          while (startTagIndex < tagHashCodeStackCursor) {
            callback(TOKEN_END_TAG_NAME, endTagStartIndex, endTagStartIndex);
            popTag();
          }

          callback(TOKEN_END_TAG_NAME, startIndex, endIndex);
          popTag();
          break;
        }

        if (implicitlyOpenedTagSet === undefined || !implicitlyOpenedTagSet.has(endTagHashCode)) {
          if (!areUnbalancedEndTagsIgnored) {
            throw new ParserError('Unexpected end tag.', input, startIndex, endIndex);
          }
          break;
        }

        if (implicitlyClosedTagMap !== undefined) {
          insertImplicitEndTags(implicitlyClosedTagMap.get(endTagHashCode), endTagStartIndex);
        }

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

  readTokens(input, tokenCallback, readerOptions);

  if (tagHashCodeStackCursor !== -1 && !areUnbalancedStartTagsImplicitlyClosed) {
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
 * Options of {@link readTokens}.
 *
 * @internal
 */
export interface TokenReaderOptions extends ContextualTokenReaderOptions {
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
  areTagNamesEqual?: (
    input: string,
    startIndex1: number,
    endIndex1: number,
    startIndex2: number,
    endIndex2: number
  ) => boolean;

  /**
   * Hash codes of {@link TokenizerOptions.rawTextTags}.
   */
  rawTextTagSet?: Set<number>;

  /**
   * Hash codes of {@link TokenizerOptions.escapableRawTextTags}.
   */
  escapableRawTextTagSet?: Set<number>;

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
 * Contextual options are read from the options object on every use, so the callback can change them.
 *
 * @param input The text to read tokens from.
 * @param callback The callback that is invoked when a token is read.
 * @param options Token reader options.
 * @throws {@link ParserError} If {@link TokenReaderOptions.isStrict} is `true` and input is malformed.
 * @internal
 */
export function readTokens(input: string, callback: TokenCallback, options: TokenReaderOptions = {}): void {
  const {
    getTagHashCode = getCaseSensitiveHashCode,
    areTagNamesEqual = areCaseSensitiveSubstringsEqual,
    rawTextTagSet,
    escapableRawTextTagSet,
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

  for (let index = textStartIndex, nextIndex = index; index < inputLength; index = nextIndex) {
    let charCode = input.charCodeAt(index);

    if (scope === SCOPE_START_TAG) {
      // ----------------------------------------------------------
      // Self-closing start tag
      // ----------------------------------------------------------

      if (
        options.areSelfClosingTagsRecognized &&
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
        nextIndex = skipUntilTagOpening(input, nextIndex);
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
            (options.areSelfClosingTagsRecognized ? ", a self-closing start tag ('/>')," : '') +
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

        callback(
          TOKEN_ATTRIBUTE_VALUE,
          nextIndex,
          (nextIndex = skipChars(input, nextIndex, isUnquotedAttributeValueChar))
        );

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

    if (options.areProcessingInstructionsRecognized && enclosingRawTextTagHashCode === 0 && charCode === /* ? */ 63) {
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
      options.areCDATASectionsRecognized &&
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
      getCharCodeAt(input, nextIndex + 1) === /* - */ 45 &&
      getCharCodeAt(input, nextIndex + 2) === /* - */ 45
    ) {
      if (textStartIndex !== index) {
        scope = SCOPE_TEXT;
        callback(TOKEN_TEXT, textStartIndex, index);
      }

      // Skip "!--"
      nextIndex += 3;

      const commentEndIndex = getIndexOfOrLength(input, '-->', nextIndex);

      if (isStrict && commentEndIndex === inputLength) {
        throw new ParserError("Expected the comment to be closed with '-->'.", input, index, inputLength);
      }

      callback(TOKEN_COMMENT, nextIndex, (nextIndex = commentEndIndex));

      // Skip "-->"
      textStartIndex = nextIndex += 3;

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
                (options.areCDATASectionsRecognized ? ", or a CDATA section ('<![CDATA[[')" : '') +
                '.',
          input,
          nextIndex - 1,
          nextIndex + 1
        );
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
    // End of prolog
    // ----------------------------------------------------------

    scope = SCOPE_TEXT;

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

        nextIndex = skipUntilTagOpening(input, nextIndex);
        continue;
      }

      // Doesn't match the current raw text tag
      if (
        enclosingRawTextTagHashCode !== 0 &&
        (enclosingRawTextTagHashCode !== getTagHashCode(input, tagNameStartIndex, nextIndex) ||
          !areTagNamesEqual(
            input,
            enclosingRawTextTagNameStartIndex,
            enclosingRawTextTagNameEndIndex,
            tagNameStartIndex,
            nextIndex
          ))
      ) {
        nextIndex = skipUntilTagOpening(input, nextIndex);
        continue;
      }

      if (textStartIndex !== index) {
        callback(TOKEN_TEXT, textStartIndex, index);
      }

      callback(TOKEN_END_TAG_NAME, tagNameStartIndex, nextIndex);

      // Close the raw text tag
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

      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    if (textStartIndex !== index) {
      callback(TOKEN_TEXT, textStartIndex, index);
    }

    if (rawTextTagSet !== undefined || escapableRawTextTagSet !== undefined) {
      const startTagHashCode = getTagHashCode(input, tagNameStartIndex, nextIndex);

      if (
        (rawTextTagSet !== undefined && rawTextTagSet.has(startTagHashCode)) ||
        (escapableRawTextTagSet !== undefined && escapableRawTextTagSet.has(startTagHashCode))
      ) {
        // Start of the raw text tag
        enclosingRawTextTagHashCode = startTagHashCode;
        enclosingRawTextTagNameStartIndex = tagNameStartIndex;
        enclosingRawTextTagNameEndIndex = nextIndex;
      }
    }

    callback(TOKEN_START_TAG_NAME, tagNameStartIndex, nextIndex);

    scope = SCOPE_START_TAG;
    textStartIndex = nextIndex = skipSpaces(input, nextIndex);
  }

  // The input may end inside a start tag, after an attribute without a value
  if (scope !== SCOPE_START_TAG && textStartIndex < inputLength) {
    callback(TOKEN_TEXT, textStartIndex, inputLength);
  }
}

/**
 * Returns case-insensitive djb2 hash of a substring.
 */
export function getCaseInsensitiveHashCode(input: string, startIndex: number, endIndex: number): number {
  let hashCode = 5_381;

  for (let i = startIndex; i < endIndex; ++i) {
    const charCode = input.charCodeAt(i);
    hashCode = (hashCode << 5) + hashCode + (charCode < 65 || charCode > 90 ? charCode : charCode + 32);
  }

  return hashCode;
}

/**
 * Returns case-sensitive djb2 hash of a substring.
 */
export function getCaseSensitiveHashCode(input: string, startIndex: number, endIndex: number): number {
  let hashCode = 5_381;

  for (let i = startIndex; i < endIndex; ++i) {
    hashCode = (hashCode << 5) + hashCode + input.charCodeAt(i);
  }

  return hashCode;
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

function getCaseInsensitiveCharCodeAt(input: string, index: number): number {
  return toLowerCaseCharCode(getCharCodeAt(input, index));
}

function toLowerCaseCharCode(charCode: number): number {
  return charCode < /* A */ 65 || charCode > /* Z */ 90 ? charCode : charCode + 32;
}

/**
 * Returns `true` if case-insensitive "!DOCTYPE" starts at index.
 */
function isDoctypeSectionOpening(input: string, index: number): boolean {
  return (
    getCharCodeAt(input, index) === /* ! */ 33 &&
    getCaseInsensitiveCharCodeAt(input, index + 1) === /* d */ 100 &&
    getCaseInsensitiveCharCodeAt(input, index + 2) === /* o */ 111 &&
    getCaseInsensitiveCharCodeAt(input, index + 3) === /* c */ 99 &&
    getCaseInsensitiveCharCodeAt(input, index + 4) === /* t */ 116 &&
    getCaseInsensitiveCharCodeAt(input, index + 5) === /* y */ 121 &&
    getCaseInsensitiveCharCodeAt(input, index + 6) === /* p */ 112 &&
    getCaseInsensitiveCharCodeAt(input, index + 7) === /* e */ 101
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
    getCharCodeAt(input, index) === /* ! */ 33 &&
    getCharCodeAt(input, index + 1) === /* [ */ 91 &&
    getCaseInsensitiveCharCodeAt(input, index + 2) === /* c */ 99 &&
    getCaseInsensitiveCharCodeAt(input, index + 3) === /* d */ 100 &&
    getCaseInsensitiveCharCodeAt(input, index + 4) === /* a */ 97 &&
    getCaseInsensitiveCharCodeAt(input, index + 5) === /* t */ 116 &&
    getCaseInsensitiveCharCodeAt(input, index + 6) === /* a */ 97 &&
    getCharCodeAt(input, index + 7) === /* [ */ 91
  );
}

/**
 * Skips chars until they match a predicate.
 */
function skipChars(input: string, index: number, predicate: (charCode: number) => boolean): number {
  while (index < input.length && predicate(input.charCodeAt(index))) {
    ++index;
  }
  return index;
}

/**
 * Skips whitespace chars.
 */
function skipSpaces(input: string, index: number): number {
  return skipChars(input, index, isSpaceChar);
}

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

// https://www.w3.org/TR/xml/#NT-Name
function skipXMLName(input: string, index: number): number {
  return isXMLNameStartChar(getCharCodeAt(input, index)) ? skipChars(input, index + 1, isXMLNameChar) : index;
}

function skipHTMLName(input: string, index: number): number {
  return isXMLNameStartChar(getCharCodeAt(input, index)) ? skipChars(input, index + 1, isHTMLNameChar) : index;
}

function skipHTMLAttributeName(input: string, index: number): number {
  return skipChars(input, index, isHTMLAttributeNameChar);
}

function getIndexOfOrLength(input: string, searchString: string, index: number): number {
  index = input.indexOf(searchString, index);

  return index !== -1 ? index : input.length;
}

function skipUntilTagOpening(input: string, index: number): number {
  return getIndexOfOrLength(input, '<', index);
}

function skipUntilTagClosing(input: string, index: number): number {
  return getIndexOfOrLength(input, '>', index);
}
