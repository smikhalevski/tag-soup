import {ITokenizerOptions, tokenize} from './tokenize';
import {ObjectPool} from '@smikhalevski/object-pool';
import {createAttributeToken, createDataToken, createEndTagToken, createStartTagToken} from './tokens';
import {IArrayLike, IParser, IParserOptions, ISaxHandler, IStartTagToken} from './parser-types';

/**
 * Creates a new stateful SAX parser.
 *
 * @param handler The parsing handler.
 * @param options Parsing options.
 */
export function createSaxParser(handler: ISaxHandler, options?: IParserOptions): IParser<void> {
  const opts = {...options};

  let buffer = '';
  let chunkOffset = 0;

  const tokenizerOptions: ITokenizerOptions = {
    startTagTokenPool: new ObjectPool(createStartTagToken),
    attributeTokenPool: new ObjectPool(createAttributeToken),
    endTagToken: createEndTagToken(),
    dataToken: createDataToken(),
  };

  const forgivingHandler = createForgivingHandler(handler, tokenizerOptions, opts);

  const write = (sourceChunk: string): void => {
    sourceChunk ||= '';
    buffer += sourceChunk;
    const index = tokenize(buffer, true, chunkOffset, tokenizerOptions, opts, forgivingHandler);
    buffer = buffer.substr(index);
    chunkOffset += index;
  };

  const parse = (source?: string): void => {
    source ||= '';
    buffer += source;
    const index = tokenize(buffer, false, chunkOffset, tokenizerOptions, opts, forgivingHandler);
    forgivingHandler.sourceEnd?.(chunkOffset + index);
    reset();
  };

  const reset = (): void => {
    buffer = '';
    chunkOffset = 0;
    forgivingHandler.reset?.();
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
    sourceEnd: sourceEndCallback,
  } = handler;

  const {
    startTagTokenPool,
    attributeTokenPool,
  } = tokenizerOptions;

  const {
    checkVoidTag,
    endsAncestorAt,
  } = options;

  const endTagToken = createEndTagToken();
  const forgivingHandler = {...handler};
  const ancestors: IArrayLike<IStartTagToken> = {length: 0};

  const releaseStartTag = (token: IStartTagToken): void => {
    startTagTokenPool.release(token);

    for (let i = 0; i < token.attributes.length; ++i) {
      attributeTokenPool.release(token.attributes[i]);
    }
  };

  if (!startTagCallback && !endTagCallback) {
    forgivingHandler.startTag = releaseStartTag;
    return forgivingHandler;
  }

  const releaseAncestors = (ancestorIndex: number): void => {
    for (let i = ancestorIndex; i < ancestors.length; ++i) {
      releaseStartTag(ancestors[i]);
      ancestors[i] = undefined as unknown as IStartTagToken;
    }
    ancestors.length = ancestorIndex;
  };

  const triggerImplicitEnd = (ancestorIndex: number, end: number) => {
    if (ancestorIndex % 1 !== 0 || ancestorIndex < 0 || ancestorIndex >= ancestors.length) {
      return;
    }
    if (!endTagCallback) {
      releaseAncestors(ancestorIndex);
      return;
    }

    for (let i = ancestors.length - 1; i >= ancestorIndex; --i) {

      endTagToken.rawName = ancestors[i].rawName;
      endTagToken.name = ancestors[i].name;
      endTagToken.start = endTagToken.end = end;
      endTagToken.nameStart = endTagToken.nameEnd = -1;

      endTagCallback(endTagToken);
    }
    releaseAncestors(ancestorIndex);
  };

  forgivingHandler.startTag = (token) => {
    token.selfClosing ||= checkVoidTag?.(token) || false;

    if (endsAncestorAt != null && ancestors.length !== 0) {
      triggerImplicitEnd(endsAncestorAt(ancestors, token), token.start);
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
      triggerImplicitEnd(i + 1, token.start);
      endTagCallback?.(token);
      releaseStartTag(ancestors[i]);
      ancestors.length = i;
      break;
    }
  };

  forgivingHandler.sourceEnd = (sourceLength) => {
    triggerImplicitEnd(0, sourceLength);
    sourceEndCallback?.(sourceLength);
  };

  forgivingHandler.reset = () => {
    releaseAncestors(0);
    resetCallback?.();
  };

  return forgivingHandler;
}
