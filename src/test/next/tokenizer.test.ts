import {TokenHandler} from 'tokenizer-dsl';
import {tokenizer} from '../../main/next/tokenizer';
import {LexerContext, TokenType} from '../../main/next/tokenizer-types';
import {getCaseInsensitiveHashCode} from '../../main/next/utils';

describe('tokenizer', () => {

  const tokenCallbackMock = jest.fn();

  const handler: TokenHandler<TokenType, LexerContext> = (type, chunk, offset, length, context, state) => {
    tokenCallbackMock(type, state.chunkOffset + offset, length, /*context*/);
  };

  const context: LexerContext = {
    state: {},
    getHashCode: getCaseInsensitiveHashCode,
  } as unknown as LexerContext;

  beforeEach(() => {
    tokenCallbackMock.mockRestore();
  });

  test('tokenizes text', () => {
    tokenizer('aaa', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 3);
  });

  test('tokenizes the start tag without attributes', () => {
    tokenizer('<a>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
  });

  test('tokenizes the start tag with attributes', () => {
    tokenizer('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb">', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_NAME, 7, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.ATTRIBUTE_VALUE, 11, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.ATTRIBUTE_NAME, 22, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, TokenType.ATTRIBUTE_VALUE, 26, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(7, TokenType.START_TAG_CLOSING, 35, 1);
  });

  test('tokenizes the start tag without attributes and with spaces before the greater-then char', () => {
    tokenizer('<a   >', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 5, 1);
  });

  test('tokenizes the end tag', () => {
    tokenizer('</a   >', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.END_TAG_OPENING, 0, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.END_TAG_CLOSING, 3, 4);
  });

  test('tokenizes the self-closing tag without attributes', () => {
    tokenizer('<a/>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 2);
  });

  test('tokenizes the self-closing tag with attributes', () => {
    tokenizer('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb"  />', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_NAME, 7, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.ATTRIBUTE_VALUE, 11, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.ATTRIBUTE_NAME, 22, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, TokenType.ATTRIBUTE_VALUE, 26, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(7, TokenType.START_TAG_CLOSING, 37, 2);
  });

  test('does not tokenize self-closing tag with the unquoted attribute that ends with a slash', () => {
    tokenizer('<a foo=123//>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_UNQUOTED_VALUE, 7, 5);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 12, 1);
  });

  test('tokenizes the start tag with the invalid syntax as a text', () => {
    tokenizer('< a>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 4);
  });

  test('tokenizes the start tag that starts with the weird char as text', () => {
    tokenizer('<@#$%*>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 7);
  });

  test('tokenizes the start tag that contain weird chars and starts with the valid name char', () => {
    tokenizer('<a@#$%*>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 7, 1);
  });

  test('tokenizes the end tag with the invalid syntax as text', () => {
    tokenizer('</ a>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 5);
  });

  test('ignores bullshit in closing tags', () => {
    tokenizer('</a @#$%*/>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.END_TAG_OPENING, 0, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.END_TAG_CLOSING, 3, 8);
  });

  test('tokenizes the trailing text', () => {
    tokenizer('<a>okay', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.TEXT, 3, 4);
  });

  test('malformed tag becomes part of continuous text', () => {
    tokenizer('aaa< /a>bbb<b>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.TEXT, 3, 8);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_OPENING, 11, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 13, 1);
  });

  test('emits start tag with attributes', () => {
    tokenizer('<a foo bar=eee>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(5);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_NAME, 7, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.ATTRIBUTE_UNQUOTED_VALUE, 11, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.START_TAG_CLOSING, 14, 1);
  });

  test('tokenizes terminated XML comments', () => {
    tokenizer('<!--foo-->', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.COMMENT, 0, 10);
  });

  test('tokenizes unterminated XML comments', () => {
    tokenizer('<!--foo', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.COMMENT, 0, 10);
  });

  test('tokenizes XML comments that contain minuses', () => {
    tokenizer('<!-- foo---->', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.COMMENT, 0, 13);
  });

  test('tokenizes processing instructions', () => {
    tokenizer('<?xml version="1.0"?>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.PROCESSING_INSTRUCTION, 0, 21);
  });

  test('tokenizes unterminated processing instructions as comments', () => {
    tokenizer('<?xml version="1.0"', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.PROCESSING_INSTRUCTION, 0, 21);
  });

  test('tokenizes CDATA sections', () => {
    tokenizer('<![CDATA[hello]]>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.CDATA_SECTION, 0, 17);
  });

  test('tokenizes doctype', () => {
    tokenizer('<!DOCTYPE html>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.DOCTYPE, 0, 15);
  });

  test('tokenizes doctype without spaces', () => {
    tokenizer('<!DOCTYPEhtml>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.DOCTYPE, 0, 14);
  });

  test('tokenizes doctype without value', () => {
    tokenizer('<!DOCTYPE>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.DOCTYPE, 0, 10);
  });

  test('tokenizes start tag opening', () => {
    tokenizer('<aaa', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 4);
  });

  test('tokenizes start tag with space', () => {
    tokenizer('<aaa >', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 5, 1);
  });

  test('tokenizes spaces between attribute name and value', () => {
    tokenizer('<aaa bbb = "ccc"', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 5, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_VALUE, 11, 5);
  });
});
