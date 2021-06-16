import {identity, startTagToken, tokenize, tokenizeAttrs} from '../main/tokenize';
import {IAttributeToken, IDataToken, ISaxParserOptions, IStartTagToken, ITagToken} from '../main/createSaxParser';
import {cloneDeep} from 'lodash';

describe('tokenizeAttrs', () => {

  let attrs: Array<IAttributeToken>;

  beforeEach(() => {
    attrs = [];
  });

  it('reads a double quoted attr', () => {
    expect(tokenizeAttrs('aaa="111"', 0, 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: true,
        start: 0,
        end: 9,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 5,
        valueEnd: 8,
      },
    ]);
  });

  it('reads a single quoted attr', () => {
    expect(tokenizeAttrs('aaa=\'111\'', 0, 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: true,
        start: 0,
        end: 9,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 5,
        valueEnd: 8,
      },
    ]);
  });

  it('reads an unquoted attr', () => {
    expect(tokenizeAttrs('aaa=111', 0, 0, attrs, identity, identity)).toBe(7);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: false,
        start: 0,
        end: 7,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 4,
        valueEnd: 7,
      },
    ]);
  });

  it('reads mixed attrs separated by spaces', () => {
    expect(tokenizeAttrs('aaa=111 bbb="222" ccc=\'333\'', 0, 0, attrs, identity, identity)).toBe(27);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: false,
        start: 0,
        end: 7,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 4,
        valueEnd: 7,
      },
      {
        rawName: 'bbb',
        name: 'bbb',
        rawValue: '222',
        value: '222',
        quoted: true,
        start: 8,
        end: 17,
        nameStart: 8,
        nameEnd: 11,
        valueStart: 13,
        valueEnd: 16,
      },
      {
        rawName: 'ccc',
        name: 'ccc',
        rawValue: '333',
        value: '333',
        quoted: true,
        start: 18,
        end: 27,
        nameStart: 18,
        nameEnd: 21,
        valueStart: 23,
        valueEnd: 26,
      },
    ]);
  });

  it('reads quoted attrs separated by slashes', () => {
    expect(tokenizeAttrs('aaa="111"//bbb=\'222\'//', 0, 0, attrs, identity, identity)).toBe(20);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: true,
        start: 0,
        end: 9,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 5,
        valueEnd: 8,
      },
      {
        rawName: 'bbb',
        name: 'bbb',
        rawValue: '222',
        value: '222',
        quoted: true,
        start: 11,
        end: 20,
        nameStart: 11,
        nameEnd: 14,
        valueStart: 16,
        valueEnd: 19,
      },
    ]);
  });

  it('reads non-separated quoted attrs', () => {
    expect(tokenizeAttrs('aaa="111"bbb=\'222\'', 0, 0, attrs, identity, identity)).toBe(18);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: true,
        start: 0,
        end: 9,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 5,
        valueEnd: 8,
      },
      {
        rawName: 'bbb',
        name: 'bbb',
        rawValue: '222',
        value: '222',
        quoted: true,
        start: 9,
        end: 18,
        nameStart: 9,
        nameEnd: 12,
        valueStart: 14,
        valueEnd: 17,
      },
    ]);
  });

  it('reads an attr without the value', () => {
    expect(tokenizeAttrs('aaa', 0, 0, attrs, identity, identity)).toBe(3);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: undefined,
        value: undefined,
        quoted: false,
        start: 0,
        end: 3,
        nameStart: 0,
        nameEnd: 3,
        valueStart: -1,
        valueEnd: -1,
      },
    ]);
  });

  it('reads a attr with an equals char and without the value', () => {
    expect(tokenizeAttrs('aaa=', 0, 0, attrs, identity, identity)).toBe(4);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: null,
        value: null,
        quoted: false,
        start: 0,
        end: 4,
        nameStart: 0,
        nameEnd: 3,
        valueStart: -1,
        valueEnd: -1,
      },
    ]);
  });

  it('treats the slash char as the whitespace in the attr name', () => {
    expect(tokenizeAttrs('aaa/bbb="222"', 0, 0, attrs, identity, identity)).toBe(13);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: undefined,
        value: undefined,
        quoted: false,
        start: 0,
        end: 3,
        nameStart: 0,
        nameEnd: 3,
        valueStart: -1,
        valueEnd: -1,
      },
      {
        rawName: 'bbb',
        name: 'bbb',
        rawValue: '222',
        value: '222',
        quoted: true,
        start: 4,
        end: 13,
        nameStart: 4,
        nameEnd: 7,
        valueStart: 9,
        valueEnd: 12,
      },
    ]);
  });

  it('ignores leading slashes', () => {
    expect(tokenizeAttrs('//aaa=111', 0, 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: false,
        start: 2,
        end: 9,
        nameStart: 2,
        nameEnd: 5,
        valueStart: 6,
        valueEnd: 9,
      },
    ]);
  });

  it('ignores leading space chars', () => {
    expect(tokenizeAttrs(' \taaa=111', 0, 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: false,
        start: 2,
        end: 9,
        nameStart: 2,
        nameEnd: 5,
        valueStart: 6,
        valueEnd: 9,
      },
    ]);
  });

  it('trailing slashes are the part of the unquoted attr value', () => {
    expect(tokenizeAttrs('aaa=111//', 0, 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111//',
        value: '111//',
        quoted: false,
        start: 0,
        end: 9,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 4,
        valueEnd: 9,
      },
    ]);
  });

  it('trailing slashes are treated as an unquoted value', () => {
    expect(tokenizeAttrs('aaa=//', 0, 0, attrs, identity, identity)).toBe(6);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '//',
        value: '//',
        quoted: false,
        start: 0,
        end: 6,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 4,
        valueEnd: 6,
      },
    ]);
  });

  it('trailing slashes after the quoted value are ignored', () => {
    expect(tokenizeAttrs('aaa="111"//', 0, 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: true,
        start: 0,
        end: 9,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 5,
        valueEnd: 8,
      },
    ]);
  });

  it('trailing slash without the preceding equals char is ignored', () => {
    expect(tokenizeAttrs('aaa/', 0, 0, attrs, identity, identity)).toBe(3);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: undefined,
        value: undefined,
        quoted: false,
        start: 0,
        end: 3,
        nameStart: 0,
        nameEnd: 3,
        valueStart: -1,
        valueEnd: -1,
      },
    ]);
  });

  it('ignores training spaces', () => {
    expect(tokenizeAttrs('aaa=111  ', 0, 0, attrs, identity, identity)).toBe(7);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: false,
        start: 0,
        end: 7,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 4,
        valueEnd: 7,
      },
    ]);
  });

  it('ignores spaces around the equals char', () => {
    expect(tokenizeAttrs('aaa  =  111', 0, 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: false,
        start: 0,
        end: 11,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 8,
        valueEnd: 11,
      },
    ]);
  });

  it('treats the equals char as the part of the attr value', () => {
    expect(tokenizeAttrs('aaa=111=111', 0, 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111=111',
        value: '111=111',
        quoted: false,
        start: 0,
        end: 11,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 4,
        valueEnd: 11,
      },
    ]);
  });

  it('treats the quote char as the part of the attr value', () => {
    expect(tokenizeAttrs('aaa=111"111', 0, 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111"111',
        value: '111"111',
        quoted: false,
        start: 0,
        end: 11,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 4,
        valueEnd: 11,
      },
    ]);
  });

  it('treats single quot as the part of attr value', () => {
    expect(tokenizeAttrs('aaa=111\'111', 0, 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111\'111',
        value: '111\'111',
        quoted: false,
        start: 0,
        end: 11,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 4,
        valueEnd: 11,
      },
    ]);
  });

  it('treats slash followed by the equals char as the part of the attr value', () => {
    expect(tokenizeAttrs('aaa=111/=111 bbb=222', 0, 0, attrs, identity, identity)).toBe(20);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111/=111',
        value: '111/=111',
        quoted: false,
        start: 0,
        end: 12,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 4,
        valueEnd: 12,
      },
      {
        rawName: 'bbb',
        name: 'bbb',
        rawValue: '222',
        value: '222',
        quoted: false,
        start: 13,
        end: 20,
        nameStart: 13,
        nameEnd: 16,
        valueStart: 17,
        valueEnd: 20,
      },
    ]);
  });

  it('treats leading quotes as the part of the attr name', () => {
    expect(tokenizeAttrs('""""aaa=111', 0, 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: '""""aaa',
        name: '""""aaa',
        rawValue: '111',
        value: '111',
        quoted: false,
        start: 0,
        end: 11,
        nameStart: 0,
        nameEnd: 7,
        valueStart: 8,
        valueEnd: 11,
      },
    ]);
  });

  it('treats trailing quotes as the part of the attr name', () => {
    expect(tokenizeAttrs('aaa=""""""bbb=222', 0, 0, attrs, identity, identity)).toBe(17);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '',
        value: '',
        quoted: true,
        start: 0,
        end: 6,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 5,
        valueEnd: 5,
      },
      {
        rawName: '""""bbb',
        name: '""""bbb',
        rawValue: '222',
        value: '222',
        quoted: false,
        start: 6,
        end: 17,
        nameStart: 6,
        nameEnd: 13,
        valueStart: 14,
        valueEnd: 17,
      },
    ]);
  });

  it('reads the attr with the weird name', () => {
    expect(tokenizeAttrs('@#$%*=000', 0, 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: '@#$%*',
        name: '@#$%*',
        rawValue: '000',
        value: '000',
        quoted: false,
        start: 0,
        end: 9,
        nameStart: 0,
        nameEnd: 5,
        valueStart: 6,
        valueEnd: 9,
      },
    ]);
  });

  it('reads the attr that starts with the less-than char', () => {
    expect(tokenizeAttrs('<=000', 0, 0, attrs, identity, identity)).toBe(5);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: '<',
        name: '<',
        rawValue: '000',
        value: '000',
        quoted: false,
        start: 0,
        end: 5,
        nameStart: 0,
        nameEnd: 1,
        valueStart: 2,
        valueEnd: 5,
      },
    ]);
  });

  it('does not read after the greater-than char', () => {
    expect(tokenizeAttrs('  >aaa=111', 0, 0, attrs, identity, identity)).toBe(0);
    expect(attrs).toEqual<Array<IAttributeToken>>([]);
  });

  it('decodes the value', () => {
    expect(tokenizeAttrs('aaa=111', 0, 0, attrs, () => '222222', identity)).toBe(7);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '222222',
        quoted: false,
        start: 0,
        end: 7,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 4,
        valueEnd: 7,
      },
    ]);
  });

  it('renames the attr', () => {
    expect(tokenizeAttrs('aaa=111', 0, 0, attrs, identity, () => 'bbbbbb')).toBe(7);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'bbbbbb',
        rawValue: '111',
        value: '111',
        quoted: false,
        start: 0,
        end: 7,
        nameStart: 0,
        nameEnd: 3,
        valueStart: 4,
        valueEnd: 7,
      },
    ]);
  });

  it('respects offset', () => {
    expect(tokenizeAttrs('aaa=111', 0, 5, attrs, identity, identity)).toBe(7);
    expect(attrs).toEqual<Array<IAttributeToken>>([
      {
        rawName: 'aaa',
        name: 'aaa',
        rawValue: '111',
        value: '111',
        quoted: false,
        start: 5 + 0,
        end: 5 + 7,
        nameStart: 5 + 0,
        nameEnd: 5 + 3,
        valueStart: 5 + 4,
        valueEnd: 5 + 7,
      },
    ]);
  });
});

describe('tokenize', () => {

  const onStartTagMock = jest.fn();
  const onEndTagMock = jest.fn();
  const onTextMock = jest.fn();
  const onCommentMock = jest.fn();
  const onProcessingInstructionMock = jest.fn();
  const onCdataSectionMock = jest.fn();
  const onDocumentTypeMock = jest.fn();

  const saxParserOptionsMock: ISaxParserOptions = {
    onStartTag: (token) => onStartTagMock(cloneDeep(token)),
    onEndTag: (token) => onEndTagMock(cloneDeep(token)),
    onText: (token) => onTextMock(cloneDeep(token)),
    onComment: (token) => onCommentMock(cloneDeep(token)),
    onProcessingInstruction: (token) => onProcessingInstructionMock(cloneDeep(token)),
    onCdataSection: (token) => onCdataSectionMock(cloneDeep(token)),
    onDocumentType: (token) => onDocumentTypeMock(cloneDeep(token)),
  };

  beforeEach(() => {
    // This makes tests more strict than use of expect.objectContaining
    startTagToken.attributes = {length: 0};

    onStartTagMock.mockReset();
    onEndTagMock.mockReset();
    onTextMock.mockReset();
    onCommentMock.mockReset();
    onProcessingInstructionMock.mockReset();
    onCdataSectionMock.mockReset();
    onDocumentTypeMock.mockReset();
  });

  describe('in non-streaming mode', () => {

    it('parses text', () => {
      tokenize('aaa', false, 0, saxParserOptionsMock);

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

    it('parses the start tag without attrs', () => {
      tokenize('<a>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: {length: 0},
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
    });

    it('parses the start tag with attrs', () => {
      tokenize('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb">', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: {
          length: 3,
          0: {
            rawName: 'foo',
            name: 'foo',
            rawValue: undefined,
            value: undefined,
            quoted: false,
            start: 3,
            end: 6,
            nameStart: 3,
            nameEnd: 6,
            valueStart: -1,
            valueEnd: -1,
          },
          1: {
            rawName: 'bar',
            name: 'bar',
            rawValue: 'aaa"bbb',
            value: 'aaa"bbb',
            quoted: true,
            start: 7,
            end: 20,
            nameStart: 7,
            nameEnd: 10,
            valueStart: 12,
            valueEnd: 19,
          },
          2: {
            rawName: 'baz',
            name: 'baz',
            rawValue: 'aaa\'bbb',
            value: 'aaa\'bbb',
            quoted: true,
            start: 22,
            end: 35,
            nameStart: 22,
            nameEnd: 25,
            valueStart: 27,
            valueEnd: 34,
          },
        },
        selfClosing: false,
        start: 0,
        end: 36,
        nameStart: 1,
        nameEnd: 2,
      });
    });

    it('parses the start tag without attrs and with spaces before the greater-then char', () => {
      tokenize('<a   >', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: {length: 0},
        selfClosing: false,
        start: 0,
        end: 6,
        nameStart: 1,
        nameEnd: 2,
      });
    });

    it('parses the end tag', () => {
      tokenize('</a   >', false, 0, saxParserOptionsMock);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenCalledWith<[ITagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        start: 0,
        end: 7,
        nameStart: 2,
        nameEnd: 3,
      });
    });

    it('does not emit self-closing tags by default', () => {
      tokenize('<a/>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: {length: 0},
        selfClosing: false,
        start: 0,
        end: 4,
        nameStart: 1,
        nameEnd: 2,
      });

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('parses the self-closing tag without attrs', () => {
      tokenize('<a/>', false, 0, {
        ...saxParserOptionsMock,
        selfClosingEnabled: true,
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: {length: 0},
        selfClosing: true,
        start: 0,
        end: 4,
        nameStart: 1,
        nameEnd: 2,
      });

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('parses the self-closing tag with attrs', () => {
      tokenize('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb"  />', false, 0, {
        ...saxParserOptionsMock,
        selfClosingEnabled: true,
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: {
          length: 3,
          0: {
            rawName: 'foo',
            name: 'foo',
            rawValue: undefined,
            value: undefined,
            quoted: false,
            start: 3,
            end: 6,
            nameStart: 3,
            nameEnd: 6,
            valueStart: -1,
            valueEnd: -1,
          },
          1: {
            rawName: 'bar',
            name: 'bar',
            rawValue: 'aaa"bbb',
            value: 'aaa"bbb',
            quoted: true,
            start: 7,
            end: 20,
            nameStart: 7,
            nameEnd: 10,
            valueStart: 12,
            valueEnd: 19,
          },
          2: {
            rawName: 'baz',
            name: 'baz',
            rawValue: 'aaa\'bbb',
            value: 'aaa\'bbb',
            quoted: true,
            start: 22,
            end: 35,
            nameStart: 22,
            nameEnd: 25,
            valueStart: 27,
            valueEnd: 34,
          },
        },
        selfClosing: true,
        start: 0,
        end: 39,
        nameStart: 1,
        nameEnd: 2,
      });

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('does not parse self-closing tag with the unquoted attr that ends with a slash', () => {
      tokenize('<a foo=123//>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: {
          length: 1,
          0: {
            rawName: 'foo',
            name: 'foo',
            rawValue: '123//',
            value: '123//',
            quoted: false,
            start: 3,
            end: 12,
            nameStart: 3,
            nameEnd: 6,
            valueStart: 7,
            valueEnd: 12,
          },
        },
        selfClosing: false,
        start: 0,
        end: 13,
        nameStart: 1,
        nameEnd: 2,
      });

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('parses the start tag with the invalid syntax as a text', () => {
      tokenize('< a>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: '< a>',
        data: '< a>',
        start: 0,
        end: 4,
        dataStart: 0,
        dataEnd: 4,
      });
    });

    it('parses the start tag that start with the weird char as text', () => {
      tokenize('<@#$%*>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: '<@#$%*>',
        data: '<@#$%*>',
        start: 0,
        end: 7,
        dataStart: 0,
        dataEnd: 7,
      });
    });

    it('parses the start tag that contain weird chars and starts with the valid name char', () => {
      tokenize('<a@#$%*>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a@#$%*',
        tagName: 'a@#$%*',
        attributes: {length: 0},
        selfClosing: false,
        start: 0,
        end: 8,
        nameStart: 1,
        nameEnd: 7,
      });
    });

    it('parses the end tag with the invalid syntax as text', () => {
      tokenize('</ a>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: '</ a>',
        data: '</ a>',
        start: 0,
        end: 5,
        dataStart: 0,
        dataEnd: 5,
      });
    });

    it('ignores bullshit in closing tags', () => {
      tokenize('</a @#$%*/>', false, 0, saxParserOptionsMock);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenCalledWith<[ITagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        start: 0,
        end: 11,
        nameStart: 2,
        nameEnd: 3,
      });
    });

    it('parses the trailing text', () => {
      tokenize('<a>okay', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: {length: 0},
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'okay',
        data: 'okay',
        start: 3,
        end: 7,
        dataStart: 3,
        dataEnd: 7,
      });
    });

    it('malformed tag becomes part of text', () => {
      tokenize('aaa< /a>bbb<b>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'aaa< /a>bbb',
        data: 'aaa< /a>bbb',
        start: 0,
        end: 11,
        dataStart: 0,
        dataEnd: 11,
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'b',
        tagName: 'b',
        attributes: {length: 0},
        selfClosing: false,
        start: 11,
        end: 14,
        nameStart: 12,
        nameEnd: 13,
      });
    });

    it('emits start tag with attrs', () => {
      tokenize('<a foo bar=eee>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: {
          length: 2,
          0: {
            rawName: 'foo',
            name: 'foo',
            rawValue: undefined,
            value: undefined,
            quoted: false,
            start: 3,
            end: 6,
            nameStart: 3,
            nameEnd: 6,
            valueStart: -1,
            valueEnd: -1,
          },
          1: {
            rawName: 'bar',
            name: 'bar',
            rawValue: 'eee',
            value: 'eee',
            quoted: false,
            start: 7,
            end: 14,
            nameStart: 7,
            nameEnd: 10,
            valueStart: 11,
            valueEnd: 14,
          },
        },
        selfClosing: false,
        start: 0,
        end: 15,
        nameStart: 1,
        nameEnd: 2,
      });
    });

    it('parses terminated XML comments', () => {
      tokenize('<!--foo-->', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'foo',
        data: 'foo',
        start: 0,
        end: 10,
        dataStart: 4,
        dataEnd: 7,
      });
    });

    it('parses unterminated XML comments', () => {
      tokenize('<!--foo', false, 0, saxParserOptionsMock);

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

    it('parses terminated HTML comments', () => {
      tokenize('<!foo>', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'foo',
        data: 'foo',
        start: 0,
        end: 6,
        dataStart: 2,
        dataEnd: 5,
      });
    });

    it('parses unterminated HTML comments', () => {
      tokenize('<!foo', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'foo',
        data: 'foo',
        start: 0,
        end: 5,
        dataStart: 2,
        dataEnd: 5,
      });
    });

    it('parses HTML comments as text in XML mode', () => {
      tokenize('<!foo>', false, 0, {...saxParserOptionsMock, xmlEnabled: true});

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: '<!foo>',
        data: '<!foo>',
        start: 0,
        end: 6,
        dataStart: 0,
        dataEnd: 6,
      });
    });

    it('parses XML comments that contain minuses', () => {
      tokenize('<!-- foo---->', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: ' foo--',
        data: ' foo--',
        start: 0,
        end: 13,
        dataStart: 4,
        dataEnd: 10,
      });
    });

    it('parses processing instructions in XML mode', () => {
      tokenize('<?xml version="1.0"?>', false, 0, {xmlEnabled: true, ...saxParserOptionsMock});

      expect(onProcessingInstructionMock).toHaveBeenCalledTimes(1);
      expect(onProcessingInstructionMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'xml version="1.0"',
        data: 'xml version="1.0"',
        start: 0,
        end: 21,
        dataStart: 2,
        dataEnd: 19,
      });
    });

    it('parses terminated processing instructions as comments', () => {
      tokenize('<?xml version="1.0"?>', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: '?xml version="1.0"?',
        data: '?xml version="1.0"?',
        start: 0,
        end: 21,
        dataStart: 1,
        dataEnd: 20,
      });
    });

    it('parses unterminated processing instructions as comments', () => {
      tokenize('<?xml version="1.0"', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: '?xml version="1.0"',
        data: '?xml version="1.0"',
        start: 0,
        end: 19,
        dataStart: 1,
        dataEnd: 19,
      });
    });

    it('parses CDATA blocks in XML mode', () => {
      tokenize('<![CDATA[hello]]>', false, 0, {xmlEnabled: true, ...saxParserOptionsMock});

      expect(onCdataSectionMock).toHaveBeenCalledTimes(1);
      expect(onCdataSectionMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'hello',
        data: 'hello',
        start: 0,
        end: 17,
        dataStart: 9,
        dataEnd: 14,
      });
    });

    it('parses CDATA blocks as comments', () => {
      tokenize('<![CDATA[hello]]>', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: '[CDATA[hello]]',
        data: '[CDATA[hello]]',
        start: 0,
        end: 17,
        dataStart: 2,
        dataEnd: 16,
      });
    });

    it('parses doctype', () => {
      tokenize('<!DOCTYPE html>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: ' html',
        data: ' html',
        start: 0,
        end: 15,
        dataStart: 9,
        dataEnd: 14,
      });
    });

    it('parses doctype without spaces', () => {
      tokenize('<!DOCTYPEhtml>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: 'html',
        data: 'html',
        start: 0,
        end: 14,
        dataStart: 9,
        dataEnd: 13,
      });
    });

    it('parses doctype without value', () => {
      tokenize('<!DOCTYPE>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: '',
        data: '',
        start: 0,
        end: 10,
        dataStart: 9,
        dataEnd: 9,
      });
    });

    it('does not parse DTD', () => {
      tokenize('<!DOCTYPE greeting [<!ELEMENT greeting (#PCDATA)>]>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: ' greeting [<!ELEMENT greeting (#PCDATA)',
        data: ' greeting [<!ELEMENT greeting (#PCDATA)',
        start: 0,
        end: 49,
        dataStart: 9,
        dataEnd: 48,
      });

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenCalledWith<[IDataToken]>({
        rawData: ']>',
        data: ']>',
        start: 49,
        end: 51,
        dataStart: 49,
        dataEnd: 51,
      });
    });

    it('can enforce case-insensitive CDATA tags in HTML mode', () => {
      tokenize('<script><foo aaa=111></SCRIPT>', false, 0, {
        ...saxParserOptionsMock,
        isTextContent: (token) => token.tagName === 'script',
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'script',
        tagName: 'script',
        attributes: {length: 0},
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
        rawTagName: 'SCRIPT',
        tagName: 'script',
        start: 21,
        end: 30,
        nameStart: 23,
        nameEnd: 29,
      });
    });

    it('CDATA tags are case-sensitive in XML mode', () => {
      tokenize('<script><foo aaa=111></SCRIPT>', false, 0, {
        ...saxParserOptionsMock,
        xmlEnabled: true,
        isTextContent: (token) => token.tagName === 'script',
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'script',
        tagName: 'script',
        attributes: {length: 0},
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

    it('can enforce CDATA in self-closing tags', () => {
      tokenize('<script/><foo>', false, 0, {
        ...saxParserOptionsMock,
        selfClosingEnabled: true,
        isTextContent: (token) => token.tagName === 'script',
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(1, {
        rawTagName: 'script',
        tagName: 'script',
        attributes: {length: 0},
        selfClosing: true,
        start: 0,
        end: 9,
        nameStart: 1,
        nameEnd: 7,
      });
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(2, {
        rawTagName: 'foo',
        tagName: 'foo',
        attributes: {length: 0},
        selfClosing: false,
        start: 9,
        end: 14,
        nameStart: 10,
        nameEnd: 13,
      });

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('can rewrite tag names', () => {
      tokenize('<foo><bar>', false, 0, {
        ...saxParserOptionsMock,
        renameTag: (tagName) => tagName.toUpperCase(),
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(1, {
        rawTagName: 'foo',
        tagName: 'FOO',
        attributes: {length: 0},
        selfClosing: false,
        start: 0,
        end: 5,
        nameStart: 1,
        nameEnd: 4,
      });
      expect(onStartTagMock).toHaveBeenNthCalledWith<[IStartTagToken]>(2, {
        rawTagName: 'bar',
        tagName: 'BAR',
        attributes: {length: 0},
        selfClosing: false,
        start: 5,
        end: 10,
        nameStart: 6,
        nameEnd: 9,
      });
    });

    it('can rewrite attr names', () => {
      tokenize('<foo aaa=111 bbb=222>', false, 0, {...saxParserOptionsMock, renameAttr: (name) => name.toUpperCase()});

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'foo',
        tagName: 'foo',
        attributes: {
          length: 2,
          0: {
            rawName: 'aaa',
            name: 'AAA',
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
          1: {
            rawName: 'bbb',
            name: 'BBB',
            rawValue: '222',
            value: '222',
            quoted: false,
            start: 13,
            end: 20,
            nameStart: 13,
            nameEnd: 16,
            valueStart: 17,
            valueEnd: 20,
          },
        },
        selfClosing: false,
        start: 0,
        end: 21,
        nameStart: 1,
        nameEnd: 4,
      });
    });
  });

  describe('in streaming mode', () => {

    it('parses the start tag without attrs', () => {
      tokenize('<a>', true, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: {length: 0},
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });
    });

    it('does not emit the trailing text', () => {
      tokenize('<a>okay', true, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenCalledWith<[IStartTagToken]>({
        rawTagName: 'a',
        tagName: 'a',
        attributes: {length: 0},
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
      });

      expect(onTextMock).not.toHaveBeenCalled();
    });

    it('does not emit unterminated XML comments', () => {
      tokenize('<!--foo', true, 0, saxParserOptionsMock);
      expect(onCommentMock).not.toHaveBeenCalled();
    });

    it('does not emit unterminated HTML comments', () => {
      tokenize('<!foo', true, 0, saxParserOptionsMock);
      expect(onCommentMock).not.toHaveBeenCalled();
    });

    it('does not emit unterminated processing instructions as comments', () => {
      tokenize('<?xml version="1.0"', true, 0, saxParserOptionsMock);
      expect(onCommentMock).not.toHaveBeenCalled();
    });
  });
});
