import {createForgivingSaxParser} from '../main/createForgivingSaxParser';
import {cloneDeep} from 'lodash';
import fs from 'fs';
import path from 'path';
import {IDataToken, IStartTagToken, ITagToken} from '../main/token-types';
import {IForgivingSaxParserOptions, IParser} from '../main/parser-types';

describe('createForgivingSaxParser', () => {

  let parser: IParser;

  const onStartTagMock = jest.fn();
  const onEndTagMock = jest.fn();
  const onTextMock = jest.fn();
  const onCommentMock = jest.fn();
  const onProcessingInstructionMock = jest.fn();
  const onCdataSectionMock = jest.fn();
  const onDocumentTypeMock = jest.fn();

  const createParser = (options?: IForgivingSaxParserOptions) => createForgivingSaxParser({
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

  describe('in streaming mode', () => {

    it('defers text emit', () => {
      parser.write('aaa');
      expect(onTextMock).not.toHaveBeenCalled();

      parser.parse();

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'aaa',
        data: 'aaa',
        start: 0,
        end: 3,
        dataStart: 0,
        dataEnd: 3,
      });
    });

    it('emits the start tag', () => {
      parser.write('<a>');

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
    });

    it('emits the end tag', () => {
      parser.write('<a></a>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenCalledWith<[ITagToken]>({
        rawName: 'a',
        name: 'a',
        start: 3,
        end: 7,
        nameStart: 5,
        nameEnd: 6,
      });
    });

    it('does not emit the end tag without corresponding start tag', () => {
      parser.write('</a>');

      expect(onStartTagMock).not.toHaveBeenCalled();
      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('emits end tag if the start implicitly closes', () => {
      parser = createParser({isImplicitEnd: (containerToken) => containerToken.name === 'a'});
      parser.write('<a><b>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(1, {
        rawName: 'a',
        name: 'a',
        attrs: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(2, {
        rawName: 'b',
        name: 'b',
        attrs: [],
        selfClosing: false,
        start: 3,
        end: 6,
        nameStart: 4,
        nameEnd: 5,
      });

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenCalledWith<[ITagToken]>({
        rawName: 'a',
        name: 'a',
        start: 3,
        end: 3,
        nameStart: -1,
        nameEnd: -1,
      });
    });

    it('emits end tag for intermediate tags if the start implicitly closes', () => {
      parser = createParser({isImplicitEnd: (containerToken, token) => containerToken.name === 'a' && token.name === 'c'});
      parser.write('<a><b><c>');

      expect(onStartTagMock).toHaveBeenCalledTimes(3);
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(1, {
        rawName: 'a',
        name: 'a',
        attrs: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(2, {
        rawName: 'b',
        name: 'b',
        attrs: [],
        selfClosing: false,
        start: 3,
        end: 6,
        nameStart: 4,
        nameEnd: 5,
      });
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(3, {
        rawName: 'c',
        name: 'c',
        attrs: [],
        selfClosing: false,
        start: 6,
        end: 9,
        nameStart: 7,
        nameEnd: 8,
      });

      expect(onEndTagMock).toHaveBeenCalledTimes(2);
      expect(onEndTagMock).toHaveBeenNthCalledWith<[ITagToken]>(1, {
        rawName: 'b',
        name: 'b',
        start: 6,
        end: 6,
        nameStart: -1,
        nameEnd: -1,
      });
      expect(onEndTagMock).toHaveBeenNthCalledWith<[ITagToken]>(2, {
        rawName: 'a',
        name: 'a',
        start: 6,
        end: 6,
        nameStart: -1,
        nameEnd: -1,
      });
    });

    it('recognizes void tags', () => {
      parser = createParser({isVoidContent: (token) => token.name === 'a'});
      parser.write('<a><b></b></a>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(1, {
        rawName: 'a',
        name: 'a',
        attrs: [],
        selfClosing: true,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(2, {
        rawName: 'b',
        name: 'b',
        attrs: [],
        selfClosing: false,
        start: 3,
        end: 6,
        nameStart: 4,
        nameEnd: 5,
      });

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenCalledWith<[ITagToken]>({
        rawName: 'b',
        name: 'b',
        start: 6,
        end: 10,
        nameStart: 8,
        nameEnd: 9,
      });
    });
  });

  describe('in non-streaming mode', () => {

    it('emits end tags for unclosed start tags', () => {
      parser.parse('<a><b>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(1, {
        rawName: 'a',
        name: 'a',
        attrs: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(2, {
        rawName: 'b',
        name: 'b',
        attrs: [],
        selfClosing: false,
        start: 3,
        end: 6,
        nameStart: 4,
        nameEnd: 5,
      });

      expect(onEndTagMock).toHaveBeenCalledTimes(2);
      expect(onEndTagMock).toHaveBeenNthCalledWith<[ITagToken]>(1, {
        rawName: 'b',
        name: 'b',
        start: 6,
        end: 6,
        nameStart: -1,
        nameEnd: -1,
      });
      expect(onEndTagMock).toHaveBeenNthCalledWith<[ITagToken]>(2, {
        rawName: 'a',
        name: 'a',
        start: 6,
        end: 6,
        nameStart: -1,
        nameEnd: -1,
      });
    });

    it('emits text before closing unclosed tags', () => {
      parser.parse('<a>bbb');

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

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'bbb',
        data: 'bbb',
        start: 3,
        end: 6,
        dataStart: 3,
        dataEnd: 6,
      });

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenCalledWith<[ITagToken]>({
        rawName: 'a',
        name: 'a',
        start: 6,
        end: 6,
        nameStart: -1,
        nameEnd: -1,
      });
    });

    it('implicitly closes current tag with nesting', () => {
      parser = createParser({isImplicitEnd: (containerToken, token) => containerToken.name === 'p' && token.name === 'p'});
      parser.parse('<p><p>aaa</p></p>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(1, {
        rawName: 'p',
        name: 'p',
        attrs: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(2, {
        rawName: 'p',
        name: 'p',
        attrs: [],
        selfClosing: false,
        start: 3,
        end: 6,
        nameStart: 4,
        nameEnd: 5,
      });

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'aaa',
        data: 'aaa',
        start: 6,
        end: 9,
        dataStart: 6,
        dataEnd: 9,
      });

      expect(onEndTagMock).toHaveBeenCalledTimes(2);
      expect(onEndTagMock).toHaveBeenNthCalledWith<[ITagToken]>(1, {
        rawName: 'p',
        name: 'p',
        start: 3,
        end: 3,
        nameStart: -1,
        nameEnd: -1,
      });
      expect(onEndTagMock).toHaveBeenNthCalledWith<[ITagToken]>(2, {
        rawName: 'p',
        name: 'p',
        start: 9,
        end: 13,
        nameStart: 11,
        nameEnd: 12,
      });
    });
  });

  it('can parse test file', () => {
    const html = fs.readFileSync(path.join(__dirname, './test.html'), 'utf8');
    createForgivingSaxParser().parse(html);
  });
});
