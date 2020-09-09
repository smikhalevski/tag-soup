import {
  Attribute,
  parseSax,
  SaxParser,
  SaxParserCallbacks,
  SaxParserDialectOptions,
  SaxParserOptions,
} from './createSaxParser';
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

  let text = '';
  let textStart = -1;
  let textEnd = -1;

  let nameStack: Array<string> = [];
  let attrStack: Array<Array<Attribute>> = [];
  let depth = 0; // stack depth
  let c = -1; // cursor

  const addText = (data: string, start: number, end: number) => {
    if (textStart === -1) {
      text = data;
      textStart = start;
    } else {
      text += data;
    }
    textEnd = end;
  };

  const emitText = () => {
    if (textStart !== -1) {
      emitOrphans(textStart);

      onText?.(text, textStart, textEnd);
      textStart = -1;
    }
  };

  const emitOrphans = (start: number) => {
    if (c !== depth - 1) {
      for (let i = c; i < depth; i++) {
        onStartTag?.(nameStack[i], attrStack[i], false, ContentMode.FLOW, start, start);
        c = i;
      }
    }
  };

  const overrides: SaxParserOptions = {

    onStartTag(name, attrs, selfClosing, contentMode, start, end) {
      selfClosing ||= contentMode === ContentMode.VOID;

      emitText();

      if (isImplicitEnd) {
        for (let i = 0; i <= c; i++) {
          if (isImplicitEnd(nameStack[i], name)) {

            if (onEndTag) {
              for (let j = c; j >= i; j--) {
                onEndTag(nameStack[j], start, start);
              }
            }
            c = i - 1;
            break;
          }
        }
      }

      onStartTag?.(name, attrs, selfClosing, contentMode, start, end);

      if (selfClosing) {
        depth--;
        for (let i = c + 1; i < depth; i++) {
          nameStack[i] = nameStack[i + 1];
          attrStack[i] = attrStack[i + 1];
        }
      } else {
        c++;
        nameStack[c] = name;
        attrStack[c] = attrs;

        if (c === depth) {
          depth++;
        }
      }
    },

    onEndTag(name, start, end) {
      emitText();

      for (let i = c; i >= 0; i--) {
        if (nameStack[i] === name) {

          if (onEndTag) {
            for (let j = c; j > i; j--) {
              onEndTag(nameStack[j], start, start);
            }
            onEndTag(nameStack[i], start, end);
          }
          c = i - 1;

          depth--;
          for (let j = c + 1; j < depth; j--) {
            nameStack[i] = nameStack[i + 1];
            attrStack[i] = attrStack[i + 1];
          }
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

      if (onEndTag) {
        for (let i = c; i >= 0; i--) {
          onEndTag(nameStack[i], offset, offset);
        }
      }

      offset = 0;
    },
  };
}
