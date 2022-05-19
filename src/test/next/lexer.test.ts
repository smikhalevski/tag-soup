import {createLexer} from '../../main/next/lexer';
import {LexerHandler} from '../../main/next/lexer-types';

describe('createLexer', () => {

  const handlerMock = jest.fn();
  const lexer = createLexer();

  const handler: LexerHandler = (type, chunk, offset, length) => {
    handlerMock(type, offset, length);
  };

  beforeEach(() => {
    handlerMock.mockRestore();
  });

  test('reads tokens from input', () => {
    lexer('<a foo="">', handler);

    expect(handlerMock).toHaveBeenCalledTimes(3);
  });
});
