import {
  createSaxParser,
  ISaxParser,
  ISaxParserCallbacks,
  ISaxParserDialectOptions,
  IStartTagToken,
} from './createSaxParser';
import {endTagToken} from './tokenize';

export interface IForgivingSaxParserDialectOptions extends ISaxParserDialectOptions {

  /**
   * Determines whether the tag cannot have any content.
   *
   * @param tagName The name of the start tag.
   * @returns If `true` than the tag would be treated as self-closing even if it isn't marked up as such.
   */
  isVoidContent?: (token: IStartTagToken) => boolean;

  /**
   * Determines whether the container start tag with name `currentTagName` should be closed with corresponding end tag
   * when tag with name `tagName` is read.
   *
   * @param currentTagName The name of the start tag that is currently opened.
   * @param tagName The name of the start tag that was read.
   * @returns If `true` than the {@link onEndTag} would be triggered with `currentTagName` before {@link onStartTag}
   *     with `tagName` is triggered.
   */
  isImplicitEnd?: (token: IStartTagToken, prevToken: IStartTagToken) => boolean;
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

  let startTokens: Array<IStartTagToken> = [];
  let depth = 0;

  const saxParserCallbacks: ISaxParserCallbacks = {

    onStartTag(token) {
      token.selfClosing ||= isVoidContent?.(token) || false;

      if (isImplicitEnd) {
        for (let i = depth - 1; i >= 0; i--) {
          if (isImplicitEnd(startTokens[i], token)) {

            if (onEndTag) {
              for (let j = depth - 1; j >= i; j--) {

                endTagToken.tagName = startTokens[j].tagName;
                endTagToken.start = token.start;
                endTagToken.end = token.start;
                endTagToken.nameStart = token.start;
                endTagToken.nameEnd = token.start;

                onEndTag(endTagToken);
              }
            }
            depth = i;
            break;
          }
        }
      }

      onStartTag?.(token);

      if (!token.selfClosing) {
        startTokens[depth++] = token;
      }
    },

    onEndTag(token) {
      for (let i = depth - 1; i >= 0; i--) {
        if (startTokens[i].tagName === token.tagName) {

          if (onEndTag) {
            for (let j = depth - 1; j > i; j--) {

              endTagToken.tagName = startTokens[j].tagName;
              endTagToken.start = token.start;
              endTagToken.end = token.start;
              endTagToken.nameStart = token.start;
              endTagToken.nameEnd = token.start;

              onEndTag(endTagToken);
            }

            onEndTag(token);
          }
          depth = i;
        }
      }
    },

    onReset() {
      startTokens = [];
      depth = 0;
      onReset?.();
    },

    onParse(chunk, parsedCharCount) {
      if (onEndTag) {
        for (let i = depth - 1; i >= 0; i--) {

          endTagToken.tagName = startTokens[i].tagName;
          endTagToken.start = parsedCharCount;
          endTagToken.end = parsedCharCount;
          endTagToken.nameStart = parsedCharCount;
          endTagToken.nameEnd = parsedCharCount;

          onEndTag(endTagToken);
        }
      }
      onParse?.(chunk, parsedCharCount);
    },
  };

  return createSaxParser(Object.assign({}, options, saxParserCallbacks));
}
