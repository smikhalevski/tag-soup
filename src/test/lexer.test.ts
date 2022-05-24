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

  describe('Start tags', () => {

    test('reads the start tag', () => {
      lexer('<w>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(3);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.IMPLICIT_END_TAG, 3, 0);
    });

    test('reads consequent start tags', () => {
      lexer('<w><k>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(6);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_OPENING, 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.IMPLICIT_END_TAG, 6, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.IMPLICIT_END_TAG, 6, 0);
    });

    test('implicitly ends the immediate parent', () => {
      const lexer = createLexer({implicitEndTagMap: {'k': ['w']}});

      lexer('<w><k>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(6);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.IMPLICIT_END_TAG, 3, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_OPENING, 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.START_TAG_CLOSING, 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.IMPLICIT_END_TAG, 6, 0);
    });

    test('implicitly ends the ancestor', () => {
      const lexer = createLexer({implicitEndTagMap: {'z': ['w']}});

      lexer('<w><k><z>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(9);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_OPENING, 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.IMPLICIT_END_TAG, 6, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.IMPLICIT_END_TAG, 6, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(7, TokenType.START_TAG_OPENING, 6, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(8, TokenType.START_TAG_CLOSING, 8, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(9, TokenType.IMPLICIT_END_TAG, 9, 0);
    });

    test('implicitly ends the topmost ancestor', () => {
      const lexer = createLexer({implicitEndTagMap: {'y': ['z', 'w']}});

      lexer('<w><k><z><y>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(12);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_OPENING, 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.START_TAG_OPENING, 6, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.START_TAG_CLOSING, 8, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(7, TokenType.IMPLICIT_END_TAG, 9, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(8, TokenType.IMPLICIT_END_TAG, 9, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(9, TokenType.IMPLICIT_END_TAG, 9, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(10, TokenType.START_TAG_OPENING, 9, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(11, TokenType.START_TAG_CLOSING, 11, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(12, TokenType.IMPLICIT_END_TAG, 12, 0);
    });

  });

  describe('Self-closing tags', () => {

    test('reads the self-closing tag', () => {
      const lexer = createLexer({selfClosingTagsEnabled: true});

      lexer('<w/>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(2);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_SELF_CLOSING, 2, 2);
    });

    test('reads consequent self-closing tags', () => {
      const lexer = createLexer({selfClosingTagsEnabled: true});

      lexer('<w/><k/>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(4);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_SELF_CLOSING, 2, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_OPENING, 4, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_SELF_CLOSING, 6, 2);
    });

  });

  describe('Void tags', () => {

    test('reads the void tag as self-closing', () => {
      const lexer = createLexer({voidTags: ['w']});

      lexer('<w>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(2);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_SELF_CLOSING, 2, 1);
    });

    test('reads consequent void tags', () => {
      const lexer = createLexer({voidTags: ['w', 'k']});

      lexer('<w><k>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(4);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_SELF_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_OPENING, 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_SELF_CLOSING, 5, 1);
    });

    test('reads the void tag in the container', () => {
      const lexer = createLexer({voidTags: ['k']});

      lexer('<w><k></w>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(6);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_OPENING, 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_SELF_CLOSING, 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.END_TAG_OPENING, 6, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.END_TAG_CLOSING, 9, 1);
    });

  });

  describe('CDATA tags', () => {

    test('reads the CDATA tag', () => {
      const lexer = createLexer({cdataTags: ['w']});

      lexer('<w>aaa</w>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(5);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.TEXT, 3, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.END_TAG_OPENING, 6, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.END_TAG_CLOSING, 9, 1);
    });

    test('ignores start tags inside CDATA tags', () => {
      const lexer = createLexer({cdataTags: ['w']});

      lexer('<w><w><k></w>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(6);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.TEXT, 3, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.TEXT, 6, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.END_TAG_OPENING, 9, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.END_TAG_CLOSING, 12, 1);
    });

    test('ignores end tags inside CDATA tags', () => {
      const lexer = createLexer({cdataTags: ['w']});

      lexer('<w></k></w>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(6);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.TEXT, 3, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.TEXT, 6, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.END_TAG_OPENING, 7, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.END_TAG_CLOSING, 10, 1);
    });

  });

  describe('End tags', () => {

    test('reads the end tag', () => {
      lexer('<w></w>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(4);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.END_TAG_OPENING, 3, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.END_TAG_CLOSING, 6, 1);
    });

    test('emits implicit end tags', () => {
      lexer('<w><k></w>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(7);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_OPENING, 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.IMPLICIT_END_TAG, 6, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.END_TAG_OPENING, 6, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(7, TokenType.END_TAG_CLOSING, 9, 1);
    });

    test('does not emit orphan end tag', () => {
      lexer('</w>', handler);

      expect(handlerMock).not.toHaveBeenCalled();
    });

    test('emits implicit start tags for orphan end tags', () => {
      const lexer = createLexer({implicitStartTags: ['w']});

      lexer('</w>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(2);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.IMPLICIT_START_TAG, 0, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.END_TAG_CLOSING, 3, 1);
    });

    test('emits implicit start tag that implicitly ends preceding tag', () => {
      const lexer = createLexer({implicitEndTagMap: {'k': ['w']}, implicitStartTags: ['k']});

      lexer('<w></k>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(5);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.IMPLICIT_END_TAG, 3, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.IMPLICIT_START_TAG, 3, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.END_TAG_CLOSING, 6, 1);
    });

    test('emits implicit start tag and end tags during nesting of the same tag', () => {
      const lexer = createLexer({implicitEndTagMap: {'w': ['w']}, implicitStartTags: ['w']});

      lexer('<w><w></w></w>', handler);

      expect(handlerMock).toHaveBeenCalledTimes(9);
      expect(handlerMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, TokenType.IMPLICIT_END_TAG, 3, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_OPENING, 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(5, TokenType.START_TAG_CLOSING, 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(6, TokenType.END_TAG_OPENING, 6, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(7, TokenType.END_TAG_CLOSING, 9, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(8, TokenType.IMPLICIT_START_TAG, 10, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(9, TokenType.END_TAG_CLOSING, 13, 1);
    });

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
