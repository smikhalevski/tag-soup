import {createLexer} from '../../main/next/lexer';
import {LexerHandler, TokenType} from '../../main/next/tokenizer-types';

describe('createLexer', () => {

  const handlerMock = jest.fn();
  const lexer = createLexer();

  const handler: LexerHandler = (type, chunk, offset, length) => {
    handlerMock(type, offset, length);
  };

  beforeEach(() => {
    handlerMock.mockRestore();
  });

  test('reads attribute with value in quotes', () => {
    lexer('<a foo="aaa">', handler);

    expect(handlerMock).toHaveBeenCalledTimes(4);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG, 1, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_VALUE, 8, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.END_TAG, 13, 0);
  });

  test('reads attribute with value in apostrophes', () => {
    lexer('<a foo=\'aaa\'>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(4);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG, 1, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_VALUE, 8, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.END_TAG, 13, 0);
  });

  test('reads attribute without value', () => {
    lexer('<a foo bar>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(4);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG, 1, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_NAME, 7, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.END_TAG, 11, 0);
  });

  test('reads self-closing tags', () => {
    const lexer = createLexer({selfClosingTagsEnabled: true});

    lexer('<a/>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(2);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG, 1, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.END_TAG, 4, 0);
  });

  test('ignores unexpected end tags', () => {
    lexer('<a></b></a>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(2);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG, 1, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.END_TAG, 9, 1);
  });

  test('injects end tags before end tag', () => {
    lexer('<a><b></a>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(4);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG, 1, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG, 4, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.END_TAG, 6, 0);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.END_TAG, 8, 1);
  });

  test('injects end tags before input end', () => {
    lexer('<a><b>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(4);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG, 1, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG, 4, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.END_TAG, 6, 0);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.END_TAG, 6, 0);
  });

  test('reads text in a tag', () => {
    lexer('<a>aaa</a>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(3);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG, 1, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.TEXT, 3, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.END_TAG, 8, 1);
  });

  test('ends wrest tags', () => {
    const lexer = createLexer({wrestTags: {p: ['p']}});

    lexer('<p>aaa<p>bbb', handler);

    expect(handlerMock).toHaveBeenCalledTimes(6);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG, 1, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.TEXT, 3, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.END_TAG, 6, 0);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG, 7, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.TEXT, 9, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.END_TAG, 12, 0);
  });
});
