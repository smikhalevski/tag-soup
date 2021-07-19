import {allCharBy, char, charBy, CharCodeChecker, ResultCode, seq, text, untilCharBy, untilText} from 'tokenizer-dsl';
import {IObjectPool} from './createObjectPool';
import {IAttributeToken, IDataToken, IStartTagToken, ITagToken} from './token-types';
import {IParserOptions, ISaxHandler} from './parser-types';
import {CharCode} from './CharCode';

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
 * Check if char should be treated as a whitespace inside a tag.
 */
const isTagSpaceChar: CharCodeChecker = (c) => isSpaceChar(c) || c === CharCode['/'];

const isNotTagNameChar: CharCodeChecker = (c) => isSpaceChar(c) || c === CharCode['/'] || c === CharCode['>'];

const isNotAttributeNameChar: CharCodeChecker = (c) => isSpaceChar(c) || c === CharCode['/'] || c === CharCode['>'] || c === CharCode['='];

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

const takeAttributeName = untilCharBy(isNotAttributeNameChar, false, true);

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
const takeDtd = seq(text('<!'), untilText('>', true, true));

// <?okay?>
const takeProcessingInstruction = seq(text('<?'), untilText('?>', true, true));

// <![CDATA[okay]]>
const takeCdataSection = seq(text('<![CDATA['), untilText(']]>', true, true));

// <!DOCTYPE html>
const takeDocumentType = seq(text('<!DOCTYPE', true), untilText('>', true, true));

/**
 * Reads attributes from the source.
 *
 * @param chunk The string to read attributes from.
 * @param index The index in `chunk` from which to start reading.
 * @param offset The offset of the `chunk` in scope of the whole input.
 * @param attributes An array to which {@link IAttributeToken} objects are added.
 * @param options Tokenization options.
 * @param parserOptions Parsing options.
 */
export function tokenizeAttributes(chunk: string, index: number, offset: number, attributes: Array<IAttributeToken>, options: ITokenizerOptions, parserOptions: IParserOptions): number {

  const {attributeTokenPool} = options;
  const {decodeAttribute, renameAttribute} = parserOptions;

  const charCount = chunk.length;

  let attributeCount = 0;

  while (index < charCount) {

    let k = takeTagSpace(chunk, index);
    let j = takeAttributeName(chunk, k);

    // No attribute available
    if (j === k) {
      break;
    }

    const attributeToken = attributes[attributeCount] ||= attributeTokenPool.take();
    const rawName = chunk.substring(k, j);

    attributeToken.rawName = rawName;
    attributeToken.name = renameAttribute ? renameAttribute(rawName) : rawName;
    attributeToken.nameStart = attributeToken.start = offset + k;
    attributeToken.nameEnd = offset + j;

    k = j;
    j = takeEq(chunk, k);

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
      j = takeQuotValue(chunk, k);
      if (j === ResultCode.NO_MATCH) {
        j = takeAposValue(chunk, k);
      }
      if (j !== ResultCode.NO_MATCH) {
        valueStart = k + 1;
        valueEnd = j - 1;
        quoted = true;
        k = Math.min(j, charCount);
      } else {

        // Unquoted value
        j = takeUnquotedValue(chunk, k);
        if (j !== k) {
          valueStart = k;
          valueEnd = j;
          k = j;
        }
      }

      if (valueStart !== -1) {
        rawValue = chunk.substring(valueStart, valueEnd);
        value = decodeAttribute ? decodeAttribute(rawValue) : rawValue;
        valueStart += offset;
        valueEnd += offset;
      }
    }

    attributeToken.rawValue = rawValue;
    attributeToken.value = value;
    attributeToken.valueStart = valueStart;
    attributeToken.valueEnd = valueEnd;
    attributeToken.quoted = quoted;
    attributeToken.end = offset + k;

    attributeCount++;

    index = k;
  }

  attributes.length = attributeCount;
  return index;
}

export interface ITokenizerOptions {
  startTagTokenPool: IObjectPool<IStartTagToken>;
  endTagToken: ITagToken;
  dataToken: IDataToken;
  attributeTokenPool: IObjectPool<IAttributeToken>;
}

/**
 * Reads markup tokens from the string.
 *
 * **Note:** Pooled objects must be returned back to the pool by the pool owner.
 *
 * @param chunk The chunk of the input to read tokens from.
 * @param streaming If set to `true` then tokenizer stops when an ambiguous char sequence is met.
 * @param chunkOffset The offset of the `chunk` in scope of the whole input.
 * @param options Tokenization options.
 * @param parserOptions Parsing options.
 * @param handler SAX handler that is notified about parsed tokens.
 * @returns The index in `chunk` right after the last parsed character.
 */
export function tokenize(chunk: string, streaming: boolean, chunkOffset: number, options: ITokenizerOptions, parserOptions: IParserOptions, handler: ISaxHandler): number {

  const {
    startTagTokenPool,
    endTagToken,
    dataToken,
  } = options;

  const {
    cdataEnabled,
    processingInstructionsEnabled,
    selfClosingEnabled,
    decodeText,
    renameTag,
    checkCdataTag,
  } = parserOptions;

  const {
    startTag: startTagCallback,
    endTag: endTagCallback,
    text: textCallback,
    comment: commentCallback,
    processingInstruction: processingInstructionCallback,
    cdata: cdataCallback,
    doctype: doctypeCallback,
  } = handler;

  let textStart = -1;
  let textEnd = -1;
  let tagParsingEnabled = true;
  let startTagName: string | undefined;

  const emitText = (): void => {
    if (textStart !== -1) {
      emitData(textCallback, textStart, textEnd, 0, 0, true);
      textStart = textEnd = -1;
    }
  };

  const emitData = (callback: ((token: IDataToken) => void) | undefined, start: number, end: number, dataStartOffset: number, dataEndOffset: number, decodeEnabled: boolean): number => {
    const index = Math.min(end, charCount);

    if (callback) {
      const dataStart = start + dataStartOffset;
      const dataEnd = Math.min(end - dataEndOffset, charCount);
      const rawData = chunk.substring(dataStart, dataEnd);

      dataToken.rawData = rawData;
      dataToken.data = decodeEnabled && decodeText ? decodeText(rawData) : rawData;
      dataToken.start = chunkOffset + start;
      dataToken.end = chunkOffset + index;
      dataToken.dataStart = chunkOffset + dataStart;
      dataToken.dataEnd = chunkOffset + dataEnd;

      callback(dataToken);
    }
    return index;
  };

  const charCount = chunk.length;

  let i = 0;
  let j;

  while (i < charCount) {

    // Text
    if (textStart === -1) {
      let k = takeText(chunk, i);

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
      j = takeStartTagOpening(chunk, i);
      if (j !== ResultCode.NO_MATCH) {
        const startTagToken = startTagTokenPool.take();

        const nameStart = i + 1;
        const nameEnd = j;

        const rawTagName = chunk.substring(nameStart, nameEnd);
        const tagName = renameTag ? renameTag(rawTagName) : rawTagName;

        j = tokenizeAttributes(chunk, j, chunkOffset, startTagToken.attributes, options, parserOptions);

        // Skip malformed content and excessive whitespaces
        const k = takeUntilGt(chunk, j);

        if (k === ResultCode.NO_MATCH) {
          // Unterminated start tag
          return i;
        }

        const selfClosing = selfClosingEnabled && k - j >= 2 && chunk.charCodeAt(k - 2) === CharCode['/'] || false;

        emitText();

        startTagToken.rawName = rawTagName;
        startTagToken.name = tagName;
        startTagToken.selfClosing = selfClosing;
        startTagToken.start = chunkOffset + i;
        startTagToken.end = chunkOffset + k;
        startTagToken.nameStart = chunkOffset + nameStart;
        startTagToken.nameEnd = chunkOffset + nameEnd;

        if (!selfClosing) {
          startTagName = tagName;
          tagParsingEnabled = !checkCdataTag?.(startTagToken);
        }

        i = k;
        startTagCallback?.(startTagToken);
        continue;
      }
    }

    // End tag
    j = takeEndTagOpening(chunk, i);
    if (j !== ResultCode.NO_MATCH) {
      const nameStart = i + 2;
      const nameEnd = j;

      const rawTagName = chunk.substring(nameStart, nameEnd);
      const tagName = renameTag ? renameTag(rawTagName) : rawTagName;

      if (tagParsingEnabled || startTagName === tagName) {

        // Resume tag parsing if cdata content tag has ended
        tagParsingEnabled = true;

        // Skip malformed content and excessive whitespaces
        const k = takeUntilGt(chunk, j);

        if (k === ResultCode.NO_MATCH) {
          // Unterminated end tag
          return i;
        }

        emitText();

        if (endTagCallback) {
          endTagToken.rawName = rawTagName;
          endTagToken.name = tagName;
          endTagToken.start = chunkOffset + i;
          endTagToken.end = chunkOffset + k;
          endTagToken.nameStart = chunkOffset + nameStart;
          endTagToken.nameEnd = chunkOffset + nameEnd;

          endTagCallback(endTagToken);
        }

        i = k;
        continue;
      }
    }

    if (tagParsingEnabled) {
      let k;

      // Comment
      k = j = takeComment(chunk, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        emitText();
        i = emitData(commentCallback, i, j, 4, 3, true);
        continue;
      }

      // Doctype
      k = j = takeDocumentType(chunk, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        emitText();
        i = emitData(doctypeCallback, i, j, 9, 1, false);
        continue;
      }

      // CDATA section
      j = takeCdataSection(chunk, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        emitText();
        if (cdataEnabled) {
          i = emitData(cdataCallback, i, j, 9, 3, false);
        } else {
          i = emitData(commentCallback, i, j, 2, 1, false);
        }
        continue;
      }

      // Processing instruction
      j = takeProcessingInstruction(chunk, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        emitText();
        if (processingInstructionsEnabled) {
          i = emitData(processingInstructionCallback, i, j, 2, 2, false);
        } else {
          i = emitData(commentCallback, i, j, 1, 1, false);
        }
        continue;
      }

      // DTD
      j = takeDtd(chunk, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        emitText();
        if (cdataEnabled) {
          i = Math.min(j, charCount);
        } else {
          i = emitData(commentCallback, i, j, 2, 1, true);
        }
        continue;
      }
    }

    // Concat with existing text
    if (textStart === -1) {
      textStart = i;
    }
    textEnd = takeText(chunk, i + 1);

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
