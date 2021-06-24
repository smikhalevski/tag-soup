import {allCharBy, char, charBy, CharCodeChecker, ResultCode, seq, text, untilCharBy, untilText} from 'tokenizer-dsl';
import {IObjectPool} from './createObjectPool';
import {IAttrToken, IDataToken, IStartTagToken, ITagToken} from './token-types';
import {DataTokenCallback, ISaxParserOptions} from './sax-parser-types';
import {CharCode} from './CharCode';
import {Rewriter} from './decoder-types';

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
const takeAposValue = seq(char(CharCode['\'']), untilText('\'', true, true));

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

export interface IAttrTokenizerOptions {
  attrTokenPool: IObjectPool<IAttrToken>;
  decodeAttr?: Rewriter;
  renameAttr?: Rewriter;
}

/**
 * Reads attributes from the source.
 *
 * @param str The string to read attributes from.
 * @param index The index in `str` from which to start reading.
 * @param offset The offset of the `str` chunk in scope of the stream.
 * @param attrs An array to which {@link IAttrToken} objects are added.
 * @param options Other options.
 */
export function tokenizeAttrs(str: string, index: number, offset: number, attrs: Array<IAttrToken>, options: IAttrTokenizerOptions): number {
  const {
    attrTokenPool,
    decodeAttr,
    renameAttr,
  } = options;

  const charCount = str.length;

  let attrCount = 0;

  while (index < charCount) {

    let k = takeTagSpace(str, index);
    let j = takeAttrName(str, k);

    // No attribute available
    if (j === k) {
      break;
    }

    const attrToken = attrs[attrCount] = attrTokenPool.take();
    const rawName = str.substring(k, j);

    attrToken.rawName = rawName;
    attrToken.name = renameAttr ? renameAttr(rawName) : rawName;
    attrToken.nameStart = attrToken.start = offset + k;
    attrToken.nameEnd = offset + j;

    k = j;
    j = takeEq(str, k);

    let rawValue;
    let value;
    let valueStart = -1;
    let valueEnd = -1;
    let quoted = false;

    // Equals sign presents, so there may be a value
    if (j !== ResultCode.NO_MATCH) {
      k = j;
      rawValue = value = null;

      // Quoted value
      j = takeQuotValue(str, k);
      if (j === ResultCode.NO_MATCH) {
        j = takeAposValue(str, k);
      }
      if (j !== ResultCode.NO_MATCH) {
        valueStart = k + 1;
        valueEnd = j - 1;
        quoted = true;
        k = Math.min(j, charCount);
      } else {

        // Unquoted value
        j = takeUnquotedValue(str, k);
        if (j !== k) {
          valueStart = k;
          valueEnd = j;
          k = j;
        }
      }

      if (valueStart !== -1) {
        rawValue = str.substring(valueStart, valueEnd);
        value = decodeAttr ? decodeAttr(rawValue) : rawValue;
        valueStart += offset;
        valueEnd += offset;
      }
    }

    attrToken.rawValue = rawValue;
    attrToken.value = value;
    attrToken.valueStart = valueStart;
    attrToken.valueEnd = valueEnd;
    attrToken.quoted = quoted;
    attrToken.end = offset + k;

    attrCount++;

    index = k;
  }

  attrs.length = attrCount;
  return index;
}

export interface ITokenizerOptions extends ISaxParserOptions {
  startTagToken: IStartTagToken;
  endTagToken: ITagToken;
  dataToken: IDataToken;
  attrTokenPool: IObjectPool<IAttrToken>;
}

/**
 * Reads markup tokens from the string.
 *
 * **Note:** This function has no defaults for SAX parser arguments.
 *
 * @param str The string to read tokens from.
 * @param streaming If set to `true` then tokenizer stops when an ambiguous char sequence is met. Ambiguity is
 *     considered is tokenization result may change if string contained more characters.
 * @param offset The offset of the `str` chunk in scope of the stream.
 * @param options Other options.
 * @returns The offset in `str` right after the last parsed character.
 */
export function tokenize(str: string, streaming: boolean, offset: number, options: ITokenizerOptions): number {
  const {
    xmlEnabled,
    decodeText,
    renameTag,
    selfClosingEnabled,
    isTextContent,

    onStartTag,
    onEndTag,
    onText,
    onComment,
    onProcessingInstruction,
    onCdataSection,
    onDocumentType,

    startTagToken,
    endTagToken,
    dataToken,
    attrTokenPool,
  } = options;

  let textStart = -1;
  let textEnd = -1;
  let tagParsingEnabled = true;
  let startTagName: string | undefined;

  const attrs = startTagToken.attrs;

  const emitText = (): void => {
    if (textStart !== -1) {
      emitData(onText, textStart, textEnd, 0, 0, true);
      textStart = textEnd = -1;
    }
  };

  const emitData = (callback: DataTokenCallback | undefined, start: number, end: number, dataStartOffset: number, dataEndOffset: number, decodeEnabled: boolean): number => {
    const index = Math.min(end, charCount);

    if (callback) {
      const dataStart = start + dataStartOffset;
      const dataEnd = Math.min(end - dataEndOffset, charCount);
      const rawData = str.substring(dataStart, dataEnd);

      dataToken.rawData = rawData;
      dataToken.data = decodeEnabled && decodeText ? decodeText(rawData) : rawData;
      dataToken.start = offset + start;
      dataToken.end = offset + index;
      dataToken.dataStart = offset + dataStart;
      dataToken.dataEnd = offset + dataEnd;

      callback(dataToken);
    }
    return index;
  };

  const charCount = str.length;

  let i = 0;
  let j;

  while (i < charCount) {

    // Text
    if (textStart === -1) {
      let k = takeText(str, i);

      if (k === ResultCode.NO_MATCH && (k = charCount) && streaming) {
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
      if (j !== ResultCode.NO_MATCH) {
        const nameStart = i + 1;
        const nameEnd = j;

        const rawTagName = str.substring(nameStart, nameEnd);
        const tagName = renameTag ? renameTag(rawTagName) : rawTagName;

        j = tokenizeAttrs(str, j, offset, attrs, options);

        // Skip malformed content and excessive whitespaces
        const k = takeUntilGt(str, j);

        if (k === ResultCode.NO_MATCH) {
          // Unterminated start tag
          return i;
        }

        const selfClosing = (xmlEnabled || selfClosingEnabled) && k - j >= 2 && str.charCodeAt(k - 2) === CharCode['/'] || false;

        emitText();

        startTagToken.rawName = rawTagName;
        startTagToken.name = tagName;
        startTagToken.selfClosing = selfClosing;
        startTagToken.start = offset + i;
        startTagToken.end = offset + k;
        startTagToken.nameStart = offset + nameStart;
        startTagToken.nameEnd = offset + nameEnd;

        if (!selfClosing) {
          startTagName = tagName;
          tagParsingEnabled = !isTextContent?.(startTagToken);
        }

        onStartTag?.(startTagToken);
        i = k;

        for (let i = 0; i < attrs.length; i++) {
          attrTokenPool.free(attrs[i]);
        }
        continue;
      }
    }

    // End tag
    j = takeEndTagOpening(str, i);
    if (j !== ResultCode.NO_MATCH) {
      const nameStart = i + 2;
      const nameEnd = j;

      const rawTagName = str.substring(nameStart, nameEnd);
      const tagName = renameTag ? renameTag(rawTagName) : rawTagName;

      if (tagParsingEnabled || startTagName === tagName) {

        // Resume tag parsing if text content tag has ended
        tagParsingEnabled = true;

        // Skip malformed content and excessive whitespaces
        const k = takeUntilGt(str, j);

        if (k === ResultCode.NO_MATCH) {
          // Unterminated end tag
          return i;
        }

        emitText();

        if (onEndTag) {
          endTagToken.rawName = rawTagName;
          endTagToken.name = tagName;
          endTagToken.start = offset + i;
          endTagToken.end = offset + k;
          endTagToken.nameStart = offset + nameStart;
          endTagToken.nameEnd = offset + nameEnd;

          onEndTag(endTagToken);
        }

        i = k;
        continue;
      }
    }

    if (tagParsingEnabled) {
      let k;

      // Comment
      k = j = takeComment(str, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        emitText();
        i = emitData(onComment, i, j, 4, 3, true);
        continue;
      }

      // Doctype
      k = j = takeDocumentType(str, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        emitText();
        i = emitData(onDocumentType, i, j, 9, 1, false);
        continue;
      }

      // CDATA section
      j = takeCdataSection(str, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        emitText();
        if (xmlEnabled) {
          i = emitData(onCdataSection, i, j, 9, 3, false);
        } else {
          i = emitData(onComment, i, j, 2, 1, false);
        }
        continue;
      }

      // Processing instruction
      j = takeProcessingInstruction(str, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        emitText();
        if (xmlEnabled) {
          i = emitData(onProcessingInstruction, i, j, 2, 2, false);
        } else {
          i = emitData(onComment, i, j, 1, 1, false);
        }
        continue;
      }

      // Weird comments
      if (!xmlEnabled) {
        j = takeWeirdComment(str, i);
        if (j !== ResultCode.NO_MATCH) {
          if (j > charCount && streaming) {
            return i;
          }
          emitText();
          i = emitData(onComment, i, j, 2, 1, true);
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
