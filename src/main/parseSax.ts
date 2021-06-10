import {allCharBy, char, charBy, CharCodeChecker, seq, text, untilCharBy, untilText} from 'tokenizer-dsl';
import {CharCode, clearPrototype, Mutable, Rewriter} from './parser-utils';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {DataCallback, IAttribute, ISaxParserOptions} from './createSaxParser';

// https://www.w3.org/TR/xml/#NT-S
const isSpaceChar: CharCodeChecker = (c) =>
    c === 0x20
    || c === CharCode['\t']
    || c === CharCode['\r']
    || c === CharCode['\n'];

// https://www.w3.org/TR/xml/#NT-NameStartChar
const isTagNameStartChar: CharCodeChecker = (c) =>
    c >= CharCode['a'] && c <= CharCode['z']
    || c >= CharCode['A'] && c <= CharCode['Z']
    || c === CharCode['_']
    || c === CharCode[':']
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
    || c >= 0x10000 && c <= 0xeffff;

/**
 * Check if char should be treated as a whitespace inside tag.
 */
const isTagSpaceChar: CharCodeChecker = (c) => isSpaceChar(c) || c === CharCode['/'];

const isNotTagNameChar: CharCodeChecker = (c) => isSpaceChar(c) || c === CharCode['/'] || c === CharCode['>'];

const isNotAttrNameChar: CharCodeChecker = (c) => isSpaceChar(c) || c === CharCode['/'] || c === CharCode['>'] || c === CharCode['='];

const isNotUnquotedValueChar: CharCodeChecker = (c) => isSpaceChar(c) || c === CharCode['>'];

const takeText = untilText('<', false, false);

const takeUntilGt = untilText('>', true, false);

const takeTagNameStartChar = charBy(isTagNameStartChar);
const takeTagNameChars = untilCharBy(isNotTagNameChar, false, true);

// <okay
const takeStartTagOpening = seq(char(CharCode['<']), takeTagNameStartChar, takeTagNameChars);

// </okay
const takeEndTagOpening = seq(text('</'), takeTagNameStartChar, takeTagNameChars);

const takeTagSpace = allCharBy(isTagSpaceChar);

const takeAttrName = untilCharBy(isNotAttrNameChar, false, true);

const takeSpace = allCharBy(isSpaceChar);

// =
const takeEq = seq(takeSpace, char(CharCode['=']), takeSpace);

// "okay"
const takeQuotValue = seq(char(CharCode['"']), untilText('"', true, true));

// 'okay'
const takeAposValue = seq(char(CharCode["'"]), untilText("'", true, true));

// okay
const takeUnquotedValue = untilCharBy(isNotUnquotedValueChar, false, true);

// <!--okay-->
const takeComment = seq(text('<!--'), untilText('-->', true, true));

// <!okay>
const takeWeirdComment = seq(text('<!'), untilText('>', true, true));

// <?okay?>
const takeProcessingInstruction = seq(text('<?'), untilText('?>', true, true));

// <![CDATA[okay]]>
const takeCdataSection = seq(text('<![CDATA['), untilText(']]>', true, true));

// <!DOCTYPE html>
const takeDocumentType = seq(text('<!DOCTYPE', true), untilText('>', true, true));

/**
 * Parses attributes from string starting from given position.
 *
 * @param str The string to read attributes from.
 * @param i The initial index where attributes' definitions are expected to start.
 * @param attrs An array to which {@link IAttribute} objects are added.
 * @param decode The decoder of HTML/XML entities.
 * @param rename The callback that receives an attribute name and returns a new name.
 */
export function parseAttrs(str: string, i: number, attrs: Mutable<ArrayLike<IAttribute>>, decode: Rewriter, rename: Rewriter): number {
  const charCount = str.length;

  let attrCount = 0;

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

    // Populate attributes pool
    const attr = attrs[attrCount];
    if (attr) {
      attr.name = name;
      attr.value = value;
      attr.start = start;
      attr.end = k;
    } else {
      attrs[attrCount] = {name, value, start, end: k};
    }
    attrCount++;

    i = k;
  }

  attrs.length = attrCount;
  return i;
}

// Default decoder used by SAX parser
const xmlDecoder = createEntitiesDecoder();

export function lowerCase(str: string): string {
  return str.toLowerCase();
}

export function identity<T>(value: T): T {
  return value;
}

export function parseSax(str: string, streaming: boolean, offset: number, options: ISaxParserOptions): number {
  const {
    xmlEnabled = false,
    decodeAttr = xmlDecoder,
    decodeText = xmlDecoder,
    renameTag = xmlEnabled ? identity : lowerCase,
    renameAttr = xmlEnabled ? identity : lowerCase,
    selfClosingEnabled = false,
    isTextContent,

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
  let tagParsingEnabled = true;
  let startTagName: string | undefined;

  // Pool of reusable attribute objects
  let attrs: Mutable<ArrayLike<IAttribute>> | undefined;

  // Emits text chunk if any
  const emitText = () => {
    if (textStart !== -1) {
      // This substring call would have performance implications in perf test if the result substring is huge
      const text = str.substring(textStart, textEnd);
      onText?.(decodeText(text), offset + textStart, offset + textEnd);
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

    if (tagParsingEnabled) {

      // Start tag
      j = takeStartTagOpening(str, i);
      if (j !== -1) {
        const tagName = renameTag(str.substring(i + 1, j));

        attrs ||= clearPrototype({length: 0});

        j = parseAttrs(str, j, attrs, decodeAttr, renameAttr);

        // Skip malformed content and excessive whitespaces
        const k = takeUntilGt(str, j);

        if (k === -1) {
          // Unterminated start tag
          return i;
        }

        const selfClosing = (xmlEnabled || selfClosingEnabled) && k - j >= 2 && str.charCodeAt(k - 2) === CharCode['/'];

        emitText();
        onStartTag?.(tagName, attrs, selfClosing, offset + i, offset + k);

        if (!selfClosing) {
          startTagName = tagName;
          tagParsingEnabled = !isTextContent?.(tagName);
        }

        i = k;
        continue;
      }
    }

    // End tag
    j = takeEndTagOpening(str, i);
    if (j !== -1) {
      const tagName = renameTag(str.substring(i + 2, j));

      if (tagParsingEnabled || startTagName === tagName) {

        // Resume tag parsing if text content tag has ended
        tagParsingEnabled = true;

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

    if (tagParsingEnabled) {
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
