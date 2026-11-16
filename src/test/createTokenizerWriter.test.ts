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
  onText(_input, startIndex, endIndex) {
    callbackMock('text', startIndex, endIndex);
  },
  onStartTagName(_input, startIndex, endIndex) {
    callbackMock('start_tag_name', startIndex, endIndex);
  },
  onStartTagClosing(_input, startIndex, endIndex) {
    callbackMock('start_tag_closing', startIndex, endIndex);
  },
  onStartTagSelfClosing(_input, startIndex, endIndex) {
    callbackMock('start_tag_self_closing', startIndex, endIndex);
  },
  onEndTagName(_input, startIndex, endIndex) {
    callbackMock('end_tag_name', startIndex, endIndex);
  },
  onAttribute(_input, nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex) {
    callbackMock('attribute_name', nameStartIndex, nameEndIndex);
    callbackMock('attribute_value', valueStartIndex, valueEndIndex);
  },
  onComment(_input, startIndex, endIndex) {
    callbackMock('comment', startIndex, endIndex);
  },
  onProcessingInstruction(_input, targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex) {
    callbackMock('processing_instruction_target', targetStartIndex, targetEndIndex);
    callbackMock('processing_instruction_data', dataStartIndex, dataEndIndex);
  },
  onCDATASection(_input, startIndex, endIndex) {
    callbackMock('cdata_section', startIndex, endIndex);
  },
  onDoctype(_input, nameStartIndex, nameEndIndex) {
    callbackMock('doctype_name', nameStartIndex, nameEndIndex);
  },
};

const defaultConfig = resolveTokenizerOptions({});
const strictConfig = resolveTokenizerOptions({ isStrict: true });
const fragmentConfig = { ...defaultConfig, isFragment: true };

// Reads tokens from an input with a new state and tag stack, and returns the index where unread text starts
function readInput(input: string, config: TokenizerConfig, isInputEnded = true): number {
  return readTokens(input, isInputEnded, handler, config, createTokenizerState(config), createTagStack(config));
}

// Returns tokens that a writer reads from chunks, and the error that it throws, with indices in the stream. Text of
// raw_text and script_data tags is a raw_text token.
function readChunks(chunks: string[], config: TokenizerConfig): string[] {
  const tokens: string[] = [];

  const pushToken = (tokenName: string, startIndex: number, endIndex: number, input: string): void => {
    tokens.push(tokenName + ' ' + (writer.inputOffset + startIndex) + ' ' + input.substring(startIndex, endIndex));
  };

  const writer = createTokenizerWriter(
    {
      onText(input, startIndex, endIndex, isRawText) {
        pushToken(isRawText ? 'raw_text' : 'text', startIndex, endIndex, input);
      },
      onStartTagName(input, startIndex, endIndex) {
        pushToken('start_tag_name', startIndex, endIndex, input);
      },
      onStartTagClosing(input, startIndex, endIndex) {
        pushToken('start_tag_closing', startIndex, endIndex, input);
      },
      onStartTagSelfClosing(input, startIndex, endIndex) {
        pushToken('start_tag_self_closing', startIndex, endIndex, input);
      },
      onEndTagName(input, startIndex, endIndex) {
        pushToken('end_tag_name', startIndex, endIndex, input);
      },
      onAttribute(input, nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex) {
        pushToken('attribute_name', nameStartIndex, nameEndIndex, input);
        pushToken('attribute_value', valueStartIndex, valueEndIndex, input);
      },
      onComment(input, startIndex, endIndex) {
        pushToken('comment', startIndex, endIndex, input);
      },
      onProcessingInstruction(input, targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex) {
        pushToken('processing_instruction_target', targetStartIndex, targetEndIndex, input);
        pushToken('processing_instruction_data', dataStartIndex, dataEndIndex, input);
      },
      onCDATASection(input, startIndex, endIndex) {
        pushToken('cdata_section', startIndex, endIndex, input);
      },
      onDoctype(input, nameStartIndex, nameEndIndex) {
        pushToken('doctype_name', nameStartIndex, nameEndIndex, input);
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

    const startIndex = error.inputOffset + error.startIndex;
    const endIndex = error.inputOffset + error.endIndex;

    tokens.push('error ' + startIndex + ' ' + endIndex + ' ' + error.message);
  }
  return tokens;
}

// Checks that a writer reads the input split into any two chunks, and into single chars, as if the whole input was read
// at once. Returns the tokens of the whole input, so a test can check what was read.
function expectChunksToBeReadLikeInput(input: string, config: TokenizerConfig): string[] {
  const tokens = readChunks([input], config);

  for (let i = 1; i < input.length; ++i) {
    const chunks = [input.substring(0, i), input.substring(i)];

    expect(readChunks(chunks, config), 'chunks ' + JSON.stringify(chunks)).toEqual(tokens);
  }
  expect(readChunks(input.split(''), config), 'chunks of one char').toEqual(tokens);

  return tokens;
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

  test('reads > outside of a tag as text', () => {
    readInput('>aaa>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 5);
  });

  test('reads < followed by a char that cannot start a tag name as text', () => {
    readInput('aaa<+ccc', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 8);
  });

  test('reads < at the end of the input as text', () => {
    readInput('aaa<', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 4);
  });

  test('reads </ at the end of the input as text', () => {
    readInput('aaa</', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 5);
  });

  test('reads a start tag whose name starts with punctuation as text', () => {
    readInput('<@#$%*>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 7);
  });

  test('reads punctuation after the first char as a part of a start tag name', () => {
    readInput('<xxx@#$%*>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 9, 10);
  });

  test('reads tag names that start with an underscore, a colon or a non-ASCII letter', () => {
    readInput('<_aaa><:bbb><äää>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 7, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 11, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 16, 17);
  });

  test('does not read emojis as tag names', () => {
    readInput('aaa<❤️>bbb</👨‍❤️‍💋‍👨>ccc', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 12, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 24, 27);
  });

  test('ignores chars after the name in an end tag', () => {
    readInput('<xxx></xxx @#$%*/>aaa', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 18, 21);
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

  test('reads a start tag whose name starts with a digit as text and such an end tag as a comment', () => {
    readInput('<111></111>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 7, 10);
  });

  test('reads an end tag with a space before its name as a comment', () => {
    readInput('</ xxx>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 2, 6);
  });

  test('reads an unterminated malformed end tag as a comment', () => {
    readInput('aaa</#bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 5, 9);
  });

  test('ignores </>', () => {
    readInput('aaa</>bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'text', 6, 9);
  });

  test('reads unterminated start tags', () => {
    readInput('<aaa', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
  });

  test('reads an unterminated double-quoted attribute value', () => {
    readInput('<aaa xxx="zzz', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 13);
  });

  test('reads an unterminated unquoted attribute value', () => {
    readInput('<aaa bbb=ccc', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 12);
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

  test('reads tabs, line feeds and carriage returns as spaces', () => {
    readInput('\t\r\n<!DOCTYPE\thtml>\r\n<aaa\tbbb\n=\r\nccc\tddd\r>eee</aaa\t>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 13, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 21, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_name', 25, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_value', 32, 35);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'attribute_name', 36, 39);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'attribute_value', 40, 40);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_closing', 40, 41);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'text', 41, 44);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 46, 49);
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

  test('does not read tags in a comment', () => {
    readInput('aaa<xxx>bbb<!--</xxx>ccc--></xxx>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'comment', 15, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 29, 32);
  });

  test('reads an empty comment', () => {
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

  test('reads -- that does not close a comment as a part of the comment', () => {
    readInput('<!--aaa--bbb-->', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 12);
  });

  test('reads --! that does not close a comment as a part of the comment', () => {
    readInput('<!--aaa--!bbb-->', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 13);
  });

  test('does not read -- at the end of the input as a part of an unclosed comment', () => {
    readInput('<!--aaa--', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 7);
  });

  test('does not read --! at the end of the input as a part of an unclosed comment', () => {
    readInput('<!--aaa--!', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 7);
  });

  test('does not read - at the end of the input as a part of an unclosed comment', () => {
    readInput('<!--aaa-', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 7);
  });

  test('reads an unclosed empty comment', () => {
    readInput('<!--', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 4);
  });

  test('reads an unclosed comment up to the end of the input', () => {
    readInput('<!--aaa<bbb>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 12);
  });

  test('reads a bogus comment up to the first >', () => {
    readInput('aaa<xxx>bbb<!</xxx>ccc--></xxx>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'comment', 13, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'text', 19, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 27, 30);
  });

  test('reads <!> as an empty comment', () => {
    readInput('aaa<!>bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 6, 9);
  });

  test('reads an unclosed bogus comment up to the end of the input', () => {
    readInput('aaa<!bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 5, 8);
  });

  test('reads a processing instruction as a comment by default', () => {
    readInput('aaa<?xml version="1.0"?>bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 4, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 24, 27);
  });

  test('reads <?> as a comment by default', () => {
    readInput('aaa<?>bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'comment', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 6, 9);
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

  test('reads entities as a part of attribute values', () => {
    readInput('<xxx aaa=&amp; bbb="&amp;" ccc=\'&amp;\'>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(8);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_name', 15, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'attribute_value', 20, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'attribute_name', 27, 30);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'attribute_value', 32, 37);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_closing', 38, 39);
  });

  test('reads an empty unquoted attribute value before the start tag closing', () => {
    readInput('<xxx ddd=>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
  });

  test('reads empty quoted attribute values', () => {
    readInput('<xxx aaa="" bbb=\'\'>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'attribute_value', 17, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 18, 19);
  });

  test('ignores a slash before an attribute name', () => {
    readInput('<aaa /xxx>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
  });

  test('ignores an equals sign before an attribute name', () => {
    readInput('<xxx =aaa>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 9, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
  });

  test('reads a slash that is not followed by > as a separator of names in a start tag', () => {
    const config = resolveTokenizerOptions({ areSelfClosingTagsRecognized: true });

    readInput('<xxx/aaa/bbb>', config);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 8, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_name', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'attribute_value', 12, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 12, 13);
  });

  test('reads < as an attribute name', () => {
    readInput('<aaa <></aaa>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 6, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 6, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 9, 12);
  });

  test('reads the value of an attribute whose name is <', () => {
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

  test('ignores spaces around the equals sign of an attribute', () => {
    readInput('aaa<yyy xxx   =   "zzz">bbb', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_name', 8, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'attribute_value', 19, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 23, 24);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'text', 24, 27);
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

  test('reads a self-closing tag with attributes', () => {
    const config = resolveTokenizerOptions({ areSelfClosingTagsRecognized: true });

    readInput('<xxx aaa="bbb" />', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_self_closing', 15, 17);
  });

  test('reads a self-closing tag after a valueless attribute', () => {
    const config = resolveTokenizerOptions({ areSelfClosingTagsRecognized: true });

    readInput('<xxx aaa/>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 8, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_self_closing', 8, 10);
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

  test('reads < as a part of an unquoted attribute value', () => {
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

  test('reads tags in a raw text tag as text', () => {
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

  test('reads tags in an escapable raw text tag as text', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'escapable_raw_text' } } });

    readInput('<aaa><bbb></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 12, 15);
  });

  test('reads comments in a raw text tag as text', () => {
    const config = resolveTokenizerOptions({ tags: { script: { kind: 'raw_text' } } });

    readInput('<script><!-->bbb</--></script>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 7, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 8, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 23, 29);
  });

  test('ends raw text with an end tag in a different case if tag names are case-insensitive', () => {
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

  test('does not end raw text with an end tag in a different case by default', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'raw_text' } } });

    readInput('<aaa></AAA></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 13, 16);
  });

  test('does not end a raw text tag with an end tag that has the same hash code but a different name', () => {
    // The test needs names with equal hash codes. End tags in raw text are compared by chars, and this guards against
    // matching them by hash code.
    expect(getCaseSensitiveHashCode('aQ', 0, 2)).toBe(getCaseSensitiveHashCode('b0', 0, 2));

    const config = resolveTokenizerOptions({ tags: { aQ: { kind: 'raw_text' } } });

    readInput('<aQ></b0></aQ>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 3, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 4, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 11, 13);
  });

  test('does not end raw text with an unterminated end tag at the end of the input', () => {
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

  test('does not end raw text with an end tag whose name starts with the name of the raw text tag', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'raw_text' } } });

    readInput('<aaa></aaab></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 14, 17);
  });

  test('ends raw text with an end tag whose name is followed by a space', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'raw_text' } } });

    readInput('<aaa>bbb</aaa ccc>ddd', config);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 18, 21);
  });

  test('ends raw text with an end tag whose name is followed by a slash', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'raw_text' } } });

    readInput('<aaa>bbb</aaa/>ddd', config);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 15, 18);
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

  test('ends double escaping of script data at -->', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readInput('<aaa><!--<aaa>--></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 19, 22);
  });

  test('ends escaping of script data at -->', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    // After --> the start tag doesn't make script data double escaped, so the end tag ends it
    readInput('<aaa><!--bbb--><aaa></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 22, 25);
  });

  test('escapes script data again after -->', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readInput('<aaa><!--bbb--><!--<aaa></aaa></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 30);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 32, 35);
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

  test('does not double escape script data with a start tag of a longer name', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readInput('<aaa><!--<aaax></aaa>bbb', config);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 21, 24);
  });

  test('does not double escape script data with a start tag that is not after <!--', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readInput('<aaa><aaa></aaa>bbb', config);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 16, 19);
  });

  test('ends script data with an end tag in a different case if tag names are case-insensitive', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { kind: 'script_data' } },
      areTagNamesCaseInsensitive: true,
    });

    readInput('<aaa>bbb</AAA>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 10, 13);
  });

  test('double escapes script data with a start tag in a different case if tag names are case-insensitive', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { kind: 'script_data' } },
      areTagNamesCaseInsensitive: true,
    });

    readInput('<aaa><!--<AAA></AAA></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 22, 25);
  });

  test('does not end script data with an unterminated end tag at the end of the input', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'script_data' } } });

    readInput('<aaa>bbb</aaa', config);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 13);
  });

  test('reads lower-case DOCTYPE', () => {
    readInput('<!doctype html>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 10, 14);
  });

  test('reads upper-case DOCTYPE', () => {
    readInput('<!DOCTYPE html>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 10, 14);
  });

  test('reads empty DOCTYPE', () => {
    readInput('<!DOCTYPE>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 9, 9);
  });

  test('reads DOCTYPE name without separating spaces', () => {
    readInput('<!DOCTYPEhtml   >', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 9, 13);
  });

  test('ignores spaces surrounding DOCTYPE', () => {
    readInput('   <!DOCTYPE>   ', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 12, 12);
  });

  test('reads unterminated DOCTYPE', () => {
    readInput('<!DOCTYPE html', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 10, 14);
  });

  test('reads public and system identifiers of DOCTYPE', () => {
    const tokens: string[] = [];
    const input = '<!DOCTYPE html PUBLIC "aaa" \'bbb\'>';

    createTokenizerWriter(
      {
        onDoctype(
          input,
          nameStartIndex,
          nameEndIndex,
          publicIdStartIndex,
          publicIdEndIndex,
          systemIdStartIndex,
          systemIdEndIndex
        ) {
          tokens.push(
            input.substring(nameStartIndex, nameEndIndex),
            input.substring(publicIdStartIndex, publicIdEndIndex),
            input.substring(systemIdStartIndex, systemIdEndIndex)
          );
        },
      },
      defaultConfig
    ).end(input);

    expect(tokens).toEqual(['html', 'aaa', 'bbb']);
  });

  test.each([
    ['<!DOCTYPE html SYSTEM "aaa">', ['html', '', 'aaa']],
    ['<!doctype html system "aaa">', ['html', '', 'aaa']],
    ['<!DOCTYPE html PUBLIC "aaa">', ['html', 'aaa', '']],
    ['<!DOCTYPE html PUBLIC "aa>a" "bbb">', ['html', 'aa', '']],
    ['<!DOCTYPE html PUBLIC aaa>', ['html', '', '']],
    ['<!DOCTYPE html bbb "aaa">', ['html', '', '']],
    ['<!DOCTYPE 1/2>', ['1/2', '', '']],
    ['<!DOCTYPE>', ['', '', '']],
  ])('reads DOCTYPE %s', (input, expectedTokens) => {
    const tokens: string[] = [];

    createTokenizerWriter(
      {
        onDoctype(
          input,
          nameStartIndex,
          nameEndIndex,
          publicIdStartIndex,
          publicIdEndIndex,
          systemIdStartIndex,
          systemIdEndIndex
        ) {
          tokens.push(
            input.substring(nameStartIndex, nameEndIndex),
            input.substring(publicIdStartIndex, publicIdEndIndex),
            input.substring(systemIdStartIndex, systemIdEndIndex)
          );
        },
      },
      defaultConfig
    ).end(input);

    expect(tokens).toEqual(expectedTokens);
  });

  test('ignores the second DOCTYPE in the prologue', () => {
    readInput('<!DOCTYPE aaa> <!DOCTYPE bbb>ccc', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'text', 29, 32);
  });

  test('strict reads the second DOCTYPE in the prologue', () => {
    readInput('<!DOCTYPE aaa> <!DOCTYPE bbb><ccc></ccc>', strictConfig);

    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'doctype_name', 25, 28);
  });

  test('ignores DOCTYPE in fragment', () => {
    readInput('aaa<!DOCTYPE html>bbb', fragmentConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'text', 18, 21);
  });

  test('reads leading spaces of a fragment as text', () => {
    readInput('  <aaa>  ', fragmentConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 2);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_name', 3, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_closing', 6, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 7, 9);
  });

  test('does not end the prologue after a comment', () => {
    readInput('<!--xxx-->   \n\n   <!DOCTYPE html>', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'doctype_name', 28, 32);
  });

  test('does not end the prologue after DOCTYPE', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'xml' });

    readInput('<!--xxx-->   \n\n   <!DOCTYPE html><!--xxx-->   \n\n   <?xml aaa?>', config);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 7);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'doctype_name', 28, 32);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'comment', 37, 40);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'processing_instruction_target', 53, 56);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'processing_instruction_data', 57, 60);
  });

  test('does not end the prologue after a processing instruction', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'xml' });

    readInput('   <?xml aaa?>   <!DOCTYPE html>   ', config);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'doctype_name', 27, 31);
  });

  test('does not end the prologue after a bogus comment', () => {
    readInput('   <?xml aaa?>   <!DOCTYPE html>   ', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 4, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'doctype_name', 27, 31);
  });

  test('does not end the prologue after a malformed end tag', () => {
    readInput('   </#>   aaa', defaultConfig);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'text', 10, 13);
  });

  test('skips spaces between processing instructions in the prologue', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'xml' });

    readInput('   <?xml aaa?>  <?xml bbb?>  <?xml ccc?>', config);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'processing_instruction_target', 18, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'processing_instruction_data', 22, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'processing_instruction_target', 31, 34);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'processing_instruction_data', 35, 38);
  });

  test('ends the prologue after a start tag', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'xml' });

    readInput('<?xml aaa?><aaa><!DOCTYPE html>', config);

    // DOCTYPE after the prolog is ignored
    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 15, 16);
  });

  test('ends the prologue after an end tag', () => {
    // A start tag ends the prologue too, so the end tag has no start tag, and aaa is implicitly started instead
    const config = resolveTokenizerOptions({ tags: { aaa: { isImplicitlyStarted: true } } });

    readInput('</aaa><!DOCTYPE html>', config);

    // DOCTYPE after the prologue is ignored
    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 2, 5);
  });

  test('ends the prologue after a start tag without a name', () => {
    readInput('< ><!DOCTYPE html>', defaultConfig);

    // DOCTYPE after the prolog is ignored
    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
  });

  test('ends the prologue after < that is followed by a tag', () => {
    readInput('<<!DOCTYPE html>', defaultConfig);

    // DOCTYPE after the prologue is ignored
    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 1);
  });

  test('ends the prologue after text', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'xml' });

    readInput('<?xml aaa?>aaa<!DOCTYPE html>', config);

    // DOCTYPE after the prolog is ignored
    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 11, 14);
  });

  test('ends the prologue after text that follows DOCTYPE', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'xml' });

    // Spaces after the processing instruction are text, since the prologue was ended
    readInput('<!DOCTYPE html>aaa<?xml aaa?>   ', config);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'doctype_name', 10, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'text', 15, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'processing_instruction_target', 20, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'processing_instruction_data', 24, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 29, 32);
  });

  test('ends the prologue after a CDATA section', () => {
    const config = resolveTokenizerOptions({ areCDATASectionsRecognized: true });

    readInput('<![CDATA[aaa]]><!DOCTYPE html>', config);

    // DOCTYPE after the prologue is ignored
    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'cdata_section', 9, 12);
  });

  test('reads spaces around a bogus comment as text after the prologue', () => {
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

  test('reads spaces after comments and processing instructions as text after the prologue', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'xml' });

    readInput('<aaa><!--bbb-->   <?ccc ddd?>   </#>   </aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(10);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'comment', 9, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 15, 18);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'processing_instruction_target', 20, 23);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'processing_instruction_data', 24, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'text', 29, 32);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'comment', 34, 35);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'text', 36, 39);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'end_tag_name', 41, 44);
  });

  test('reads text after processing instruction', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'xml' });

    readInput('<aaa><?xxx bbb?>ccc</aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'processing_instruction_target', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'processing_instruction_data', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'text', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 21, 24);
  });

  test('reads processing instruction without a target', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'xml' });

    readInput('<? aaa?>', config);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 2);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 3, 6);
  });

  test('reads unterminated processing instruction', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'xml' });

    readInput('<?aaa bbb', config);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 6, 9);
  });

  test('reads HTML processing instruction', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'html' });

    readInput('<?aaa bbb>ccc', config);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 10, 13);
  });

  test('reads HTML processing instruction without one question mark before closing', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'html' });

    readInput('<?aaa bbb??>', config);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 6, 10);
  });

  test('reads HTML processing instruction that ends at the first closing angle bracket', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'html' });

    readInput('<?aaa bbb>ccc?>', config);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 10, 15);
  });

  test.each(['<?xml aaa>', '<?XML-STYLESHEET aaa>', '<?a.b>', '<?1a>', '<?>'])(
    'reads HTML processing instruction %s as comment',
    input => {
      const config = resolveTokenizerOptions({ processingInstructionSyntax: 'html' });

      readInput(input, config);

      expect(callbackMock).toHaveBeenCalledTimes(1);
      expect(callbackMock).toHaveBeenNthCalledWith(1, 'comment', 1, input.length - 1);
    }
  );

  test('ignores unclosed HTML processing instruction', () => {
    const config = resolveTokenizerOptions({ processingInstructionSyntax: 'html' });

    readInput('aaa<?bbb ccc', config);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'text', 0, 3);
  });

  test('reads CDATA as a bogus comment by default', () => {
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

  test('reads unterminated CDATA', () => {
    const config = resolveTokenizerOptions({ areCDATASectionsRecognized: true });

    readInput('<![CDATA[aaa]]', config);

    expect(callbackMock).toHaveBeenCalledTimes(1);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'cdata_section', 9, 14);
  });

  test('reads CDATA in a raw text tag as text', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'raw_text' } }, areCDATASectionsRecognized: true });

    readInput('<aaa><![CDATA[aaa]]></aaa>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 22, 25);
  });

  test('does not read CDATA that starts with a letter instead of an exclamation mark', () => {
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

  test('strict throws if invalid char in start tag and self-closing tags are recognized', () => {
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

  test('strict reads tag names and attribute names with non-ASCII chars', () => {
    readInput('<äää· ööö·="bbb"></äää·>', strictConfig);

    expect(callbackMock).toHaveBeenCalledTimes(5);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 6, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 16, 17);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 19, 23);
  });

  test('strict reads a processing instruction target with non-ASCII chars', () => {
    const config = resolveTokenizerOptions({ isStrict: true, processingInstructionSyntax: 'xml' });

    readInput('<?äää· bbb?>', config);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 7, 10);
  });

  test('strict reads XML names with dots, dashes, colons, underscores and digits', () => {
    readInput('<a.b-c:d_e1 f.g-h:i_j2="kkk">', strictConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 12, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 24, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 28, 29);
  });

  test('strict throws if a name starts with a char that is not an XML name start char', () => {
    expect(() => readInput('<1aa>', strictConfig)).toThrow(
      new MarkupSyntaxError('Expected a name for the start tag.', '<1aa>', 1, 2)
    );

    expect(() => readInput('<aaa></1aa>', strictConfig)).toThrow(
      new MarkupSyntaxError('Expected a name for the end tag.', '<aaa></1aa>', 7, 8)
    );

    expect(() => readInput('<aaa 1bb="ccc">', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected an attribute name or a start tag closing ('>').", '<aaa 1bb="ccc">', 5, 6)
    );

    const config = resolveTokenizerOptions({ isStrict: true, processingInstructionSyntax: 'xml' });

    expect(() => readInput('<?1aa?>', config)).toThrow(
      new MarkupSyntaxError('Expected a processing instruction target.', '<?1aa?>', 2, 3)
    );
  });

  test('strict throws if a name has a char that is not an XML name char', () => {
    expect(() => readInput('<aaa@>', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected an attribute name or a start tag closing ('>').", '<aaa@>', 4, 5)
    );

    expect(() => readInput('<aaa></aaa@>', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected a closing angle bracket ('>').", '<aaa></aaa@>', 10, 11)
    );

    expect(() => readInput('<aaa b@b="ccc">', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected an attribute value separated by an equals sign ('=').", '<aaa b@b="ccc">', 6, 7)
    );
  });

  test('strict throws if attribute is not followed by equals sign', () => {
    expect(() => readInput('<aaa bbb', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected an attribute value separated by an equals sign ('=').", '<aaa bbb', 8, 9)
    );
  });

  test('strict throws if attribute is followed by start tag closing', () => {
    expect(() => readInput('<aaa bbb>', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected an attribute value separated by an equals sign ('=').", '<aaa bbb>', 8, 9)
    );
  });

  test('strict reads spaces around the equals sign', () => {
    readInput('<aaa bbb = "ccc">', strictConfig);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 16, 17);
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

  test('strict throws if attribute value is not quoted', () => {
    expect(() => readInput('<aaa bbb=ccc>', strictConfig)).toThrow(
      new MarkupSyntaxError(
        'Expected a double-quoted (\'"\') or a single-quoted ("\'") attribute value.',
        '<aaa bbb=ccc>',
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

  test('strict throws if double-quoted attribute value is not terminated', () => {
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
    const config = resolveTokenizerOptions({ isStrict: true, processingInstructionSyntax: 'xml' });

    expect(() => readInput('<??>', config)).toThrow(
      new MarkupSyntaxError('Expected a processing instruction target.', '<??>', 2, 3)
    );

    expect(() => readInput('<?   aaa?>', config)).toThrow(
      new MarkupSyntaxError('Expected a processing instruction target.', '<?   aaa?>', 2, 3)
    );
  });

  test('strict reads processing instruction without data', () => {
    const config = resolveTokenizerOptions({ isStrict: true, processingInstructionSyntax: 'xml' });

    readInput('<?aaa?>bbb', config);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'processing_instruction_target', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'processing_instruction_data', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 7, 10);
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

  test('strict reads spaces before end tag closing', () => {
    readInput('<aaa></aaa \n\t >', strictConfig);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 7, 10);
  });

  test('strict throws if end tag has chars after its name', () => {
    expect(() => readInput('<aaa></aaa bbb>', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected a closing angle bracket ('>').", '<aaa></aaa bbb>', 11, 12)
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
    const config = resolveTokenizerOptions({ isStrict: true, processingInstructionSyntax: 'xml' });

    expect(() => readInput('<?aaa', config)).toThrow(
      new MarkupSyntaxError("Expected the processing instruction to be closed with '?>'.", '<?aaa', 0, 5)
    );
  });

  test('strict throws if comment, CDATA section or processing instruction is not terminated after text', () => {
    const config = resolveTokenizerOptions({
      isStrict: true,
      areCDATASectionsRecognized: true,
      processingInstructionSyntax: 'xml',
    });

    expect(() => readInput('aaa<!--bbb', config)).toThrow(
      new MarkupSyntaxError("Expected the comment to be closed with '-->'.", 'aaa<!--bbb', 3, 10)
    );

    expect(() => readInput('aaa<![CDATA[bbb', config)).toThrow(
      new MarkupSyntaxError("Expected the CDATA section to be closed with ']]>'.", 'aaa<![CDATA[bbb', 3, 15)
    );

    expect(() => readInput('aaa<?bbb', config)).toThrow(
      new MarkupSyntaxError("Expected the processing instruction to be closed with '?>'.", 'aaa<?bbb', 3, 8)
    );
  });

  test('strict throws if CDATA section opening is in lower case', () => {
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

  test('strict throws if processing instructions are not recognized', () => {
    expect(() => readInput('<?xml?>', strictConfig)).toThrow(
      new MarkupSyntaxError('Processing instructions are forbidden.', '<?xml?>', 0, 2)
    );
  });

  test('strict throws if CDATA sections are not recognized', () => {
    expect(() => readInput('<![CDATA[]]>', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected a comment ('<!--'), a doctype declaration ('<!DOCTYPE').", '<![CDATA[]]>', 0, 2)
    );
  });

  test('strict does not expect DOCTYPE after the prologue', () => {
    expect(() => readInput('aaa<![CDATA[]]>', strictConfig)).toThrow(
      new MarkupSyntaxError("Expected a comment ('<!--').", 'aaa<![CDATA[]]>', 3, 5)
    );
  });

  test('strict throws if markup declaration is not a comment, DOCTYPE or CDATA section', () => {
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

  test('strict throws if DOCTYPE is in a fragment', () => {
    const config = { ...strictConfig, isFragment: true };

    expect(() => readInput('<!DOCTYPE html>', config)).toThrow(
      new MarkupSyntaxError("Expected a comment ('<!--').", '<!DOCTYPE html>', 0, 2)
    );
  });

  test('strict reads multiple root elements in a fragment', () => {
    const config = {
      ...resolveTokenizerOptions({ isStrict: true, areSelfClosingTagsRecognized: true }),
      isFragment: true,
    };

    readInput('<aaa/><bbb/>', config);

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_self_closing', 4, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_self_closing', 10, 12);
  });

  test('pops ended, void and self-closing tags from the tag stack', () => {
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

    expect(tagStack.lastIndex).toBe(-1);
  });

  test('returns the input length if the input is ended', () => {
    expect(readInput('<aaa bbb', defaultConfig)).toBe(8);
  });

  test('returns the input length if all of the input was read', () => {
    expect(readInput('<aaa></aaa>', defaultConfig, false)).toBe(11);
  });

  test('returns the index of the text before the token that reaches the end of the input', () => {
    expect(readInput('<aaa>bbb<ccc', defaultConfig, false)).toBe(5);

    expect(callbackMock).toHaveBeenCalledTimes(2);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
  });

  test('returns the index of the attribute that reaches the end of the input', () => {
    expect(readInput('<aaa bbb="ccc" ddd', defaultConfig, false)).toBe(15);

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'attribute_name', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'attribute_value', 10, 13);
  });
});

describe('createTokenizerWriter', () => {
  test('reads balanced tags', () => {
    createTokenizerWriter(handler, defaultConfig).end('<aaa>bbb</aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 5, 8);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'end_tag_name', 10, 13);
  });

  test('implicitly ends unbalanced start tags at the end of the input', () => {
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

  test('implicitly ends a tag at the end tag of its ancestor', () => {
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

  test('throws if a tag is not ended before the end tag of its ancestor', () => {
    expect(() => createTokenizerWriter(handler, defaultConfig).end('<aaa><bbb></aaa>')).toThrow(
      new MarkupSyntaxError('Expected an end tag.', '<aaa><bbb></aaa>', 10, 10)
    );
  });

  test('implicitly ends a tag at the end tag of its ancestor and ignores its own end tag after that', () => {
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

  test('ends an ancestor that was started after tags were implicitly ended', () => {
    const config = resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true });

    // </b> searches the stack and ends c and b, then d and e take their places in the stack
    createTokenizerWriter(handler, config).end('<a><b><c></b><d><e></d></a>');

    expect(callbackMock).toHaveBeenCalledTimes(15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 9, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 11, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(13, 'end_tag_name', 19, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(14, 'end_tag_name', 21, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(15, 'end_tag_name', 25, 26);
  });

  test('ends an ancestor that was started after a tag was ended by its end tag', () => {
    const config = resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true });

    // </c> searches the stack, </b> ends the innermost tag without a search, then e and f take places of b and c
    createTokenizerWriter(handler, config).end('<a><b><c><d></c></b><e><f></e></a>');

    expect(callbackMock).toHaveBeenCalledTimes(18);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 12, 12);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'end_tag_name', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 18, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(16, 'end_tag_name', 26, 26);
    expect(callbackMock).toHaveBeenNthCalledWith(17, 'end_tag_name', 28, 29);
    expect(callbackMock).toHaveBeenNthCalledWith(18, 'end_tag_name', 32, 33);
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

  test('implicitly ends the immediate parent that has no content', () => {
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

  test('implicitly ends the outermost ancestor that a start tag ends', () => {
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

  test('does not read a tag with the config of a tag that was ended at the same depth', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { implicitEndingTagNames: ['ccc'] } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    // bbb takes the place of the first aaa in the stack of enclosing tags, so ccc must end only the second aaa
    createTokenizerWriter(handler, config).end('<aaa></aaa><bbb><aaa><ccc>');

    expect(callbackMock).toHaveBeenCalledTimes(12);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 7, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_name', 17, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_closing', 20, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 21, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'start_tag_name', 22, 25);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'start_tag_closing', 25, 26);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 26, 26);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'end_tag_name', 26, 26);
  });

  test('implicitly ends a tag after tags whose groups share a bit with its group were ended', () => {
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

  test('implicitly ends a tag inside a tag whose group shares a bit with the group that a start tag ends', () => {
    const tags: Record<string, TagParsingOptions> = {};

    // Each tag is in its own group, and groups from the 30th up share a bit
    for (let i = 0; i < 32; ++i) {
      tags['a' + i] = { implicitEndingTagNames: ['b' + i] };
    }

    const config = resolveTokenizerOptions({ tags, areUnbalancedStartTagsImplicitlyEnded: true });

    // b30 ends a30, but not a31 that encloses it, though groups of a30 and a31 share a bit
    createTokenizerWriter(handler, config).end('<a31><a30><b30>');

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_name', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_closing', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 15, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 15, 15);
  });

  test('does not implicitly end a tag whose group shares a bit with the group that a start tag ends', () => {
    const tags: Record<string, TagParsingOptions> = {};

    // Each tag is in its own group, and groups from the 30th up share a bit
    for (let i = 0; i < 32; ++i) {
      tags['a' + i] = { implicitEndingTagNames: ['b' + i] };
    }

    const config = resolveTokenizerOptions({ tags, areUnbalancedStartTagsImplicitlyEnded: true });

    // b31 ends a31, whose group shares a bit with the group of a30
    createTokenizerWriter(handler, config).end('<a30><b31>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 10, 10);
  });

  test('implicitly ends tags with a start tag if unbalanced start tags are not implicitly ended', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { implicitEndingTagNames: ['bbb'] } } });

    createTokenizerWriter(handler, config).end('<aaa><ccc><bbb></bbb>');

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_name', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_closing', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 17, 20);
  });

  test('does not implicitly end a tag outside the nearest implicit ending scope', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { isImplicitEndingScope: true }, bbb: { implicitEndingTagNames: ['bbb'] } },
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

  test('implicitly ends a tag inside the nearest implicit ending scope', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { isImplicitEndingScope: true }, bbb: { implicitEndingTagNames: ['bbb'] } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<bbb><aaa><bbb><bbb>');

    expect(callbackMock).toHaveBeenCalledTimes(12);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 14, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 15, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_name', 16, 19);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'start_tag_closing', 19, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'end_tag_name', 20, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 20, 20);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'end_tag_name', 20, 20);
  });

  test('implicitly ends the implicit ending scope that must be ended', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { implicitEndingTagNames: ['aaa'], isImplicitEndingScope: true } },
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

  test('does not implicitly end a tag outside the nearest implicit ending scope with an implicitly started tag', () => {
    const config = resolveTokenizerOptions({
      tags: {
        aaa: { isImplicitEndingScope: true },
        bbb: { implicitEndingTagNames: ['ccc'] },
        ccc: { isImplicitlyStarted: true },
      },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<bbb><aaa></ccc>');

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 16, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 16, 16);
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

  test('closes and ends the void start tag at the end of the input', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { kind: 'void' } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<aaa');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 4, 4);
  });

  test('does not insert an end tag after a self-closing void tag', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'void' } }, areSelfClosingTagsRecognized: true });

    createTokenizerWriter(handler, config).end('<aaa/>bbb');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_self_closing', 4, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'text', 6, 9);
  });

  test('reads consecutive void tags', () => {
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

  test('does not read a tag that follows a void tag as a void tag', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'void' } } });

    createTokenizerWriter(handler, config).end('<aaa><bbb>ccc</bbb>');

    expect(callbackMock).toHaveBeenCalledTimes(7);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'text', 10, 13);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 15, 18);
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

  test('throws if a void tag has an end tag', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'void' } } });

    expect(() => createTokenizerWriter(handler, config).end('<aaa></aaa>')).toThrow(
      new MarkupSyntaxError('Unexpected end tag.', '<aaa></aaa>', 7, 10)
    );
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

  test('throws if an end tag is unbalanced', () => {
    expect(() => createTokenizerWriter(handler, defaultConfig).end('</aaa>')).toThrow(
      new MarkupSyntaxError('Unexpected end tag.', '</aaa>', 2, 5)
    );

    expect(() => createTokenizerWriter(handler, defaultConfig).end('<aaa></bbb></aaa>')).toThrow(
      new MarkupSyntaxError('Unexpected end tag.', '<aaa></bbb></aaa>', 7, 10)
    );
  });

  test('inserts a start tag for an unbalanced end tag of an implicitly started tag', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { isImplicitlyStarted: true } } });

    createTokenizerWriter(handler, config).end('</aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 2, 5);
  });

  test('inserts a start tag for an implicitly started tag if unbalanced end tags are ignored', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { isImplicitlyStarted: true } },
      areUnbalancedEndTagsIgnored: true,
    });

    createTokenizerWriter(handler, config).end('</aaa></bbb>');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 2, 5);
  });

  test('implicitly ends the enclosing tag with an inserted start tag', () => {
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

  test('does not end a tag with an end tag that differs in case by default', () => {
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

  test('ends a tag with an end tag that differs in case if tag names are case-insensitive', () => {
    const config = resolveTokenizerOptions({ areTagNamesCaseInsensitive: true });

    createTokenizerWriter(handler, config).end('<aaa></AAA>');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 7, 10);
  });

  test('ends an ancestor with an end tag that differs in case if tag names are case-insensitive', () => {
    const config = resolveTokenizerOptions({
      areTagNamesCaseInsensitive: true,
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<aaA><bbb></Aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 12, 15);
  });

  test('strict ends an ancestor with an end tag that differs in case if tag names are case-insensitive', () => {
    const config = resolveTokenizerOptions({
      areTagNamesCaseInsensitive: true,
      areUnbalancedStartTagsImplicitlyEnded: true,
      isStrict: true,
    });

    createTokenizerWriter(handler, config).end('<aaA><bbb></Aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 10, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 12, 15);
  });

  test('reads a start tag that differs in case with the config of the tag if tag names are case-insensitive', () => {
    const config = resolveTokenizerOptions({ tags: { aaa: { kind: 'void' } }, areTagNamesCaseInsensitive: true });

    createTokenizerWriter(handler, config).end('<AAA>bbb');

    expect(callbackMock).toHaveBeenCalledTimes(4);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'text', 5, 8);
  });

  test('implicitly ends a tag with a start tag that differs in case if tag names are case-insensitive', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { implicitEndingTagNames: ['bbb'] } },
      areTagNamesCaseInsensitive: true,
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<AAA><BBB>');

    expect(callbackMock).toHaveBeenCalledTimes(6);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 5, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 10, 10);
  });

  test('inserts a start tag for an end tag that differs in case if tag names are case-insensitive', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { isImplicitlyStarted: true } },
      areTagNamesCaseInsensitive: true,
    });

    createTokenizerWriter(handler, config).end('</AAA>');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 2, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 5, 6);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 2, 5);
  });

  test('compares non-ASCII letters of tag names case-sensitively if tag names are case-insensitive', () => {
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

  test('applies options of a foreign tag to its content', () => {
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

  test('applies CDATA and processing instruction options of a foreign tag to its content', () => {
    const config = resolveTokenizerOptions({
      tags: {
        svg: {
          foreignContext: {
            areSelfClosingTagsRecognized: true,
            areCDATASectionsRecognized: true,
            processingInstructionSyntax: 'xml',
          },
        },
      },
    });

    expect(
      readChunks(['<![CDATA[a]]><?b c?><d/><svg><![CDATA[e]]><?f g?><h/></svg><![CDATA[i]]><?j k?></d>'], config)
    ).toEqual([
      'comment 2 [CDATA[a]]',
      'comment 14 ?b c?',
      'start_tag_name 21 d',
      'start_tag_closing 23 >',
      'start_tag_name 25 svg',
      'start_tag_closing 28 >',
      'cdata_section 38 e',
      'processing_instruction_target 44 f',
      'processing_instruction_data 46 g',
      'start_tag_name 50 h',
      'start_tag_self_closing 51 />',
      'end_tag_name 55 svg',
      'comment 61 [CDATA[i]]',
      'comment 73 ?j k?',
      'end_tag_name 81 d',
    ]);
  });

  test('reads sibling foreign tags', () => {
    const config = resolveTokenizerOptions({
      tags: { ccc: { foreignContext: { areSelfClosingTagsRecognized: true } } },
    });

    createTokenizerWriter(handler, config).end('<aaa><ccc><ddd/></ccc><bbb/></bbb><ccc><eee/></ccc></aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(16);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_self_closing', 14, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 18, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_name', 23, 26);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'start_tag_closing', 27, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'end_tag_name', 30, 33);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'start_tag_name', 35, 38);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'start_tag_closing', 38, 39);
    expect(callbackMock).toHaveBeenNthCalledWith(13, 'start_tag_name', 40, 43);
    expect(callbackMock).toHaveBeenNthCalledWith(14, 'start_tag_self_closing', 43, 45);
    expect(callbackMock).toHaveBeenNthCalledWith(15, 'end_tag_name', 47, 50);
    expect(callbackMock).toHaveBeenNthCalledWith(16, 'end_tag_name', 53, 56);
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

  test('restores options after the end tag of a foreign tag', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { foreignContext: {} } },
      areSelfClosingTagsRecognized: true,
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb/></bbb></aaa><ccc/>');

    expect(callbackMock).toHaveBeenCalledTimes(8);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 10, 11);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 13, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'end_tag_name', 19, 22);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'start_tag_name', 24, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'start_tag_self_closing', 27, 29);
  });

  test('restores options after an implicitly ended foreign tag', () => {
    const config = resolveTokenizerOptions({
      tags: { bbb: { foreignContext: { areSelfClosingTagsRecognized: true } } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    createTokenizerWriter(handler, config).end('<aaa><bbb><ccc/></aaa><ddd/></ddd>');

    expect(callbackMock).toHaveBeenCalledTimes(11);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_self_closing', 14, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 16, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 18, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'start_tag_name', 23, 26);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'start_tag_closing', 27, 28);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 30, 33);
  });

  test('restores options after a foreign tag that shares options with the root', () => {
    const tokenizerOptions: TokenizerOptions = {};

    tokenizerOptions.tags = {
      aaa: {
        foreignContext: { areSelfClosingTagsRecognized: true, tags: { bbb: { foreignContext: tokenizerOptions } } },
      },
    };

    const config = resolveTokenizerOptions(tokenizerOptions);

    // <ccc/> is read with root options, <ddd/> with options of aaa, and <eee/> with root options again
    createTokenizerWriter(handler, config).end('<aaa><bbb><ccc/></ccc></bbb><ddd/></aaa><eee/></eee>');

    expect(callbackMock).toHaveBeenCalledTimes(14);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 4, 5);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'start_tag_name', 6, 9);
    expect(callbackMock).toHaveBeenNthCalledWith(4, 'start_tag_closing', 9, 10);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'start_tag_name', 11, 14);
    expect(callbackMock).toHaveBeenNthCalledWith(6, 'start_tag_closing', 15, 16);
    expect(callbackMock).toHaveBeenNthCalledWith(7, 'end_tag_name', 18, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 24, 27);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'start_tag_name', 29, 32);
    expect(callbackMock).toHaveBeenNthCalledWith(10, 'start_tag_self_closing', 32, 34);
    expect(callbackMock).toHaveBeenNthCalledWith(11, 'end_tag_name', 36, 39);
    expect(callbackMock).toHaveBeenNthCalledWith(12, 'start_tag_name', 41, 44);
    expect(callbackMock).toHaveBeenNthCalledWith(13, 'start_tag_closing', 45, 46);
    expect(callbackMock).toHaveBeenNthCalledWith(14, 'end_tag_name', 48, 51);
  });

  test('reads tags of contexts that share a tags record', () => {
    const tags: Record<string, TagParsingOptions> = { br: { kind: 'void' } };

    tags.svg = { foreignContext: { tags, areSelfClosingTagsRecognized: true } };

    const config = resolveTokenizerOptions({ tags });

    expect(readChunks(['<br><svg><br><aaa/></svg><aaa/></aaa>'], config)).toEqual([
      'start_tag_name 1 br',
      'start_tag_closing 3 >',
      'end_tag_name 4 ',
      'start_tag_name 5 svg',
      'start_tag_closing 8 >',
      'start_tag_name 10 br',
      'start_tag_closing 12 >',
      'end_tag_name 13 ',
      'start_tag_name 14 aaa',
      'start_tag_self_closing 17 />',
      'end_tag_name 21 svg',
      'start_tag_name 26 aaa',
      'start_tag_closing 30 >',
      'end_tag_name 33 aaa',
    ]);
  });

  test('implicitly ends foreign tags whose contexts have no tags', () => {
    const config = resolveTokenizerOptions({
      tags: {
        aaa: { implicitEndingTagNames: ['ccc'], foreignContext: {} },
        bbb: { implicitEndingTagNames: ['ccc'], foreignContext: {} },
      },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });

    expect(readChunks(['<aaa><ccc></ccc><bbb><ccc>'], config)).toEqual([
      'start_tag_name 1 aaa',
      'start_tag_closing 4 >',
      'end_tag_name 5 ',
      'start_tag_name 6 ccc',
      'start_tag_closing 9 >',
      'end_tag_name 12 ccc',
      'start_tag_name 17 bbb',
      'start_tag_closing 20 >',
      'end_tag_name 21 ',
      'start_tag_name 22 ccc',
      'start_tag_closing 25 >',
      'end_tag_name 26 ',
    ]);
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

  test('does not implicitly end a tag of another context with a tag that ends other tags', () => {
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

  test('applies outer tags to a tag that implicitly ends a foreign tag', () => {
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

  test('applies outer tags to a raw text tag that implicitly ends a foreign tag', () => {
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

  test('applies tags of a foreign tag to an unbalanced end tag in its content', () => {
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
    // The test needs names with equal hash codes
    expect(getCaseSensitiveHashCode('aQ', 0, 2)).toBe(getCaseSensitiveHashCode('b0', 0, 2));

    expect(() => createTokenizerWriter(handler, defaultConfig).end('<aQ></b0>')).toThrow(
      new MarkupSyntaxError('Unexpected end tag.', '<aQ></b0>', 6, 8)
    );
  });

  test('does not end a tag with an end tag whose name starts with the name of the tag', () => {
    expect(() => createTokenizerWriter(handler, defaultConfig).end('<aaa></aaab>')).toThrow(
      new MarkupSyntaxError('Unexpected end tag.', '<aaa></aaab>', 7, 11)
    );

    const config = resolveTokenizerOptions({ areTagNamesCaseInsensitive: true });

    expect(() => createTokenizerWriter(handler, config).end('<aaa></AAAB>')).toThrow(
      new MarkupSyntaxError('Unexpected end tag.', '<aaa></AAAB>', 7, 11)
    );
  });

  test('implicitly ends a tag whose sibling was ended', () => {
    const config = resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true });

    createTokenizerWriter(handler, config).end('<aaa><bbb></bbb><ccc></aaa>');

    expect(callbackMock).toHaveBeenCalledTimes(9);
    expect(callbackMock).toHaveBeenNthCalledWith(5, 'end_tag_name', 12, 15);
    expect(callbackMock).toHaveBeenNthCalledWith(8, 'end_tag_name', 21, 21);
    expect(callbackMock).toHaveBeenNthCalledWith(9, 'end_tag_name', 23, 26);
  });

  test('ends an enclosing tag that is not the innermost one after a tag with the same name was ended', () => {
    const config = resolveTokenizerOptions({ areUnbalancedStartTagsImplicitlyEnded: true });

    // The stack is searched for </aaa>, and the first aaa, which was ended by its end tag, must not be found
    expect(readChunks(['<aaa></aaa><aaa><bbb></aaa>'], config)).toEqual([
      'start_tag_name 1 aaa',
      'start_tag_closing 4 >',
      'end_tag_name 7 aaa',
      'start_tag_name 12 aaa',
      'start_tag_closing 15 >',
      'start_tag_name 17 bbb',
      'start_tag_closing 20 >',
      'end_tag_name 21 ',
      'end_tag_name 23 aaa',
    ]);

    // The same for the first aaa that is self-closing
    expect(
      readChunks(
        ['<aaa/><aaa><bbb></aaa>'],
        resolveTokenizerOptions({ areSelfClosingTagsRecognized: true, areUnbalancedStartTagsImplicitlyEnded: true })
      )
    ).toEqual([
      'start_tag_name 1 aaa',
      'start_tag_self_closing 4 />',
      'start_tag_name 7 aaa',
      'start_tag_closing 10 >',
      'start_tag_name 12 bbb',
      'start_tag_closing 15 >',
      'end_tag_name 16 ',
      'end_tag_name 18 aaa',
    ]);
  });

  test('does not read a tag with the config of a tag that has the same hash code but a different name', () => {
    // The test needs names with equal hash codes
    expect(getCaseSensitiveHashCode('aQ', 0, 2)).toBe(getCaseSensitiveHashCode('b0', 0, 2));

    const config = resolveTokenizerOptions({ tags: { aQ: { kind: 'void' } } });

    createTokenizerWriter(handler, config).end('<b0></b0>');

    expect(callbackMock).toHaveBeenCalledTimes(3);
    expect(callbackMock).toHaveBeenNthCalledWith(1, 'start_tag_name', 1, 3);
    expect(callbackMock).toHaveBeenNthCalledWith(2, 'start_tag_closing', 3, 4);
    expect(callbackMock).toHaveBeenNthCalledWith(3, 'end_tag_name', 6, 8);
  });

  test('reads tags that have the same hash code with their own configs', () => {
    // The test needs names with equal hash codes
    expect(getCaseSensitiveHashCode('aQ', 0, 2)).toBe(getCaseSensitiveHashCode('b0', 0, 2));

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

  test('does not implicitly start a tag with the config of a tag that has the same hash code but a different name', () => {
    // The test needs names with equal hash codes
    expect(getCaseSensitiveHashCode('aQ', 0, 2)).toBe(getCaseSensitiveHashCode('b0', 0, 2));

    const config = resolveTokenizerOptions({ tags: { aQ: { isImplicitlyStarted: true } } });

    expect(() => createTokenizerWriter(handler, config).end('</b0>')).toThrow(
      new MarkupSyntaxError('Unexpected end tag.', '</b0>', 2, 4)
    );
  });

  test('ignores the case of names in implicitEndingTagNames if tag names are case-insensitive', () => {
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

  test('ignores the case of keys of tags if tag names are case-insensitive', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { implicitEndingTagNames: ['bbb'] }, BBB: { kind: 'void' } },
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

  test('reads the tags option of a context once', () => {
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

  test('reads the foreignContext option of a tag once', () => {
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
      tags: { aaa: { implicitEndingTagNames: new Set(['AAA']) } },
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

  test('passes isRawText as true only for text of raw_text and script_data tags', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { kind: 'raw_text' }, bbb: { kind: 'escapable_raw_text' }, ccc: { kind: 'script_data' } },
    });
    const isRawTextFlags: boolean[] = [];

    createTokenizerWriter(
      {
        onText(_input, _startIndex, _endIndex, isRawText) {
          isRawTextFlags.push(isRawText);
        },
      },
      config
    ).end('xxx<aaa>yyy</aaa><bbb>zzz</bbb><ccc>www</ccc>');

    expect(isRawTextFlags).toEqual([false, true, false, true]);
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

  test('passes isRawText for raw text of a tag that was started in a previous chunk', () => {
    const config = resolveTokenizerOptions({
      tags: { aaa: { kind: 'raw_text' }, bbb: { kind: 'escapable_raw_text' }, ccc: { kind: 'script_data' } },
      areUnbalancedStartTagsImplicitlyEnded: true,
    });
    const isRawTextFlags: boolean[] = [];

    const writer = createTokenizerWriter(
      {
        onText(_input, _startIndex, _endIndex, isRawText) {
          isRawTextFlags.push(isRawText);
        },
      },
      config
    );

    writer.write('<aaa>xx');
    writer.write('x</aaa><bbb>yy');
    writer.write('y</bbb><ccc>zz');
    writer.write('z</ccc><aaa>ww');
    writer.end('w');

    expect(isRawTextFlags).toEqual([true, false, true, true]);
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

  test('throws if a start tag is not closed at the end of the input', () => {
    expect(() => createTokenizerWriter(handler, defaultConfig).end('<aaa xxx="bbb"')).toThrow(
      new MarkupSyntaxError('Unexpected end of the document.', '<aaa xxx="bbb"', 14, 14)
    );
  });

  test('throws if a tag is not ended at the end of the input', () => {
    expect(() => createTokenizerWriter(handler, defaultConfig).end('<aaa>bbb')).toThrow(
      new MarkupSyntaxError('Unexpected end of the document.', '<aaa>bbb', 8, 8)
    );
  });

  test('holds back text and an end tag until the chunk that completes them', () => {
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
            processingInstructionSyntax: 'xml',
          },
        },
        textarea: { kind: 'escapable_raw_text' },
      },
      areTagNamesCaseInsensitive: true,
      areUnbalancedStartTagsImplicitlyEnded: true,
      areUnbalancedEndTagsIgnored: true,
    });

    // An input and the last token that is read from it. Inserted end tags and an empty DOCTYPE name have no chars,
    // so their tokens end with a space.
    const inputs: Array<[string, string]> = [
      ['  <!DOCTYPE aaa>  <!--bbb-->  <?ccc?>  <p>ddd<br>eee<br/>fff</P>', 'end_tag_name 62 P'],
      ['<p aaa="bbb" ccc=\'ddd\' eee=fff ggg = hhh iii>jjj</p >kkk</>lll</#mmm>', 'comment 64 #mmm'],
      ['<style>aaa</sty</style><textarea>bbb</textarea  ><script>ccc</scriptx></script>', 'end_tag_name 72 script'],
      ['<script><!--<script>aaa</script>bbb--></script>ccc', 'text 47 ccc'],
      ['<svg><path aaa="bbb"/><![CDATA[ccc]]><?ddd eee?></svg><![CDATA[fff]]>', 'comment 56 [CDATA[fff]]'],
      ['<!-->aaa<!--->bbb<!--ccc--!>ddd<!--eee--->fff<!---ggg', 'comment 49 -ggg'],
      ['aaa < bbb <1 ccc <', 'text 0 aaa < bbb <1 ccc <'],
      ['<p>aaa<p>bbb</div>ccc', 'end_tag_name 21 '],
      ['<aaa>xbbb</bbb>', 'end_tag_name 15 '],
      ['<aaa bbb="ccc', 'end_tag_name 13 '],
      ['<aaa bbb', 'end_tag_name 8 '],
      ['aaa</', 'text 0 aaa</'],
      ['<script>aaa</script', 'end_tag_name 19 '],
      ['<!DOCTYPE', 'doctype_name 9 '],
      ['<!DOC', 'comment 2 DOC'],
    ];

    for (const [input, lastToken] of inputs) {
      const tokens = expectChunksToBeReadLikeInput(input, config);

      expect(tokens[tokens.length - 1], input).toBe(lastToken);
    }
  });

  test('compares an end tag with a tag of a previous chunk by name, not by indices in the new input', () => {
    const writer = createTokenizerWriter(handler, defaultConfig);

    // The name of aaa is at 1..4 in the first input, where the second input has bbb
    writer.write('<aaa>');

    expect(() => writer.end('xbbb</bbb>')).toThrow(new MarkupSyntaxError('Unexpected end tag.', 'xbbb</bbb>', 6, 9, 5));
  });

  test('reads implicitly ended and foreign tags from chunks as if the whole input was read at once', () => {
    const svgOptions: TokenizerContextOptions = {
      areSelfClosingTagsRecognized: true,
      areCDATASectionsRecognized: true,
      processingInstructionSyntax: 'xml',
    };

    const tokenizerOptions: TokenizerOptions = {
      tags: {
        br: { kind: 'void', isImplicitlyStarted: true },
        li: { implicitEndingTagNames: ['li'] },
        p: { implicitEndingTagNames: ['p'], isImplicitlyStarted: true },
        svg: { implicitEndingTagNames: ['br'], isImplicitEndingScope: true, foreignContext: svgOptions },
        ul: { isImplicitEndingScope: true },
      },
      areTagNamesCaseInsensitive: true,
      areUnbalancedStartTagsImplicitlyEnded: true,
      areUnbalancedEndTagsIgnored: true,
    };

    svgOptions.tags = { foreignObject: { foreignContext: tokenizerOptions } };

    const config = resolveTokenizerOptions(tokenizerOptions);

    // An input and the last token that is read from it
    const inputs: Array<[string, string]> = [
      ['<ul><li>aaa<ul><li>bbb<LI>ccc</ul><li>ddd', 'end_tag_name 41 '],
      ['aaa</p>bbb</BR>ccc</div>', 'text 15 ccc'],
      ['<svg><path/><br>aaa<svg><li><li/>', 'end_tag_name 33 '],
      ['<svg><foreignObject><br/><svg><aaa/></svg></foreignObject><bbb/></svg><ccc/>', 'end_tag_name 76 '],
      ['<p>aaa<svg><p>bbb', 'end_tag_name 17 '],
    ];

    for (const [input, lastToken] of inputs) {
      const tokens = expectChunksToBeReadLikeInput(input, config);

      expect(tokens[tokens.length - 1], input).toBe(lastToken);
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
        (kind === 'escapable_raw_text' ? 'text' : 'raw_text') + ' 10 <b>x</b>',
        'end_tag_name 20 zvdrvgnj',
      ];

      expect(readChunks([input], config)).toEqual(tokens);

      // Split inside the text
      expect(readChunks(['<zvdrvgnj><b>x', '</b></zvdrvgnj>'], config)).toEqual(tokens);

      expectChunksToBeReadLikeInput(input, config);
    }
  });

  test('reads a strict document from chunks as if the whole input was read at once', () => {
    const config = resolveTokenizerOptions({
      areSelfClosingTagsRecognized: true,
      areCDATASectionsRecognized: true,
      processingInstructionSyntax: 'xml',
      isStrict: true,
    });

    const tokens = expectChunksToBeReadLikeInput(
      '<?aaa bbb?>  <!DOCTYPE ccc>  <ddd eee="fff" ggg=\'hhh\'><iii/><![CDATA[jjj]]><!--kkk--><?lll mmm?>nnn</ddd>',
      config
    );

    expect(tokens[tokens.length - 1]).toBe('end_tag_name 101 ddd');
  });

  test('throws errors in chunks as if the whole input was read at once', () => {
    const config = resolveTokenizerOptions({
      areSelfClosingTagsRecognized: true,
      areCDATASectionsRecognized: true,
      processingInstructionSyntax: 'xml',
      isStrict: true,
    });

    // An input and the error that is thrown, the last token that is read from it
    const inputs: Array<[string, string]> = [
      ['<aaa><bbb></aaa>', 'error 10 10 Expected an end tag.'],
      ['<aaa bbb></aaa>', "error 8 9 Expected an attribute value separated by an equals sign ('=')."],
      ['<aaa bbb=ccc></aaa>', 'error 9 10 Expected a double-quoted (\'"\') or a single-quoted ("\'") attribute value.'],
      ['<aaa><!--bbb', "error 5 12 Expected the comment to be closed with '-->'."],
      ['<aaa></aaa><bbb/>', 'error 11 15 Expected a single root element.'],
      ['<aaa>', 'error 5 5 Unexpected end of the document.'],
      ['<aaa><!bbb></aaa>', "error 5 7 Expected a comment ('<!--'), or a CDATA section ('<![CDATA[')."],
      ['<aaa></aaa  bbb>', "error 12 13 Expected a closing angle bracket ('>')."],
    ];

    for (const [input, lastToken] of inputs) {
      const tokens = expectChunksToBeReadLikeInput(input, config);

      expect(tokens[tokens.length - 1], input).toBe(lastToken);
    }
  });

  test('reads tags nested deeper than the initial size of the tag stack', () => {
    const tagNames: string[] = [];

    for (let i = 0; i < 100; ++i) {
      tagNames.push('a' + i);
    }

    const startTags = tagNames.map(tagName => '<' + tagName + '>');
    const endTags = tagNames.map(tagName => '</' + tagName + '>').reverse();

    const tokens = readChunks([startTags.join('') + endTags.join('')], defaultConfig);

    expect(tokens.filter(token => token.startsWith('start_tag_name')).map(token => token.split(' ')[2])).toEqual(
      tagNames
    );
    expect(tokens.filter(token => token.startsWith('end_tag_name')).map(token => token.split(' ')[2])).toEqual(
      [...tagNames].reverse()
    );

    // Each tag in its own chunk
    expect(readChunks([...startTags, ...endTags], defaultConfig)).toEqual(tokens);
  });

  test('sets the input offset of an error', () => {
    const writer = createTokenizerWriter(handler, strictConfig);

    writer.write('<aaa>bb');

    // The input of the error is the unread text 'bb' followed by the last chunk, and it starts at 5 in the stream
    expect(() => writer.end('b</bbb>')).toThrow(new MarkupSyntaxError('Unexpected end tag.', 'bbb</bbb>', 5, 8, 5));
  });

  test('sets the input offset of an error that is thrown at the end of the input', () => {
    const writer = createTokenizerWriter(handler, defaultConfig);

    writer.write('<aaa>');

    expect(() => writer.end('bbb')).toThrow(new MarkupSyntaxError('Unexpected end of the document.', 'bbb', 3, 3, 5));
  });

  test('throws if a chunk is written after the end', () => {
    const config = resolveTokenizerOptions({});
    const writer = createTokenizerWriter(handler, config);

    writer.end();

    expect(() => writer.write('aaa')).toThrow(new Error('The writer was ended.'));
  });

  test('throws if the writer is ended twice', () => {
    const writer = createTokenizerWriter(handler, defaultConfig);

    writer.end();

    expect(() => writer.end()).toThrow(new Error('The writer was ended.'));
  });

  test('throws if a chunk is written after an error', () => {
    const config = resolveTokenizerOptions({ isStrict: true });
    const writer = createTokenizerWriter(handler, config);

    expect(() => writer.write('</aaa>')).toThrow(MarkupSyntaxError);
    expect(() => writer.write('bbb')).toThrow(new Error('The writer was ended.'));
  });

  test('rethrows an error of the handler as is and stays ended', () => {
    // A syntax error of another input, for example from a tokenizer that the handler runs
    const error = new MarkupSyntaxError('Expected', 'xxx', 1, 2, 3);

    const writer = createTokenizerWriter(
      {
        onStartTagName() {
          throw error;
        },
      },
      defaultConfig
    );

    writer.write('aaa');

    let thrownError;

    try {
      writer.write('<bbb>');
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBe(error);
    expect(error.inputOffset).toBe(3);
    expect(() => writer.write('ccc')).toThrow(new Error('The writer was ended.'));
  });
});
