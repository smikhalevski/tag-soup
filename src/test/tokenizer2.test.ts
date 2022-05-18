import {TokenHandler} from 'tokenizer-dsl';
import {tokenizer, Type} from '../main/tokenize2';

describe('', () => {

  const tokenCallbackMock = jest.fn();
  const errorCallbackMock = jest.fn();
  const unrecognizedTokenCallbackMock = jest.fn();

  const handler: TokenHandler = {
    token(type, chunk, offset, length, context, state) {
      tokenCallbackMock(type, state.chunkOffset + offset, length, /*context*/);
    },
    error(type, chunk, offset, errorCode, context, state) {
      errorCallbackMock(type, state.chunkOffset + offset, errorCode, /*context*/);
    },
    unrecognizedToken(chunk, offset, context, state) {
      unrecognizedTokenCallbackMock(state.chunkOffset + offset, /*context*/);
    }
  };

  const context = undefined;

  beforeEach(() => {
    tokenCallbackMock.mockRestore();
    errorCallbackMock.mockRestore();
    unrecognizedTokenCallbackMock.mockRestore();
  });

  test('tokenizes text', () => {
    tokenizer('aaa', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.TEXT, 0, 3);
  });

  test('tokenizes the start tag without attributes', () => {
    tokenizer('<a>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 2, 1);
  });

  test('tokenizes the start tag with attributes', () => {
    tokenizer('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb">', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, Type.ATTRIBUTE_NAME, 7, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, Type.ATTRIBUTE_APOS_VALUE, 11, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, Type.ATTRIBUTE_NAME, 22, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, Type.ATTRIBUTE_QUOT_VALUE, 26, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(7, Type.START_TAG_CLOSING, 35, 1);
  });

  test('tokenizes the start tag without attributes and with spaces before the greater-then char', () => {
    tokenizer('<a   >', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 5, 1);
  });

  test('tokenizes the end tag', () => {
    tokenizer('</a   >', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.END_TAG_OPENING, 0, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.END_TAG_CLOSING, 3, 4);
  });

  test('tokenizes the self-closing tag without attributes', () => {
    tokenizer('<a/>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 2, 2);
  });

  test('tokenizes the self-closing tag with attributes', () => {
    tokenizer('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb"  />', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, Type.ATTRIBUTE_NAME, 7, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, Type.ATTRIBUTE_APOS_VALUE, 11, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, Type.ATTRIBUTE_NAME, 22, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, Type.ATTRIBUTE_QUOT_VALUE, 26, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(7, Type.START_TAG_CLOSING, 37, 2);
  });

  test('does not tokenize self-closing tag with the unquoted attribute that ends with a slash', () => {
    tokenizer('<a foo=123//>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, Type.ATTRIBUTE_UNQUOTED_VALUE, 7, 5);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, Type.START_TAG_CLOSING, 12, 1);
  });

  test('tokenizes the start tag with the invalid syntax as a text', () => {
    tokenizer('< a>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.TEXT, 0, 4);
  });

  test('tokenizes the start tag that starts with the weird char as text', () => {
    tokenizer('<@#$%*>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.TEXT, 0, 7);
  });

  test('tokenizes the start tag that contain weird chars and starts with the valid name char', () => {
    tokenizer('<a@#$%*>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 7, 1);
  });

  test('tokenizes the end tag with the invalid syntax as text', () => {
    tokenizer('</ a>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.TEXT, 0, 5);
  });

  test('ignores bullshit in closing tags', () => {
    tokenizer('</a @#$%*/>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.END_TAG_OPENING, 0, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.END_TAG_CLOSING, 3, 8);
  });

  test('tokenizes the trailing text', () => {
    tokenizer('<a>okay', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 2, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, Type.TEXT, 3, 4);
  });

  test('malformed tag becomes part of continuous text', () => {
    tokenizer('aaa< /a>bbb<b>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.TEXT, 0, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.TEXT, 3, 8);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, Type.START_TAG_OPENING, 11, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, Type.START_TAG_CLOSING, 13, 1);
  });

  test('emits start tag with attributes', () => {
    tokenizer('<a foo bar=eee>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(5);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, Type.ATTRIBUTE_NAME, 7, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, Type.ATTRIBUTE_UNQUOTED_VALUE, 11, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, Type.START_TAG_CLOSING, 14, 1);
  });



















  test('tokenizes start tag opening', () => {
    tokenizer('<aaa', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 4);
  });

  test('tokenizes start tag with space', () => {
    tokenizer('<aaa >', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 5, 1);
  });

  test('tokenizes ', () => {
    tokenizer('<aaa bbb = "ccc"', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, Type.ATTRIBUTE_NAME, 5, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, Type.ATTRIBUTE_QUOT_VALUE, 11, 5);
  });
});
