import {SaxParser} from '../main/createSaxParser';
import {ContentMode} from '../main/ContentMode';
import {createForgivingSaxParser, ForgivingSaxParserOptions} from '../main/createForgivingSaxParser';

describe('createForgivingSaxParser', () => {

  let parser: SaxParser;

  const onStartTagMock = jest.fn();
  const onEndTagMock = jest.fn();
  const onTextMock = jest.fn();
  const onCommentMock = jest.fn();
  const onProcessingInstructionMock = jest.fn();
  const onCdataSectionMock = jest.fn();
  const onDocumentTypeMock = jest.fn();

  const createParser = (options: ForgivingSaxParserOptions) => createForgivingSaxParser({
    ...options,
    onStartTag: onStartTagMock,
    onEndTag: onEndTagMock,
    onText: onTextMock,
    onComment: onCommentMock,
    onProcessingInstruction: onProcessingInstructionMock,
    onCdataSection: onCdataSectionMock,
    onDocumentType: onDocumentTypeMock,
  });

  beforeEach(() => {
    parser = createParser({});

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
      parser.writeStream('aaa');
      expect(onTextMock).not.toHaveBeenCalled();

      parser.commit();
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'aaa', 0, 3);
    });

    it('emits the start tag', () => {
      parser.writeStream('<a>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 3);
      expect(onTextMock).not.toHaveBeenCalled();
    });

    it('emits the end tag', () => {
      parser.writeStream('<a></a>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 3);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 3, 7);
    });

    it('does not emit the end tag without corresponding start tag', () => {
      parser.writeStream('</a>');

      expect(onStartTagMock).not.toHaveBeenCalled();
      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('emits end tag if the start implicitly closes', () => {
      parser = createParser({isImplicitEnd: (t1) => t1 === 'a'});
      parser.writeStream('<a><b>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'b', [], false, ContentMode.FLOW, 3, 6);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 3, 3);
    });

    it('emits end tag for intermediate tags if the start implicitly closes', () => {
      parser = createParser({isImplicitEnd: (t1, t2) => t1 === 'a' && t2 === 'c'});
      parser.writeStream('<a><b><c>');

      expect(onStartTagMock).toHaveBeenCalledTimes(3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'b', [], false, ContentMode.FLOW, 3, 6);
      expect(onStartTagMock).toHaveBeenNthCalledWith(3, 'c', [], false, ContentMode.FLOW, 6, 9);

      expect(onEndTagMock).toHaveBeenCalledTimes(2);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'b', 6, 6);
      expect(onEndTagMock).toHaveBeenNthCalledWith(2, 'a', 6, 6);
    });

    it('emits start tag as raw source', () => {
      parser = createParser({isEmittedAsText: (t) => t === 'b'});
      parser.writeStream('<a><b>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 3);

      expect(onTextMock).not.toHaveBeenCalled();

      parser.commit();

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '<b>', 3, 6);
    });

    it('does not emit ignored tags', () => {
      parser = createParser({isIgnored: (t) => t === 'b'});
      parser.writeStream('<a><b></b></a>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 3);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 10, 14);
    });

    it('recognizes void tags', () => {
      parser = createParser({getContentMode: (tagName) => tagName === 'a' ? ContentMode.VOID : ContentMode.FLOW});
      parser.writeStream('<a><b></b></a>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], true, ContentMode.VOID, 0, 3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'b', [], false, ContentMode.FLOW, 3, 6);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'b', 6, 10);
    });
  });

  describe('in non-streaming mode', () => {

    it('emits raw source instead of a tag', () => {
      parser = createParser({isEmittedAsText: (tagName) => tagName === 'a'});
      parser.commit('<a><b></b></a>');

      expect(onTextMock).toHaveBeenCalledTimes(2);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '<a>', 0, 3);
      expect(onTextMock).toHaveBeenNthCalledWith(2, '</a>', 10, 14);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'b', [], false, ContentMode.FLOW, 3, 6);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'b', 6, 10);
    });
  });
});
