import { beforeEach, describe, expect, test, vi } from 'vitest';
import { resolveTokenizerOptions, type TokenizerOptions } from '../main/createTokenizer.ts';
import {
  getCaseInsensitiveHashCode,
  getCaseSensitiveHashCode,
  ParserError,
  readTokens,
  type ResolvedTokenizerOptions,
  tokenizeMarkup,
  type TokenizerState,
} from '../main/tokenizeMarkup.ts';

const callbackMock = vi.fn();

function makeTestState(options: ResolvedTokenizerOptions): TokenizerState {
  return { tagHashCode: 0, tagOptions: undefined, context: options.initialContext };
}

beforeEach(() => {
  callbackMock.mockReset();
});

describe('readTokens', () => {
  test('reads empty string', () => {
    readTokens('', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(0);
  });

  test('reads text', () => {
    readTokens('aaa', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
  });

  test('reads the leading lt as text', () => {
    readTokens('>aaa>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 5);
  });

  test('treats gt followed by non tag name character as text', () => {
    readTokens('aaa<+ccc', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 8);
  });

  test('reads the start tag as a text if name begins with a non-valid char', () => {
    readTokens('<@#$%*>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 7);
  });

  test('reads the start tag if name begins with a valid char followed by invalid chars', () => {
    readTokens('<xxx@#$%*>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 9, 10);
  });

  test('ignores bullshit in end tags', () => {
    readTokens('</xxx @#$%*/>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'END_TAG_NAME', 2, 5);
  });

  test('reads the start tag in double brackets', () => {
    readTokens('<<xxx>>aaa</xxx>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 1);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 6, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 12, 15);
  });

  test('reads empty start tag names as text and empty end tag names as comments', () => {
    readTokens('< ></ >', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'COMMENT', 5, 6);
  });

  test('reads non-alpha start tag names as text and non-alpha end tag names as comments', () => {
    readTokens('<111></111>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'COMMENT', 7, 10);
  });

  test('reads the malformed end tag as a comment', () => {
    readTokens('</ xxx>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 2, 6);
  });

  test('ignores end tags without a name and content', () => {
    readTokens('aaa</>bbb', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'TEXT', 6, 9);
  });

  test('reads </ at the end of the input as text', () => {
    readTokens('aaa</', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 5);
  });

  test('reads unterminated start tags', () => {
    readTokens('<aaa', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
  });

  test('reads unterminated attributes', () => {
    readTokens('<aaa xxx="zzz', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 13);
  });

  test('reads unterminated end tags', () => {
    readTokens('</aaa', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'END_TAG_NAME', 2, 5);
  });

  test('reads start and end tags', () => {
    readTokens('aaa<xxx>bbb</xxx>ccc', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'TEXT', 17, 20);
  });

  test('parses comments', () => {
    readTokens('aaa<xxx>bbb<!--</xxx>ccc--></xxx>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'COMMENT', 15, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 29, 32);
  });

  test('parses empty comments', () => {
    readTokens('aaa<!---->bbb', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'COMMENT', 7, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 10, 13);
  });

  test('reads <!--> as an empty comment', () => {
    readTokens('<!-->aaa', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'TEXT', 5, 8);
  });

  test('reads <!---> as an empty comment', () => {
    readTokens('<!--->aaa', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'TEXT', 6, 9);
  });

  test('reads comments closed with --!>', () => {
    readTokens('<!--aaa--!>bbb', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'TEXT', 11, 14);
  });

  test('reads dashes before the comment closing as a part of the comment', () => {
    readTokens('<!--aaa--->', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 8);
  });

  test('reads an unclosed comment without -- at the end of the input', () => {
    readTokens('<!--aaa--', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 7);
  });

  test('reads an unclosed comment without --! at the end of the input', () => {
    readTokens('<!--aaa--!', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 7);
  });

  test('reads an unclosed comment without - at the end of the input', () => {
    readTokens('<!--aaa-', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 7);
  });

  test('reads an unclosed empty comment', () => {
    readTokens('<!--', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 4);
  });

  test('parses body DTD as comment', () => {
    readTokens('aaa<xxx>bbb<!</xxx>ccc--></xxx>', callbackMock, { isFragment: true });

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'COMMENT', 13, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'TEXT', 19, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'END_TAG_NAME', 27, 30);
  });

  test('parse empty DTD as comment', () => {
    readTokens('aaa<!>bbb', callbackMock, { isFragment: true });

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'COMMENT', 5, 5);
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
    readTokens('aaa<❤️>bbb</👨‍❤️‍💋‍👨>ccc', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'COMMENT', 12, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 24, 27);
  });

  test('reads lt as an attribute name', () => {
    readTokens('<aaa <></aaa>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 6, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 6, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 9, 12);
  });

  test('ignores redundant spaces before start tag closing', () => {
    readTokens('aaa<xxx   >bbb', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 11, 14);
  });

  test('ignores redundant spaces before end tag closing', () => {
    readTokens('aaa</xxx   >bbb', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'END_TAG_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 12, 15);
  });

  test('reads nested tags', () => {
    readTokens('aaa<yyy>bbb<xxx>ccc</xxx>ddd</yyy>', callbackMock);

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
    readTokens("<xxx yyy='aaa\"bbb' zzz='aaa\"bbb'>", callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_NAME', 19, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'ATTRIBUTE_VALUE', 24, 31);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 32, 33);
  });

  test('reads double-quoted attributes', () => {
    readTokens('<xxx yyy="aaa\'bbb" zzz="aaa\'bbb">', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_NAME', 19, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'ATTRIBUTE_VALUE', 24, 31);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 32, 33);
  });

  test('reads unquoted attributes', () => {
    readTokens('<xxx yyy=aaa"bbb\'ccc>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 9, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 20, 21);
  });

  test('reads valueless attributes', () => {
    readTokens('<xxx aaa bbb>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 9, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_NAME', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'ATTRIBUTE_VALUE', 12, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 12, 13);
  });

  test('reads valueless attribute at the end of the input', () => {
    readTokens('<xxx aaa', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 8, 8);
  });

  test('reads equals sign in unquoted attribute value', () => {
    readTokens('<xxx aaa= bbb=>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 14, 15);
  });

  test('reads slashes in unquoted attribute value', () => {
    readTokens('<xxx aaa=bbb/ccc>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 9, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 16, 17);
  });

  test('reads entities in attributes', () => {
    readTokens('<xxx aaa=&amp; bbb="&amp;" ccc=\'&amp;\' ddd=>', callbackMock);

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
    readTokens('<aaa /xxx></xxx aaa>bbb', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 9, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'TEXT', 20, 23);
  });

  test('reads bullshit attribute names', () => {
    readTokens("<xxx < = '' fff>vvv</xxx>", callbackMock);

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
    readTokens('<xxx yyy="aaa"bbb">', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_NAME', 14, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'ATTRIBUTE_VALUE', 18, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 18, 19);
  });

  test('does not read self-closing tags by default', () => {
    readTokens('<xxx/>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 5, 6);
  });

  test('reads self-closing tag', () => {
    const options = resolveTokenizerOptions({ areSelfClosingTagsRecognized: true });

    readTokens('<xxx/>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_SELF_CLOSING', 4, 6);
  });

  test('does not read self-closing tag with the unquoted attribute that ends with a slash', () => {
    const options = resolveTokenizerOptions({ areSelfClosingTagsRecognized: true });

    readTokens('<xxx aaa=bbb//>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 9, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 14, 15);
  });

  test('ignores redundant spaces in attributes', () => {
    readTokens('aaa<yyy xxx   =   "zzz">bbb', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_NAME', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_NAME', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'ATTRIBUTE_VALUE', 19, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 23, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'TEXT', 24, 27);
  });

  test('does not read tags in double-quoted attribute', () => {
    readTokens('<aaa xxx="bbb<zzz>ccc</zzz>">', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 28, 29);
  });

  test('does not read tags in single-quoted attribute', () => {
    readTokens("<aaa xxx='bbb<zzz>ccc</zzz>'>", callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 28, 29);
  });

  test('does not read tags in unquoted attribute', () => {
    readTokens('<aaa xxx=bbb<zzz>ccc</zzz>>', callbackMock);

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
    const options = resolveTokenizerOptions({ tags: { script: { kind: 'raw_text' } } });

    readTokens('<script><aaa>bbb</aaa></script>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 8, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 24, 30);
  });

  test('reads attributes of a raw text tag', () => {
    const options = resolveTokenizerOptions({ tags: { script: { kind: 'raw_text' } } });

    readTokens('<script aaa="xxx" ccc="yyy">zzz</script>', callbackMock, options, makeTestState(options));

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

  test('reads tags after a self-closing raw text tag', () => {
    const options = resolveTokenizerOptions({
      tags: { aaa: { kind: 'raw_text' } },
      areSelfClosingTagsRecognized: true,
    });

    readTokens('<aaa/><bbb></bbb>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_SELF_CLOSING', 4, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 13, 16);
  });

  test('ignores tags in escapable raw text tags', () => {
    const options = resolveTokenizerOptions({ tags: { aaa: { kind: 'escapable_raw_text' } } });

    readTokens('<aaa><bbb></aaa>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 12, 15);
  });

  test('ignores comments in raw text tags', () => {
    const options = resolveTokenizerOptions({ tags: { script: { kind: 'raw_text' } } });

    readTokens('<script><!-->bbb</--></script>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 8, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 23, 29);
  });

  test('matches case-insensitive end raw text tags', () => {
    const options = resolveTokenizerOptions({
      tags: { script: { kind: 'raw_text' } },
      areTagNamesCaseInsensitive: true,
    });

    readTokens('<script><!-->bbb</--></SCRIPT>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 8, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 23, 29);
  });

  test('does not end a raw text tag with an end tag that has the same hash code but a different name', () => {
    // "aQ" and "b0" have the same hash code
    const options = resolveTokenizerOptions({ tags: { aQ: { kind: 'raw_text' } } });

    readTokens('<aQ></b0></aQ>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 3, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 4, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 11, 13);
  });

  test('does not end raw text with an end tag at the end of the input', () => {
    const options = resolveTokenizerOptions({ tags: { aaa: { kind: 'raw_text' } } });

    readTokens('<aaa></aaa', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 10);
  });

  test('ends raw text with an end tag that follows another end tag without a closing', () => {
    const options = resolveTokenizerOptions({ tags: { aaa: { kind: 'raw_text' } } });

    readTokens('<aaa></bbb</aaa>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 12, 15);
  });

  test('does not end script data with an end tag after an escaped start tag', () => {
    const options = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readTokens('<aaa><!--<aaa></aaa></aaa>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 22, 25);
  });

  test('ends escaped script data with an end tag', () => {
    const options = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readTokens('<aaa><!--</aaa>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 11, 14);
  });

  test('ends escaping of script data at -->', () => {
    const options = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readTokens('<aaa><!--<aaa>--></aaa>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 19, 22);
  });

  test('does not escape script data with <!-->', () => {
    const options = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readTokens('<aaa><!--><aaa></aaa>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 17, 20);
  });

  test('reads lower-case DOCTYPE', () => {
    readTokens('<!doctype html>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 10, 14);
  });

  test('reads empty DOCTYPE', () => {
    readTokens('<!doctype>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 9, 9);
  });

  test('reads DOCTYPE name without separating spaces', () => {
    readTokens('<!doctypehtml   >', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 9, 13);
  });

  test('ignores spaces surrounding DOCTYPE', () => {
    readTokens('   <!DOCTYPE>   ', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 12, 12);
  });

  test('reads non-empty DOCTYPE', () => {
    readTokens('<!DOCTYPE html>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 10, 14);
  });

  test('reads DOCTYPE after comment', () => {
    readTokens('<!--xxx-->   \n\n   <!DOCTYPE html>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'DOCTYPE_NAME', 28, 32);
  });

  test('reads DOCTYPE and processing instruction after comment', () => {
    const options = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readTokens(
      '<!--xxx-->   \n\n   <!DOCTYPE html><!--xxx-->   \n\n   <?xml aaa?>',
      callbackMock,
      options,
      makeTestState(options)
    );

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'DOCTYPE_NAME', 28, 32);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'COMMENT', 37, 40);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'PROCESSING_INSTRUCTION_TARGET', 53, 56);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'PROCESSING_INSTRUCTION_DATA', 57, 60);
  });

  test('reads processing instruction and DOCTYPE separated with spaces', () => {
    const options = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readTokens('   <?xml aaa?>   <!DOCTYPE html>   ', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'PROCESSING_INSTRUCTION_TARGET', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'PROCESSING_INSTRUCTION_DATA', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'DOCTYPE_NAME', 27, 31);
  });

  test('reads quirky comment before DOCTYPE', () => {
    readTokens('   <?xml aaa?>   <!DOCTYPE html>   ', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'DOCTYPE_NAME', 27, 31);
  });

  test('skips spaces after the malformed end tag in prolog', () => {
    readTokens('   </#>   aaa', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'TEXT', 10, 13);
  });

  test('reads quirky comment in a container', () => {
    readTokens('   <aaa>   <?xml bbb?>   </aaa>   ', callbackMock);

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
    const options = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readTokens('<!DOCTYPE html>aaa<?xml aaa?>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'DOCTYPE_NAME', 10, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'TEXT', 15, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'PROCESSING_INSTRUCTION_TARGET', 20, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'PROCESSING_INSTRUCTION_DATA', 24, 27);
  });

  test('closes prolog with processing instruction after text', () => {
    const options = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readTokens('<?xml aaa?>aaa<!DOCTYPE html>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'PROCESSING_INSTRUCTION_TARGET', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'PROCESSING_INSTRUCTION_DATA', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'COMMENT', 16, 28);
  });

  test('closes multiple processing instruction in prolog', () => {
    const options = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readTokens('   <?xml aaa?>  <?xml bbb?>  <?xml ccc?>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'PROCESSING_INSTRUCTION_TARGET', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'PROCESSING_INSTRUCTION_DATA', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'PROCESSING_INSTRUCTION_TARGET', 18, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'PROCESSING_INSTRUCTION_DATA', 22, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'PROCESSING_INSTRUCTION_TARGET', 31, 34);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'PROCESSING_INSTRUCTION_DATA', 35, 38);
  });

  test('reads text after processing instruction', () => {
    const options = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readTokens('<aaa><?xxx bbb?>ccc</aaa>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'PROCESSING_INSTRUCTION_TARGET', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'PROCESSING_INSTRUCTION_DATA', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'TEXT', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 21, 24);
  });

  test('closes prolog after tag', () => {
    const options = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readTokens('<?xml aaa?><aaa><!DOCTYPE html>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'PROCESSING_INSTRUCTION_TARGET', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'PROCESSING_INSTRUCTION_DATA', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'COMMENT', 18, 30);
  });

  test('closes prolog after end tag', () => {
    readTokens('</aaa><!DOCTYPE html>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'END_TAG_NAME', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'COMMENT', 8, 20);
  });

  test('closes prolog after start tag without a name', () => {
    readTokens('< ><!DOCTYPE html>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'COMMENT', 5, 17);
  });

  test('closes prolog after text', () => {
    const options = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readTokens('<?xml aaa?>aaa<!DOCTYPE html>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'PROCESSING_INSTRUCTION_TARGET', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'PROCESSING_INSTRUCTION_DATA', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'COMMENT', 16, 28);
  });

  test('reads CDATA as comment', () => {
    readTokens('<![CDATA[]]>', callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 2, 11);
  });

  test('reads empty CDATA', () => {
    const options = resolveTokenizerOptions({ areCDATASectionsRecognized: true });

    readTokens('<![CDATA[]]>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'CDATA_SECTION', 9, 9);
  });

  test('reads non-empty CDATA', () => {
    const options = resolveTokenizerOptions({ areCDATASectionsRecognized: true });

    readTokens('<![CDATA[aaa]]>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'CDATA_SECTION', 9, 12);
  });

  test('ignores CDATA in raw tag', () => {
    const options = resolveTokenizerOptions({ tags: { aaa: { kind: 'raw_text' } }, areCDATASectionsRecognized: true });

    readTokens('<aaa><![CDATA[aaa]]></aaa>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'TEXT', 5, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'END_TAG_NAME', 22, 25);
  });

  test('does not read CDATA without an exclamation mark', () => {
    const options = resolveTokenizerOptions({ areCDATASectionsRecognized: true });

    readTokens('<a[CDATA[]]>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 11, 12);
  });

  test('does not read tags inside CDATA', () => {
    const options = resolveTokenizerOptions({ areCDATASectionsRecognized: true });

    readTokens('<![CDATA[<aaa>bbb</aaa>]]>', callbackMock, options, makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'CDATA_SECTION', 9, 23);
  });

  test('strict throws if invalid char in start tag', () => {
    expect(() => readTokens('<aaa ///', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError("Expected an attribute name or a start tag closing ('>').", '<aaa ///', 5, 6)
    );
  });

  test('strict throws if invalid char in self-closing start tag', () => {
    const options = resolveTokenizerOptions({ isStrict: true, areSelfClosingTagsRecognized: true });

    expect(() => readTokens('<aaa ///', callbackMock, options, makeTestState(options))).toThrow(
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
      new ParserError('Expected a double-quoted (\'"\') or a single-quoted ("\'") attribute value.', '<aaa bbb=', 9, 10)
    );
  });

  test('strict reads single-quoted attribute value', () => {
    readTokens("<aaa bbb='ccc'>", callbackMock, resolveTokenizerOptions({ isStrict: true }));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'ATTRIBUTE_NAME', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'ATTRIBUTE_VALUE', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 14, 15);
  });

  test('strict throws if attribute value is not terminated', () => {
    expect(() => readTokens('<aaa bbb="ccc', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError("Expected the attribute value to be closed with a double-quote ('\"').", '<aaa bbb="ccc', 10, 13)
    );
  });

  test('strict throws if single-quoted attribute value is not terminated', () => {
    expect(() => readTokens("<aaa bbb='ccc", callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError('Expected the attribute value to be closed with a single-quote ("\'").', "<aaa bbb='ccc", 10, 13)
    );
  });

  test('strict throws if processing instruction does not have a target', () => {
    const options = resolveTokenizerOptions({ isStrict: true, areProcessingInstructionsRecognized: true });

    expect(() => readTokens('<??>', callbackMock, options, makeTestState(options))).toThrow(
      new ParserError('Expected a processing instruction target.', '<??>', 2, 3)
    );

    expect(() => readTokens('<?   aaa?>', callbackMock, options, makeTestState(options))).toThrow(
      new ParserError('Expected a processing instruction target.', '<?   aaa?>', 2, 3)
    );
  });

  test('strict throws if start tag has no name', () => {
    expect(() => readTokens('< >', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError('Expected a name for the start tag.', '< >', 1, 2)
    );
  });

  test('strict throws if end tag has no name', () => {
    expect(() => readTokens('</ >', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError('Expected a name for the end tag.', '</ >', 2, 3)
    );
  });

  test('strict throws if comment is not terminated', () => {
    expect(() => readTokens('<!--aaa', callbackMock, resolveTokenizerOptions({ isStrict: true }))).toThrow(
      new ParserError("Expected the comment to be closed with '-->'.", '<!--aaa', 0, 7)
    );
  });

  test('strict does not read <!--> as an empty comment', () => {
    readTokens('<!-->aaa-->', callbackMock, resolveTokenizerOptions({ isStrict: true }));

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'COMMENT', 4, 8);
  });

  test('strict throws if CDATA section is not terminated', () => {
    const options = resolveTokenizerOptions({ isStrict: true, areCDATASectionsRecognized: true });

    expect(() => readTokens('<![CDATA[aaa', callbackMock, options, makeTestState(options))).toThrow(
      new ParserError("Expected the CDATA section to be closed with ']]>'.", '<![CDATA[aaa', 0, 12)
    );
  });

  test('strict throws if processing instruction is not terminated', () => {
    const options = resolveTokenizerOptions({ isStrict: true, areProcessingInstructionsRecognized: true });

    expect(() => readTokens('<?aaa', callbackMock, options, makeTestState(options))).toThrow(
      new ParserError("Expected the processing instruction to be closed with '?>'.", '<?aaa', 0, 5)
    );
  });

  test('strict does not read lower-case CDATA', () => {
    const options = resolveTokenizerOptions({ isStrict: true, areCDATASectionsRecognized: true });

    expect(() => readTokens('<![cdata[]]>', callbackMock, options, makeTestState(options))).toThrow(
      new ParserError(
        "Expected a comment ('<!--'), a doctype declaration ('<!DOCTYPE'), or a CDATA section ('<![CDATA[').",
        '<![cdata[]]>',
        0,
        2
      )
    );
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

    const options = resolveTokenizerOptions({ isStrict: true, areCDATASectionsRecognized: true });

    expect(() => readTokens('<!bbb>', callbackMock, options, makeTestState(options))).toThrow(
      new ParserError(
        "Expected a comment ('<!--'), a doctype declaration ('<!DOCTYPE'), or a CDATA section ('<![CDATA[').",
        '<!bbb>',
        0,
        2
      )
    );
  });

  test('sets the tag hash code and the tag options before a start tag name is passed to the callback', () => {
    const options = resolveTokenizerOptions({ tags: { aaa: { kind: 'void' } } });
    const state = makeTestState(options);
    const states: Partial<TokenizerState>[] = [];

    readTokens(
      '<aaa><bbb>',
      token => {
        if (token === 'START_TAG_NAME') {
          states.push({ tagHashCode: state.tagHashCode, tagOptions: state.tagOptions });
        }
      },
      options,
      state
    );

    expect(states).toEqual([
      { tagHashCode: getCaseSensitiveHashCode('aaa', 0, 3), tagOptions: expect.objectContaining({ kind: 'void' }) },
      { tagHashCode: getCaseSensitiveHashCode('bbb', 0, 3), tagOptions: undefined },
    ]);
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
    tokenizeMarkup(
      '<aaa><bbb>ccc',
      callbackMock,
      resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true })
    );

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'TEXT', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 13, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'END_TAG_NAME', 13, 13);
  });

  test('implicitly ends the immediate parent', () => {
    tokenizeMarkup(
      '<aaa>bbb<ccc>ddd',
      callbackMock,
      resolveTokenizerOptions({
        areUnbalancedStartTagsImplicitlyEnded: true,
        tags: { aaa: { implicitlyEndedBy: ['ccc'] } },
      })
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

  test('implicitly ends the ancestor', () => {
    tokenizeMarkup(
      '<aaa>bbb<ccc>ddd<eee>',
      callbackMock,
      resolveTokenizerOptions({
        areUnbalancedStartTagsImplicitlyEnded: true,
        tags: { aaa: { implicitlyEndedBy: ['eee'] } },
      })
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

  test('implicitly ends the topmost ancestor', () => {
    tokenizeMarkup(
      '<aaa>bbb<ccc>ddd<eee>fff<ggg>',
      callbackMock,
      resolveTokenizerOptions({
        areUnbalancedStartTagsImplicitlyEnded: true,
        tags: { aaa: { implicitlyEndedBy: ['ggg'] }, eee: { implicitlyEndedBy: ['ggg'] } },
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
    tokenizeMarkup('<aaa>bbb', callbackMock, resolveTokenizerOptions({ tags: { aaa: { kind: 'void' } } }));

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'TEXT', 5, 8);
  });

  test('reads consequent void tags', () => {
    tokenizeMarkup(
      '<aaa><bbb>',
      callbackMock,
      resolveTokenizerOptions({ tags: { aaa: { kind: 'void' }, bbb: { kind: 'void' } } })
    );

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 10, 10);
  });

  test('reads the void tag in the container', () => {
    tokenizeMarkup('<aaa><bbb></aaa>', callbackMock, resolveTokenizerOptions({ tags: { bbb: { kind: 'void' } } }));

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 12, 15);
  });

  test('implicitly ends a tag', () => {
    tokenizeMarkup(
      '<aaa><bbb></aaa>',
      callbackMock,
      resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true })
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
    tokenizeMarkup('</aaa>', callbackMock, resolveTokenizerOptions({ areUnbalancedEndTagsIgnored: true }));

    expect(callbackMock).toHaveBeenCalledTimes(0);
  });

  test('ignores an unbalanced end tag in a container', () => {
    tokenizeMarkup('<aaa></bbb></aaa>', callbackMock, resolveTokenizerOptions({ areUnbalancedEndTagsIgnored: true }));

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 13, 16);
  });

  test('inserts start tags for unbalanced end tags', () => {
    tokenizeMarkup('</aaa>', callbackMock, resolveTokenizerOptions({ tags: { aaa: { isImplicitlyStarted: true } } }));

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 2, 5);
  });

  test('implicitly ends a tag', () => {
    tokenizeMarkup(
      '<aaa><bbb>',
      callbackMock,
      resolveTokenizerOptions({
        tags: { aaa: { implicitlyEndedBy: ['bbb'] } },
        areUnbalancedStartTagsImplicitlyEnded: true,
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 10, 10);
  });

  test('inserts start tag that forcefully ends preceding tag', () => {
    tokenizeMarkup(
      '<aaa></bbb>',
      callbackMock,
      resolveTokenizerOptions({
        tags: { aaa: { implicitlyEndedBy: ['bbb'] }, bbb: { isImplicitlyStarted: true } },
      })
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
      resolveTokenizerOptions({
        tags: { xxx: { implicitlyEndedBy: ['xxx'], isImplicitlyStarted: true } },
      })
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
    tokenizeMarkup(
      '<aaa></AAA>',
      callbackMock,
      resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true, areUnbalancedEndTagsIgnored: true })
    );

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 11, 11);
  });

  test('reads case-insensitive end tags', () => {
    tokenizeMarkup('<aaa></AAA>', callbackMock, resolveTokenizerOptions({ areTagNamesCaseInsensitive: true }));

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
        areTagNamesCaseInsensitive: true,
        areUnbalancedStartTagsImplicitlyEnded: true,
        areUnbalancedEndTagsIgnored: true,
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 17, 17);
  });

  test('ends unbalanced tags', () => {
    tokenizeMarkup(
      '<a><b></a></b>',
      callbackMock,
      resolveTokenizerOptions({
        areUnbalancedStartTagsImplicitlyEnded: true,
        areUnbalancedEndTagsIgnored: true,
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 2);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 6, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 8, 9);
  });

  test('implicitly ends tags inside the nearest boundary', () => {
    tokenizeMarkup(
      '<aaa><bbb><aaa><bbb>',
      callbackMock,
      resolveTokenizerOptions({
        tags: { aaa: { isImplicitEndingBoundary: true }, bbb: { implicitlyEndedBy: ['bbb'] } },
        areUnbalancedStartTagsImplicitlyEnded: true,
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(12);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_NAME', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'START_TAG_NAME', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'START_TAG_CLOSING', 19, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'END_TAG_NAME', 20, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'END_TAG_NAME', 20, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'END_TAG_NAME', 20, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'END_TAG_NAME', 20, 20);
  });

  test('implicitly ends the boundary tag that must be ended', () => {
    tokenizeMarkup(
      '<aaa><bbb><aaa>',
      callbackMock,
      resolveTokenizerOptions({
        tags: { aaa: { implicitlyEndedBy: ['aaa'], isImplicitEndingBoundary: true } },
        areUnbalancedStartTagsImplicitlyEnded: true,
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'START_TAG_NAME', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'START_TAG_CLOSING', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'END_TAG_NAME', 15, 15);
  });

  test('reads self-closing foreign tag', () => {
    tokenizeMarkup(
      '<aaa><bbb/><ccc><ddd/></ccc></aaa>',
      callbackMock,
      resolveTokenizerOptions({
        tags: { ccc: { foreignContext: { areSelfClosingTagsRecognized: true } } },
        areUnbalancedStartTagsImplicitlyEnded: true,
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(11);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'START_TAG_NAME', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'START_TAG_SELF_CLOSING', 20, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'END_TAG_NAME', 24, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'END_TAG_NAME', 28, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'END_TAG_NAME', 30, 33);
  });

  test('reads sibling foreign tags', () => {
    tokenizeMarkup(
      '<aaa><ccc>ddd</ccc><ccc>fff</ccc></aaa>',
      callbackMock,
      resolveTokenizerOptions({ tags: { ccc: { foreignContext: { areSelfClosingTagsRecognized: true } } } })
    );

    expect(callbackMock).toHaveBeenCalledTimes(11);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'TEXT', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 15, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'START_TAG_NAME', 20, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'START_TAG_CLOSING', 23, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'TEXT', 24, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'END_TAG_NAME', 29, 32);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'END_TAG_NAME', 35, 38);
  });

  test('reads deeply nested foreign tags', () => {
    tokenizeMarkup(
      '<aaa><bbb><ccc><ddd/>xxx</ccc><eee/>',
      callbackMock,
      resolveTokenizerOptions({
        tags: {
          bbb: {
            foreignContext: {
              areSelfClosingTagsRecognized: true,
              tags: {
                ccc: { foreignContext: { areSelfClosingTagsRecognized: false } },
              },
            },
          },
        },
        areUnbalancedStartTagsImplicitlyEnded: true,
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(15);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_NAME', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'START_TAG_NAME', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'START_TAG_CLOSING', 20, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'TEXT', 21, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'END_TAG_NAME', 24, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'END_TAG_NAME', 26, 29);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'START_TAG_NAME', 31, 34);
    expect(callbackMock).toHaveBeenNthCalledWith(13, 'START_TAG_SELF_CLOSING', 34, 36);
    expect(callbackMock).toHaveBeenNthCalledWith(14, 'END_TAG_NAME', 36, 36);
    expect(callbackMock).toHaveBeenNthCalledWith(15, 'END_TAG_NAME', 36, 36);
  });

  test('restores options after a self-closing foreign tag', () => {
    tokenizeMarkup(
      '<aaa/><bbb/></bbb>',
      callbackMock,
      resolveTokenizerOptions({ tags: { aaa: { foreignContext: { areSelfClosingTagsRecognized: true } } } })
    );

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_SELF_CLOSING', 4, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 11, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 14, 17);
  });

  test('restores the initial context of the state after a foreign tag', () => {
    const options = resolveTokenizerOptions({
      tags: { aaa: { foreignContext: {} } },
      areSelfClosingTagsRecognized: true,
    });

    tokenizeMarkup('<aaa></aaa><bbb/>', callbackMock, resolveTokenizerOptions({}), makeTestState(options));

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_SELF_CLOSING', 15, 17);
  });

  test('restores options after an implicitly ended foreign tag', () => {
    tokenizeMarkup(
      '<aaa><bbb></aaa><ccc/></ccc>',
      callbackMock,
      resolveTokenizerOptions({
        tags: { bbb: { foreignContext: { areSelfClosingTagsRecognized: true } } },
        areUnbalancedStartTagsImplicitlyEnded: true,
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'START_TAG_NAME', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'START_TAG_CLOSING', 21, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'END_TAG_NAME', 24, 27);
  });

  test('restores options after a foreign tag that shares options with the root', () => {
    const options: TokenizerOptions = {};

    options.tags = {
      aaa: { foreignContext: { areSelfClosingTagsRecognized: true, tags: { bbb: { foreignContext: options } } } },
    };

    tokenizeMarkup('<aaa><bbb></bbb></aaa><ccc/></ccc>', callbackMock, resolveTokenizerOptions(options));

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 18, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'START_TAG_NAME', 23, 26);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'START_TAG_CLOSING', 27, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'END_TAG_NAME', 30, 33);
  });

  test('does not apply outer tags to content of a foreign tag', () => {
    tokenizeMarkup(
      '<aaa><bbb></bbb></aaa>',
      callbackMock,
      resolveTokenizerOptions({ tags: { aaa: { foreignContext: {} }, bbb: { kind: 'void' } } })
    );

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 18, 21);
  });

  test('applies tags of a foreign tag to its content', () => {
    tokenizeMarkup(
      '<aaa><bbb></aaa>',
      callbackMock,
      resolveTokenizerOptions({ tags: { aaa: { foreignContext: { tags: { bbb: { kind: 'void' } } } } } })
    );

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 12, 15);
  });

  test('implicitly ends a tag that was started in another context', () => {
    tokenizeMarkup(
      '<bbb><aaa><ccc>',
      callbackMock,
      resolveTokenizerOptions({
        tags: { aaa: { foreignContext: {} }, bbb: { implicitlyEndedBy: ['ccc'] } },
        areUnbalancedStartTagsImplicitlyEnded: true,
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'START_TAG_NAME', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'START_TAG_CLOSING', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'END_TAG_NAME', 15, 15);
  });

  test('does not implicitly end a tag of another context that is ended by other tags', () => {
    tokenizeMarkup(
      '<bbb><aaa><ddd>',
      callbackMock,
      resolveTokenizerOptions({
        tags: {
          aaa: { foreignContext: { tags: { eee: { implicitlyEndedBy: ['ddd'] } } } },
          bbb: { implicitlyEndedBy: ['ccc'] },
        },
        areUnbalancedStartTagsImplicitlyEnded: true,
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_NAME', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'END_TAG_NAME', 15, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'END_TAG_NAME', 15, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'END_TAG_NAME', 15, 15);
  });

  test('reads a tag that implicitly ends a foreign tag with outer tags', () => {
    tokenizeMarkup(
      '<aaa><bbb>ccc',
      callbackMock,
      resolveTokenizerOptions({
        tags: { aaa: { implicitlyEndedBy: ['bbb'], foreignContext: {} }, bbb: { kind: 'void' } },
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'TEXT', 10, 13);
  });

  test('reads raw text of a tag that implicitly ends a foreign tag with outer tags', () => {
    tokenizeMarkup(
      '<aaa><bbb><ccc></bbb>',
      callbackMock,
      resolveTokenizerOptions({
        tags: { aaa: { implicitlyEndedBy: ['bbb'], foreignContext: {} }, bbb: { kind: 'raw_text' } },
      })
    );

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_NAME', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'TEXT', 10, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'END_TAG_NAME', 17, 20);
  });

  test('implicitly starts a tag with tags of a foreign tag', () => {
    tokenizeMarkup(
      '<aaa></bbb></aaa>',
      callbackMock,
      resolveTokenizerOptions({ tags: { aaa: { foreignContext: { tags: { bbb: { isImplicitlyStarted: true } } } } } })
    );

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'START_TAG_NAME', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'END_TAG_NAME', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'END_TAG_NAME', 13, 16);
  });

  test('does not end a tag with an end tag that has the same hash code but a different name', () => {
    // "aQ" and "b0" have the same hash code
    expect(() => tokenizeMarkup('<aQ></b0>', callbackMock)).toThrow(
      new ParserError('Unexpected end tag.', '<aQ></b0>', 6, 8)
    );
  });

  test('sets the tag hash code and the tag options before an implicitly started start tag name is passed to the callback', () => {
    const options = resolveTokenizerOptions({ tags: { aaa: { isImplicitlyStarted: true } } });
    const state = makeTestState(options);
    const states: Partial<TokenizerState>[] = [];

    tokenizeMarkup(
      '</aaa>',
      token => {
        if (token === 'START_TAG_NAME') {
          states.push({ tagHashCode: state.tagHashCode, tagOptions: state.tagOptions });
        }
      },
      options,
      state
    );

    expect(states).toEqual([
      {
        tagHashCode: getCaseSensitiveHashCode('aaa', 0, 3),
        tagOptions: expect.objectContaining({ isImplicitlyStarted: true }),
      },
    ]);
  });

  test('closes the start tag at the end of the input', () => {
    tokenizeMarkup('<aaa', callbackMock, resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true }));

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'START_TAG_NAME', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 4, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'END_TAG_NAME', 4, 4);
  });

  test('strict throws if document has multiple root elements', () => {
    expect(() =>
      tokenizeMarkup(
        '<aaa/><bbb/>',
        callbackMock,
        resolveTokenizerOptions({ isStrict: true, areSelfClosingTagsRecognized: true })
      )
    ).toThrow(new ParserError('Expected a single root element.', '<aaa/><bbb/>', 6, 10));
  });

  test('throws if start tag is not closed before EOF', () => {
    expect(() => tokenizeMarkup('<aaa xxx="bbb"', callbackMock)).toThrow(
      new ParserError('Unexpected end of the document.', '<aaa xxx="bbb"', 14)
    );
  });
});

describe('getCaseInsensitiveHashCode', () => {
  test('returns a non-negative 30-bit integer', () => {
    const hashCode = getCaseInsensitiveHashCode('aaabbbccc', 0, 9);

    expect(hashCode).toBeGreaterThanOrEqual(0);
    expect(hashCode).toBeLessThan(2 ** 30);
  });
});

describe('getCaseSensitiveHashCode', () => {
  test('returns a non-negative 30-bit integer', () => {
    const hashCode = getCaseSensitiveHashCode('aaabbbccc', 0, 9);

    expect(hashCode).toBeGreaterThanOrEqual(0);
    expect(hashCode).toBeLessThan(2 ** 30);
  });
});
