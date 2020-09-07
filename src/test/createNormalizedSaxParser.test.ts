import {parseSax, SaxParser} from '../main/createSaxParser';
import {TagType} from '../main/TagType';
import {createNormalizedSaxParser, NormalizedSaxParserOptions} from '../main/createNormalizedSaxParser';

describe('createNormalizedSaxParser', () => {

  describe('in streaming mode', () => {

    let parser: SaxParser;

    const onStartTagMock = jest.fn();
    const onAttributeMock = jest.fn();
    const onEndTagMock = jest.fn();
    const onTextMock = jest.fn();
    const onCommentMock = jest.fn();
    const onProcessingInstructionMock = jest.fn();
    const onCdataSectionMock = jest.fn();
    const onDocumentTypeMock = jest.fn();

    const createParser = (options: NormalizedSaxParserOptions) => createNormalizedSaxParser({
      ...options,
      onStartTag: onStartTagMock,
      onAttribute: onAttributeMock,
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
      onAttributeMock.mockReset();
      onEndTagMock.mockReset();
      onTextMock.mockReset();
      onCommentMock.mockReset();
      onProcessingInstructionMock.mockReset();
      onCdataSectionMock.mockReset();
      onDocumentTypeMock.mockReset();
    });

    it('defers text emit', () => {
      parser.writeStream('aaa');
      expect(onTextMock).not.toHaveBeenCalled();

      parser.commit();
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'aaa', 0, 3);
    });

    it('emits the start tag', () => {
      parser.writeStream('<a>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', false, TagType.FLOW, 0, 3);
      expect(onTextMock).not.toHaveBeenCalled();
    });

    it('emits end tag if the start implicitly closes', () => {
      parser = createParser({isImplicitEnd: (t1) => t1 === 'a'});
      parser.writeStream('<a><b>');

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', false, TagType.FLOW, 0, 3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'b', false, TagType.FLOW, 3, 6);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 3, 3);
    });

    it('emits end tag for intermediate tags if the start implicitly closes', () => {
      parser = createParser({isImplicitEnd: (t1, t2) => t1 === 'a' && t2 === 'c'});
      parser.writeStream('<a><b><c>');

      expect(onStartTagMock).toHaveBeenCalledTimes(3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', false, TagType.FLOW, 0, 3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'b', false, TagType.FLOW, 3, 6);
      expect(onStartTagMock).toHaveBeenNthCalledWith(3, 'c', false, TagType.FLOW, 6, 9);

      expect(onEndTagMock).toHaveBeenCalledTimes(2);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'b', 6, 6);
      expect(onEndTagMock).toHaveBeenNthCalledWith(2, 'a', 6, 6);
    });

    it('emits tag restarts', () => {
      parser = createParser({isContinuousAfterEnd: (t1, t2) => t1 === 'b' && t2 === 'a'});
      parser.writeStream('<a><b></a>');

      expect(onStartTagMock).toHaveBeenCalledTimes(3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', false, TagType.FLOW, 0, 3);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'b', false, TagType.FLOW, 3, 6);
      expect(onStartTagMock).toHaveBeenNthCalledWith(3, 'b', false, TagType.FLOW, 10, 10);

      expect(onEndTagMock).toHaveBeenCalledTimes(2);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'b', 6, 6);
      expect(onEndTagMock).toHaveBeenNthCalledWith(2, 'a', 6, 10);
    });
  });
});