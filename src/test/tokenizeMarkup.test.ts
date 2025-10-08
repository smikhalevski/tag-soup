import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ParserError, readTokens, tokenizeMarkup } from '../main/tokenizeMarkup.js';
import { resolveTokenizerOptions } from '../main/createTokenizer.js';

const callbackMock = vi.fn();

beforeEach(() => {
  callbackMock.mockReset();
});

describe('readTokens', () => {
  test('reads empty string', () => {
    readTokens('', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(0);
  });

  test('reads text', () => {
    readTokens('aaa', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
  });

  test('reads the leading lt as text', () => {
    readTokens('>aaa>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 5);
  });

  test('treats gt followed by non tag name character as text', () => {
    readTokens('aaa<+ccc', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 8);
  });

  test('reads the start tag as a text if name begins with a non-valid char', () => {
    readTokens('<@#$%*>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 7);
  });

  test('reads the start tag if name begins with a valid char followed by invalid chars', () => {
    readTokens('<xxx@#$%*>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 9, 10);
  });

  test('ignores bullshit in end tags', () => {
    readTokens('</xxx @#$%*/>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'END_TAG_NAME', 2, 5);
  });

  test('reads the start tag in double brackets', () => {
    readTokens('<<xxx>>aaa</xxx>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 1);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 6, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 12, 15);
  });

  test('reads empty tag names as text', () => {
    readTokens('< ></ >', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 7);
  });

  test('reads non-alpha tag names as text', () => {
    readTokens('<111></111>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 11);
  });

  test('reads the malformed end tag as a text', () => {
    readTokens('</ xxx>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 7);
  });

  test('reads unterminated start tags', () => {
    readTokens('<aaa', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
  });

  test('reads unterminated attributes', () => {
    readTokens('<aaa xxx="zzz', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 13);
  });

  test('reads unterminated end tags', () => {
    readTokens('</aaa', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'END_TAG_NAME', 2, 5);
  });

  test('reads start and end tags', () => {
    readTokens('aaa<xxx>bbb</xxx>ccc', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'TEXT', 17, 20);
  });

  test('parses comments', () => {
    readTokens('aaa<xxx>bbb<!--</xxx>ccc--></xxx>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'COMMENT', 15, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 29, 32);
  });

  test('parses empty comments', () => {
    readTokens('aaa<!---->bbb', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'COMMENT', 7, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 10, 13);
  });

  test('parses body DTD as comment', () => {
    readTokens('aaa<xxx>bbb<!</xxx>ccc--></xxx>', callbackMock, { isFragment: true });

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'COMMENT', 12, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'TEXT', 19, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'END_TAG_NAME', 27, 30);
  });

  test('parse empty DTD as comment', () => {
    readTokens('aaa<!>bbb', callbackMock, { isFragment: true });

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'COMMENT', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 6, 9);
  });

  test('parses processing instructions as comments', () => {
    readTokens('aaa<?xml version="1.0"?>bbb', callbackMock, { isFragment: true });

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'COMMENT', 4, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 24, 27);
  });

  test('parses empty processing instructions as comments', () => {
    readTokens('aaa<?>bbb', callbackMock, { isFragment: true });

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'COMMENT', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 6, 9);
  });

  test('does not reads emojis as tag names', () => {
    readTokens('aaa<❤️>bbb</👨‍❤️‍💋‍👨>ccc', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 27);
  });

  test('reads lt as an attribute name', () => {
    readTokens('<aaa <></aaa>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 6, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 6, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 9, 12);
  });

  test('ignores redundant spaces before start tag closing', () => {
    readTokens('aaa<xxx   >bbb', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 11, 14);
  });

  test('ignores redundant spaces before end tag closing', () => {
    readTokens('aaa</xxx   >bbb', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'END_TAG_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 12, 15);
  });

  test('reads nested tags', () => {
    readTokens('aaa<yyy>bbb<xxx>ccc</xxx>ddd</yyy>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(10);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'TEXT', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'END_TAG_NAME', 21, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'TEXT', 25, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'END_TAG_NAME', 30, 33);
  });

  test('reads single-quoted attributes', () => {
    readTokens("<xxx yyy='aaa\"bbb' zzz='aaa\"bbb'>", callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_NAME', 19, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'ATTRIBUTE_VALUE', 24, 31);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 32, 33);
  });

  test('reads double-quoted attributes', () => {
    readTokens('<xxx yyy="aaa\'bbb" zzz="aaa\'bbb">', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_NAME', 19, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'ATTRIBUTE_VALUE', 24, 31);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 32, 33);
  });

  test('reads unquoted attributes', () => {
    readTokens('<xxx yyy=aaa"bbb\'ccc>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 9, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 20, 21);
  });

  test('reads valueless attributes', () => {
    readTokens('<xxx aaa bbb>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 9, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_NAME', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'ATTRIBUTE_VALUE', 12, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 12, 13);
  });

  test('reads valueless unquoted attributes', () => {
    readTokens('<xxx aaa= bbb=>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 14, 15);
  });

  test('reads entities in attributes', () => {
    readTokens('<xxx aaa=&amp; bbb="&amp;" ccc=\'&amp;\' ddd=>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(10);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 9, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_NAME', 15, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'ATTRIBUTE_VALUE', 20, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'ATTRIBUTE_NAME', 27, 30);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'ATTRIBUTE_VALUE', 32, 37);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'ATTRIBUTE_NAME', 39, 42);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'ATTRIBUTE_VALUE', 43, 43);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'START_TAG_CLOSING', 43, 44);
  });

  test('ignores leading slash in an attribute name', () => {
    readTokens('<aaa /xxx></xxx aaa>bbb', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 9, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'TEXT', 20, 23);
  });

  test('reads bullshit attribute names', () => {
    readTokens("<xxx < = '' fff>vvv</xxx>", callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(8);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'ATTRIBUTE_VALUE', 15, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'TEXT', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'END_TAG_NAME', 21, 24);
  });

  test('reads attributes with unbalanced end quotes', () => {
    readTokens('<xxx yyy="aaa"bbb">', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_NAME', 14, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'ATTRIBUTE_VALUE', 18, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 18, 19);
  });

  test('does not read self-closing tags by default', () => {
    readTokens('<xxx/>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 5, 6);
  });

  test('reads self-closing tag', () => {
    readTokens('<xxx/>', callbackMock, { isSelfClosingTagsRecognized: true });

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_SELF_CLOSING', 4, 6);
  });

  test('does not read self-closing tag with the unquoted attribute that ends with a slash', () => {
    readTokens('<xxx aaa=bbb//>', callbackMock, { isSelfClosingTagsRecognized: true });

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_SELF_CLOSING', 13, 15);
  });

  test('ignores redundant spaces in attributes', () => {
    readTokens('aaa<yyy xxx   =   "zzz">bbb', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_NAME', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_VALUE', 19, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 23, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'TEXT', 24, 27);
  });

  test('does not read tags in double-quoted attribute', () => {
    readTokens('<aaa xxx="bbb<zzz>ccc</zzz>">', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 28, 29);
  });

  test('does not read tags in single-quoted attribute', () => {
    readTokens("<aaa xxx='bbb<zzz>ccc</zzz>'>", callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 28, 29);
  });

  test('does not read tags in unquoted attribute', () => {
    readTokens('<aaa xxx=bbb<zzz>ccc</zzz>>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 9, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 16, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'TEXT', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 22, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'TEXT', 26, 27);
  });

  test('ignores tags in raw text tags', () => {
    readTokens('<script><aaa>bbb</aaa></script>', callbackMock, resolveTokenizerOptions({ rawTextTags: ['script'] }));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 8, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 24, 30);
  });

  test('reads attributes of a raw text tag', () => {
    readTokens(
      '<script aaa="xxx" ccc="yyy">zzz</script>',
      callbackMock,
      resolveTokenizerOptions({ rawTextTags: ['script'] })
    );

    expect(callbackMock).toHaveBeenCalledTimes(8);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_NAME', 18, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'ATTRIBUTE_VALUE', 23, 26);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 27, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'TEXT', 28, 31);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'END_TAG_NAME', 33, 39);
  });

  test('ignores comments in raw text tags', () => {
    readTokens('<script><!-->bbb</--></script>', callbackMock, resolveTokenizerOptions({ rawTextTags: ['script'] }));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 8, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 23, 29);
  });

  test('matches case-insensitive end raw text tags', () => {
    readTokens(
      '<script><!-->bbb</--></SCRIPT>',
      callbackMock,
      resolveTokenizerOptions({ rawTextTags: ['script'], isCaseInsensitiveTags: true })
    );

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 8, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 23, 29);
  });

  test('reads lower-case DOCTYPE', () => {
    readTokens('<!doctype html>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 10, 14);
  });

  test('reads empty DOCTYPE', () => {
    readTokens('<!doctype>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 9, 9);
  });

  test('reads DOCTYPE name without separating spaces', () => {
    readTokens('<!doctypehtml   >', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 9, 13);
  });

  test('ignores spaces surrounding DOCTYPE', () => {
    readTokens('   <!DOCTYPE>   ', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 12, 12);
  });

  test('reads non-empty DOCTYPE', () => {
    readTokens('<!DOCTYPE html>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 10, 14);
  });

  test('reads DOCTYPE after comment', () => {
    readTokens('<!--xxx-->   \n\n   <!DOCTYPE html>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'DOCTYPE_NAME', 28, 32);
  });

  test('reads DOCTYPE and processing instruction after comment', () => {
    readTokens('<!--xxx-->   \n\n   <!DOCTYPE html><!--xxx-->   \n\n   <?xml aaa?>', callbackMock, {
      isProcessingInstructionRecognized: true,
    });

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'DOCTYPE_NAME', 28, 32);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'COMMENT', 37, 40);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'PROCESSING_INSTRUCTION_TARGET', 53, 56);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'PROCESSING_INSTRUCTION_DATA', 57, 60);
  });

  test('reads processing instruction and DOCTYPE separated with spaces', () => {
    readTokens('   <?xml aaa?>   <!DOCTYPE html>   ', callbackMock, { isProcessingInstructionRecognized: true });

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'PROCESSING_INSTRUCTION_TARGET', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'PROCESSING_INSTRUCTION_DATA', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'DOCTYPE_NAME', 27, 31);
  });

  test('reads quirky comment before DOCTYPE', () => {
    readTokens('   <?xml aaa?>   <!DOCTYPE html>   ', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'DOCTYPE_NAME', 27, 31);
  });

  test('reads quirky comment in a container', () => {
    readTokens('   <aaa>   <?xml bbb?>   </aaa>   ', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'COMMENT', 12, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'TEXT', 22, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 27, 30);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'TEXT', 31, 34);
  });

  test('closes prolog with DOCTYPE after text', () => {
    readTokens('<!DOCTYPE html>aaa<?xml aaa?>', callbackMock, { isProcessingInstructionRecognized: true });

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 10, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'TEXT', 15, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'PROCESSING_INSTRUCTION_TARGET', 20, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'PROCESSING_INSTRUCTION_DATA', 24, 27);
  });

  test('closes prolog with processing instruction after text', () => {
    readTokens('<?xml aaa?>aaa<!DOCTYPE html>', callbackMock, { isProcessingInstructionRecognized: true });

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'PROCESSING_INSTRUCTION_TARGET', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'PROCESSING_INSTRUCTION_DATA', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'COMMENT', 15, 28);
  });

  test('closes multiple processing instruction in prolog', () => {
    readTokens('   <?xml aaa?>  <?xml bbb?>  <?xml ccc?>', callbackMock, { isProcessingInstructionRecognized: true });

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'PROCESSING_INSTRUCTION_TARGET', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'PROCESSING_INSTRUCTION_DATA', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'PROCESSING_INSTRUCTION_TARGET', 18, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'PROCESSING_INSTRUCTION_DATA', 22, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'PROCESSING_INSTRUCTION_TARGET', 31, 34);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'PROCESSING_INSTRUCTION_DATA', 35, 38);
  });

  test('closes prolog after tag', () => {
    readTokens('<?xml aaa?><aaa><!DOCTYPE html>', callbackMock, { isProcessingInstructionRecognized: true });

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'PROCESSING_INSTRUCTION_TARGET', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'PROCESSING_INSTRUCTION_DATA', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'COMMENT', 17, 30);
  });

  test('closes prolog after text', () => {
    readTokens('<?xml aaa?>aaa<!DOCTYPE html>', callbackMock, { isProcessingInstructionRecognized: true });

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'PROCESSING_INSTRUCTION_TARGET', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'PROCESSING_INSTRUCTION_DATA', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'COMMENT', 15, 28);
  });

  test('reads CDATA as comment', () => {
    readTokens('<![CDATA[]]>', callbackMock, {});

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 1, 11);
  });

  test('reads empty CDATA', () => {
    readTokens('<![CDATA[]]>', callbackMock, { isCDATARecognized: true });

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'CDATA_SECTION', 9, 9);
  });

  test('reads non-empty CDATA', () => {
    readTokens('<![CDATA[aaa]]>', callbackMock, { isCDATARecognized: true });

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'CDATA_SECTION', 9, 12);
  });

  test('ignores CDATA in raw tag', () => {
    readTokens(
      '<aaa><![CDATA[aaa]]></aaa>',
      callbackMock,
      resolveTokenizerOptions({ rawTextTags: ['aaa'], isCDATARecognized: true })
    );

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 22, 25);
  });

  test('does not read tags inside CDATA', () => {
    readTokens('<![CDATA[<aaa>bbb</aaa>]]>', callbackMock, resolveTokenizerOptions({ isCDATARecognized: true }));

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'CDATA_SECTION', 9, 23);
  });

  test('strict throws if invalid char in start tag', () => {
    expect(() => readTokens('<aaa ///', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError("Expected an attribute name or a start tag closing ('>').", '<aaa ///', 5, 6)
    );
  });

  test('strict throws if invalid char in self-closing start tag', () => {
    expect(() =>
      readTokens(
        '<aaa ///',
        callbackMock,
        resolveTokenizerOptions({ isStrict: true, isSelfClosingTagsRecognized: true })
      )
    ).toThrow(
      new ParserError(
        "Expected an attribute name, a self-closing start tag ('/>'), or a start tag closing ('>').",
        '<aaa ///',
        5,
        6
      )
    );
  });

  test('strict throws if attribute is not followed by equals sign', () => {
    expect(() => readTokens('<aaa bbb', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError("Expected an attribute value separated by an equals sign ('=').", '<aaa bbb', 8, 9)
    );
  });

  test('strict throws if attribute is not followed by equals sign', () => {
    expect(() => readTokens('<aaa bbb', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError("Expected an attribute value separated by an equals sign ('=').", '<aaa bbb', 8, 9)
    );
  });

  test('strict throws if attribute has no value', () => {
    expect(() => readTokens('<aaa bbb=', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError("Expected a double-quoted attribute value ('\"').", '<aaa bbb=', 9, 10)
    );
  });

  test('strict throws if attribute value is not terminated', () => {
    expect(() => readTokens('<aaa bbb="ccc', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError("Expected the attribute value to be closed with a double-quote ('\"').", '<aaa bbb="ccc', 10, 13)
    );
  });

  test('strict throws if processing instruction does not have a target', () => {
    expect(() =>
      readTokens(
        '<??>',
        callbackMock,
        resolveTokenizerOptions({ isStrict: true, isProcessingInstructionRecognized: true })
      )
    ).toThrow(new ParserError('Expected a processing instruction target.', '<??>', 2, 3));

    expect(() =>
      readTokens(
        '<?   aaa?>',
        callbackMock,
        resolveTokenizerOptions({ isStrict: true, isProcessingInstructionRecognized: true })
      )
    ).toThrow(new ParserError('Expected a processing instruction target.', '<?   aaa?>', 2, 3));
  });

  test('strict throws if processing instruction is not supported', () => {
    expect(() => readTokens('<?xml?>', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError('Processing instructions are forbidden.', '<?xml?>', 0, 2)
    );
  });

  test('strict throws if CDATA is not supported', () => {
    expect(() => readTokens('<![CDATA[]]>', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError("Expected a comment ('<!--'), a doctype declaration ('<!DOCTYPE').", '<![CDATA[]]>', 0, 2)
    );

    expect(() => readTokens('aaa<![CDATA[]]>', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError("Expected a comment ('<!--').", 'aaa<![CDATA[]]>', 3, 5)
    );

    expect(() =>
      readTokens('<!bbb>', callbackMock, resolveTokenizerOptions({ isStrict: true, isCDATARecognized: true }))
    ).toThrow(
      new ParserError(
        "Expected a comment ('<!--'), a doctype declaration ('<!DOCTYPE'), or a CDATA section ('<![CDATA[[').",
        '<!bbb>',
        0,
        2
      )
    );
  });
});

describe('tokenizeMarkup', () => {
  test('reads the balanced start tag', () => {
    tokenizeMarkup('<aaa>bbb</aaa>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 10, 13);
  });

  test('reads the unbalanced start tag', () => {
    tokenizeMarkup('<aaa><bbb>ccc', callbackMock, { isUnbalancedStartTagsImplicitlyClosed: true });

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'TEXT', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 13, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'END_TAG_NAME', 13, 13);
  });

  test('implicitly closes the immediate parent', () => {
    tokenizeMarkup(
      '<aaa>bbb<ccc>ddd',
      callbackMock,
      resolveTokenizerOptions({ isUnbalancedStartTagsImplicitlyClosed: true, implicitlyClosedTags: { ccc: ['aaa'] } })
    );

    expect(callbackMock).toHaveBeenCalledTimes(8);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 8, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_NAME', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 12, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'TEXT', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'END_TAG_NAME', 16, 16);
  });

  test('implicitly closes the ancestor', () => {
    tokenizeMarkup(
      '<aaa>bbb<ccc>ddd<eee>',
      callbackMock,
      resolveTokenizerOptions({ isUnbalancedStartTagsImplicitlyClosed: true, implicitlyClosedTags: { eee: ['aaa'] } })
    );

    expect(callbackMock).toHaveBeenCalledTimes(11);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_NAME', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 12, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'TEXT', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'END_TAG_NAME', 16, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'END_TAG_NAME', 16, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'START_TAG_NAME', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'START_TAG_CLOSING', 20, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'END_TAG_NAME', 21, 21);
  });

  test('implicitly closes the topmost ancestor', () => {
    tokenizeMarkup(
      '<aaa>bbb<ccc>ddd<eee>fff<ggg>',
      callbackMock,
      resolveTokenizerOptions({
        isUnbalancedStartTagsImplicitlyClosed: true,
        implicitlyClosedTags: { ggg: ['aaa', 'eee'] },
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(15);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_NAME', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 12, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'TEXT', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'START_TAG_NAME', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'START_TAG_CLOSING', 20, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'TEXT', 21, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'END_TAG_NAME', 24, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'END_TAG_NAME', 24, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'END_TAG_NAME', 24, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(13, 'START_TAG_NAME', 25, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(14, 'START_TAG_CLOSING', 28, 29);
    expect(callbackMock).toHaveBeenNthCalledWith(15, 'END_TAG_NAME', 29, 29);
  });

  test('reads the void tag', () => {
    tokenizeMarkup('<aaa>bbb', callbackMock, resolveTokenizerOptions({ voidTags: ['aaa'] }));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 5, 8);
  });

  test('reads consequent void tags', () => {
    tokenizeMarkup('<aaa><bbb>', callbackMock, resolveTokenizerOptions({ voidTags: ['aaa', 'bbb'] }));

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 10, 10);
  });

  test('reads the void tag in the container', () => {
    tokenizeMarkup('<aaa><bbb></aaa>', callbackMock, resolveTokenizerOptions({ voidTags: ['bbb'] }));

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 12, 15);
  });

  test('implicitly closes a tag', () => {
    tokenizeMarkup(
      '<aaa><bbb></aaa>',
      callbackMock,
      resolveTokenizerOptions({ isUnbalancedStartTagsImplicitlyClosed: true })
    );

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 12, 15);
  });

  test('ignores an unbalanced end tag', () => {
    tokenizeMarkup('</aaa>', callbackMock, resolveTokenizerOptions({ isUnbalancedEndTagsIgnored: true }));

    expect(callbackMock).toHaveBeenCalledTimes(0);
  });

  test('ignores an unbalanced end tag in a container', () => {
    tokenizeMarkup('<aaa></bbb></aaa>', callbackMock, resolveTokenizerOptions({ isUnbalancedEndTagsIgnored: true }));

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 13, 16);
  });

  test('inserts start tags for unbalanced end tags', () => {
    tokenizeMarkup('</aaa>', callbackMock, resolveTokenizerOptions({ implicitlyOpenedTags: ['aaa'] }));

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 2, 5);
  });

  test('implicitly closes a tag', () => {
    tokenizeMarkup(
      '<aaa><bbb>',
      callbackMock,
      resolveTokenizerOptions({ implicitlyClosedTags: { bbb: ['aaa'] }, isUnbalancedStartTagsImplicitlyClosed: true })
    );

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 10, 10);
  });

  test('inserts start tag that forcefully closes preceding tag', () => {
    tokenizeMarkup(
      '<aaa></bbb>',
      callbackMock,
      resolveTokenizerOptions({ implicitlyClosedTags: { bbb: ['aaa'] }, implicitlyOpenedTags: ['bbb'] })
    );

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_NAME', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 7, 10);
  });

  test('inserts start tags and end tags during nesting of the same tag', () => {
    tokenizeMarkup(
      'aaa<xxx>bbb<xxx>ccc</xxx>ddd</xxx>eee',
      callbackMock,
      resolveTokenizerOptions({ implicitlyClosedTags: { xxx: ['xxx'] }, implicitlyOpenedTags: ['xxx'] })
    );

    expect(callbackMock).toHaveBeenCalledTimes(14);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 11, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'START_TAG_CLOSING', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'TEXT', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'END_TAG_NAME', 21, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'TEXT', 25, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'START_TAG_NAME', 30, 33);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'START_TAG_CLOSING', 33, 34);
    expect(callbackMock).toHaveBeenNthCalledWith(13, 'END_TAG_NAME', 30, 33);
    expect(callbackMock).toHaveBeenNthCalledWith(14, 'TEXT', 34, 37);
  });

  test('reads case-sensitive end tags by default', () => {
    tokenizeMarkup('<aaa></AAA>', callbackMock, {
      isUnbalancedStartTagsImplicitlyClosed: true,
      isUnbalancedEndTagsIgnored: true,
    });

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 11, 11);
  });

  test('reads case-insensitive end tags', () => {
    tokenizeMarkup('<aaa></AAA>', callbackMock, resolveTokenizerOptions({ isCaseInsensitiveTags: true }));

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 7, 10);
  });

  test('read non ASCII alpha-chars as case-sensitive in case-insensitive tag matching mode', () => {
    tokenizeMarkup(
      '<aaaффф></AAAФФФ>',
      callbackMock,
      resolveTokenizerOptions({
        isCaseInsensitiveTags: true,
        isUnbalancedStartTagsImplicitlyClosed: true,
        isUnbalancedEndTagsIgnored: true,
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 17, 17);
  });

  test('closes unbalanced tags', () => {
    tokenizeMarkup(
      '<a><b></a></b>',
      callbackMock,
      resolveTokenizerOptions({ isUnbalancedStartTagsImplicitlyClosed: true, isUnbalancedEndTagsIgnored: true })
    );

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 2);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 6, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 8, 9);
  });

  test('throws if start tag is not closed before EOF', () => {
    expect(() => tokenizeMarkup('<aaa xxx="bbb"', callbackMock)).toThrow(
      new ParserError('Unexpected end of the document.', '<aaa xxx="bbb"', 14)
    );
  });
});
