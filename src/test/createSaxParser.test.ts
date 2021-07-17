import {createSaxParser} from '../main/createSaxParser';
import {cloneDeep} from 'lodash';
import {IDataToken, IStartTagToken, ITagToken} from '../main/token-types';
import {IParser, ISaxParserOptions} from '../main/parser-types';
import {createForgivingSaxParser} from '../main';

describe('createSaxParser', () => {

  let parser: IParser;

  const onStartTagMock = jest.fn();
  const onEndTagMock = jest.fn();
  const onTextMock = jest.fn();
  const onCommentMock = jest.fn();
  const onProcessingInstructionMock = jest.fn();
  const onCdataSectionMock = jest.fn();
  const onDocumentTypeMock = jest.fn();

  const createParser = (options?: ISaxParserOptions) => createForgivingSaxParser({
    startTag: (token) => onStartTagMock(cloneDeep(token)),
    endTag: (token) => onEndTagMock(cloneDeep(token)),
    text: (token) => onTextMock(cloneDeep(token)),
    comment: (token) => onCommentMock(cloneDeep(token)),
    processingInstruction: (token) => onProcessingInstructionMock(cloneDeep(token)),
    cdata: (token) => onCdataSectionMock(cloneDeep(token)),
    doctype: (token) => onDocumentTypeMock(cloneDeep(token)),
    ...options,
  });

  beforeEach(() => {
    parser = createParser();

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

    it('CDATA tags are case-insensitive in HTML mode', () => {
      const parser = createParser({
        checkCdataTag: (token) => token.name === 'script',
      });

      parser.parse('<script><foo aaa=111></SCRIPT>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawName: 'script',
        name: 'script',
        attrs: [],
        selfClosing: false,
        start: 0,
        end: 8,
        nameStart: 1,
        nameEnd: 7,
      });

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: '<foo aaa=111>',
        data: '<foo aaa=111>',
        start: 8,
        end: 21,
        dataStart: 8,
        dataEnd: 21,
      });

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenCalledWith<[ITagToken]>({
        rawName: 'SCRIPT',
        name: 'script',
        start: 21,
        end: 30,
        nameStart: 23,
        nameEnd: 29,
      });
    });

    it('CDATA tags are case-sensitive in XML mode', () => {
      const parser = createParser({
        xmlEnabled: true,
        checkCdataTag: (token) => token.name === 'script',
      });

      parser.parse('<script><foo aaa=111></SCRIPT>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawName: 'script',
        name: 'script',
        attrs: [],
        selfClosing: false,
        start: 0,
        end: 8,
        nameStart: 1,
        nameEnd: 7,
      });

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: '<foo aaa=111></SCRIPT>',
        data: '<foo aaa=111></SCRIPT>',
        start: 8,
        end: 30,
        dataStart: 8,
        dataEnd: 30,
      });
    });

    it('throws errors', () => {
      const error = new Error('Fail');
      const parser = createParser({
        text() {
          throw error;
        },
      });

      expect(() => parser.parse('foo')).toThrow(error);
      expect(onTextMock).not.toHaveBeenCalled();
    });

    it('captures errors', () => {
      const onErrorMock = jest.fn();
      const error = new Error('Fail');
      const parser = createParser({
        text() {
          throw error;
        },
        error: onErrorMock,
      });

      expect(() => parser.parse('foo')).not.toThrow();

      expect(onTextMock).not.toHaveBeenCalled();

      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock).toHaveBeenCalledWith(error);
    });

  });

  describe('in streaming mode', () => {

    it('defers text emit', () => {
      parser.write('<a>foo');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawName: 'a',
        name: 'a',
        attrs: [],
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
        rawName: 'a',
        name: 'a',
        start: 12,
        end: 16,
        nameStart: 14,
        nameEnd: 15,
      });
    });

    it('defers start tag emit', () => {
      parser = createParser({selfClosingEnabled: true});

      parser.write('<www aaa=111 ');

      expect(onStartTagMock).not.toHaveBeenCalled();

      parser.write('/>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawName: 'www',
        name: 'www',
        attrs: [
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
        rawName: 'bar',
        name: 'bar',
        attrs: [
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
