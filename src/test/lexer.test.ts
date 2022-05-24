import {createLexer} from '../main/lexer';
import {LexerHandler, TokenType} from '../main/lexer-types';

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
    lexer('<w foo="aaa">', handler);

    expect(handlerMock).toHaveBeenCalledTimes(5);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_VALUE, 7, 5);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 12, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.IMPLICIT_END_TAG, 13, 0);
  });

  test('reads attribute with value in apostrophes', () => {
    lexer('<w foo=\'aaa\'>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(5);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_VALUE, 7, 5);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 12, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.IMPLICIT_END_TAG, 13, 0);
  });

  test('reads attribute without value', () => {
    lexer('<w foo bar>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(5);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_NAME, 7, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 10, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.IMPLICIT_END_TAG, 11, 0);
  });

  test('reads self-closing tags', () => {
    const lexer = createLexer({selfClosingTagsEnabled: true});

    lexer('<w/>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(2);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_SELF_CLOSING, 2, 2);
  });

  test('ignores unbalanced end tags', () => {
    lexer('<w></b></w>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(4);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.END_TAG_OPENING, 7, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.END_TAG_CLOSING, 10, 1);
  });

  test('injects end tags before end tag', () => {
    lexer('<w><b></w>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(7);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_OPENING, 3, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 5, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.IMPLICIT_END_TAG, 6, 0);
    expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.END_TAG_OPENING, 6, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(7, TokenType.END_TAG_CLOSING, 9, 1);
  });

  test('injects end tags before input end', () => {
    lexer('<w><b>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(6);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_OPENING, 3, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 5, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.IMPLICIT_END_TAG, 6, 0);
    expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.IMPLICIT_END_TAG, 6, 0);
  });

  test('reads text in a tag', () => {
    lexer('<w>aaa</w>', handler);

    expect(handlerMock).toHaveBeenCalledTimes(5);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.TEXT, 3, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.END_TAG_OPENING, 6, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.END_TAG_CLOSING, 9, 1);
  });

  test('implicitly ends tags', () => {
    const lexer = createLexer({implicitEndTagMap: {p: ['p']}});

    lexer('<p>aaa<p>bbb', handler);

    expect(handlerMock).toHaveBeenCalledTimes(8);
    expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.TEXT, 3, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.IMPLICIT_END_TAG, 6, 0);
    expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.START_TAG_OPENING, 6, 2);
    expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.START_TAG_CLOSING, 8, 1);
    expect(handlerMock).toHaveBeenNthCalledWith(7, TokenType.TEXT, 9, 3);
    expect(handlerMock).toHaveBeenNthCalledWith(8, TokenType.IMPLICIT_END_TAG, 12, 0);
  });
});
