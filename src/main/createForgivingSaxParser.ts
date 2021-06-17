import {createSaxParser} from './createSaxParser';
import {createTagToken} from './token-pools';
import {createValuePool} from './createValuePool';
import {ITagToken} from './token-types';
import {IForgivingSaxParserOptions, ISaxParser, ISaxParserCallbacks} from './sax-parser-types';

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

  const containerTagTokenPool = createValuePool(createTagToken);
  const endTagToken = createTagToken();

  let containerTokens: Array<ITagToken> = [];
  let depth = 0;

  const saxParserCallbacks: ISaxParserCallbacks = {

    onStartTag(token) {
      token.selfClosing ||= isVoidContent?.(token) || false;

      if (isImplicitEnd) {
        for (let i = depth - 1; i >= 0; i--) {

          if (isImplicitEnd(containerTokens[i], token)) {

            if (onEndTag) {
              for (let j = depth - 1; j >= i; j--) {
                assignEndTagToken(endTagToken, containerTokens[j], token.start);
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
        assignTagToken(containerTokens[depth++] ||= containerTagTokenPool.next(), token);
      }
    },

    onEndTag(token) {
      for (let i = depth - 1; i >= 0; i--) {
        if (containerTokens[i].name === token.name) {

          if (onEndTag) {
            for (let j = depth - 1; j > i; j--) {
              assignEndTagToken(endTagToken, containerTokens[j], token.start);
              onEndTag(endTagToken);
            }
            onEndTag(token);
          }

          depth = i;
        }
      }
    },

    onReset() {
      for (let i = 0; i < containerTokens.length; i++) {
        containerTagTokenPool.free(containerTokens[i]);
      }
      containerTokens.length = depth = 0;
      onReset?.();
    },

    onParse(chunk, parsedCharCount) {
      if (onEndTag) {
        for (let i = depth - 1; i >= 0; i--) {
          assignEndTagToken(endTagToken, containerTokens[i], parsedCharCount);
          onEndTag(endTagToken);
        }
      }
      onParse?.(chunk, parsedCharCount);
    },
  };

  return createSaxParser(Object.assign({}, options, saxParserCallbacks));
}

function assignTagToken(tokenA: ITagToken, tokenB: ITagToken): void {
  tokenA.rawName = tokenB.rawName;
  tokenA.name = tokenB.name;
  tokenA.nameStart = tokenB.nameStart;
  tokenA.nameEnd = tokenB.nameEnd;
  tokenA.start = tokenB.start;
  tokenA.end = tokenB.end;
}

function assignEndTagToken(endTagToken: ITagToken, containerTagToken: ITagToken, end: number): void {
  assignTagToken(endTagToken, containerTagToken);
  endTagToken.start = endTagToken.end = end;
  endTagToken.nameStart = endTagToken.nameEnd = -1;
}
