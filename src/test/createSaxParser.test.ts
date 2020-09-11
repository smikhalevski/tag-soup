import {createSaxParser, SaxParser} from '../main/createSaxParser';

describe('createSaxParser', () => {

  let parser: SaxParser;

  const onStartTagMock = jest.fn();
  const onEndTagMock = jest.fn();
  const onTextMock = jest.fn();
  const onCommentMock = jest.fn();
  const onProcessingInstructionMock = jest.fn();
  const onCdataSectionMock = jest.fn();
  const onDocumentTypeMock = jest.fn();

  beforeEach(() => {
    parser = createSaxParser({
      selfClosingEnabled: true,

      onStartTag: onStartTagMock,
      onEndTag: onEndTagMock,
      onText: onTextMock,
      onComment: onCommentMock,
      onProcessingInstruction: onProcessingInstructionMock,
      onCdataSection: onCdataSectionMock,
      onDocumentType: onDocumentTypeMock,
    });

    onStartTagMock.mockReset();
    onEndTagMock.mockReset();
    onTextMock.mockReset();
    onCommentMock.mockReset();
    onProcessingInstructionMock.mockReset();
    onCdataSectionMock.mockReset();
    onDocumentTypeMock.mockReset();
  });

  describe('in non-streaming mode', () => {

    it('does not emit incomplete start tags', () => {
      parser.parse('<www aaa=111 ');

      expect(onStartTagMock).not.toHaveBeenCalled();
      expect(onTextMock).not.toHaveBeenCalled();
    });

    it('emits incomplete comment', () => {
      parser.parse('<!--foo');

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 7);
    });
  });

  describe('in streaming mode', () => {

    it('defers text emit', () => {
      parser.write('<a>foo');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 3);
      expect(onTextMock).not.toHaveBeenCalled();

      parser.write('bar</a>');

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'foobar', 3, 9);
      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 9, 13);
    });

    it('defers start tag emit', () => {
      parser.write('<www aaa=111 ');

      expect(onStartTagMock).not.toHaveBeenCalled();

      parser.write('/>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'www', {
        length: 1,
        0: {name: 'aaa', value: '111', start: 5, end: 12},
      }, true, 0, 15);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('defers comment emit', () => {
      parser.write('<!--foo');

      expect(onCommentMock).not.toHaveBeenCalled();

      parser.write('bar-->');

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foobar', 0, 13);
    });

    it('emits incomplete comment on commit', () => {
      parser.write('<!--foo');

      expect(onCommentMock).not.toHaveBeenCalled();

      parser.parse();

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 7);
    });

    it('emits tail on commit with an additional data', () => {
      parser.write('<!--foo');

      expect(onCommentMock).not.toHaveBeenCalled();

      parser.parse('bar');

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foobar', 0, 10);
    });

    it('can reset the stream', () => {
      parser.write('foo');

      expect(onTextMock).not.toHaveBeenCalled();

      parser.reset();
      parser.parse('bar');

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'bar', 0, 3);
    });
  });
});