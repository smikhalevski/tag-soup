import {lowerCase} from './parser-utils';
import {ITokenizerOptions, tokenize} from './tokenize';
import {createValuePool} from './createValuePool';
import {createAttrToken, createDataToken, createStartTagToken, createTagToken} from './token-pools';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {ISaxParser, ISaxParserOptions} from './sax-parser-types';

const xmlDecoder = createEntitiesDecoder();

/**
 * Creates a streaming SAX parser that doesn't validate the order of tags. This is the fastest parser variation.
 *
 * @see createForgivingSaxParser
 */
export function createSaxParser(options: ISaxParserOptions = {}): ISaxParser {
  const {
    xmlEnabled,
    decodeAttr = xmlDecoder,
    decodeText = xmlDecoder,
    renameTag = xmlEnabled ? undefined : lowerCase,
    renameAttr = xmlEnabled ? undefined : lowerCase,

    onReset,
    onWrite,
    onParse,
    onError,
  } = options;

  let buffer = '';
  let offset = 0;
  let parsedCharCount = 0;

  const attrTokenPool = createValuePool(createAttrToken);

  const tokenizerOptions: ITokenizerOptions = Object.assign({}, options, {
    decodeAttr,
    decodeText,
    renameTag,
    renameAttr,

    startTagToken: createStartTagToken(),
    endTagToken: createTagToken(),
    dataToken: createDataToken(),
    attrTokenPool,
  });

  const handleError = (error: any): void => {
    attrTokenPool.freeAll();
    if (onError) {
      onError(error);
    } else {
      throw error;
    }
  };

  const reset = (): void => {
    attrTokenPool.freeAll();
    buffer = '';
    offset = 0;
    try {
      onReset?.();
    } catch (error) {
      handleError(error);
    }
  };

  return {

    getBuffer() {
      return buffer;
    },

    reset,

    write(chunk) {
      chunk ??= '';
      buffer += chunk;
      try {
        const l = tokenize(buffer, true, offset, tokenizerOptions);
        parsedCharCount += l;

        buffer = buffer.substr(l);
        offset += l;
        onWrite?.('' + chunk, parsedCharCount);
      } catch (error) {
        handleError(error);
      }
    },

    parse(chunk) {
      chunk ??= '';
      buffer += chunk;
      try {
        const l = tokenize(buffer, false, offset, tokenizerOptions);
        parsedCharCount += l;

        onParse?.('' + chunk, parsedCharCount);
      } catch (error) {
        handleError(error);
      }
      reset();
    },
  };
}
