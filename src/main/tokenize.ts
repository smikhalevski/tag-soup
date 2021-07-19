import {allCharBy, char, charBy, CharCodeChecker, ResultCode, seq, text, untilCharBy, untilText} from 'tokenizer-dsl';
import {IObjectPool} from './createObjectPool';
import {
  IArrayLike,
  IAttributeToken,
  IDataToken,
  IParserOptions,
  ISaxHandler,
  IStartTagToken,
  ITagToken,
} from './parser-types';
import {CharCode} from './CharCode';

const min = Math.min;

// https://www.w3.org/TR/xml/#NT-S
const isSpaceChar: CharCodeChecker = (charCode) =>
    charCode === CharCode[' ']
    || charCode === CharCode['\t']
    || charCode === CharCode['\r']
    || charCode === CharCode['\n'];

// https://www.w3.org/TR/xml/#NT-NameStartChar
const isTagNameStartChar: CharCodeChecker = (charCode) =>
    charCode >= CharCode['a'] && charCode <= CharCode['z']
    || charCode >= CharCode['A'] && charCode <= CharCode['Z']
    || charCode === CharCode['_']
    || charCode === CharCode[':']
    || charCode >= 0xc0 && charCode <= 0xd6
    || charCode >= 0xd8 && charCode <= 0xf6
    || charCode >= 0xf8 && charCode <= 0x2ff
    || charCode >= 0x370 && charCode <= 0x37d
    || charCode >= 0x37f && charCode <= 0x1fff
    || charCode >= 0x200c && charCode <= 0x200d
    || charCode >= 0x2070 && charCode <= 0x218f
    || charCode >= 0x2c00 && charCode <= 0x2fef
    || charCode >= 0x3001 && charCode <= 0xd7ff
    || charCode >= 0xf900 && charCode <= 0xfdcf
    || charCode >= 0xfdf0 && charCode <= 0xfffd
    || charCode >= 0x10000 && charCode <= 0xeffff;

/**
 * Check if char should be treated as a whitespace inside a tag.
 */
const isTagSpaceChar: CharCodeChecker = (charCode) => isSpaceChar(charCode) || charCode === CharCode['/'];

const isNotTagNameChar: CharCodeChecker = (charCode) =>
    isSpaceChar(charCode)
    || charCode === CharCode['/']
    || charCode === CharCode['>'];

const isNotAttributeNameChar: CharCodeChecker = (charCode) =>
    isSpaceChar(charCode)
    || charCode === CharCode['/']
    || charCode === CharCode['>']
    || charCode === CharCode['='];

const isNotUnquotedValueChar: CharCodeChecker = (charCode) => isSpaceChar(charCode) || charCode === CharCode['>'];

const takeText = untilText('<', false, false);

const takeUntilGt = untilText('>', true, false);

const takeTagNameStartChar = charBy(isTagNameStartChar);
const takeTagNameChars = untilCharBy(isNotTagNameChar, false, true);

// <okay
const takeStartTagOpening = seq(char(CharCode['<']), takeTagNameStartChar, takeTagNameChars);

// </okay
const takeEndTagOpening = seq(text('</'), takeTagNameStartChar, takeTagNameChars);

const takeAttributeName = untilCharBy(isNotAttributeNameChar, false, true);

const takeTagSpace = allCharBy(isTagSpaceChar);

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
const takeCdata = seq(text('<![CDATA['), untilText(']]>', true, true));

// <!DOCTYPE html>
const takeDoctype = seq(text('<!DOCTYPE', true), untilText('>', true, true));

/**
 * Reads attributes from the source.
 *
 * @param chunk The string to read attributes from.
 * @param index The index in `chunk` from which to start reading.
 * @param offset The offset of the `chunk` in scope of the whole input.
 * @param attributes An array to which {@link IAttributeToken} objects are added.
 * @param options Tokenization options.
 * @param parserOptions Parsing options.
 *
 * @returns The index in `chunk` at which reading was completed.
 */
export function tokenizeAttributes(chunk: string, index: number, offset: number, attributes: IArrayLike<IAttributeToken>, options: ITokenizerOptions, parserOptions: IParserOptions): number {

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
        k = min(j, charCount);
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

  // Clean up array-like object
  for (let i = attributeCount; i < attributes.length; i++) {
    attributes[i] = undefined as unknown as IAttributeToken;
  }

  attributes.length = attributeCount;
  return index;
}

export interface ITokenizerOptions {
  startTagTokenPool: IObjectPool<IStartTagToken>;
  endTagTokenPool: IObjectPool<ITagToken>;
  dataTokenPool: IObjectPool<IDataToken>;
  attributeTokenPool: IObjectPool<IAttributeToken>;
}

/**
 * Reads markup tokens from the string.
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
    endTagTokenPool,
    dataTokenPool,
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

        if (textStart !== -1) {
          emitData(chunkOffset,chunk,dataTokenPool,textCallback, textStart, textEnd, 0, 0, decodeText);
          textStart = textEnd = -1;
        }


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

        if (textStart !== -1) {
          emitData(chunkOffset,chunk,dataTokenPool,textCallback, textStart, textEnd, 0, 0, decodeText);
          textStart = textEnd = -1;
        }


        if (endTagCallback) {
          const endTagToken = endTagTokenPool.take();
          endTagToken.rawName = rawTagName;
          endTagToken.name = tagName;
          endTagToken.start = chunkOffset + i;
          endTagToken.end = chunkOffset + k;
          endTagToken.nameStart = chunkOffset + nameStart;
          endTagToken.nameEnd = chunkOffset + nameEnd;

          endTagCallback(endTagToken);
          endTagTokenPool.free(endTagToken);
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
        if (textStart !== -1) {
          emitData(chunkOffset,chunk,dataTokenPool,textCallback, textStart, textEnd, 0, 0, decodeText);
          textStart = textEnd = -1;
        }

        i = emitData(chunkOffset,chunk,dataTokenPool,commentCallback, i, j, 4, 3, decodeText);
        continue;
      }

      // Doctype
      k = j = takeDoctype(chunk, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        if (textStart !== -1) {
          emitData(chunkOffset,chunk,dataTokenPool,textCallback, textStart, textEnd, 0, 0, decodeText);
          textStart = textEnd = -1;
        }

        i = emitData(chunkOffset,chunk,dataTokenPool,doctypeCallback, i, j, 9, 1, undefined);
        continue;
      }

      // CDATA section
      j = takeCdata(chunk, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        if (textStart !== -1) {
          emitData(chunkOffset,chunk,dataTokenPool,textCallback, textStart, textEnd, 0, 0, decodeText);
          textStart = textEnd = -1;
        }

        if (cdataEnabled) {
          i = emitData(chunkOffset,chunk,dataTokenPool,cdataCallback, i, j, 9, 3, undefined);
        } else {
          i = emitData(chunkOffset,chunk,dataTokenPool,commentCallback, i, j, 2, 1, undefined);
        }
        continue;
      }

      // Processing instruction
      j = takeProcessingInstruction(chunk, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        if (textStart !== -1) {
          emitData(chunkOffset,chunk,dataTokenPool,textCallback, textStart, textEnd, 0, 0, decodeText);
          textStart = textEnd = -1;
        }

        if (processingInstructionsEnabled) {
          i = emitData(chunkOffset,chunk,dataTokenPool,processingInstructionCallback, i, j, 2, 2, undefined);
        } else {
          i = emitData(chunkOffset,chunk,dataTokenPool,commentCallback, i, j, 1, 1, undefined);
        }
        continue;
      }

      // DTD
      j = takeDtd(chunk, i);
      if (j !== ResultCode.NO_MATCH) {
        if (j > charCount && streaming) {
          return i;
        }
        if (textStart !== -1) {
          emitData(chunkOffset,chunk,dataTokenPool,textCallback, textStart, textEnd, 0, 0, decodeText);
          textStart = textEnd = -1;
        }

        if (cdataEnabled) {
          i = Math.min(j, charCount);
        } else {
          i = emitData(chunkOffset,chunk,dataTokenPool,commentCallback, i, j, 2, 1, decodeText);
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

  if (textStart !== -1) {
    emitData(chunkOffset,chunk,dataTokenPool,textCallback, textStart, textEnd, 0, 0, decodeText);
    textStart = textEnd = -1;
  }


  return i;
}

const emitData = (chunkOffset: number, chunk: string, dataTokenPool: IObjectPool<IDataToken>, callback: ((token: IDataToken) => void) | undefined, start: number, end: number, dataStartOffset: number, dataEndOffset: number, decoder: ((str: string) => string) | undefined): number => {

  const charCount = chunk.length;
  const index = Math.min(end, charCount);

  if (callback) {
    const dataStart = start + dataStartOffset;
    const dataEnd = Math.min(end - dataEndOffset, charCount);
    const rawData = chunk.substring(dataStart, dataEnd);

    const dataToken = dataTokenPool.take();

    dataToken.rawData = rawData;
    dataToken.data = decoder ? decoder(rawData) : rawData;
    dataToken.start = chunkOffset + start;
    dataToken.end = chunkOffset + index;
    dataToken.dataStart = chunkOffset + dataStart;
    dataToken.dataEnd = chunkOffset + dataEnd;

    callback(dataToken);
    dataTokenPool.free(dataToken);
  }
  return index;
};
