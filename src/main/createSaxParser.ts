import {ITokenizerOptions, tokenize} from './tokenize';
import {createObjectPool} from './createObjectPool';
import {createAttributeToken, createDataToken, createStartTagToken, createTagToken} from './tokens';
import {IParser, IParserOptions, ISaxHandler, ITagToken} from './parser-types';




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

  const ancestorTokens: any = {};
  ancestorTokens.length = 0;

  const startTagTokenPool = createObjectPool(createStartTagToken);
  const attributeTokenPool = createObjectPool(createAttributeToken);
  const tokenizerOptions: ITokenizerOptions = {
    startTagTokenPool,
    endTagTokenPool: createObjectPool(createTagToken),
    dataTokenPool: createObjectPool(createDataToken),
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
        for (let i = ancestorTokens.length - 1; i >= 0; i--) {
          const containerToken = ancestorTokens[i];

          if (checkBoundaryTag?.(containerToken)) {
            break;
          }

          if (checkImplicitEndTag(containerToken as any, token)) {

            if (endTagCallback) {
              for (let j = ancestorTokens.length - 1; j >= i; j--) {
                assignEndTagToken(endTagToken, ancestorTokens[j], token.start);
                endTagCallback(endTagToken);
              }
            }

            ancestorTokens.length = i;
            break;
          }
        }
      }

      startTagCallback?.(token);

      if (!token.selfClosing) {
        assignTagToken(ancestorTokens[ancestorTokens.length++] ||= containerTagTokenPool.take(), token);
      }

      startTagTokenPool.free(token);
      for (let i = 0; i < token.attributes.length; i++) {
        attributeTokenPool.free(token.attributes[i]);
      }
    };

    forgivingHandler.endTag = (token) => {
      for (let i = ancestorTokens.length - 1; i >= 0; i--) {
        if (ancestorTokens[i].name === token.name) {

          if (endTagCallback) {
            for (let j = ancestorTokens.length - 1; j > i; j--) {
              assignEndTagToken(endTagToken, ancestorTokens[j], token.start);
              endTagCallback(endTagToken);
            }
            endTagCallback(token);
          }

          ancestorTokens.length = i;
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
      for (let i = ancestorTokens.length - 1; i >= 0; i--) {
        assignEndTagToken(endTagToken, ancestorTokens[i], chunkOffset + index);
        handler.endTag(endTagToken);
      }
    }

    reset();
  };

  const reset = (): void => {
    buffer = '';
    chunkOffset = 0;
    ancestorTokens.length = ancestorTokens.length = 0;
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
