import {lowerCase} from './utils';
import {ITokenizerOptions, tokenize} from './tokenize';
import {createObjectPool} from './createObjectPool';
import {createAttrToken, createDataToken, createStartTagToken, createTagToken} from './tokens';
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
    decodeText = xmlDecoder,
    decodeAttr = decodeText,
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

  const attrTokenPool = createObjectPool(createAttrToken);

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
    if (onError) {
      onError(error);
    } else {
      throw error;
    }
  };

  const reset = (): void => {
    buffer = '';
    offset = parsedCharCount = 0;
    try {
      onReset?.();
    } catch (error) {
      handleError(error);
    }
  };

  const getBuffer = () => buffer;

  const write = (chunk: string) => {
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
  };

  const parse = (str: string) => {
    str ??= '';
    buffer += str;
    try {
      const l = tokenize(buffer, false, offset, tokenizerOptions);
      parsedCharCount += l;

      onParse?.('' + str, parsedCharCount);
    } catch (error) {
      handleError(error);
    }
    reset();
  };

  return {
    getBuffer,
    reset,
    write,
    parse,
  };
}
