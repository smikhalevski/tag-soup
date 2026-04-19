/**
 * The error thrown by a parser if a {@link ParserError.input input} is malformed.
 *
 * @group Parser
 */
export class ParserError extends SyntaxError {
  /**
   * Creates a new {@link ParserError} instance.
   *
   * @param message The error message.
   * @param input The text where an error was detected.
   * @param startIndex The index of the first char in text where an error was detected, inclusive.
   * @param endIndex The index of the last char in text where an error was detected, exclusive.
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
 * A token that can be read from a text.
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
 * A callback that is invoked when a token is read from a text.
 *
 * @param token The token that was read.
 * @param startIndex The start index of the first meaningful token char, inclusive.
 * @param endIndex The end index of the last meaningful token char, exclusive.
 * @group Tokenizer
 */
export type TokenCallback = (token: Token, startIndex: number, endIndex: number) => void;

/**
 * Options of {@link tokenizeMarkup}.
 */
export interface ResolvedTokenizerOptions extends TokenReaderOptions {
  voidTags?: Set<number>;
  implicitlyClosedTags?: Map<number, Set<number>>;
  implicitlyOpenedTags?: Set<number>;
  areUnbalancedStartTagsImplicitlyClosed?: boolean;
  areUnbalancedEndTagsIgnored?: boolean;
}

/**
 * Reads tokens from text and returns them by invoking a callback.
 *
 * Tokens are _guaranteed_ to be returned in correct order. Missing tokens are inserted to restore the correct order if
 * needed.
 *
 * @example
 * tokenizeMarkup(
 *   'Hello, <b>Bob</b>!',
 *   (token, startIndex, endIndex) => {
 *     // Handle token here
 *   },
 *   resolveTokenizerOptions(htmlTokenizerOptions)
 * );
 *
 * @param input The text to read tokens from.
 * @param callback The callback that is invoked when a token is read.
 * @param options Tokenizer options prepared by {@link resolveTokenizerOptions}.
 */
export function tokenizeMarkup(input: string, callback: TokenCallback, options: ResolvedTokenizerOptions = {}): void {
  const {
    readTag = getCaseSensitiveHashCode,
    voidTags,
    implicitlyClosedTags,
    implicitlyOpenedTags,
    areUnbalancedStartTagsImplicitlyClosed = false,
    areUnbalancedEndTagsIgnored = false,
  } = options;

  const tagStack = [0, 0, 0, 0, 0, 0, 0, 0];

  let tagStackCursor = -1;

  const tokenCallback: TokenCallback = (token, startIndex, endIndex) => {
    switch (token) {
      case TOKEN_START_TAG_NAME:
        const startTag = readTag(input, startIndex, endIndex);

        if (implicitlyClosedTags !== undefined) {
          tagStackCursor = insertEndTags(
            implicitlyClosedTags.get(startTag),
            tagStack,
            tagStackCursor,
            callback,
            startIndex - 1
          );
        }

        callback(TOKEN_START_TAG_NAME, startIndex, endIndex);
        tagStack[++tagStackCursor] = startTag;
        break;

      case TOKEN_START_TAG_CLOSING:
        callback(TOKEN_START_TAG_CLOSING, startIndex, endIndex);

        if (voidTags !== undefined && voidTags.has(tagStack[tagStackCursor])) {
          callback(TOKEN_END_TAG_NAME, endIndex, endIndex);
          --tagStackCursor;
        }
        break;

      case TOKEN_START_TAG_SELF_CLOSING:
        callback(TOKEN_START_TAG_SELF_CLOSING, startIndex, endIndex);
        --tagStackCursor;
        break;

      case TOKEN_END_TAG_NAME:
        const endTag = readTag(input, startIndex, endIndex);

        if (tagStackCursor !== -1 && tagStack[tagStackCursor] === endTag) {
          // Correctly closed parent tag
          callback(TOKEN_END_TAG_NAME, startIndex, endIndex);
          --tagStackCursor;
          break;
        }

        // Include "</"
        const endTagStartIndex = startIndex - 2;

        const startTagIndex = tagStackCursor !== -1 ? tagStack.lastIndexOf(endTag, tagStackCursor) : -1;

        // Found a start tag
        if (startTagIndex !== -1) {
          if (!areUnbalancedStartTagsImplicitlyClosed && startTagIndex !== tagStackCursor) {
            throw new ParserError('Expected an end tag.', input, endTagStartIndex);
          }

          // Insert unbalanced end tags before the opened start tag
          while (startTagIndex < tagStackCursor) {
            callback(TOKEN_END_TAG_NAME, endTagStartIndex, endTagStartIndex);
            --tagStackCursor;
          }

          callback(TOKEN_END_TAG_NAME, startIndex, endIndex);
          --tagStackCursor;
          break;
        }

        if (implicitlyOpenedTags === undefined || !implicitlyOpenedTags.has(endTag)) {
          if (!areUnbalancedEndTagsIgnored) {
            throw new ParserError('Unexpected end tag.', input, startIndex, endIndex);
          }
          break;
        }

        if (implicitlyClosedTags !== undefined) {
          tagStackCursor = insertEndTags(
            implicitlyClosedTags.get(endTag),
            tagStack,
            tagStackCursor,
            callback,
            endTagStartIndex
          );
        }

        callback(TOKEN_START_TAG_NAME, startIndex, endIndex);
        callback(TOKEN_START_TAG_CLOSING, endIndex, endIndex + 1);
        callback(TOKEN_END_TAG_NAME, startIndex, endIndex);
        break;

      default:
        callback(token, startIndex, endIndex);
        break;
    }
  };

  readTokens(input, tokenCallback, options);

  if (tagStackCursor !== -1 && !areUnbalancedStartTagsImplicitlyClosed) {
    throw new ParserError('Unexpected end of the document.', input, input.length);
  }

  while (tagStackCursor-- !== -1) {
    callback(TOKEN_END_TAG_NAME, input.length, input.length);
  }
}

function insertEndTags(
  tagsToClose: Set<number> | undefined,
  tagStack: number[],
  tagStackCursor: number,
  callback: TokenCallback,
  insertionIndex: number
): number {
  if (tagsToClose === undefined) {
    return tagStackCursor;
  }

  let index = 0;

  while (index <= tagStackCursor && !tagsToClose.has(tagStack[index])) {
    ++index;
  }

  while (index <= tagStackCursor) {
    callback(TOKEN_END_TAG_NAME, insertionIndex, insertionIndex);
    --tagStackCursor;
  }

  return tagStackCursor;
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

export interface ContextualTokenReaderOptions {
  parentOptions?: ContextualTokenReaderOptions;
  foreignTags?: Map<number, ContextualTokenReaderOptions>;
  areSelfClosingTagsRecognized?: boolean;
  areCDATASectionsRecognized?: boolean;
  areProcessingInstructionsRecognized?: boolean;
}

export interface TokenReaderOptions extends ContextualTokenReaderOptions {
  readTag?: (input: string, startIndex: number, endIndex: number) => number;
  rawTextTags?: Set<number>;
  isFragment?: boolean;
  isStrict?: boolean;
}

/**
 * Reads tokens from the text and returns tokens by invoking a callback.
 *
 * Tokens returned in the same order they are listed in text.
 */
export function readTokens(input: string, callback: TokenCallback, options: TokenReaderOptions = {}): void {
  const { readTag = getCaseSensitiveHashCode, rawTextTags, isFragment, isStrict = false } = options;

  let scope = isFragment ? SCOPE_TEXT : SCOPE_PROLOGUE;
  let textStartIndex = isFragment ? 0 : skipSpaces(input, 0);

  const inputLength = input.length;

  const skipName = isStrict ? skipXMLName : skipHTMLName;
  const skipAttributeName = isStrict ? skipXMLName : skipHTMLAttributeName;

  const foreignTagStack = [0, 0, 0, 0];

  let foreignTagStackCursor = -1;

  let enclosingRawTextTag = 0;

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

      if (isStrict && quoteCharCode !== /* " */ 34) {
        throw new ParserError("Expected a double-quoted attribute value ('\"').", input, nextIndex, nextIndex + 1);
      }

      // ----------------------------------------------------------
      // Unquoted attribute value
      // ----------------------------------------------------------

      if (quoteCharCode !== /* " */ 34 && quoteCharCode !== /* ' */ 39) {
        callback(TOKEN_ATTRIBUTE_VALUE, nextIndex, (nextIndex = skipChars(input, nextIndex, isHTMLAttributeNameChar)));

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
          "Expected the attribute value to be closed with a double-quote ('\"').",
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

    if (options.areProcessingInstructionsRecognized && enclosingRawTextTag === 0 && charCode === /* ? */ 63) {
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

      callback(TOKEN_PROCESSING_INSTRUCTION_DATA, nextIndex, (nextIndex = getIndexOfOrLength(input, '?>', nextIndex)));

      // Skip "?>"
      nextIndex += 2;

      textStartIndex = nextIndex =
        scope == SCOPE_PROLOGUE ? skipSpaces(input, nextIndex) : skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // DOCTYPE
    // ----------------------------------------------------------

    if (
      scope === SCOPE_PROLOGUE &&
      enclosingRawTextTag === 0 &&
      charCode === /* ! */ 33 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 1) === /* d */ 100 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 2) === /* o */ 111 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 3) === /* c */ 99 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 4) === /* t */ 116 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 5) === /* y */ 121 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 6) === /* p */ 112 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 7) === /* e */ 101
    ) {
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
      enclosingRawTextTag === 0 &&
      getCharCodeAt(input, nextIndex + 1) === /* [ */ 91 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 2) === /* c */ 99 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 3) === /* d */ 100 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 4) === /* a */ 97 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 5) === /* t */ 116 &&
      getCaseInsensitiveCharCodeAt(input, nextIndex + 6) === /* a */ 97 &&
      getCharCodeAt(input, nextIndex + 7) === /* [ */ 91
    ) {
      if (textStartIndex !== index) {
        callback(TOKEN_TEXT, textStartIndex, index);
      }

      // Skip "![CDATA["
      nextIndex += 8;

      callback(TOKEN_CDATA_SECTION, nextIndex, (nextIndex = getIndexOfOrLength(input, ']]>', nextIndex)));

      scope = SCOPE_TEXT;
      textStartIndex = nextIndex += 3;
      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // Comment
    // ----------------------------------------------------------

    if (
      enclosingRawTextTag === 0 &&
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

      callback(TOKEN_COMMENT, nextIndex, (nextIndex = getIndexOfOrLength(input, '-->', nextIndex)));

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

    if (enclosingRawTextTag === 0 && (charCode === /* ? */ 63 || charCode === /* ! */ 33)) {
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
          new ParserError('Expected a name for the end tag.', input, tagNameStartIndex, tagNameStartIndex + 1);
        }

        nextIndex = skipUntilTagOpening(input, nextIndex);
        continue;
      }

      // Doesn't match the current raw text tag
      if (enclosingRawTextTag !== 0 && enclosingRawTextTag !== readTag(input, tagNameStartIndex, nextIndex)) {
        nextIndex = skipUntilTagOpening(input, nextIndex);
        continue;
      }

      if (textStartIndex !== index) {
        callback(TOKEN_TEXT, textStartIndex, index);
      }

      let nextForeignTagStackCursor = -1;

      if (
        enclosingRawTextTag === 0 &&
        foreignTagStackCursor !== -1 &&
        (nextForeignTagStackCursor = foreignTagStack.lastIndexOf(
          readTag(input, tagNameStartIndex, nextIndex),
          foreignTagStackCursor
        )) !== -1
      ) {
        // Pop foreign tags off the stack
        while (foreignTagStackCursor !== nextForeignTagStackCursor - 1) {
          --foreignTagStackCursor;
          options = options.parentOptions!;
        }
      }

      callback(TOKEN_END_TAG_NAME, tagNameStartIndex, nextIndex);

      // Close the raw text tag
      enclosingRawTextTag = 0;

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
    if (enclosingRawTextTag !== 0) {
      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    const tagNameStartIndex = nextIndex;

    nextIndex = skipName(input, nextIndex);

    // No tag name
    if (tagNameStartIndex === nextIndex) {
      if (isStrict) {
        new ParserError('Expected a name for the start tag.', input, tagNameStartIndex, tagNameStartIndex + 1);
      }

      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    if (textStartIndex !== index) {
      callback(TOKEN_TEXT, textStartIndex, index);
    }

    enclosingRawTextTag = 0;

    let startTag;
    let nextOptions;

    if (rawTextTags !== undefined && rawTextTags.has((startTag = readTag(input, tagNameStartIndex, nextIndex)))) {
      // Start of the raw text tag
      enclosingRawTextTag = startTag;
    }

    if (
      enclosingRawTextTag === 0 &&
      options.foreignTags !== undefined &&
      (nextOptions = options.foreignTags.get(
        (startTag = startTag !== undefined ? startTag : readTag(input, tagNameStartIndex, nextIndex))
      )) !== undefined
    ) {
      // Start of the foreign tag
      foreignTagStack[++foreignTagStackCursor] = startTag;

      options = nextOptions;
    }

    callback(TOKEN_START_TAG_NAME, tagNameStartIndex, nextIndex);

    scope = SCOPE_START_TAG;
    textStartIndex = nextIndex = skipSpaces(input, nextIndex);
  }

  if (textStartIndex < inputLength) {
    callback(TOKEN_TEXT, textStartIndex, inputLength);
  }
}

/**
 * Returns case-insensitive djb2 hash of a substring.
 */
export function getCaseInsensitiveHashCode(input: string, startIndex: number, endIndex: number): number {
  let hashCode = 0;

  for (let i = startIndex; i < endIndex; ++i) {
    const charCode = input.charCodeAt(i);
    hashCode = (hashCode << 5) - hashCode + (charCode < 65 || charCode > 90 ? charCode : charCode + 32);
  }

  return hashCode;
}

/**
 * Returns case-sensitive djb2 hash of a substring.
 */
export function getCaseSensitiveHashCode(input: string, startIndex: number, endIndex: number): number {
  let hashCode = 0;

  for (let i = startIndex; i < endIndex; ++i) {
    hashCode = (hashCode << 5) - hashCode + input.charCodeAt(i);
  }

  return hashCode;
}

function getCharCodeAt(input: string, index: number): number {
  return index < input.length ? input.charCodeAt(index) : -1;
}

function getCaseInsensitiveCharCodeAt(input: string, index: number): number {
  const charCode = getCharCodeAt(input, index);

  return charCode < 65 || charCode > 90 ? charCode : charCode + 32;
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
