import {ITokenizerOptions, tokenize} from './tokenize';
import {createObjectPool} from './createObjectPool';
import {createAttributeToken, createDataToken, createStartTagToken, createTagToken} from './tokens';
import {IArrayLike, IParser, IParserOptions, ISaxHandler, IStartTagToken, ITagToken} from './parser-types';

/**
 * Creates a new stateful SAX parser.
 */
export function createSaxParser(options: IParserOptions = {}): IParser<ISaxHandler, void> {
  const {
    checkVoidTag,
    endsAncestorAt,
  } = options;

  let buffer = '';
  let chunkOffset = 0;

  const ancestorTagTokens: IArrayLike<IStartTagToken> = {length: 0};

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
    startTagTokenPool.release(token);

    for (let i = 0; i < token.attributes.length; i++) {
      attributeTokenPool.release(token.attributes[i]);
    }
  };




  const triggerEndTagCallbackForAncestors = (endTagCallback: ((token: ITagToken) => void) | undefined, ancestorIndex: number, end: number) => {
    const ancestorCount = ancestorTagTokens.length;

    if (endTagCallback != null && ancestorCount > ancestorIndex) {
      const token = endTagTokenPool.take();

      for (let i = ancestorCount - 1; i >= ancestorIndex; --i) {

        token.rawName = ancestorTagTokens[i].rawName;
        token.name = ancestorTagTokens[i].name;
        token.start = token.end = end;
        token.nameStart = token.nameEnd = -1;

        endTagCallback(token);
      }
      endTagTokenPool.release(token);
    }
    for (let i = ancestorIndex; i < ancestorCount; ++i) {
      freeStartTagToken(ancestorTagTokens[i]);
    }
    ancestorTagTokens.length = ancestorIndex;
  };









  const createForgivingHandler = (handler: ISaxHandler): ISaxHandler => {
    const {
      startTag: startTagCallback,
      endTag: endTagCallback,
    } = handler;

    const forgivingHandler = Object.assign({}, handler);

    forgivingHandler.startTag = (token) => {
      token.selfClosing ||= checkVoidTag?.(token) || false;

      if (endsAncestorAt != null && ancestorTagTokens.length !== 0) {

        const i = endsAncestorAt(ancestorTagTokens, token);

        if (i >= 0 && i < ancestorTagTokens.length) {
          triggerEndTagCallbackForAncestors(endTagCallback, i, token.start);
        }
      }

      startTagCallback?.(token);

      if (token.selfClosing) {
        freeStartTagToken(token);
      } else {
        ancestorTagTokens[ancestorTagTokens.length++] = token;
      }
    };

    forgivingHandler.endTag = (token) => {
      for (let i = ancestorTagTokens.length - 1; i >= 0; --i) {
        if (ancestorTagTokens[i].name !== token.name) {
          continue;
        }
        triggerEndTagCallbackForAncestors(endTagCallback, i + 1, token.start);
        endTagCallback?.(token);
        freeStartTagToken(ancestorTagTokens[i]);
        ancestorTagTokens.length = i;
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
    for (let i = 0; i < ancestorTagTokens.length; ++i) {
      freeStartTagToken(ancestorTagTokens[i]);
    }
    buffer = '';
    ancestorTagTokens.length = chunkOffset = 0;
  };

  return {
    write,
    parse,
    reset,
  };
}
