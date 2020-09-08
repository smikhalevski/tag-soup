import {allCharBy, char, charBy, CharCodeChecker, seq, substr, untilCharBy, untilSubstr} from './dsl-utils';
import {CharCode} from './CharCode';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {Maybe, Rewriter} from './shared-types';
import {ContentMode} from './ContentMode';

export interface Attribute {

  /**
   * The rewritten name of the attribute.
   */
  name: string;

  /**
   * The decoded value of the attribute. If attribute didn't have a value then an empty string.
   */
  value: string;
  start: number;
  end: number;
}

export type StartTagCallback = (tagName: string, attrs: Array<Attribute>, selfClosing: boolean, tagType: ContentMode, start: number, end: number) => void;

export type EndTagCallback = (tagName: string, start: number, end: number) => void;

export type DataCallback = (data: string, start: number, end: number) => void;

export interface SaxParserDialectOptions {

  /**
   * If set to `true` then CDATA sections and processing instructions are recognized, self-closing tags are enabled and
   * tag names are case-sensitive. Otherwise, CDATA sections and processing instructions are emitted as comments,
   * self-closing tags are treated as start tags and tag names are case-insensitive.
   *
   * @default false
   */
  xmlEnabled?: boolean;

  /**
   * Receives attribute value and returns string with decoded entities. By default, only XML entities are decoded.
   */
  decodeAttr?: Rewriter;

  /**
   * Receives text node value and returns string with decoded entities. By default, only XML entities are decoded.
   */
  decodeText?: Rewriter;

  /**
   * Rewrites tag name. By default, in XML mode tags are not rewritten while in non-XML mode tags are converted to
   * lower case.
   */
  renameTag?: Rewriter;

  /**
   * Rewrites attribute name. By default there's no rewriting.
   */
  renameAttr?: Rewriter;

  /**
   * Enables self-closing tags recognition. In XML mode this is always enabled.
   */
  selfClosingEnabled?: boolean;

  /**
   * Returns mode that defines how content of the tag is interpreted. If omitted then all tags are considered to have
   * {@link ContentMode.FLOW} which has no constraints.
   *
   * @param tagName The tag name, rewritten with {@link renameTag}.
   * @returns The content mode for the tag with `tagName`.
   */
  getContentMode?: (tagName: string) => Maybe<ContentMode>;
}

export interface SaxParserCallbacks {
  onStartTag?: StartTagCallback;
  onEndTag?: EndTagCallback;
  onText?: DataCallback;
  onComment?: DataCallback;
  onProcessingInstruction?: DataCallback;
  onCdataSection?: DataCallback;
  onDocumentType?: DataCallback;
}

export interface SaxParserOptions extends SaxParserDialectOptions, SaxParserCallbacks {
}

export interface SaxParser {

  resetStream(): void;

  writeStream(str: string): void;

  commit(str?: string): void;
}

/**
 * Creates a streaming SAX parser that emits tags as is.
 */
export function createSaxParser(options: SaxParserOptions): SaxParser {
  let tail = '';
  let offset = 0;

  return {
    resetStream() {
      tail = '';
      offset = 0;
    },
    writeStream(str) {
      tail += str;
      const l = parseSax(tail, true, offset, options);
      tail = tail.substr(l);
      offset += l;
    },
    commit(str = '') {
      parseSax(tail + str, false, offset, options);
      tail = '';
      offset = 0;
    },
  };
}

// https://www.w3.org/TR/xml/#NT-S
const isSpaceChar: CharCodeChecker = (c) => c === 0x20 || c === 0x09 || c === 0xD || c === 0xA;

// https://www.w3.org/TR/xml/#NT-NameStartChar
const isTagNameStartChar: CharCodeChecker = (c) => (
    c >= 97 && c <= 122 // a-z
    || c >= 65 && c <= 90 // A-Z
    || c === 95 // "_"
    || c === 58 // ":"
    || c >= 0xc0 && c <= 0xd6
    || c >= 0xd8 && c <= 0xf6
    || c >= 0xf8 && c <= 0x2ff
    || c >= 0x370 && c <= 0x37d
    || c >= 0x37f && c <= 0x1fff
    || c >= 0x200c && c <= 0x200d
    || c >= 0x2070 && c <= 0x218f
    || c >= 0x2c00 && c <= 0x2fef
    || c >= 0x3001 && c <= 0xd7ff
    || c >= 0xf900 && c <= 0xfdcf
    || c >= 0xfdf0 && c <= 0xfffd
    || c >= 0x10000 && c <= 0xeffff
);

/**
 * Check if char should be treated as a whitespace inside tag.
 */
const isTagSpaceChar: CharCodeChecker = (c) => isSpaceChar(c) || c === CharCode.SLASH;

const isNotTagNameChar: CharCodeChecker = (c) => isSpaceChar(c) || c === CharCode.SLASH || c === CharCode.GT;

const isNotAttrNameChar: CharCodeChecker = (c) => isSpaceChar(c) || c === CharCode.SLASH || c === CharCode.GT || c === CharCode.EQ;

const isNotUnquotedValueChar: CharCodeChecker = (c) => isSpaceChar(c) || c === CharCode.GT;

const takeText = untilSubstr('<', false, false);

const takeUntilGt = untilSubstr('>', true, false);

const takeTagNameStartChar = charBy(isTagNameStartChar);
const takeTagNameChars = untilCharBy(isNotTagNameChar, false, true);

// <okay
const takeStartTagOpening = seq(char(CharCode.LT), takeTagNameStartChar, takeTagNameChars);

// </okay
const takeEndTagOpening = seq(substr('</'), takeTagNameStartChar, takeTagNameChars);

const takeTagSpace = allCharBy(isTagSpaceChar);

const takeAttrName = untilCharBy(isNotAttrNameChar, false, true);

const takeSpace = allCharBy(isSpaceChar);

// =
const takeEq = seq(takeSpace, char(CharCode.EQ), takeSpace);

// "okay"
const takeQuotValue = seq(char(CharCode.QUOT), untilSubstr('"', true, true));

// 'okay'
const takeAposValue = seq(char(CharCode.APOS), untilSubstr("'", true, true));

// okay
const takeUnquotedValue = untilCharBy(isNotUnquotedValueChar, false, true);

// <!--okay-->
const takeComment = seq(substr('<!--'), untilSubstr('-->', true, true));

// <!okay>
const takeWeirdComment = seq(substr('<!'), untilSubstr('>', true, true));

// <?okay?>
const takeProcessingInstruction = seq(substr('<?'), untilSubstr('?>', true, true));

// <![CDATA[okay]]>
const takeCdataSection = seq(substr('<![CDATA['), untilSubstr(']]>', true, true));

// <!DOCTYPE html>
const takeDocumentType = seq(substr('<!DOCTYPE', true), untilSubstr('>', true, true));

/**
 * Parses attributes from string starting from given position.
 *
 * @param str The string to read attributes from.
 * @param i The initial index where attributes' definitions are expected to start.
 * @param attrs An array to which {@link Attribute} objects are added.
 * @param decode The decoder of HTML/XML entities.
 * @param rename The callback that receives an attribute name and returns a new name.
 */
export function parseAttrs(str: string, i: number, attrs: Array<Attribute>, decode: Rewriter, rename: Rewriter): number {
  const charCount = str.length;

  while (i < charCount) {

    let value = '';
    let start = takeTagSpace(str, i);
    let k = start;
    let j = takeAttrName(str, k);

    // No attribute available
    if (j === k) {
      break;
    }

    const name = rename(str.substring(k, j));

    k = j;
    j = takeEq(str, k);

    // Equals sign presents, so there may be a value
    if (j !== -1) {
      k = j;

      // Quoted value
      j = takeQuotValue(str, k);
      if (j === -1) {
        j = takeAposValue(str, k);
      }
      if (j !== -1) {
        value = decode(str.substring(k + 1, j - 1));
        k = Math.min(j, charCount);
      } else {

        // Unquoted value
        j = takeUnquotedValue(str, k);
        if (j !== k) {
          value = decode(str.substring(k, j));
          k = j;
        }
      }
    }

    attrs.push({name, value, start, end: k});

    i = k;
  }
  return i;
}

// Default decoder used by SAX parser
const xmlDecoder = createEntitiesDecoder();

function lowerCase(str: string): string {
  return str.toLowerCase();
}

export function identity<T>(value: T): T {
  return value;
}

export function parseSax(str: string, streaming: boolean, offset: number, options: SaxParserOptions): number {
  const {
    xmlEnabled = false,
    decodeAttr = xmlDecoder,
    decodeText = xmlDecoder,
    renameTag = xmlEnabled ? identity : lowerCase,
    renameAttr = xmlEnabled ? identity : lowerCase,
    selfClosingEnabled = false,
    getContentMode,

    onStartTag,
    onEndTag,
    onText,
    onComment,
    onProcessingInstruction,
    onCdataSection,
    onDocumentType,
  } = options;

  let textStart = -1;
  let textEnd = -1;
  let startTagMode: number = ContentMode.FLOW;
  let startTagName: string | undefined;

  // Emits text chunk if any
  const emitText = () => {
    if (textStart !== -1) {
      onText?.(decodeText(str.substring(textStart, textEnd)), offset + textStart, offset + textEnd);
      textStart = textEnd = -1;
    }
  };

  const emitData = (cb: DataCallback | undefined, i: number, j: number, di: number, dj: number): number => {
    emitText();

    const k = j > charCount ? charCount : j;
    cb?.(str.substring(i + di, j - dj), offset + i, offset + k);
    return k;
  };

  const charCount = str.length;

  let i = 0;
  let j;

  while (i < charCount) {

    // Text
    if (textStart === -1) {
      let k = takeText(str, i);

      if (k === -1 && (k = charCount) && streaming) {
        break;
      }
      if (k !== i) {
        textStart = i;
        textEnd = i = k;
        continue;
      }
    }

    if (startTagMode !== ContentMode.TEXT) {

      // Start tag
      j = takeStartTagOpening(str, i);
      if (j !== -1) {
        const tagName = renameTag(str.substring(i + 1, j));
        const tagMode = getContentMode?.(tagName) || ContentMode.FLOW;

        const attrs: Array<Attribute> = [];
        j = parseAttrs(str, j, attrs, decodeAttr, renameAttr);

        // Skip malformed content and excessive whitespaces
        const k = takeUntilGt(str, j);

        if (k === -1) {
          // Unterminated start tag
          return i;
        }

        const selfClosing = (xmlEnabled || selfClosingEnabled) && k - j >= 2 && str.charCodeAt(k - 2) === CharCode.SLASH;

        emitText();
        onStartTag?.(tagName, attrs, selfClosing, tagMode, offset + i, offset + k);

        if (!selfClosing) {
          startTagName = tagName;
          startTagMode = tagMode;
        }

        i = k;
        continue;
      }
    }

    // End tag
    j = takeEndTagOpening(str, i);
    if (j !== -1) {
      const tagName = renameTag(str.substring(i + 2, j));

      if (startTagMode !== ContentMode.TEXT || startTagName === tagName) {

        // Skip malformed content and excessive whitespaces
        const k = takeUntilGt(str, j);

        if (k === -1) {
          // Unterminated end tag
          return i;
        }

        emitText();
        onEndTag?.(tagName, offset + i, offset + k);

        i = k;
        continue;
      }
    }

    if (startTagMode !== ContentMode.TEXT) {
      let k;

      // Comment
      k = j = takeComment(str, i);
      if (j !== -1) {
        if (j > charCount && streaming) {
          return i;
        }
        i = emitData(onComment, i, j, 4, 3);
        continue;
      }

      // Doctype
      k = j = takeDocumentType(str, i);
      if (j !== -1) {
        if (j > charCount && streaming) {
          return i;
        }
        i = emitData(onDocumentType, i, j, 9, 1);
        continue;
      }

      // CDATA section
      j = takeCdataSection(str, i);
      if (j !== -1) {
        if (j > charCount && streaming) {
          return i;
        }
        i = xmlEnabled ? emitData(onCdataSection, i, j, 9, 3) : emitData(onComment, i, j, 2, 1);
        continue;
      }

      // Processing instruction
      j = takeProcessingInstruction(str, i);
      if (j !== -1) {
        if (j > charCount && streaming) {
          return i;
        }
        i = xmlEnabled ? emitData(onProcessingInstruction, i, j, 2, 2) : emitData(onComment, i, j, 1, 1);
        continue;
      }

      // Weird comments
      if (!xmlEnabled) {
        j = takeWeirdComment(str, i);
        if (j !== -1) {
          if (j > charCount && streaming) {
            return i;
          }
          i = emitData(onComment, i, j, 2, 1);
          continue;
        }
      }
    }

    // Concat with existing text
    if (textStart === -1) {
      textStart = i;
    }
    textEnd = takeText(str, i + 1);

    if (textEnd === -1) {
      textEnd = charCount;
      break;
    }
    i = textEnd;
  }

  if (streaming) {
    if (textStart !== -1) {
      return textStart;
    }
    return i;
  }

  emitText();
  return i;
}
