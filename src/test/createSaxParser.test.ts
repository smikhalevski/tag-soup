import {createSaxParser, IDataToken, ISaxParser, IStartTagToken, ITagToken} from '../main/createSaxParser';
import {cloneDeep} from 'lodash';

describe('createSaxParser', () => {

  let parser: ISaxParser;

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

      onStartTag: (token) => onStartTagMock(cloneDeep(token)),
      onEndTag: (token) => onEndTagMock(cloneDeep(token)),
      onText: (token) => onTextMock(cloneDeep(token)),
      onComment: (token) => onCommentMock(cloneDeep(token)),
      onProcessingInstruction: (token) => onProcessingInstructionMock(cloneDeep(token)),
      onCdataSection: (token) => onCdataSectionMock(cloneDeep(token)),
      onDocumentType: (token) => onDocumentTypeMock(cloneDeep(token)),
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
      expect(onCommentMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'foo',
        data: 'foo',
        start: 0,
        end: 7,
        dataStart: 4,
        dataEnd: 7,
      });
    });
  });

  describe('in streaming mode', () => {

    it('defers text emit', () => {
      parser.write('<a>foo');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });

      expect(onTextMock).not.toHaveBeenCalled();

      parser.write('qux');

      expect(onTextMock).not.toHaveBeenCalled();

      parser.write('bar</a>');

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'fooquxbar',
        data: 'fooquxbar',
        start: 3,
        end: 12,
        dataStart: 3,
        dataEnd: 12,
      });

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenCalledWith<[ITagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        start: 12,
        end: 16,
        nameStart: 14,
        nameEnd: 15,
      });
    });

    it('defers start tag emit', () => {
      parser.write('<www aaa=111 ');

      expect(onStartTagMock).not.toHaveBeenCalled();

      parser.write('/>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'www',
        tagName: 'www',
        attributes: [
          {
            rawName: 'aaa',
            name: 'aaa',
            rawValue: '111',
            value: '111',
            quoted: false,
            start: 5,
            end: 12,
            nameStart: 5,
            nameEnd: 8,
            valueStart: 9,
            valueEnd: 12,
          },
        ],
        selfClosing: true,
        start: 0,
        end: 15,
        nameStart: 1,
        nameEnd: 4,
      });

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('emits attribute with proper offsets', () => {
      parser.write('<foo>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);

      parser.write('<bar aaa=111>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(2, {
        rawTagName: 'bar',
        tagName: 'bar',
        attributes: [
          {
            rawName: 'aaa',
            name: 'aaa',
            rawValue: '111',
            value: '111',
            quoted: false,
            start: 10,
            end: 17,
            nameStart: 10,
            nameEnd: 13,
            valueStart: 14,
            valueEnd: 17,
          },
        ],
        selfClosing: false,
        start: 5,
        end: 18,
        nameStart: 6,
        nameEnd: 9,
      });

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('defers comment emit', () => {
      parser.write('<!--foo');

      expect(onCommentMock).not.toHaveBeenCalled();

      parser.write('bar-->');

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'foobar',
        data: 'foobar',
        start: 0,
        end: 13,
        dataStart: 4,
        dataEnd: 10,
      });
    });

    it('emits incomplete comment on parse', () => {
      parser.write('<!--foo');

      expect(onCommentMock).not.toHaveBeenCalled();

      parser.parse();

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'foo',
        data: 'foo',
        start: 0,
        end: 7,
        dataStart: 4,
        dataEnd: 7,
      });
    });

    it('emits tail on parse with an additional data', () => {
      parser.write('<!--foo');

      expect(onCommentMock).not.toHaveBeenCalled();

      parser.parse('bar');

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'foobar',
        data: 'foobar',
        start: 0,
        end: 10,
        dataStart: 4,
        dataEnd: 10,
      });
    });

    it('can reset the stream', () => {
      parser.write('foo');

      expect(onTextMock).not.toHaveBeenCalled();

      parser.reset();
      parser.parse('bar');

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'bar',
        data: 'bar',
        start: 0,
        end: 3,
        dataStart: 0,
        dataEnd: 3,
      });
    });
  });
});
