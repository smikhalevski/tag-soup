import {createSaxParser} from '../main/createSaxParser';
import {cloneDeep} from 'lodash';
import {IDataToken, IStartTagToken, ITagToken} from '../main/token-types';
import {IParser, ISaxHandler} from '../main/parser-types';

describe('createSaxParser', () => {

  const startTagMock = jest.fn();
  const endTagMock = jest.fn();
  const textMock = jest.fn();
  const commentMock = jest.fn();
  const processingInstructionMock = jest.fn();
  const cdataMock = jest.fn();
  const doctypeMock = jest.fn();

  let parser: IParser<ISaxHandler, void>;
  let handler: ISaxHandler;

  beforeEach(() => {
    parser = createSaxParser();

    handler = {
      startTag: (token) => startTagMock(cloneDeep(token)),
      endTag: (token) => endTagMock(cloneDeep(token)),
      text: (token) => textMock(cloneDeep(token)),
      comment: (token) => commentMock(cloneDeep(token)),
      doctype: (token) => doctypeMock(cloneDeep(token)),
      processingInstruction: (token) => processingInstructionMock(cloneDeep(token)),
      cdata: (token) => cdataMock(cloneDeep(token)),
    };

    startTagMock.mockReset();
    endTagMock.mockReset();
    textMock.mockReset();
    commentMock.mockReset();
    processingInstructionMock.mockReset();
    cdataMock.mockReset();
    doctypeMock.mockReset();
  });

  describe('in non-streaming mode', () => {

    it('throws errors', () => {
      handler.text = () => {
        throw new Error();
      };

      expect(() => parser.parse(handler, 'foo')).toThrow();
      expect(textMock).not.toHaveBeenCalled();
    });

    it('does not emit incomplete start tags', () => {
      parser.parse(handler, '<www aaa=111 ');

      expect(startTagMock).not.toHaveBeenCalled();
      expect(textMock).not.toHaveBeenCalled();
    });

    it('emits incomplete comment', () => {
      parser.parse(handler, '<!--foo');

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<IDataToken>{
        rawData: 'foo',
        data: 'foo',
        start: 0,
        end: 7,
        dataStart: 4,
        dataEnd: 7,
      });
    });

    it('emits CDATA tags', () => {
      parser = createSaxParser({
        checkCdataTag: (token) => token.name === 'script',
      });

      parser.parse(handler, '<script><foo aaa=111></script>');

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        rawName: 'script',
        name: 'script',
        attributes: [],
        selfClosing: false,
        start: 0,
        end: 8,
        nameStart: 1,
        nameEnd: 7,
      });

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<IDataToken>{
        rawData: '<foo aaa=111>',
        data: '<foo aaa=111>',
        start: 8,
        end: 21,
        dataStart: 8,
        dataEnd: 21,
      });

      expect(endTagMock).toHaveBeenCalledTimes(1);
      expect(endTagMock).toHaveBeenCalledWith(<ITagToken>{
        rawName: 'script',
        name: 'script',
        start: 21,
        end: 30,
        nameStart: 23,
        nameEnd: 29,
      });
    });

    it('emits end tags for unclosed start tags', () => {
      parser.parse(handler, '<a><b>');

      expect(startTagMock).toHaveBeenCalledTimes(2);
      expect(startTagMock).toHaveBeenNthCalledWith(1, <IStartTagToken>{
        rawName: 'a',
        name: 'a',
        attributes: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
      expect(startTagMock).toHaveBeenNthCalledWith(2, <IStartTagToken>{
        rawName: 'b',
        name: 'b',
        attributes: [],
        selfClosing: false,
        start: 3,
        end: 6,
        nameStart: 4,
        nameEnd: 5,
      });

      expect(endTagMock).toHaveBeenCalledTimes(2);
      expect(endTagMock).toHaveBeenNthCalledWith(1, <ITagToken>{
        rawName: 'b',
        name: 'b',
        start: 6,
        end: 6,
        nameStart: -1,
        nameEnd: -1,
      });
      expect(endTagMock).toHaveBeenNthCalledWith(2, <ITagToken>{
        rawName: 'a',
        name: 'a',
        start: 6,
        end: 6,
        nameStart: -1,
        nameEnd: -1,
      });
    });

    it('emits text before closing unclosed tags', () => {
      parser.parse(handler, '<a>bbb');

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        rawName: 'a',
        name: 'a',
        attributes: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<IDataToken>{
        rawData: 'bbb',
        data: 'bbb',
        start: 3,
        end: 6,
        dataStart: 3,
        dataEnd: 6,
      });

      expect(endTagMock).toHaveBeenCalledTimes(1);
      expect(endTagMock).toHaveBeenCalledWith(<ITagToken>{
        rawName: 'a',
        name: 'a',
        start: 6,
        end: 6,
        nameStart: -1,
        nameEnd: -1,
      });
    });

    it('implicitly closes current tag with nesting', () => {
      parser = createSaxParser({
        checkImplicitEndTag: (containerToken, token) => containerToken.name === 'p' && token.name === 'p',
      });

      parser.parse(handler, '<p><p>aaa</p></p>');

      expect(startTagMock).toHaveBeenCalledTimes(2);
      expect(startTagMock).toHaveBeenNthCalledWith(1, <IStartTagToken>{
        rawName: 'p',
        name: 'p',
        attributes: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
      expect(startTagMock).toHaveBeenNthCalledWith(2, <IStartTagToken>{
        rawName: 'p',
        name: 'p',
        attributes: [],
        selfClosing: false,
        start: 3,
        end: 6,
        nameStart: 4,
        nameEnd: 5,
      });

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<IDataToken>{
        rawData: 'aaa',
        data: 'aaa',
        start: 6,
        end: 9,
        dataStart: 6,
        dataEnd: 9,
      });

      expect(endTagMock).toHaveBeenCalledTimes(2);
      expect(endTagMock).toHaveBeenNthCalledWith(1, <ITagToken>{
        rawName: 'p',
        name: 'p',
        start: 3,
        end: 3,
        nameStart: -1,
        nameEnd: -1,
      });
      expect(endTagMock).toHaveBeenNthCalledWith(2, <ITagToken>{
        rawName: 'p',
        name: 'p',
        start: 9,
        end: 13,
        nameStart: 11,
        nameEnd: 12,
      });
    });
  });

  describe('in streaming mode', () => {

    it('defers text emit', () => {
      parser.write(handler, '<a>foo');

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        rawName: 'a',
        name: 'a',
        attributes: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });

      expect(textMock).not.toHaveBeenCalled();

      parser.write(handler, 'qux');

      expect(textMock).not.toHaveBeenCalled();

      parser.write(handler, 'bar</a>');

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<IDataToken>{
        rawData: 'fooquxbar',
        data: 'fooquxbar',
        start: 3,
        end: 12,
        dataStart: 3,
        dataEnd: 12,
      });

      expect(endTagMock).toHaveBeenCalledTimes(1);
      expect(endTagMock).toHaveBeenCalledWith(<ITagToken>{
        rawName: 'a',
        name: 'a',
        start: 12,
        end: 16,
        nameStart: 14,
        nameEnd: 15,
      });
    });

    it('defers start tag emit', () => {
      parser = createSaxParser({selfClosingEnabled: true});

      parser.write(handler, '<www aaa=111 ');

      expect(startTagMock).not.toHaveBeenCalled();

      parser.write(handler, '/>');

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        rawName: 'www',
        name: 'www',
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

      expect(endTagMock).not.toHaveBeenCalled();
    });

    it('emits attribute with proper offsets', () => {
      parser.write(handler, '<foo>');

      expect(startTagMock).toHaveBeenCalledTimes(1);

      parser.write(handler, '<bar aaa=111>');

      expect(startTagMock).toHaveBeenCalledTimes(2);
      expect(startTagMock).toHaveBeenNthCalledWith(2, <IStartTagToken>{
        rawName: 'bar',
        name: 'bar',
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

      expect(endTagMock).not.toHaveBeenCalled();
    });

    it('defers comment emit', () => {
      parser.write(handler, '<!--foo');

      expect(commentMock).not.toHaveBeenCalled();

      parser.write(handler, 'bar-->');

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<IDataToken>{
        rawData: 'foobar',
        data: 'foobar',
        start: 0,
        end: 13,
        dataStart: 4,
        dataEnd: 10,
      });
    });

    it('emits incomplete comment on parse', () => {
      parser.write(handler, '<!--foo');

      expect(commentMock).not.toHaveBeenCalled();

      parser.parse(handler);

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<IDataToken>{
        rawData: 'foo',
        data: 'foo',
        start: 0,
        end: 7,
        dataStart: 4,
        dataEnd: 7,
      });
    });

    it('emits tail on parse with an additional data', () => {
      parser.write(handler, '<!--foo');

      expect(commentMock).not.toHaveBeenCalled();

      parser.parse(handler, 'bar');

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<IDataToken>{
        rawData: 'foobar',
        data: 'foobar',
        start: 0,
        end: 10,
        dataStart: 4,
        dataEnd: 10,
      });
    });

    it('can reset the stream', () => {
      parser.write(handler, 'foo');

      expect(textMock).not.toHaveBeenCalled();

      parser.reset();
      parser.parse(handler, 'bar');

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<IDataToken>{
        rawData: 'bar',
        data: 'bar',
        start: 0,
        end: 3,
        dataStart: 0,
        dataEnd: 3,
      });
    });


    it('defers text emit', () => {
      parser.write(handler, 'aaa');
      expect(textMock).not.toHaveBeenCalled();

      parser.parse(handler);

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<IDataToken>{
        rawData: 'aaa',
        data: 'aaa',
        start: 0,
        end: 3,
        dataStart: 0,
        dataEnd: 3,
      });
    });

    it('emits the start tag', () => {
      parser.write(handler, '<a>');

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        rawName: 'a',
        name: 'a',
        attributes: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });

      expect(textMock).not.toHaveBeenCalled();
    });

    it('emits the end tag', () => {
      parser.write(handler, '<a></a>');

      expect(startTagMock).toHaveBeenCalledTimes(1);

      expect(endTagMock).toHaveBeenCalledTimes(1);
      expect(endTagMock).toHaveBeenCalledWith(<ITagToken>{
        rawName: 'a',
        name: 'a',
        start: 3,
        end: 7,
        nameStart: 5,
        nameEnd: 6,
      });
    });

    it('does not emit the end tag without corresponding start tag', () => {
      parser.write(handler, '</a>');

      expect(startTagMock).not.toHaveBeenCalled();
      expect(endTagMock).not.toHaveBeenCalled();
    });

    it('emits end tag if the start implicitly closes', () => {
      parser = createSaxParser({
        checkImplicitEndTag: (containerToken) => containerToken.name === 'a',
      });

      parser.write(handler, '<a><b>');

      expect(startTagMock).toHaveBeenCalledTimes(2);
      expect(startTagMock).toHaveBeenNthCalledWith(1, <IStartTagToken>{
        rawName: 'a',
        name: 'a',
        attributes: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
      expect(startTagMock).toHaveBeenNthCalledWith(2, <IStartTagToken>{
        rawName: 'b',
        name: 'b',
        attributes: [],
        selfClosing: false,
        start: 3,
        end: 6,
        nameStart: 4,
        nameEnd: 5,
      });

      expect(endTagMock).toHaveBeenCalledTimes(1);
      expect(endTagMock).toHaveBeenCalledWith(<ITagToken>{
        rawName: 'a',
        name: 'a',
        start: 3,
        end: 3,
        nameStart: -1,
        nameEnd: -1,
      });
    });

    it('emits end tag for intermediate tags if the start implicitly closes', () => {

      parser = createSaxParser({
        checkImplicitEndTag: (containerToken, token) => containerToken.name === 'a' && token.name === 'c',
      });

      parser.write(handler, '<a><b><c>');  // <a><b></b></a><b><c></c></b>

      expect(startTagMock).toHaveBeenCalledTimes(3);
      expect(startTagMock).toHaveBeenNthCalledWith(1, <IStartTagToken>{
        rawName: 'a',
        name: 'a',
        attributes: [],
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
      expect(startTagMock).toHaveBeenNthCalledWith(2, <IStartTagToken>{
        rawName: 'b',
        name: 'b',
        attributes: [],
        selfClosing: false,
        start: 3,
        end: 6,
        nameStart: 4,
        nameEnd: 5,
      });
      expect(startTagMock).toHaveBeenNthCalledWith(3, <IStartTagToken>{
        rawName: 'c',
        name: 'c',
        attributes: [],
        selfClosing: false,
        start: 6,
        end: 9,
        nameStart: 7,
        nameEnd: 8,
      });

      expect(endTagMock).toHaveBeenCalledTimes(2);
      expect(endTagMock).toHaveBeenNthCalledWith(1, <ITagToken>{
        rawName: 'b',
        name: 'b',
        start: 6,
        end: 6,
        nameStart: -1,
        nameEnd: -1,
      });
      expect(endTagMock).toHaveBeenNthCalledWith(2, <ITagToken>{
        rawName: 'a',
        name: 'a',
        start: 6,
        end: 6,
        nameStart: -1,
        nameEnd: -1,
      });
    });

    it('recognizes void tags', () => {
      parser = createSaxParser({
        checkVoidTag: (token) => token.name === 'a',
      });

      parser.write(handler, '<a><b></b></a>');

      expect(startTagMock).toHaveBeenCalledTimes(2);
      expect(startTagMock).toHaveBeenNthCalledWith(1, <IStartTagToken>{
        rawName: 'a',
        name: 'a',
        attributes: [],
        selfClosing: true,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
      expect(startTagMock).toHaveBeenNthCalledWith(2, <IStartTagToken>{
        rawName: 'b',
        name: 'b',
        attributes: [],
        selfClosing: false,
        start: 3,
        end: 6,
        nameStart: 4,
        nameEnd: 5,
      });

      expect(endTagMock).toHaveBeenCalledTimes(1);
      expect(endTagMock).toHaveBeenCalledWith(<ITagToken>{
        rawName: 'b',
        name: 'b',
        start: 6,
        end: 10,
        nameStart: 8,
        nameEnd: 9,
      });
    });
  });

  // it('can parse test file', () => {
  //   const html = fs.readFileSync(path.join(__dirname, './test.html'), 'utf8');
  //   createForgivingSaxParser().parse(html);
  // });
});
