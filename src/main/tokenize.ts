import {ObjectPool} from '@smikhalevski/object-pool';
import {
  IArrayLike,
  IAttributeToken,
  IDataToken,
  IEndTagToken,
  IParserOptions,
  ISaxHandler,
  IStartTagToken,
  TokenType,
} from './parser-types';
import {CharCode} from './CharCode';

/**
 * Reads attributes from the source.
 *
 * @param chunk The string to read attributes from.
 * @param index The index in `chunk` from which to start reading.
 * @param chunkOffset The offset of the `chunk` in scope of the whole input.
 * @param attributes An array-like object to which {@link IAttributeToken} objects are added.
 * @param options Tokenization options.
 * @param parserOptions Parsing options.
 * @returns The index in `chunk` at which reading was completed.
 */
export function tokenizeAttributes(
    chunk: string,
    index: number,
    chunkOffset: number,
    attributes: IArrayLike<IAttributeToken>,
    options: ITokenizerOptions,
    parserOptions: IParserOptions,
): number {

  return index;
}

export interface ITokenizerOptions {
  startTagTokenPool: ObjectPool<IStartTagToken>;
  attributeTokenPool: ObjectPool<IAttributeToken>;
  endTagToken: IEndTagToken;
  dataToken: IDataToken;
}

/**
 * Reads markup tokens from the string.
 *
 * **Note:** Tokenizer doesn't return allocated tokens back to pools.
 *
 * @param chunk The chunk of the input to read tokens from.
 * @param streaming If set to `true` then tokenizer stops when an ambiguous char sequence is met.
 * @param chunkOffset The offset of the `chunk` in scope of the whole input.
 * @param options Tokenization options.
 * @param parserOptions Parsing options.
 * @param handler SAX handler that is notified about parsed tokens.
 * @returns The index in `chunk` right after the last parsed character.
 */
export function tokenize(
    chunk: string,
    streaming: boolean,
    chunkOffset: number,
    options: ITokenizerOptions,
    parserOptions: IParserOptions,
    handler: ISaxHandler,
): number {

  return 0;
}
