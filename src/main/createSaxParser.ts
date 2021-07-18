import {ITokenizerOptions, tokenize} from './tokenize';
import {createObjectPool} from './createObjectPool';
import {createAttributeToken, createDataToken, createStartTagToken, createTagToken} from './tokens';
import {IParser, IParserOptions, IXmlSaxHandler} from './parser-types';
import {ITagToken} from './token-types';

/**
 * Creates a new streaming forgiving SAX parser.
 */
export function createSaxParser(options: IParserOptions = {}): IParser<IXmlSaxHandler, void> {
  const {
    checkVoidTag,
    checkImplicitEndTag,
    checkFragmentTag,
  } = options;

  let buffer = '';
  let offset = 0;

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

  let containerTokens: Array<ITagToken> = [];
  let depth = 0;

  const createForgivingHandler = (handler: IXmlSaxHandler): IXmlSaxHandler => {
    const {
      startTag: startTagCallback,
      endTag: endTagCallback,
    } = handler;

    const forgivingHandler = Object.assign({}, handler);

    forgivingHandler.startTag = (token) => {
      token.selfClosing ||= checkVoidTag?.(token) || false;

      if (checkImplicitEndTag) {
        for (let i = depth - 1; i >= 0; i--) {
          const containerToken = containerTokens[i];

          if (checkFragmentTag?.(containerToken)) {
            break;
          }

          if (checkImplicitEndTag(containerToken as any, token)) {

            if (endTagCallback) {
              for (let j = depth - 1; j >= i; j--) {
                assignEndTagToken(endTagToken, containerTokens[j], token.start);
                endTagCallback(endTagToken);
              }
            }

            depth = i;
            break;
          }
        }
      }

      startTagCallback?.(token);

      if (!token.selfClosing) {
        assignTagToken(containerTokens[depth++] ||= containerTagTokenPool.take(), token);
      }

      startTagTokenPool.free(token);
      for (const attributeToken of token.attributes) {
        attributeTokenPool.free(attributeToken);
      }
    };

    forgivingHandler.endTag = (token) => {
      for (let i = depth - 1; i >= 0; i--) {
        if (containerTokens[i].name === token.name) {

          if (endTagCallback) {
            for (let j = depth - 1; j > i; j--) {
              assignEndTagToken(endTagToken, containerTokens[j], token.start);
              endTagCallback(endTagToken);
            }
            endTagCallback(token);
          }

          depth = i;
        }
      }
    };

    return forgivingHandler;
  };

  const write = (handler: IXmlSaxHandler, chunk: string) => {
    chunk ||= '';
    buffer += chunk;
    const index = tokenize(buffer, true, offset, tokenizerOptions, options, createForgivingHandler(handler));
    buffer = buffer.substr(index);
    offset += index;
  };

  const parse = (handler: IXmlSaxHandler, chunk: string) => {
    chunk ||= '';
    buffer += chunk;
    const index = tokenize(buffer, false, offset, tokenizerOptions, options, createForgivingHandler(handler));

    if (handler.endTag) {
      for (let i = depth - 1; i >= 0; i--) {
        assignEndTagToken(endTagToken, containerTokens[i], offset + index);
        handler.endTag(endTagToken);
      }
    }

    reset();
  };

  const reset = (): void => {
    buffer = '';
    offset = 0;
    containerTokens.length = depth = 0;
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
