import {createSaxParser, SaxParser, SaxParserCallbacks, SaxParserDialectOptions} from './createSaxParser';

export interface ForgivingSaxParserDialectOptions extends SaxParserDialectOptions {

  /**
   * If returns `true` than tag would be treated as self-closing.
   */
  isVoidContent?: (tagName: string) => boolean;

  /**
   * If returns `true` then `currentTagName` would be closed when `tagName` starts.
   */
  isImplicitEnd?: (currentTagName: string, tagName: string) => boolean;
}

export interface ForgivingSaxParserOptions extends ForgivingSaxParserDialectOptions, SaxParserCallbacks {
}

/**
 * Creates a streaming SAX parser that guarantees the correct order of start and end tags.
 */
export function createForgivingSaxParser(options: ForgivingSaxParserOptions = {}): SaxParser {
  const {
    onStartTag,
    onEndTag,
    onReset,
    onCommit,
    isVoidContent,
    isImplicitEnd,
  } = options;

  let tagNames: Array<string> = [];
  let depth = 0;

  const saxParserCallbacks: SaxParserCallbacks = {

    onStartTag(tagName, attrs, selfClosing, start, end) {
      selfClosing ||= isVoidContent?.(tagName) || false;

      if (isImplicitEnd) {
        for (let i = depth - 1; i >= 0; i--) {
          if (isImplicitEnd(tagNames[i], tagName)) {

            if (onEndTag) {
              for (let j = depth - 1; j >= i; j--) {
                onEndTag(tagNames[j], start, start);
              }
            }
            depth = i;
            break;
          }
        }
      }

      onStartTag?.(tagName, attrs, selfClosing, start, end);

      if (!selfClosing) {
        tagNames[depth++] = tagName;
      }
    },

    onEndTag(tagName, start, end) {
      for (let i = depth - 1; i >= 0; i--) {
        if (tagNames[i] === tagName) {

          if (onEndTag) {
            for (let j = depth - 1; j > i; j--) {
              onEndTag(tagNames[j], start, start);
            }
            onEndTag(tagNames[i], start, end);
          }
          depth = i;
        }
      }
    },

    onReset() {
      tagNames = [];
      depth = 0;
      onReset?.();
    },

    onCommit(chunk, parsedCharCount) {
      if (onEndTag) {
        for (let i = depth - 1; i >= 0; i--) {
          onEndTag(tagNames[i], parsedCharCount, parsedCharCount);
        }
      }
      onCommit?.(chunk, parsedCharCount);
    },
  };

  return createSaxParser(Object.assign({}, options, saxParserCallbacks));
}
