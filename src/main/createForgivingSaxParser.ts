import {parseSax, SaxParser, SaxParserCallbacks, SaxParserDialectOptions, SaxParserOptions} from './createSaxParser';
import {ContentMode} from './ContentMode';

export interface ForgivingSaxParserDialectOptions extends SaxParserDialectOptions {

  /**
   * @returns If `true` then tag isn't emitted.
   */
  isIgnored?: (tagName: string) => boolean;

  /**
   * @returns If `true` then tag is emitted as a raw source text.
   */
  isEmittedAsText?: (tagName: string) => boolean;

  /**
   * @returns If `true` then `tagName` must be closed when `startTagName` starts.
   */
  isImplicitEnd?: (tagName: string, startTagName: string) => boolean;
}

export interface ForgivingSaxParserOptions extends ForgivingSaxParserDialectOptions, SaxParserCallbacks {
}

/**
 * Creates a streaming SAX parser that guarantees correct tag order.
 */
export function createForgivingSaxParser(options: ForgivingSaxParserOptions): SaxParser {
  const {
    onStartTag,
    onEndTag,
    onText,
    isIgnored,
    isEmittedAsText,
    isImplicitEnd,
  } = options;

  let tail = '';
  let offset = 0;

  const tagNameStack: Array<string> = [];

  let depth = 0;

  let text = '';
  let textStart = -1;
  let textEnd = -1;

  const emitText = (): void => {
    if (textStart !== -1) {
      onText?.(text, textStart, textEnd);
      textStart = -1;
    }
  };

  const addText = (data: string, start: number, end: number): void => {
    if (textStart === -1) {
      text = data;
      textStart = start;
    } else {
      text += data;
    }
    textEnd = end;
  };

  const overrides: SaxParserOptions = {

    onStartTag(tagName, attrs, selfClosing, tagType, start, end) {
      if (isIgnored?.(tagName)) {
        return;
      }
      if (isEmittedAsText?.(tagName)) {
        addText(tail.substring(start - offset, end - offset), start, end);
        return;
      }

      emitText();
      selfClosing ||= tagType === ContentMode.VOID;

      if (isImplicitEnd && onEndTag) {
        for (let i = depth - 1; i >= 0; i--) {

          if (isImplicitEnd(tagNameStack[i], tagName)) {
            for (let j = depth - 1; j >= i; j--) {
              onEndTag(tagNameStack[j], start, start);
            }
            depth = i;
            break;
          }
        }
      }
      onStartTag?.(tagName, attrs, selfClosing, tagType, start, end);

      if (!selfClosing) {
        tagNameStack[depth++] = tagName;
      }
    },

    onEndTag(tagName, start, end) {
      if (isIgnored?.(tagName)) {
        return;
      }
      if (isEmittedAsText?.(tagName)) {
        addText(tail.substring(start - offset, end - offset), start, end);
        return;
      }

      emitText();

      for (let i = depth - 1; i >= 0; i--) {
        if (tagNameStack[i] === tagName) {

          if (onEndTag) {
            for (let j = depth - 1; j > i; j--) {
              onEndTag(tagNameStack[j], start, start);
            }
            onEndTag(tagName, start, end);
          }

          depth = i;
          break;
        }
      }
    },

    onText: addText,
  };

  options = Object.assign({}, options, overrides);

  return {
    resetStream() {
      tail = '';
      offset = 0;
      textStart = -1;
      depth = 0;
    },
    writeStream(str) {
      tail += str;
      const l = parseSax(tail, true, offset, options);
      tail = str.substr(l);
      offset += l;
    },
    commit(str = '') {
      tail += str;
      const l = parseSax(tail, false, offset, options);
      tail = '';
      offset += l;

      emitText();
      for (let i = depth - 1; i >= 0; i--) {
        onEndTag?.(tagNameStack[i], offset, offset);
      }

      offset = 0;
    },
  };
}
