import {Tokenizer} from 'tokenizer-dsl';
import {createTokenizer, Type} from '../main/tokenize2';

describe('', () => {

  const tokenMock = jest.fn();
  const errorMock = jest.fn();
  const unrecognizedTokenMock = jest.fn();

  let tokenizer: Tokenizer<any, any, any>;

  beforeEach(() => {

    tokenMock.mockRestore();
    errorMock.mockRestore();
    unrecognizedTokenMock.mockRestore();

    tokenizer = createTokenizer({
      token: tokenMock,
      error: errorMock,
      unrecognizedToken: unrecognizedTokenMock,
    });
  });

  test('tokenizes text', () => {
    tokenizer.end('aaa');

    expect(tokenMock).toHaveBeenCalledTimes(1);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.TEXT, 0, 3);
  });

  test('tokenizes the start tag without attributes', () => {
    tokenizer.end('<a>');

    expect(tokenMock).toHaveBeenCalledTimes(2);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 2, 1);
  });

  test('tokenizes the start tag with attributes', () => {
    tokenizer.end('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb">');

    expect(tokenMock).toHaveBeenCalledTimes(7);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.ATTRIBUTE_NAME, 3, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(3, Type.ATTRIBUTE_NAME, 7, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(4, Type.ATTRIBUTE_APOS_VALUE, 11, 9);
    expect(tokenMock).toHaveBeenNthCalledWith(5, Type.ATTRIBUTE_NAME, 22, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(6, Type.ATTRIBUTE_QUOT_VALUE, 26, 9);
    expect(tokenMock).toHaveBeenNthCalledWith(7, Type.START_TAG_CLOSING, 35, 1);
  });

  test('tokenizes the start tag without attributes and with spaces before the greater-then char', () => {
    tokenizer.end('<a   >');

    expect(tokenMock).toHaveBeenCalledTimes(2);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 5, 1);
  });

  test('tokenizes the end tag', () => {
    tokenizer.end('</a   >');

    expect(tokenMock).toHaveBeenCalledTimes(2);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.END_TAG_OPENING, 0, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.END_TAG_CLOSING, 3, 4);
  });

  test('tokenizes the self-closing tag without attributes', () => {
    tokenizer.end('<a/>');

    expect(tokenMock).toHaveBeenCalledTimes(2);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 2, 2);
  });

  test('tokenizes the self-closing tag with attributes', () => {
    tokenizer.end('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb"  />');

    expect(tokenMock).toHaveBeenCalledTimes(7);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.ATTRIBUTE_NAME, 3, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(3, Type.ATTRIBUTE_NAME, 7, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(4, Type.ATTRIBUTE_APOS_VALUE, 11, 9);
    expect(tokenMock).toHaveBeenNthCalledWith(5, Type.ATTRIBUTE_NAME, 22, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(6, Type.ATTRIBUTE_QUOT_VALUE, 26, 9);
    expect(tokenMock).toHaveBeenNthCalledWith(7, Type.START_TAG_CLOSING, 37, 2);
  });

  test('does not tokenize self-closing tag with the unquoted attribute that ends with a slash', () => {
    tokenizer.end('<a foo=123//>');

    expect(tokenMock).toHaveBeenCalledTimes(4);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.ATTRIBUTE_NAME, 3, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(3, Type.ATTRIBUTE_UNQUOTED_VALUE, 7, 5);
    expect(tokenMock).toHaveBeenNthCalledWith(4, Type.START_TAG_CLOSING, 12, 1);
  });

  test('tokenizes the start tag with the invalid syntax as a text', () => {
    tokenizer.end('< a>');

    expect(tokenMock).toHaveBeenCalledTimes(1);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.TEXT, 0, 4);
  });

  test('tokenizes the start tag that starts with the weird char as text', () => {
    tokenizer.end('<@#$%*>');

    expect(tokenMock).toHaveBeenCalledTimes(1);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.TEXT, 0, 7);
  });

  test('tokenizes the start tag that contain weird chars and starts with the valid name char', () => {
    tokenizer.end('<a@#$%*>');

    expect(tokenMock).toHaveBeenCalledTimes(2);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 7);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 7, 1);
  });

  test('tokenizes the end tag with the invalid syntax as text', () => {
    tokenizer.end('</ a>');

    expect(tokenMock).toHaveBeenCalledTimes(1);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.TEXT, 0, 5);
  });

  test('ignores bullshit in closing tags', () => {
    tokenizer.end('</a @#$%*/>');

    expect(tokenMock).toHaveBeenCalledTimes(2);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.END_TAG_OPENING, 0, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.END_TAG_CLOSING, 3, 8);
  });

  test('tokenizes the trailing text', () => {
    tokenizer.end('<a>okay');

    expect(tokenMock).toHaveBeenCalledTimes(3);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 2, 1);
    expect(tokenMock).toHaveBeenNthCalledWith(3, Type.TEXT, 3, 4);
  });

  test('malformed tag becomes part of continuous text', () => {
    tokenizer.end('aaa< /a>bbb<b>');

    expect(tokenMock).toHaveBeenCalledTimes(4);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.TEXT, 0, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.TEXT, 3, 8);
    expect(tokenMock).toHaveBeenNthCalledWith(3, Type.START_TAG_OPENING, 11, 2);
    expect(tokenMock).toHaveBeenNthCalledWith(4, Type.START_TAG_CLOSING, 13, 1);
  });

  test('emits start tag with attributes', () => {
    tokenizer.end('<a foo bar=eee>');

    expect(tokenMock).toHaveBeenCalledTimes(5);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 2);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.ATTRIBUTE_NAME, 3, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(3, Type.ATTRIBUTE_NAME, 7, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(4, Type.ATTRIBUTE_UNQUOTED_VALUE, 11, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(5, Type.START_TAG_CLOSING, 14, 1);
  });



















  test('tokenizes start tag opening', () => {
    tokenizer.end('<aaa');

    expect(tokenMock).toHaveBeenCalledTimes(1);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 4);
  });

  test('tokenizes start tag with space', () => {
    tokenizer.end('<aaa >');

    expect(tokenMock).toHaveBeenCalledTimes(2);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 4);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.START_TAG_CLOSING, 5, 1);
  });

  test('tokenizes ', () => {
    tokenizer.end('<aaa bbb = "ccc"');

    expect(tokenMock).toHaveBeenCalledTimes(3);
    expect(tokenMock).toHaveBeenNthCalledWith(1, Type.START_TAG_OPENING, 0, 4);
    expect(tokenMock).toHaveBeenNthCalledWith(2, Type.ATTRIBUTE_NAME, 5, 3);
    expect(tokenMock).toHaveBeenNthCalledWith(3, Type.ATTRIBUTE_QUOT_VALUE, 11, 5);
  });
});
