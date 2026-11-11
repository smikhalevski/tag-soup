import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createTagStack,
  createTokenizerState,
  createTokenizerWriter,
  readTokens,
} from '../main/createTokenizerWriter.ts';
import type { TagParsingOptions, TokenHandler, TokenizerContextOptions, TokenizerOptions } from '../main/index.ts';
import { MarkupSyntaxError } from '../main/MarkupSyntaxError.ts';
import { resolveTokenizerOptions, type TokenizerConfig } from '../main/resolveTokenizerOptions.ts';
import { getCaseSensitiveHashCode } from '../main/utils.ts';

const callbackMock = vi.fn();

// Tokens are checked by indices, so the input isn't passed to the mock. Attributes and processing instructions are
// split into name and value calls, so assertions can check their indices separately.
const handler: TokenHandler = {
  onText(startIndex, endIndex) {
    callbackMock('text', startIndex, endIndex);
  },
  onStartTagName(startIndex, endIndex) {
    callbackMock('start_tag_name', startIndex, endIndex);
  },
  onStartTagClosing(startIndex, endIndex) {
    callbackMock('start_tag_closing', startIndex, endIndex);
  },
  onStartTagSelfClosing(startIndex, endIndex) {
    callbackMock('start_tag_self_closing', startIndex, endIndex);
  },
  onEndTagName(startIndex, endIndex) {
    callbackMock('end_tag_name', startIndex, endIndex);
  },
  onAttribute(nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex) {
    callbackMock('attribute_name', nameStartIndex, nameEndIndex);
    callbackMock('attribute_value', valueStartIndex, valueEndIndex);
  },
  onComment(startIndex, endIndex) {
    callbackMock('comment', startIndex, endIndex);
  },
  onProcessingInstruction(targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex) {
    callbackMock('processing_instruction_target', targetStartIndex, targetEndIndex);
    callbackMock('processing_instruction_data', dataStartIndex, dataEndIndex);
  },
  onCDATASection(startIndex, endIndex) {
    callbackMock('cdata_section', startIndex, endIndex);
  },
  onDoctypeName(startIndex, endIndex) {
    callbackMock('doctype_name', startIndex, endIndex);
  },
};

const defaultConfig = resolveTokenizerOptions({});
const strictConfig = resolveTokenizerOptions({ isStrict: true });
const fragmentConfig = { ...defaultConfig, isFragment: true };

// Reads tokens from an input with a new state and tag stack, and returns the index where unread text starts
function readInput(input: string, config: TokenizerConfig, isInputEnded = true): number {
  return readTokens(input, isInputEnded, handler, config, createTokenizerState(config), createTagStack(config));
}

// Returns tokens that a writer reads from chunks, and the error that it throws, with indices in the stream
function readChunks(chunks: string[], config: TokenizerConfig): string[] {
  const tokens: string[] = [];

  const pushToken = (tokenName: string, startIndex: number, endIndex: number, input: string): void => {
    tokens.push(tokenName + ' ' + (writer.inputOffset + startIndex) + ' ' + input.substring(startIndex, endIndex));
  };

  const writer = createTokenizerWriter(
    {
      onText(startIndex, endIndex, input) {
        pushToken('text', startIndex, endIndex, input);
      },
      onStartTagName(startIndex, endIndex, input) {
        pushToken('start_tag_name', startIndex, endIndex, input);
      },
      onStartTagClosing(startIndex, endIndex, input) {
        pushToken('start_tag_closing', startIndex, endIndex, input);
      },
      onStartTagSelfClosing(startIndex, endIndex, input) {
        pushToken('start_tag_self_closing', startIndex, endIndex, input);
      },
      onEndTagName(startIndex, endIndex, input) {
        pushToken('end_tag_name', startIndex, endIndex, input);
      },
      onAttribute(nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex, input) {
        pushToken('attribute_name', nameStartIndex, nameEndIndex, input);
        pushToken('attribute_value', valueStartIndex, valueEndIndex, input);
      },
      onComment(startIndex, endIndex, input) {
        pushToken('comment', startIndex, endIndex, input);
      },
      onProcessingInstruction(targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex, input) {
        pushToken('processing_instruction_target', targetStartIndex, targetEndIndex, input);
        pushToken('processing_instruction_data', dataStartIndex, dataEndIndex, input);
      },
      onCDATASection(startIndex, endIndex, input) {
        pushToken('cdata_section', startIndex, endIndex, input);
      },
      onDoctypeName(startIndex, endIndex, input) {
        pushToken('doctype_name', startIndex, endIndex, input);
      },
    },
    config
  );

  try {
    for (const chunk of chunks) {
      writer.write(chunk);
    }
    writer.end();
  } catch (error) {
    if (!(error instanceof MarkupSyntaxError)) {
      throw error;
    }
    tokens.push(error.message + ' ' + (error.inputOffset + error.startIndex));
  }
  return tokens;
}

// Checks that a writer reads any chunks of the input as if the whole input was read at once
function expectChunksToBeReadLikeInput(input: string, config: TokenizerConfig): void {
  const tokens = readChunks([input], config);

  for (let i = 1; i < input.length; ++i) {
    expect(readChunks([input.substring(0, i), input.substring(i)], config)).toEqual(tokens);
  }
  expect(readChunks(input.split(''), config)).toEqual(tokens);
}

beforeEach(() => {
  callbackMock.mockReset();
});

describe('readTokens', () => {
  test('reads empty string', () => {
    readInput('', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(0);
  });

  test('reads text', () => {
    readInput('aaa', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
  });

  test('reads the leading gt as text', () => {
    readInput('>aaa>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 5);
  });

  test('treats lt followed by non tag name character as text', () => {
    readInput('aaa<+ccc', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 8);
  });

  test('reads the start tag as a text if name begins with a non-valid char', () => {
    readInput('<@#$%*>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 7);
  });

  test('reads the start tag if name begins with a valid char followed by invalid chars', () => {
    readInput('<xxx@#$%*>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 9, 10);
  });

  test('reads XML names with non-ASCII chars', () => {
    readInput('<äää·>', strictConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 5, 6);
  });

  test('ignores bullshit in end tags', () => {
    readInput('<xxx></xxx @#$%*/>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 7, 10);
  });

  test('reads the start tag in double brackets', () => {
    readInput('<<xxx>>aaa</xxx>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 1);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_closing', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 6, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 12, 15);
  });

  test('reads empty start tag names as text and empty end tag names as comments', () => {
    readInput('< ></ >', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 5, 6);
  });

  test('reads non-alpha start tag names as text and non-alpha end tag names as comments', () => {
    readInput('<111></111>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 7, 10);
  });

  test('reads the malformed end tag as a comment', () => {
    readInput('</ xxx>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 2, 6);
  });

  test('ignores end tags without a name and content', () => {
    readInput('aaa</>bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'text', 6, 9);
  });

  test('reads </ at the end of the input as text', () => {
    readInput('aaa</', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 5);
  });

  test('reads unterminated start tags', () => {
    readInput('<aaa', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
  });

  test('reads unterminated attributes', () => {
    readInput('<aaa xxx="zzz', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 13);
  });

  test('reads unterminated end tags', () => {
    readInput('<aaa></aaa', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 7, 10);
  });

  test('reads start and end tags', () => {
    readInput('aaa<xxx>bbb</xxx>ccc', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'text', 17, 20);
  });

  test('parses comments', () => {
    readInput('aaa<xxx>bbb<!--</xxx>ccc--></xxx>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'comment', 15, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 29, 32);
  });

  test('parses empty comments', () => {
    readInput('aaa<!---->bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 7, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 10, 13);
  });

  test('reads <!--> as an empty comment', () => {
    readInput('<!-->aaa', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'text', 5, 8);
  });

  test('reads <!---> as an empty comment', () => {
    readInput('<!--->aaa', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'text', 6, 9);
  });

  test('reads comments closed with --!>', () => {
    readInput('<!--aaa--!>bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'text', 11, 14);
  });

  test('reads dashes before the comment closing as a part of the comment', () => {
    readInput('<!--aaa--->', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 8);
  });

  test('reads an unclosed comment without -- at the end of the input', () => {
    readInput('<!--aaa--', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 7);
  });

  test('reads an unclosed comment without --! at the end of the input', () => {
    readInput('<!--aaa--!', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 7);
  });

  test('reads an unclosed comment without - at the end of the input', () => {
    readInput('<!--aaa-', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 7);
  });

  test('reads an unclosed empty comment', () => {
    readInput('<!--', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 4);
  });

  test('parses body DTD as comment', () => {
    readInput('aaa<xxx>bbb<!</xxx>ccc--></xxx>', fragmentConfig);

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'comment', 13, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'text', 19, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 27, 30);
  });

  test('parse empty DTD as comment', () => {
    readInput('aaa<!>bbb', fragmentConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 6, 9);
  });

  test('parses processing instructions as comments', () => {
    readInput('aaa<?xml version="1.0"?>bbb', fragmentConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 4, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 24, 27);
  });

  test('parses empty processing instructions as comments', () => {
    readInput('aaa<?>bbb', fragmentConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 6, 9);
  });

  test('does not reads emojis as tag names', () => {
    readInput('aaa<❤️>bbb</👨‍❤️‍💋‍👨>ccc', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 12, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 24, 27);
  });

  test('reads lt as an attribute name', () => {
    readInput('<aaa <></aaa>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 6, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 6, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 9, 12);
  });

  test('ignores redundant spaces before start tag closing', () => {
    readInput('aaa<xxx   >bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_closing', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 11, 14);
  });

  test('ignores redundant spaces before end tag closing', () => {
    readInput('aaa<xxx></xxx   >bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 17, 20);
  });

  test('reads nested tags', () => {
    readInput('aaa<yyy>bbb<xxx>ccc</xxx>ddd</yyy>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(10);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'text', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 21, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'text', 25, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'end_tag_name', 30, 33);
  });

  test('reads single-quoted attributes', () => {
    readInput("<xxx yyy='aaa\"bbb' zzz='aaa\"bbb'>", defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_name', 19, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'attribute_value', 24, 31);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 32, 33);
  });

  test('reads double-quoted attributes', () => {
    readInput('<xxx yyy="aaa\'bbb" zzz="aaa\'bbb">', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_name', 19, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'attribute_value', 24, 31);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 32, 33);
  });

  test('reads unquoted attributes', () => {
    readInput('<xxx yyy=aaa"bbb\'ccc>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 20, 21);
  });

  test('reads valueless attributes', () => {
    readInput('<xxx aaa bbb>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_name', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'attribute_value', 12, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 12, 13);
  });

  test('reads valueless attribute at the end of the input', () => {
    readInput('<xxx aaa', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 8, 8);
  });

  test('reads equals sign in unquoted attribute value', () => {
    readInput('<xxx aaa= bbb=>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 14, 15);
  });

  test('reads slashes in unquoted attribute value', () => {
    readInput('<xxx aaa=bbb/ccc>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 16, 17);
  });

  test('reads entities in attributes', () => {
    readInput('<xxx aaa=&amp; bbb="&amp;" ccc=\'&amp;\' ddd=>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(10);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_name', 15, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'attribute_value', 20, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'attribute_name', 27, 30);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'attribute_value', 32, 37);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'attribute_name', 39, 42);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'attribute_value', 43, 43);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'start_tag_closing', 43, 44);
  });

  test('ignores leading slash in an attribute name', () => {
    readInput('<aaa /xxx></aaa xxx>bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'text', 20, 23);
  });

  test('reads bullshit attribute names', () => {
    readInput("<xxx < = '' fff>vvv</xxx>", defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(8);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'attribute_value', 15, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'text', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 21, 24);
  });

  test('reads attributes with unbalanced end quotes', () => {
    readInput('<xxx yyy="aaa"bbb">', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_name', 14, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'attribute_value', 18, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 18, 19);
  });

  test('does not read self-closing tags by default', () => {
    readInput('<xxx/>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 5, 6);
  });

  test('reads self-closing tag', () => {
    const config = resolveTokenizerOptions({ areSelfClosingTagsRecognized: true });

    readInput('<xxx/>', config);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_self_closing', 4, 6);
  });

  test('does not read self-closing tag with the unquoted attribute that ends with a slash', () => {
    const config = resolveTokenizerOptions({ areSelfClosingTagsRecognized: true });

    readInput('<xxx aaa=bbb//>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 14, 15);
  });

  test('ignores redundant spaces in attributes', () => {
    readInput('aaa<yyy xxx   =   "zzz">bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_name', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_value', 19, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 23, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'text', 24, 27);
  });

  test('does not read tags in double-quoted attribute', () => {
    readInput('<aaa xxx="bbb<zzz>ccc</zzz>">', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 28, 29);
  });

  test('does not read tags in single-quoted attribute', () => {
    readInput("<aaa xxx='bbb<zzz>ccc</zzz>'>", defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 28, 29);
  });

  test('does not read tags in unquoted attribute', () => {
    readInput('<aaa xxx=bbb<zzz>ccc</aaa>>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 16, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 22, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'text', 26, 27);
  });

  test('ignores tags in raw text tags', () => {
    const config = resolveTokenizerOptions({ tags: { script: { kind: 'raw_text' } } });

    readInput('<script><aaa>bbb</aaa></script>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 8, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 24, 30);
  });

  test('reads attributes of a raw text tag', () => {
    const config = resolveTokenizerOptions({ tags: { script: { kind: 'raw_text' } } });

    readInput('<script aaa="xxx" ccc="yyy">zzz</script>', config);

    expect(callbackMock).toHaveBeenCalledTimes(8);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_name', 18, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'attribute_value', 23, 26);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 27, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'text', 28, 31);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 33, 39);
  });

  test('reads tags after a self-closing raw text tag', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { kind: 'raw_text' } },
      areSelfClosingTagsRecognized: true,
    });

    readInput('<aaa/><bbb></bbb>', config);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_self_closing', 4, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 13, 16);
  });

  test('ignores tags in escapable raw text tags', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'escapable_raw_text' } } });

    readInput('<aaa><bbb></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 12, 15);
  });

  test('ignores comments in raw text tags', () => {
    const config = resolveTokenizerOptions({ tags: { script: { kind: 'raw_text' } } });

    readInput('<script><!-->bbb</--></script>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 8, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 23, 29);
  });

  test('matches case-insensitive end raw text tags', () => {
    const config = resolveTokenizerOptions({
      tags: { script: { kind: 'raw_text' } },
      areTagNamesCaseInsensitive: true,
    });

    readInput('<script><!-->bbb</--></SCRIPT>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 8, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 23, 29);
  });

  test('does not end a raw text tag with an end tag that has the same hash code but a different name', () => {
    // "aQ" and "b0" have the same hash code
    const config = resolveTokenizerOptions({ tags: { aQ: { kind: 'raw_text' } } });

    readInput('<aQ></b0></aQ>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 3, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 4, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 11, 13);
  });

  test('does not end raw text with an end tag at the end of the input', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'raw_text' } } });

    readInput('<aaa></aaa', config);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 10);
  });

  test('ends raw text with an end tag that follows another end tag without a closing', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'raw_text' } } });

    readInput('<aaa></bbb</aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 12, 15);
  });

  test('does not end script data with an end tag after an escaped start tag', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readInput('<aaa><!--<aaa></aaa></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 22, 25);
  });

  test('ends escaped script data with an end tag', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readInput('<aaa><!--</aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 11, 14);
  });

  test('ends escaping of script data at -->', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readInput('<aaa><!--<aaa>--></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 19, 22);
  });

  test('does not escape script data with <!-->', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readInput('<aaa><!--><aaa></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 17, 20);
  });

  test('reads lower-case DOCTYPE', () => {
    readInput('<!doctype html>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 10, 14);
  });

  test('reads empty DOCTYPE', () => {
    readInput('<!doctype>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 9, 9);
  });

  test('reads DOCTYPE name without separating spaces', () => {
    readInput('<!doctypehtml   >', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 9, 13);
  });

  test('ignores spaces surrounding DOCTYPE', () => {
    readInput('   <!DOCTYPE>   ', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 12, 12);
  });

  test('reads non-empty DOCTYPE', () => {
    readInput('<!DOCTYPE html>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 10, 14);
  });

  test('reads DOCTYPE after comment', () => {
    readInput('<!--xxx-->   \n\n   <!DOCTYPE html>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'doctype_name', 28, 32);
  });

  test('reads DOCTYPE and processing instruction after comment', () => {
    const config = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readInput('<!--xxx-->   \n\n   <!DOCTYPE html><!--xxx-->   \n\n   <?xml aaa?>', config);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'doctype_name', 28, 32);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'comment', 37, 40);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'processing_instruction_target', 53, 56);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'processing_instruction_data', 57, 60);
  });

  test('reads processing instruction and DOCTYPE separated with spaces', () => {
    const config = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readInput('   <?xml aaa?>   <!DOCTYPE html>   ', config);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'doctype_name', 27, 31);
  });

  test('reads bogus comment before DOCTYPE', () => {
    readInput('   <?xml aaa?>   <!DOCTYPE html>   ', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'doctype_name', 27, 31);
  });

  test('skips spaces after the malformed end tag in prolog', () => {
    readInput('   </#>   aaa', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'text', 10, 13);
  });

  test('reads bogus comment in a container', () => {
    readInput('   <aaa>   <?xml bbb?>   </aaa>   ', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'comment', 12, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 22, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 27, 30);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'text', 31, 34);
  });

  test('closes prolog with DOCTYPE after text', () => {
    const config = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readInput('<!DOCTYPE html>aaa<?xml aaa?>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 10, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'text', 15, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'processing_instruction_target', 20, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'processing_instruction_data', 24, 27);
  });

  test('closes prolog with processing instruction after text', () => {
    const config = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readInput('<?xml aaa?>aaa<!DOCTYPE html>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'comment', 16, 28);
  });

  test('closes multiple processing instruction in prolog', () => {
    const config = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readInput('   <?xml aaa?>  <?xml bbb?>  <?xml ccc?>', config);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'processing_instruction_target', 18, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'processing_instruction_data', 22, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'processing_instruction_target', 31, 34);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'processing_instruction_data', 35, 38);
  });

  test('reads text after processing instruction', () => {
    const config = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readInput('<aaa><?xxx bbb?>ccc</aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'processing_instruction_target', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'processing_instruction_data', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 21, 24);
  });

  test('closes prolog after tag', () => {
    const config = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readInput('<?xml aaa?><aaa><!DOCTYPE html>', config);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'comment', 18, 30);
  });

  test('closes prolog after end tag', () => {
    // A start tag closes the prolog too, so the end tag has none, and aaa is implicitly started instead
    const config = resolveTokenizerOptions({ tags: { aaa: { isImplicitlyStarted: true } } });

    readInput('</aaa><!DOCTYPE html>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'comment', 8, 20);
  });

  test('closes prolog after start tag without a name', () => {
    readInput('< ><!DOCTYPE html>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 5, 17);
  });

  test('closes prolog after text', () => {
    const config = resolveTokenizerOptions({ areProcessingInstructionsRecognized: true });

    readInput('<?xml aaa?>aaa<!DOCTYPE html>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'comment', 16, 28);
  });

  test('reads CDATA as comment', () => {
    readInput('<![CDATA[]]>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 2, 11);
  });

  test('reads empty CDATA', () => {
    const config = resolveTokenizerOptions({ areCDATASectionsRecognized: true });

    readInput('<![CDATA[]]>', config);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'cdata_section', 9, 9);
  });

  test('reads non-empty CDATA', () => {
    const config = resolveTokenizerOptions({ areCDATASectionsRecognized: true });

    readInput('<![CDATA[aaa]]>', config);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'cdata_section', 9, 12);
  });

  test('ignores CDATA in raw tag', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'raw_text' } }, areCDATASectionsRecognized: true });

    readInput('<aaa><![CDATA[aaa]]></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 22, 25);
  });

  test('does not read CDATA without an exclamation mark', () => {
    const config = resolveTokenizerOptions({ areCDATASectionsRecognized: true });

    readInput('<a[CDATA[]]>', config);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 11, 12);
  });

  test('does not read tags inside CDATA', () => {
    const config = resolveTokenizerOptions({ areCDATASectionsRecognized: true });

    readInput('<![CDATA[<aaa>bbb</aaa>]]>', config);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'cdata_section', 9, 23);
  });

  test('strict throws if invalid char in start tag', () => {
    expect(() => readInput('<aaa ///', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected an attribute name or a start tag closing ('>').", '<aaa ///', 5, 6)
    );
  });

  test('strict throws if invalid char in self-closing start tag', () => {
    const config = resolveTokenizerOptions({ isStrict: true, areSelfClosingTagsRecognized: true });

    expect(() => readInput('<aaa ///', config)).toThrow(
      new MarkupSyntaxError(
        "Expected an attribute name, a self-closing start tag ('/>'), or a start tag closing ('>').",
        '<aaa ///',
        5,
        6
      )
    );
  });

  test('strict throws if attribute is not followed by equals sign', () => {
    expect(() => readInput('<aaa bbb', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected an attribute value separated by an equals sign ('=').", '<aaa bbb', 8, 9)
    );
  });

  test('strict throws if attribute is not followed by equals sign', () => {
    expect(() => readInput('<aaa bbb', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected an attribute value separated by an equals sign ('=').", '<aaa bbb', 8, 9)
    );
  });

  test('strict throws if attribute has no value', () => {
    expect(() => readInput('<aaa bbb=', strictConfig)).toThrow(
      new MarkupSyntaxError(
        'Expected a double-quoted (\'"\') or a single-quoted ("\'") attribute value.',
        '<aaa bbb=',
        9,
        10
      )
    );
  });

  test('strict reads single-quoted attribute value', () => {
    readInput("<aaa bbb='ccc'>", strictConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 14, 15);
  });

  test('strict throws if attribute value is not terminated', () => {
    expect(() => readInput('<aaa bbb="ccc', strictConfig)).toThrow(
      new MarkupSyntaxError(
        "Expected the attribute value to be closed with a double-quote ('\"').",
        '<aaa bbb="ccc',
        10,
        13
      )
    );
  });

  test('strict throws if single-quoted attribute value is not terminated', () => {
    expect(() => readInput("<aaa bbb='ccc", strictConfig)).toThrow(
      new MarkupSyntaxError(
        'Expected the attribute value to be closed with a single-quote ("\'").',
        "<aaa bbb='ccc",
        10,
        13
      )
    );
  });

  test('strict throws if processing instruction does not have a target', () => {
    const config = resolveTokenizerOptions({ isStrict: true, areProcessingInstructionsRecognized: true });

    expect(() => readInput('<??>', config)).toThrow(
      new MarkupSyntaxError('Expected a processing instruction target.', '<??>', 2, 3)
    );

    expect(() => readInput('<?   aaa?>', config)).toThrow(
      new MarkupSyntaxError('Expected a processing instruction target.', '<?   aaa?>', 2, 3)
    );
  });

  test('strict throws if start tag has no name', () => {
    expect(() => readInput('< >', strictConfig)).toThrow(
      new MarkupSyntaxError('Expected a name for the start tag.', '< >', 1, 2)
    );
  });

  test('strict throws if end tag has no name', () => {
    expect(() => readInput('</ >', strictConfig)).toThrow(
      new MarkupSyntaxError('Expected a name for the end tag.', '</ >', 2, 3)
    );
  });

  test('strict throws if comment is not terminated', () => {
    expect(() => readInput('<!--aaa', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected the comment to be closed with '-->'.", '<!--aaa', 0, 7)
    );
  });

  test('strict does not read <!--> as an empty comment', () => {
    readInput('<!-->aaa-->', strictConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 8);
  });

  test('strict throws if CDATA section is not terminated', () => {
    const config = resolveTokenizerOptions({ isStrict: true, areCDATASectionsRecognized: true });

    expect(() => readInput('<![CDATA[aaa', config)).toThrow(
      new MarkupSyntaxError("Expected the CDATA section to be closed with ']]>'.", '<![CDATA[aaa', 0, 12)
    );
  });

  test('strict throws if processing instruction is not terminated', () => {
    const config = resolveTokenizerOptions({ isStrict: true, areProcessingInstructionsRecognized: true });

    expect(() => readInput('<?aaa', config)).toThrow(
      new MarkupSyntaxError("Expected the processing instruction to be closed with '?>'.", '<?aaa', 0, 5)
    );
  });

  test('strict does not read lower-case CDATA', () => {
    const config = resolveTokenizerOptions({ isStrict: true, areCDATASectionsRecognized: true });

    expect(() => readInput('<![cdata[]]>', config)).toThrow(
      new MarkupSyntaxError(
        "Expected a comment ('<!--'), a doctype declaration ('<!DOCTYPE'), or a CDATA section ('<![CDATA[').",
        '<![cdata[]]>',
        0,
        2
      )
    );
  });

  test('strict throws if processing instruction is not supported', () => {
    expect(() => readInput('<?xml?>', strictConfig)).toThrow(
      new MarkupSyntaxError('Processing instructions are forbidden.', '<?xml?>', 0, 2)
    );
  });

  test('strict throws if CDATA is not supported', () => {
    expect(() => readInput('<![CDATA[]]>', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected a comment ('<!--'), a doctype declaration ('<!DOCTYPE').", '<![CDATA[]]>', 0, 2)
    );

    expect(() => readInput('aaa<![CDATA[]]>', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected a comment ('<!--').", 'aaa<![CDATA[]]>', 3, 5)
    );

    const config = resolveTokenizerOptions({ isStrict: true, areCDATASectionsRecognized: true });

    expect(() => readInput('<!bbb>', config)).toThrow(
      new MarkupSyntaxError(
        "Expected a comment ('<!--'), a doctype declaration ('<!DOCTYPE'), or a CDATA section ('<![CDATA[').",
        '<!bbb>',
        0,
        2
      )
    );
  });

  test('balances tag tokens with the tag stack', () => {
    const config = resolveTokenizerOptions({ tags: { ccc: { kind: 'void' } }, areSelfClosingTagsRecognized: true });
    const tagStack = createTagStack(config);

    readTokens('<aaa>bbb</aaa><ccc><ddd/>', true, handler, config, createTokenizerState(config), tagStack);

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 15, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 18, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 19, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_name', 20, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'start_tag_self_closing', 23, 25);

    expect(tagStack.cursor).toBe(-1);
  });

  test('returns the input length', () => {
    expect(readInput('<aaa bbb', defaultConfig)).toBe(8);
  });

  test('returns the index of the text before the token that reaches the end of the input', () => {
    expect(readInput('<aaa>bbb<ccc', defaultConfig, false)).toBe(5);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
  });
});

describe('createTokenizerWriter', () => {
  test('reads the balanced start tag', () => {
    createTokenizerWriter(handler, defaultConfig).end('<aaa>bbb</aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 10, 13);
  });

  test('reads the unbalanced start tag', () => {
    const config = resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true });

    createTokenizerWriter(handler, config).end('<aaa><bbb>ccc');

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 13, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 13, 13);
  });

  test('implicitly ends a tag whose group shares a bit with groups of other enclosing tags', () => {
    const tags: Record<string, TagParsingOptions> = {};

    // Each tag is in its own group, and groups from the 30th up share a bit
    for (let i = 0; i < 32; ++i) {
      tags['a' + i] = { implicitEndingTagNames: ['b' + i] };
    }

    const config = resolveTokenizerOptions({ tags, areUnbalancedStartTagsImplicitlyEnded: true });

    // a31 is ended twice: when it's the innermost enclosing tag, and when it encloses bbb
    createTokenizerWriter(handler, config).end('<a30><a31></a31><a31><bbb></a31><b30>');

    expect(callbackMock).toHaveBeenCalledTimes(15);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 28, 31);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'end_tag_name', 32, 32);
    expect(callbackMock).toHaveBeenNthCalledWith(13, 'start_tag_name', 33, 36);
  });

  test('implicitly ends the immediate parent', () => {
    const config = resolveTokenizerOptions({
      areUnbalancedStartTagsImplicitlyEnded: true,
      tags: { aaa: { implicitEndingTagNames: ['ccc'] } },
    });

    createTokenizerWriter(handler, config).end('<aaa>bbb<ccc>ddd');

    expect(callbackMock).toHaveBeenCalledTimes(8);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 8, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 12, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'text', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 16, 16);
  });

  test('implicitly ends the ancestor', () => {
    const config = resolveTokenizerOptions({
      areUnbalancedStartTagsImplicitlyEnded: true,
      tags: { aaa: { implicitEndingTagNames: ['eee'] } },
    });

    createTokenizerWriter(handler, config).end('<aaa>bbb<ccc>ddd<eee>');

    expect(callbackMock).toHaveBeenCalledTimes(11);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 12, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'text', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 16, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 16, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'start_tag_name', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'start_tag_closing', 20, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 21, 21);
  });

  test('implicitly ends the topmost ancestor', () => {
    const config = resolveTokenizerOptions({
      areUnbalancedStartTagsImplicitlyEnded: true,
      tags: { aaa: { implicitEndingTagNames: ['ggg'] }, eee: { implicitEndingTagNames: ['ggg'] } },
    });

    createTokenizerWriter(handler, config).end('<aaa>bbb<ccc>ddd<eee>fff<ggg>');

    expect(callbackMock).toHaveBeenCalledTimes(15);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 12, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'text', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_name', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_closing', 20, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'text', 21, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'end_tag_name', 24, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 24, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'end_tag_name', 24, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(13, 'start_tag_name', 25, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(14, 'start_tag_closing', 28, 29);
    expect(callbackMock).toHaveBeenNthCalledWith(15, 'end_tag_name', 29, 29);
  });

  test('reads the void tag', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'void' } } });

    createTokenizerWriter(handler, config).end('<aaa>bbb');

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 5, 8);
  });

  test('reads consequent void tags', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'void' }, bbb: { kind: 'void' } } });

    createTokenizerWriter(handler, config).end('<aaa><bbb>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 10, 10);
  });

  test('reads the void tag in the container', () => {
    const config = resolveTokenizerOptions({ tags: { bbb: { kind: 'void' } } });

    createTokenizerWriter(handler, config).end('<aaa><bbb></aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 12, 15);
  });

  test('implicitly ends a tag', () => {
    const config = resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true });

    createTokenizerWriter(handler, config).end('<aaa><bbb></aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 12, 15);
  });

  test('ignores an unbalanced end tag', () => {
    const config = resolveTokenizerOptions({ areUnbalancedEndTagsIgnored: true });

    createTokenizerWriter(handler, config).end('</aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(0);
  });

  test('ignores an unbalanced end tag in a container', () => {
    const config = resolveTokenizerOptions({ areUnbalancedEndTagsIgnored: true });

    createTokenizerWriter(handler, config).end('<aaa></bbb></aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 13, 16);
  });

  test('inserts start tags for unbalanced end tags', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { isImplicitlyStarted: true } } });

    createTokenizerWriter(handler, config).end('</aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 2, 5);
  });

  test('implicitly ends a tag', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { implicitEndingTagNames: ['bbb'] } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 10, 10);
  });

  test('inserts start tag that forcefully ends preceding tag', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { implicitEndingTagNames: ['bbb'] }, bbb: { isImplicitlyStarted: true } },
    });

    createTokenizerWriter(handler, config).end('<aaa></bbb>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 7, 10);
  });

  test('inserts start tags and end tags during nesting of the same tag', () => {
    const config = resolveTokenizerOptions({
      tags: { xxx: { implicitEndingTagNames: ['xxx'], isImplicitlyStarted: true } },
    });

    createTokenizerWriter(handler, config).end('aaa<xxx>bbb<xxx>ccc</xxx>ddd</xxx>eee');

    expect(callbackMock).toHaveBeenCalledTimes(14);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 11, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_closing', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'text', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 21, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'text', 25, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'start_tag_name', 30, 33);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'start_tag_closing', 33, 34);
    expect(callbackMock).toHaveBeenNthCalledWith(13, 'end_tag_name', 30, 33);
    expect(callbackMock).toHaveBeenNthCalledWith(14, 'text', 34, 37);
  });

  test('reads case-sensitive end tags by default', () => {
    const config = resolveTokenizerOptions({
      areUnbalancedStartTagsImplicitlyEnded: true,
      areUnbalancedEndTagsIgnored: true,
    });

    createTokenizerWriter(handler, config).end('<aaa></AAA>');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 11, 11);
  });

  test('reads case-insensitive end tags', () => {
    const config = resolveTokenizerOptions({ areTagNamesCaseInsensitive: true });

    createTokenizerWriter(handler, config).end('<aaa></AAA>');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 7, 10);
  });

  test('read non ASCII alpha-chars as case-sensitive in case-insensitive tag matching mode', () => {
    const config = resolveTokenizerOptions({
      areTagNamesCaseInsensitive: true,
      areUnbalancedStartTagsImplicitlyEnded: true,
      areUnbalancedEndTagsIgnored: true,
    });

    createTokenizerWriter(handler, config).end('<aaaффф></AAAФФФ>');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 17, 17);
  });

  test('ends unbalanced tags', () => {
    const config = resolveTokenizerOptions({
      areUnbalancedStartTagsImplicitlyEnded: true,
      areUnbalancedEndTagsIgnored: true,
    });

    createTokenizerWriter(handler, config).end('<a><b></a></b>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 2);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 2, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 6, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 8, 9);
  });

  test('implicitly ends tags inside the nearest boundary', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { isImplicitEndingBoundary: true }, bbb: { implicitEndingTagNames: ['bbb'] } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb><aaa><bbb>');

    expect(callbackMock).toHaveBeenCalledTimes(12);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_name', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_closing', 19, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 20, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'end_tag_name', 20, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 20, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'end_tag_name', 20, 20);
  });

  test('implicitly ends the boundary tag that must be ended', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { implicitEndingTagNames: ['aaa'], isImplicitEndingBoundary: true } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb><aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_name', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_closing', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 15, 15);
  });

  test('reads self-closing foreign tag', () => {
    const config = resolveTokenizerOptions({
      tags: { ccc: { foreignContext: { areSelfClosingTagsRecognized: true } } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb/><ccc><ddd/></ccc></aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(11);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_name', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_self_closing', 20, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 24, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'end_tag_name', 28, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 30, 33);
  });

  test('reads sibling foreign tags', () => {
    const config = resolveTokenizerOptions({
      tags: { ccc: { foreignContext: { areSelfClosingTagsRecognized: true } } },
    });

    createTokenizerWriter(handler, config).end('<aaa><ccc>ddd</ccc><ccc>fff</ccc></aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(11);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 15, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_name', 20, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_closing', 23, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'text', 24, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'end_tag_name', 29, 32);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 35, 38);
  });

  test('reads deeply nested foreign tags', () => {
    const config = resolveTokenizerOptions({
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
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb><ccc><ddd/>xxx</ccc><eee/>');

    expect(callbackMock).toHaveBeenCalledTimes(15);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_name', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_closing', 20, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'text', 21, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'end_tag_name', 24, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 26, 29);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'start_tag_name', 31, 34);
    expect(callbackMock).toHaveBeenNthCalledWith(13, 'start_tag_self_closing', 34, 36);
    expect(callbackMock).toHaveBeenNthCalledWith(14, 'end_tag_name', 36, 36);
    expect(callbackMock).toHaveBeenNthCalledWith(15, 'end_tag_name', 36, 36);
  });

  test('restores options after a self-closing foreign tag', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { foreignContext: { areSelfClosingTagsRecognized: true } } },
    });

    createTokenizerWriter(handler, config).end('<aaa/><bbb/></bbb>');

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_self_closing', 4, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 11, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 14, 17);
  });

  test('restores the initial context after a foreign tag', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { foreignContext: {} } },
      areSelfClosingTagsRecognized: true,
    });

    createTokenizerWriter(handler, config).end('<aaa></aaa><bbb/>');

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_self_closing', 15, 17);
  });

  test('restores options after an implicitly ended foreign tag', () => {
    const config = resolveTokenizerOptions({
      tags: { bbb: { foreignContext: { areSelfClosingTagsRecognized: true } } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb></aaa><ccc/></ccc>');

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_name', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_closing', 21, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 24, 27);
  });

  test('restores options after a foreign tag that shares options with the root', () => {
    const tokenizerOptions: TokenizerOptions = {};

    tokenizerOptions.tags = {
      aaa: {
        foreignContext: { areSelfClosingTagsRecognized: true, tags: { bbb: { foreignContext: tokenizerOptions } } },
      },
    };

    const config = resolveTokenizerOptions(tokenizerOptions);

    createTokenizerWriter(handler, config).end('<aaa><bbb></bbb></aaa><ccc/></ccc>');

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 18, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_name', 23, 26);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_closing', 27, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 30, 33);
  });

  test('does not apply outer tags to content of a foreign tag', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { foreignContext: {} }, bbb: { kind: 'void' } } });

    createTokenizerWriter(handler, config).end('<aaa><bbb></bbb></aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 18, 21);
  });

  test('applies tags of a foreign tag to its content', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { foreignContext: { tags: { bbb: { kind: 'void' } } } } } });

    createTokenizerWriter(handler, config).end('<aaa><bbb></aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 12, 15);
  });

  test('implicitly ends a tag that was started in another context', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { foreignContext: {} }, bbb: { implicitEndingTagNames: ['ccc'] } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<bbb><aaa><ccc>');

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_name', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_closing', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 15, 15);
  });

  test('does not implicitly end a tag of another context that is ended by other tags', () => {
    const config = resolveTokenizerOptions({
      tags: {
        aaa: { foreignContext: { tags: { eee: { implicitEndingTagNames: ['ddd'] } } } },
        bbb: { implicitEndingTagNames: ['ccc'] },
      },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<bbb><aaa><ddd>');

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 15, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 15, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 15, 15);
  });

  test('reads a tag that implicitly ends a foreign tag with outer tags', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { implicitEndingTagNames: ['bbb'], foreignContext: {} }, bbb: { kind: 'void' } },
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb>ccc');

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'text', 10, 13);
  });

  test('reads raw text of a tag that implicitly ends a foreign tag with outer tags', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { implicitEndingTagNames: ['bbb'], foreignContext: {} }, bbb: { kind: 'raw_text' } },
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb><ccc></bbb>');

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'text', 10, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 17, 20);
  });

  test('implicitly starts a tag with tags of a foreign tag', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { foreignContext: { tags: { bbb: { isImplicitlyStarted: true } } } } },
    });

    createTokenizerWriter(handler, config).end('<aaa></bbb></aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 13, 16);
  });

  test('does not end a tag with an end tag that has the same hash code but a different name', () => {
    // "aQ" and "b0" have the same hash code
    expect(() => createTokenizerWriter(handler, defaultConfig).end('<aQ></b0>')).toThrow(
      new MarkupSyntaxError('Unexpected end tag.', '<aQ></b0>', 6, 8)
    );
  });

  test('ends a tag after its child was ended', () => {
    const config = resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true });

    createTokenizerWriter(handler, config).end('<aaa><bbb></bbb><ccc></aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 21, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 23, 26);
  });

  test('does not read a tag with the config of a tag that has the same hash code but a different name', () => {
    // "aQ" and "b0" have the same hash code
    const config = resolveTokenizerOptions({ tags: { aQ: { kind: 'void' } } });

    createTokenizerWriter(handler, config).end('<b0></b0>');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 3, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 6, 8);
  });

  test('reads tags that have the same hash code with their own configs', () => {
    // "aQ" and "b0" have the same hash code
    const config = resolveTokenizerOptions({ tags: { aQ: { kind: 'void' }, b0: { kind: 'raw_text' } } });

    createTokenizerWriter(handler, config).end('<aQ><b0><ccc></b0>');

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 3, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 4, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 5, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'text', 8, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 15, 17);
  });

  test('reads names that differ in case in options as the same tag if tag names are case-insensitive', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { implicitEndingTagNames: ['BBB'] }, bbb: { kind: 'void' } },
      areTagNamesCaseInsensitive: true,
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 10, 10);
  });

  test('reads tags of a context once', () => {
    let readCount = 0;

    const config = resolveTokenizerOptions({
      // A new record on every read
      get tags(): Record<string, TagParsingOptions> {
        ++readCount;
        return { aaa: { kind: 'void' } };
      },
    });

    createTokenizerWriter(handler, config).end('<aaa>bbb');

    expect(readCount).toBe(1);
    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 5, 8);
  });

  test('reads the foreign context of a tag once', () => {
    let readCount = 0;

    const config = resolveTokenizerOptions({
      tags: {
        aaa: {
          // New options on every read
          get foreignContext(): TokenizerContextOptions {
            ++readCount;
            return { areSelfClosingTagsRecognized: true };
          },
        },
      },
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb/></aaa>');

    expect(readCount).toBe(1);
    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_self_closing', 9, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 13, 16);
  });

  test('reads implicitEndingTagNames given as a Set', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { implicitEndingTagNames: new Set(['AAA']) as unknown as string[] } },
      areTagNamesCaseInsensitive: true,
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<aaa>bbb<aaa>ccc');

    expect(callbackMock).toHaveBeenCalledTimes(8);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 8, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 12, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'text', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 16, 16);
  });

  test('passes isRawText to the handler along with text', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { kind: 'raw_text' }, bbb: { kind: 'escapable_raw_text' } },
    });
    const textSpy = vi.spyOn(handler, 'onText');

    createTokenizerWriter(handler, config).end('xxx<aaa>yyy</aaa><bbb>zzz</bbb>');

    expect(textSpy.mock.calls.map(args => args[3])).toEqual([false, true, false]);

    textSpy.mockRestore();
  });

  test('passes isRawText to the handler for trailing raw text', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { kind: 'raw_text' } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });
    const textSpy = vi.spyOn(handler, 'onText');

    createTokenizerWriter(handler, config).end('<aaa>yyy');

    expect(textSpy.mock.calls.map(args => args[3])).toEqual([true]);

    textSpy.mockRestore();
  });

  test('closes the start tag at the end of the input', () => {
    const config = resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true });

    createTokenizerWriter(handler, config).end('<aaa');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 4, 4);
  });

  test('strict throws if document has multiple root elements', () => {
    const config = resolveTokenizerOptions({ isStrict: true, areSelfClosingTagsRecognized: true });

    expect(() => createTokenizerWriter(handler, config).end('<aaa/><bbb/>')).toThrow(
      new MarkupSyntaxError('Expected a single root element.', '<aaa/><bbb/>', 6, 10)
    );
  });

  test('throws if start tag is not closed before EOF', () => {
    expect(() => createTokenizerWriter(handler, defaultConfig).end('<aaa xxx="bbb"')).toThrow(
      new MarkupSyntaxError('Unexpected end of the document.', '<aaa xxx="bbb"', 14)
    );
  });

  test('reads tokens from chunks', () => {
    const config = resolveTokenizerOptions({});
    const writer = createTokenizerWriter(handler, config);

    writer.write('<aaa>bb');
    writer.write('b</a');

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(writer.inputOffset).toBe(5);

    writer.end('aa>');

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 5, 8);
  });

  test('reads tokens from chunks as if the whole input was read at once', () => {
    const config = resolveTokenizerOptions({
      tags: {
        br: { kind: 'void' },
        p: { implicitEndingTagNames: ['p'], isImplicitlyStarted: true },
        script: { kind: 'script_data' },
        style: { kind: 'raw_text' },
        svg: {
          foreignContext: {
            areSelfClosingTagsRecognized: true,
            areCDATASectionsRecognized: true,
            areProcessingInstructionsRecognized: true,
          },
        },
        textarea: { kind: 'escapable_raw_text' },
      },
      areTagNamesCaseInsensitive: true,
      areUnbalancedStartTagsImplicitlyEnded: true,
      areUnbalancedEndTagsIgnored: true,
    });

    const inputs = [
      '  <!DOCTYPE aaa>  <!--bbb-->  <?ccc?>  <p>ddd<br>eee<br/>fff</P>',
      '<p aaa="bbb" ccc=\'ddd\' eee=fff ggg = hhh iii>jjj</p >kkk</>lll</#mmm>',
      '<style>aaa</sty</style><textarea>bbb</textarea  ><script>ccc</scriptx></script>',
      '<script><!--<script>aaa</script>bbb--></script>ccc',
      '<svg><path aaa="bbb"/><![CDATA[ccc]]><?ddd eee?></svg><![CDATA[fff]]>',
      '<!-->aaa<!--->bbb<!--ccc--!>ddd<!--eee--->fff<!---ggg',
      'aaa < bbb <1 ccc <',
      '<p>aaa<p>bbb</div>ccc',
      '<aaa bbb="ccc',
      '<aaa bbb',
      'aaa</',
      '<script>aaa</script',
      '<!DOCTYPE',
      '<!DOC',
    ];

    for (const input of inputs) {
      expectChunksToBeReadLikeInput(input, config);
    }
  });

  test('reads raw text of a tag whose name hash code is 0', () => {
    // The tokenizer once stored the hash code of the raw text tag and took 0 for "not in raw text", so it read tags here
    expect(getCaseSensitiveHashCode('zvdrvgnj', 0, 8)).toBe(0);

    const input = '<zvdrvgnj><b>x</b></zvdrvgnj>';

    for (const kind of ['raw_text', 'escapable_raw_text', 'script_data'] as const) {
      const config = resolveTokenizerOptions({ tags: { zvdrvgnj: { kind } } });

      const tokens = [
        'start_tag_name 1 zvdrvgnj',
        'start_tag_closing 9 >',
        'text 10 <b>x</b>',
        'end_tag_name 20 zvdrvgnj',
      ];

      expect(readChunks([input], config)).toEqual(tokens);

      // Split inside the text
      expect(readChunks(['<zvdrvgnj><b>x', '</b></zvdrvgnj>'], config)).toEqual(tokens);

      expectChunksToBeReadLikeInput(input, config);
    }
  });

  test('throws errors in chunks as if the whole input was read at once', () => {
    const config = resolveTokenizerOptions({
      areSelfClosingTagsRecognized: true,
      areCDATASectionsRecognized: true,
      areProcessingInstructionsRecognized: true,
      isStrict: true,
    });

    const inputs = [
      '<?aaa bbb?>  <!DOCTYPE ccc>  <ddd eee="fff" ggg=\'hhh\'><iii/><![CDATA[jjj]]><!--kkk--><?lll mmm?>nnn</ddd>',
      '<aaa><bbb></aaa>',
      '<aaa bbb></aaa>',
      '<aaa bbb=ccc></aaa>',
      '<aaa><!--bbb',
      '<aaa></aaa><bbb/>',
      '<aaa>',
      '<aaa><!bbb></aaa>',
      '<aaa></aaa  bbb>',
    ];

    for (const input of inputs) {
      expectChunksToBeReadLikeInput(input, config);
    }
  });

  test('sets the input offset of an error', () => {
    const config = resolveTokenizerOptions({ isStrict: true });
    const writer = createTokenizerWriter(handler, config);

    writer.write('<aaa>');

    expect(() => writer.end('</bbb>')).toThrow(expect.objectContaining({ inputOffset: 5, startIndex: 2 }));
  });

  test('throws if a chunk is written after the end', () => {
    const config = resolveTokenizerOptions({});
    const writer = createTokenizerWriter(handler, config);

    writer.end();

    expect(() => writer.write('aaa')).toThrow(new Error('The writer was ended.'));
  });

  test('throws if a chunk is written after an error', () => {
    const config = resolveTokenizerOptions({ isStrict: true });
    const writer = createTokenizerWriter(handler, config);

    expect(() => writer.write('</aaa>')).toThrow(MarkupSyntaxError);
    expect(() => writer.write('bbb')).toThrow(new Error('The writer was ended.'));
  });
});
