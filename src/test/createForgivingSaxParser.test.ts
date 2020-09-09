import {SaxParser} from '../main/createSaxParser';
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
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 3);
      expect(onTextMock).not.toHaveBeenCalled();
    });

    it('emits the end tag', () => {
      parser.writeStream('<a></a>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 3);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 3, 7);
    });

    it('does not emit the end tag without corresponding start tag', () => {
      parser.writeStream('</a>');

      expect(onStartTagMock).not.toHaveBeenCalled();
      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('emits end tag if the start implicitly closes', () => {
      parser = createParser({isImplicitEnd: (tagName) => tagName === 'a'});
      parser.writeStream('<a><b>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'b', {length: 0}, false, 3, 6);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 3, 3);
    });

    it('emits end tag for intermediate tags if the start implicitly closes', () => {
      parser = createParser({isImplicitEnd: (currentTagName, tagName) => currentTagName === 'a' && tagName === 'c'});
      parser.writeStream('<a><b><c>');

      expect(onStartTagMock).toHaveBeenCalledTimes(3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'b', {length: 0}, false, 3, 6);
      expect(onStartTagMock).toHaveBeenNthCalledWith(3, 'c', {length: 0}, false, 6, 9);

      expect(onEndTagMock).toHaveBeenCalledTimes(2);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'b', 6, 6);
      expect(onEndTagMock).toHaveBeenNthCalledWith(2, 'a', 6, 6);
    });

    it('recognizes void tags', () => {
      parser = createParser({isVoidContent: (tagName) => tagName === 'a'});
      parser.writeStream('<a><b></b></a>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, true, 0, 3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'b', {length: 0}, false, 3, 6);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'b', 6, 10);
    });
  });

  describe('in non-streaming mode', () => {

    it('emits end tags for unclosed start tags', () => {
      parser.commit('<a><b>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'b', {length: 0}, false, 3, 6);

      expect(onEndTagMock).toHaveBeenCalledTimes(2);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'b', 6, 6);
      expect(onEndTagMock).toHaveBeenNthCalledWith(2, 'a', 6, 6);
    });

    it('emits text before closing unclosed tags', () => {
      parser.commit('<a>bbb');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 3);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'bbb', 3, 6);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 6, 6);
    });

    it('implicitly closes current tag with nesting', () => {
      parser = createParser({isImplicitEnd: (currentTagName, tagName) => currentTagName === 'p' && tagName === 'p'});
      parser.commit('<p><p>aaa</p></p>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'p', {length: 0}, false, 0, 3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'p', {length: 0}, false, 3, 6);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'aaa', 6, 9);

      expect(onEndTagMock).toHaveBeenCalledTimes(2);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'p', 3, 3);
      expect(onEndTagMock).toHaveBeenNthCalledWith(2, 'p', 9, 13);
    });
  });
});
