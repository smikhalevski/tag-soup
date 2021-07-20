import {ITokenizerOptions, tokenize} from './tokenize';
import {createObjectPool} from './createObjectPool';
import {createAttributeToken, createDataToken, createStartTagToken, createTagToken} from './tokens';
import {IArrayLike, IParser, IParserOptions, ISaxHandler, IStartTagToken, ITagToken} from './parser-types';

/**
 * Creates a new stateful SAX parser.
 */
export function createSaxParser(handler: ISaxHandler, options: IParserOptions = {}): IParser<void> {
  options = Object.assign({}, options);

  let buffer = '';
  let chunkOffset = 0;

  const tokenizerOptions: ITokenizerOptions = {
    startTagTokenPool: createObjectPool(createStartTagToken),
    attributeTokenPool: createObjectPool(createAttributeToken),
    endTagTokenPool: createObjectPool(createTagToken),
    dataTokenPool: createObjectPool(createDataToken),
  };

  handler = createForgivingHandler(handler, tokenizerOptions, options);

  const write = (sourceChunk: string): void => {
    sourceChunk ||= '';
    buffer += sourceChunk;
    const index = tokenize(buffer, true, chunkOffset, tokenizerOptions, options, handler);
    buffer = buffer.substr(index);
    chunkOffset += index;
  };

  const parse = (source?: string): void => {
    source ||= '';
    buffer += source;
    const index = tokenize(buffer, false, chunkOffset, tokenizerOptions, options, handler);
    handler.eof?.(chunkOffset + index);
    reset();
  };

  const reset = (): void => {
    buffer = '';
    chunkOffset = 0;
    handler.reset?.();
  };

  return {
    write,
    parse,
    reset,
  };
}

function createForgivingHandler(handler: ISaxHandler, tokenizerOptions: ITokenizerOptions, options: IParserOptions): ISaxHandler {
  const {
    startTag: startTagCallback,
    endTag: endTagCallback,
    reset: resetCallback,
    eof: eofCallback,
  } = handler;

  const {
    startTagTokenPool,
    attributeTokenPool,
    endTagTokenPool,
  } = tokenizerOptions;

  const {
    checkVoidTag,
    endsAncestorAt,
  } = options;

  const forgivingHandler = Object.assign({}, handler);
  const ancestors: IArrayLike<IStartTagToken> = {length: 0};

  const releaseStartTag = (token: IStartTagToken): void => {
    startTagTokenPool.release(token);

    for (let i = 0; i < token.attributes.length; ++i) {
      attributeTokenPool.release(token.attributes[i]);
    }
  };

  const releaseAncestors = (ancestorIndex: number): void => {
    for (let i = ancestorIndex; i < ancestors.length; ++i) {
      releaseStartTag(ancestors[i]);
      ancestors[i] = undefined as unknown as IStartTagToken;
    }
    ancestors.length = ancestorIndex;
  };

  const triggerImplicitEnd = (endTagCallback: ((token: ITagToken) => void) | undefined, ancestorIndex: number, end: number) => {
    const ancestorCount = ancestors.length;

    if (ancestorIndex < 0 || ancestorIndex >= ancestorCount) {
      return;
    }
    if (endTagCallback != null) {
      const token = endTagTokenPool.take();

      for (let i = ancestorCount - 1; i >= ancestorIndex; --i) {

        token.rawName = ancestors[i].rawName;
        token.name = ancestors[i].name;
        token.start = token.end = end;
        token.nameStart = token.nameEnd = -1;

        endTagCallback(token);
      }
      endTagTokenPool.release(token);
    }
    releaseAncestors(ancestorIndex);
  };

  forgivingHandler.startTag = (token) => {
    const ancestorCount = ancestors.length;

    token.selfClosing ||= checkVoidTag?.(token) || false;

    if (endsAncestorAt != null && ancestorCount !== 0) {
      triggerImplicitEnd(endTagCallback, endsAncestorAt(ancestors, token), token.start);
    }

    startTagCallback?.(token);

    if (token.selfClosing) {
      releaseStartTag(token);
    } else {
      ancestors[ancestors.length++] = token;
    }
  };

  forgivingHandler.endTag = (token) => {
    for (let i = ancestors.length - 1; i >= 0; --i) {
      if (ancestors[i].name !== token.name) {
        continue;
      }
      triggerImplicitEnd(endTagCallback, i + 1, token.start);
      endTagCallback?.(token);
      releaseStartTag(ancestors[i]);
      ancestors.length = i;
      break;
    }
  };

  forgivingHandler.eof = (sourceLength) => {
    triggerImplicitEnd(endTagCallback, 0, sourceLength);
    eofCallback?.(sourceLength);
  };

  forgivingHandler.reset = () => {
    releaseAncestors(0);
    resetCallback?.();
  };

  return forgivingHandler;
}
