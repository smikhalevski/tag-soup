import {ITokenizerOptions, tokenize} from './tokenize';
import {createObjectPool} from './createObjectPool';
import {createAttributeToken, createDataToken, createStartTagToken, createTagToken} from './tokens';
import {IParser, IParserOptions, ISaxHandler} from './parser-types';
import {ITagToken} from './token-types';

/**
 * Creates a new SAX parser.
 */
export function createSaxParser(options: IParserOptions = {}): IParser<ISaxHandler, void> {
  const {
    checkVoidTag,
    checkImplicitEndTag,
    checkBoundaryTag,
  } = options;

  let buffer = '';
  let chunkOffset = 0;
  let nestingDepth = 0;

  const ancestorTokens: Array<ITagToken> = [];

  const startTagTokenPool = createObjectPool(createStartTagToken);
  const attributeTokenPool = createObjectPool(createAttributeToken);
  const tokenizerOptions: ITokenizerOptions = {
    startTagTokenPool,
    endTagToken: createTagToken(),
    dataToken: createDataToken(),
    attributeTokenPool,
  };

  const containerTagTokenPool = createObjectPool(createTagToken);
  const endTagToken = createTagToken();

  const createForgivingHandler = (handler: ISaxHandler): ISaxHandler => {
    const {
      startTag: startTagCallback,
      endTag: endTagCallback,
    } = handler;

    const forgivingHandler = Object.assign({}, handler);

    forgivingHandler.startTag = (token) => {
      token.selfClosing ||= checkVoidTag?.(token) || false;

      if (checkImplicitEndTag) {
        for (let i = nestingDepth - 1; i >= 0; i--) {
          const containerToken = ancestorTokens[i];

          if (checkBoundaryTag?.(containerToken)) {
            break;
          }

          if (checkImplicitEndTag(containerToken as any, token)) {

            if (endTagCallback) {
              for (let j = nestingDepth - 1; j >= i; j--) {
                assignEndTagToken(endTagToken, ancestorTokens[j], token.start);
                endTagCallback(endTagToken);
              }
            }

            nestingDepth = i;
            break;
          }
        }
      }

      startTagCallback?.(token);

      if (!token.selfClosing) {
        assignTagToken(ancestorTokens[nestingDepth++] ||= containerTagTokenPool.take(), token);
      }

      startTagTokenPool.free(token);
      for (const attributeToken of token.attributes) {
        attributeTokenPool.free(attributeToken);
      }
    };

    forgivingHandler.endTag = (token) => {
      for (let i = nestingDepth - 1; i >= 0; i--) {
        if (ancestorTokens[i].name === token.name) {

          if (endTagCallback) {
            for (let j = nestingDepth - 1; j > i; j--) {
              assignEndTagToken(endTagToken, ancestorTokens[j], token.start);
              endTagCallback(endTagToken);
            }
            endTagCallback(token);
          }

          nestingDepth = i;
        }
      }
    };

    return forgivingHandler;
  };

  const write = (handler: ISaxHandler, chunk: string) => {
    chunk ||= '';
    buffer += chunk;
    const index = tokenize(buffer, true, chunkOffset, tokenizerOptions, options, createForgivingHandler(handler));
    buffer = buffer.substr(index);
    chunkOffset += index;
  };

  const parse = (handler: ISaxHandler, chunk: string) => {
    chunk ||= '';
    buffer += chunk;
    const index = tokenize(buffer, false, chunkOffset, tokenizerOptions, options, createForgivingHandler(handler));

    if (handler.endTag) {
      for (let i = nestingDepth - 1; i >= 0; i--) {
        assignEndTagToken(endTagToken, ancestorTokens[i], chunkOffset + index);
        handler.endTag(endTagToken);
      }
    }

    reset();
  };

  const reset = (): void => {
    buffer = '';
    chunkOffset = 0;
    ancestorTokens.length = nestingDepth = 0;
  };

  return {
    reset,
    write,
    parse,
  };
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
