import { createLexer } from '../main/createLexer';
import { LexerHandler, LexerState } from '../main/lexer-types';

describe('createLexer', () => {
  const handlerMock = jest.fn();
  const lexer = createLexer();

  const statelessHandler: LexerHandler = (type, chunk, offset, length) => {
    handlerMock(type, offset, length);
  };

  const statefulHandler: LexerHandler = (type, chunk, offset, length, state) => {
    handlerMock(type, offset, length, structuredClone(state));
  };

  beforeEach(() => {
    handlerMock.mockRestore();
  });

  describe('Start tags', () => {
    test('reads the start tag', () => {
      lexer('<w>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(3);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'IMPLICIT_END_TAG', 3, 0);
    });

    test('reads consequent start tags', () => {
      lexer('<w><k>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(6);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'START_TAG_OPENING', 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, 'IMPLICIT_END_TAG', 6, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(6, 'IMPLICIT_END_TAG', 6, 0);
    });

    test('implicitly ends the immediate parent', () => {
      const lexer = createLexer({ implicitEndTags: { k: ['w'] } });

      lexer('<w><k>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(6);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'IMPLICIT_END_TAG', 3, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'START_TAG_OPENING', 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(5, 'START_TAG_CLOSING', 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(6, 'IMPLICIT_END_TAG', 6, 0);
    });

    test('implicitly ends the ancestor', () => {
      const lexer = createLexer({ implicitEndTags: { z: ['w'] } });

      lexer('<w><k><z>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(9);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'START_TAG_OPENING', 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, 'IMPLICIT_END_TAG', 6, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(6, 'IMPLICIT_END_TAG', 6, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(7, 'START_TAG_OPENING', 6, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(8, 'START_TAG_CLOSING', 8, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(9, 'IMPLICIT_END_TAG', 9, 0);
    });

    test('implicitly ends the topmost ancestor', () => {
      const lexer = createLexer({ implicitEndTags: { y: ['z', 'w'] } });

      lexer('<w><k><z><y>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(12);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'START_TAG_OPENING', 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, 'START_TAG_OPENING', 6, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(6, 'START_TAG_CLOSING', 8, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(7, 'IMPLICIT_END_TAG', 9, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(8, 'IMPLICIT_END_TAG', 9, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(9, 'IMPLICIT_END_TAG', 9, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(10, 'START_TAG_OPENING', 9, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(11, 'START_TAG_CLOSING', 11, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(12, 'IMPLICIT_END_TAG', 12, 0);
    });

    test('provides tag code and cursor in handler', () => {
      lexer('<w><k>', statefulHandler);

      expect(handlerMock).toHaveBeenNthCalledWith(
        1,
        'START_TAG_OPENING',
        0,
        2,
        expect.objectContaining<Partial<LexerState>>({ activeTag: 119, stack: [119], cursor: 0 })
      );
      expect(handlerMock).toHaveBeenNthCalledWith(
        2,
        'START_TAG_CLOSING',
        2,
        1,
        expect.objectContaining<Partial<LexerState>>({ activeTag: 119, stack: [119], cursor: 0 })
      );
      expect(handlerMock).toHaveBeenNthCalledWith(
        3,
        'START_TAG_OPENING',
        3,
        2,
        expect.objectContaining<Partial<LexerState>>({ activeTag: 107, stack: [119, 107], cursor: 1 })
      );
      expect(handlerMock).toHaveBeenNthCalledWith(
        4,
        'START_TAG_CLOSING',
        5,
        1,
        expect.objectContaining<Partial<LexerState>>({ activeTag: 107, stack: [119, 107], cursor: 1 })
      );
    });
  });

  describe('Self-closing tags', () => {
    test('treats self-closing tags as implicitly ended by default', () => {
      lexer('<w/>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(3);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'IMPLICIT_END_TAG', 4, 0);
    });

    test('reads the self-closing tag', () => {
      const lexer = createLexer({ selfClosingTagsEnabled: true });

      lexer('<w/>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(2);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_SELF_CLOSING', 2, 2);
    });

    test('reads consequent self-closing tags', () => {
      const lexer = createLexer({ selfClosingTagsEnabled: true });

      lexer('<w/><k/>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(4);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_SELF_CLOSING', 2, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'START_TAG_OPENING', 4, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'START_TAG_SELF_CLOSING', 6, 2);
    });
  });

  describe('Void tags', () => {
    test('reads the void tag as self-closing', () => {
      const lexer = createLexer({ voidTags: ['w'] });

      lexer('<w>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(2);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_SELF_CLOSING', 2, 1);
    });

    test('reads consequent void tags', () => {
      const lexer = createLexer({ voidTags: ['w', 'k'] });

      lexer('<w><k>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(4);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_SELF_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'START_TAG_OPENING', 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'START_TAG_SELF_CLOSING', 5, 1);
    });

    test('reads the void tag in the container', () => {
      const lexer = createLexer({ voidTags: ['k'] });

      lexer('<w><k></w>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(6);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'START_TAG_OPENING', 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'START_TAG_SELF_CLOSING', 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, 'END_TAG_OPENING', 6, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(6, 'END_TAG_CLOSING', 9, 1);
    });
  });

  describe('CDATA tags', () => {
    test('reads the CDATA tag', () => {
      const lexer = createLexer({ cdataTags: ['w'] });

      lexer('<w>aaa</w>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(5);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'TEXT', 3, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'END_TAG_OPENING', 6, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(5, 'END_TAG_CLOSING', 9, 1);
    });

    test('ignores start tags inside CDATA tags', () => {
      const lexer = createLexer({ cdataTags: ['w'] });

      lexer('<w><w><k></w>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(6);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'TEXT', 3, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'TEXT', 6, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(5, 'END_TAG_OPENING', 9, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(6, 'END_TAG_CLOSING', 12, 1);
    });

    test('ignores end tags inside CDATA tags', () => {
      const lexer = createLexer({ cdataTags: ['w'] });

      lexer('<w></k></w>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(6);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'TEXT', 3, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'TEXT', 6, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, 'END_TAG_OPENING', 7, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(6, 'END_TAG_CLOSING', 10, 1);
    });
  });

  describe('End tags', () => {
    test('reads the end tag', () => {
      lexer('<w></w>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(4);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'END_TAG_OPENING', 3, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'END_TAG_CLOSING', 6, 1);
    });

    test('emits implicit end tags', () => {
      lexer('<w><k></w>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(7);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'START_TAG_OPENING', 3, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'START_TAG_CLOSING', 5, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(5, 'IMPLICIT_END_TAG', 6, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(6, 'END_TAG_OPENING', 6, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(7, 'END_TAG_CLOSING', 9, 1);
    });

    test('does not emit an orphan end tag', () => {
      lexer('</w>', statelessHandler);

      expect(handlerMock).not.toHaveBeenCalled();
    });

    test('does not emit an orphan end tag nested in a container', () => {
      lexer('<w></k></w>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(4);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'END_TAG_OPENING', 7, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'END_TAG_CLOSING', 10, 1);
    });

    test('emits implicit start tags for orphan end tags', () => {
      const lexer = createLexer({ implicitStartTags: ['w'] });

      lexer('</w>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(2);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'IMPLICIT_START_TAG', 0, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'END_TAG_CLOSING', 3, 1);
    });

    test('emits implicit start tag that implicitly ends preceding tag', () => {
      const lexer = createLexer({ implicitEndTags: { k: ['w'] }, implicitStartTags: ['k'] });

      lexer('<w></k>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(5);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'IMPLICIT_END_TAG', 3, 0);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'IMPLICIT_START_TAG', 3, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(5, 'END_TAG_CLOSING', 6, 1);
    });

    test('emits implicit start tag and end tags during nesting of the same tag', () => {
      const lexer = createLexer({ implicitEndTags: { p: ['p'] }, implicitStartTags: ['p'] });

      lexer('a<p>b<p>c</p>d</p>e', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(14);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'TEXT', 0, 1); // a
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_OPENING', 1, 2); // <p>
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'START_TAG_CLOSING', 3, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'TEXT', 4, 1); // b
      expect(handlerMock).toHaveBeenNthCalledWith(5, 'IMPLICIT_END_TAG', 5, 0); // </p>
      expect(handlerMock).toHaveBeenNthCalledWith(6, 'START_TAG_OPENING', 5, 2); // <p>
      expect(handlerMock).toHaveBeenNthCalledWith(7, 'START_TAG_CLOSING', 7, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(8, 'TEXT', 8, 1); // c
      expect(handlerMock).toHaveBeenNthCalledWith(9, 'END_TAG_OPENING', 9, 3); // </p>
      expect(handlerMock).toHaveBeenNthCalledWith(10, 'END_TAG_CLOSING', 12, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(11, 'TEXT', 13, 1); // d
      expect(handlerMock).toHaveBeenNthCalledWith(12, 'IMPLICIT_START_TAG', 14, 3); // <p></p>
      expect(handlerMock).toHaveBeenNthCalledWith(13, 'END_TAG_CLOSING', 17, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(14, 'TEXT', 18, 1); // e
    });
  });

  describe('Case sensitivity', () => {
    test('reads case-sensitive end tags by default', () => {
      lexer('<q></Q>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(3);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'IMPLICIT_END_TAG', 7, 0);
    });

    test('reads case-insensitive end tags', () => {
      const lexer = createLexer({ caseInsensitiveTagsEnabled: true });

      lexer('<q></Q>', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(4);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 2);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 2, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'END_TAG_OPENING', 3, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'END_TAG_CLOSING', 6, 1);
    });

    test('read non ASCII alpha-chars as case-sensitive in case-insensitive tag matching mode', () => {
      const lexer = createLexer({ caseInsensitiveTagsEnabled: true });

      lexer('<wф></wФ>a', statelessHandler);

      expect(handlerMock).toHaveBeenCalledTimes(4);
      expect(handlerMock).toHaveBeenNthCalledWith(1, 'START_TAG_OPENING', 0, 3);
      expect(handlerMock).toHaveBeenNthCalledWith(2, 'START_TAG_CLOSING', 3, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(3, 'TEXT', 9, 1);
      expect(handlerMock).toHaveBeenNthCalledWith(4, 'IMPLICIT_END_TAG', 10, 0);
    });
  });
});
