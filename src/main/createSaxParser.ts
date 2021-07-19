import {ITokenizerOptions, tokenize} from './tokenize';
import {createObjectPool} from './createObjectPool';
import {createAttributeToken, createDataToken, createStartTagToken, createTagToken} from './tokens';
import {IArrayLike, IParser, IParserOptions, ISaxHandler, IStartTagToken, ITagToken} from './parser-types';

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

  const ancestorTokens: IArrayLike<IStartTagToken> = {length: 0};

  const startTagTokenPool = createObjectPool(createStartTagToken);
  const endTagTokenPool = createObjectPool(createTagToken);
  const attributeTokenPool = createObjectPool(createAttributeToken);

  const tokenizerOptions: ITokenizerOptions = {
    startTagTokenPool,
    endTagTokenPool,
    dataTokenPool: createObjectPool(createDataToken),
    attributeTokenPool,
  };

  const freeStartTagToken = (token: IStartTagToken): void => {
    startTagTokenPool.free(token);

    for (let i = 0; i < token.attributes.length; i++) {
      attributeTokenPool.free(token.attributes[i]);
    }
  };

  const triggerEndTagCallbackForAncestors = (endTagCallback: ((token: ITagToken) => void) | undefined, ancestorIndex: number, end: number) => {
    const ancestorCount = ancestorTokens.length;

    if (endTagCallback != null && ancestorCount > ancestorIndex) {
      const token = endTagTokenPool.take();

      for (let i = ancestorCount - 1; i >= ancestorIndex; --i) {

        token.rawName = ancestorTokens[i].rawName;
        token.name = ancestorTokens[i].name;
        token.start = token.end = end;
        token.nameStart = token.nameEnd = -1;

        endTagCallback(token);
      }
      endTagTokenPool.free(token);
    }
    for (let i = ancestorIndex; i < ancestorCount; ++i) {
      freeStartTagToken(ancestorTokens[i]);
    }
    ancestorTokens.length = ancestorIndex;
  };

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
          if (checkBoundaryTag?.(ancestorTokens[i])) {
            break;
          }
          if (checkImplicitEndTag(ancestorTokens[i], token)) {
            triggerEndTagCallbackForAncestors(endTagCallback, i, token.start);
            break;
          }
        }
      }

      startTagCallback?.(token);

      if (token.selfClosing) {
        freeStartTagToken(token);
      } else {
        ancestorTokens[ancestorTokens.length++] = token;
      }
    };

    forgivingHandler.endTag = (token) => {
      for (let i = ancestorTokens.length - 1; i >= 0; --i) {
        if (ancestorTokens[i].name !== token.name) {
          continue;
        }
        triggerEndTagCallbackForAncestors(endTagCallback, i + 1, token.start);
        endTagCallback?.(token);
        freeStartTagToken(ancestorTokens[i]);
        ancestorTokens.length = i;
        break;
      }
    };

    return forgivingHandler;
  };

  const write = (handler: ISaxHandler, chunk: string): void => {
    chunk ||= '';
    buffer += chunk;
    let index;
    try {
      index = tokenize(buffer, true, chunkOffset, tokenizerOptions, options, createForgivingHandler(handler));
    } catch (error) {
      reset();
      throw error;
    }
    buffer = buffer.substr(index);
    chunkOffset += index;
  };

  const parse = (handler: ISaxHandler, chunk: string): void => {
    chunk ||= '';
    buffer += chunk;
    const endTagCallback = handler.endTag;
    try {
      const index = tokenize(buffer, false, chunkOffset, tokenizerOptions, options, createForgivingHandler(handler));
      triggerEndTagCallbackForAncestors(endTagCallback, 0, chunkOffset + index);
    } finally {
      reset();
    }
  };

  const reset = (): void => {
    for (let i = 0; i < ancestorTokens.length; ++i) {
      freeStartTagToken(ancestorTokens[i]);
    }
    buffer = '';
    ancestorTokens.length = chunkOffset = 0;
  };

  return {
    write,
    parse,
    reset,
  };
}
