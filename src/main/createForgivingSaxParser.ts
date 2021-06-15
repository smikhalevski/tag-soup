import {createSaxParser, ISaxParser, ISaxParserCallbacks, ISaxParserDialectOptions} from './createSaxParser';

export interface IForgivingSaxParserDialectOptions extends ISaxParserDialectOptions {

  /**
   * Determines whether the tag cannot have any content.
   *
   * @param tagName The name of the start tag.
   * @returns If `true` than the tag would be treated as self-closing even if it isn't marked up as such.
   */
  isVoidContent?: (tagName: string) => boolean;

  /**
   * Determines whether the container start tag with name `currentTagName` should be closed with corresponding end tag
   * when tag with name `tagName` is read.
   *
   * @param currentTagName The name of the start tag that is currently opened.
   * @param tagName The name of the start tag that was read.
   * @returns If `true` than the {@link onEndTag} would be triggered with `currentTagName` before {@link onStartTag}
   *     with `tagName` is triggered.
   */
  isImplicitEnd?: (currentTagName: string, tagName: string) => boolean;
}

export interface IForgivingSaxParserOptions extends IForgivingSaxParserDialectOptions, ISaxParserCallbacks {
}

/**
 * Creates a streaming SAX parser that:
 * - Can handle tags that were closed in the incorrect order;
 * - Adds missing close tags;
 * - Supports implicit tag closing;
 * - Supports customizable void tags;
 */
export function createForgivingSaxParser(options: IForgivingSaxParserOptions = {}): ISaxParser {
  const {
    onStartTag,
    onEndTag,
    onReset,
    onParse,
    isVoidContent,
    isImplicitEnd,
  } = options;

  let tagNames: Array<string> = [];
  let depth = 0;

  const saxParserCallbacks: ISaxParserCallbacks = {

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

    onParse(chunk, parsedCharCount) {
      if (onEndTag) {
        for (let i = depth - 1; i >= 0; i--) {
          onEndTag(tagNames[i], parsedCharCount, parsedCharCount);
        }
      }
      onParse?.(chunk, parsedCharCount);
    },
  };

  return createSaxParser(Object.assign({}, options, saxParserCallbacks));
}
