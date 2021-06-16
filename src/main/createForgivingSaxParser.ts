import {
  createSaxParser,
  ISaxParser,
  ISaxParserCallbacks,
  ISaxParserDialectOptions,
  IStartTagToken,
  ITagToken,
} from './createSaxParser';
import {endTagTokenPool, prevTagTokenPool} from './token-pools';

export interface IForgivingSaxParserDialectOptions extends ISaxParserDialectOptions {

  /**
   * Determines whether the tag cannot have any content.
   *
   * @param token The start tag token.
   * @returns If `true` than the tag would be treated as self-closing even if it isn't marked up as such.
   */
  isVoidContent?: (token: IStartTagToken) => boolean;

  /**
   * Determines whether the container start tag with name `currentTagName` should be closed with corresponding end tag
   * when tag with name `tagName` is read.
   *
   * @param containerTagName The rewritten tag name of the container that is currently opened.
   * @param token The name of the start tag that was read.
   * @returns If `true` than the {@link onEndTag} would be triggered for `containerTagName` before {@link onStartTag}
   *     with `token` is triggered.
   */
  isImplicitEnd?: (containerTagName: string, token: IStartTagToken) => boolean;
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

  let startTagTokens: Array<ITagToken> = [];
  let depth = 0;

  const saxParserCallbacks: ISaxParserCallbacks = {

    onStartTag(token) {
      token.selfClosing ||= isVoidContent?.(token) || false;

      if (isImplicitEnd) {
        for (let i = depth - 1; i >= 0; i--) {
          if (isImplicitEnd(startTagTokens[i].tagName, token)) {

            if (onEndTag) {
              const endTagToken = endTagTokenPool.next();
              try {
                for (let j = depth - 1; j >= i; j--) {

                  endTagToken.rawTagName = startTagTokens[j].rawTagName;
                  endTagToken.tagName = startTagTokens[j].tagName;
                  endTagToken.start = endTagToken.end = token.start;
                  endTagToken.nameStart = endTagToken.nameEnd = -1;

                  onEndTag(endTagToken);
                }
              } finally {
                endTagTokenPool.free(endTagToken);
              }
            }
            depth = i;
            break;
          }
        }
      }

      onStartTag?.(token);

      if (!token.selfClosing) {
        const token2 = startTagTokens[depth++] ||= prevTagTokenPool.next();

        token2.rawTagName = token.rawTagName;
        token2.tagName = token.tagName;
      }
    },

    onEndTag(token) {
      for (let i = depth - 1; i >= 0; i--) {
        if (startTagTokens[i].tagName === token.tagName) {

          if (onEndTag) {
            const endTagToken = endTagTokenPool.next();
            try {
              for (let j = depth - 1; j > i; j--) {

                endTagToken.rawTagName = startTagTokens[j].rawTagName;
                endTagToken.tagName = startTagTokens[j].tagName;
                endTagToken.start = endTagToken.end = token.start;
                endTagToken.nameStart = endTagToken.nameEnd = -1;

                onEndTag(endTagToken);
              }
            } finally {
              endTagTokenPool.free(endTagToken);
            }

            onEndTag(token);
          }
          depth = i;
        }
      }
    },

    onReset() {
      for (let i = 0; i < startTagTokens.length; i++) {
        prevTagTokenPool.free(startTagTokens[i]);
      }
      startTagTokens = [];
      depth = 0;
      onReset?.();
    },

    onParse(chunk, parsedCharCount) {
      if (onEndTag) {
        const endTagToken = endTagTokenPool.next();
        try {
          for (let i = depth - 1; i >= 0; i--) {

            endTagToken.rawTagName = startTagTokens[i].rawTagName;
            endTagToken.tagName = startTagTokens[i].tagName;
            endTagToken.start = endTagToken.end = parsedCharCount;
            endTagToken.nameStart = endTagToken.nameEnd = -1;

            onEndTag(endTagToken);
          }
        } finally {
          endTagTokenPool.free(endTagToken);
        }
      }
      onParse?.(chunk, parsedCharCount);
    },
  };

  return createSaxParser(Object.assign({}, options, saxParserCallbacks));
}
