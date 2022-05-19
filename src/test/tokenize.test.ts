import {ITokenizerOptions, tokenize, tokenizeAttributes} from '../main/tokenize';
import {ObjectPool} from '@smikhalevski/object-pool';
import {clone, createAttributeToken, createDataToken, createEndTagToken, createStartTagToken} from '../main/tokens';
import {
  IArrayLike,
  IAttributeToken,
  ICdataSectionToken,
  ICommentToken,
  IDataToken,
  IDoctypeToken,
  IEndTagToken,
  IParserOptions,
  IProcessingInstructionToken,
  ISaxHandler,
  IStartTagToken,
  ITextToken,
  TokenType,
} from '../main/parser-types';

const startTagMock = jest.fn();
const endTagMock = jest.fn();
const textMock = jest.fn();
const commentMock = jest.fn();
const processingInstructionMock = jest.fn();
const cdataMock = jest.fn();
const doctypeMock = jest.fn();

let tokenizerOptions: ITokenizerOptions;
let parserOptions: IParserOptions;
let handler: ISaxHandler;

function toArrayLike<T>(arr: Array<T>): IArrayLike<T> {
  const arrLike: IArrayLike<T> = {length: arr.length};
  for (let i = 0; i < arr.length; ++i) {
    arrLike[i] = arr[i];
  }
  return arrLike;
}

beforeEach(() => {

  tokenizerOptions = {
    startTagTokenPool: new ObjectPool(createStartTagToken),
    attributeTokenPool: new ObjectPool(createAttributeToken),
    endTagToken: createEndTagToken(),
    dataToken: createDataToken(),
  };

  parserOptions = {};

  handler = {
    startTag: (token) => startTagMock(token.clone()),
    endTag: (token) => endTagMock(token.clone()),
    text: (token) => textMock(token.clone()),
    comment: (token) => commentMock(token.clone()),
    doctype: (token) => doctypeMock(token.clone()),
    processingInstruction: (token) => processingInstructionMock(token.clone()),
    cdata: (token) => cdataMock(token.clone()),
  };

  startTagMock.mockReset();
  endTagMock.mockReset();
  textMock.mockReset();
  commentMock.mockReset();
  processingInstructionMock.mockReset();
  cdataMock.mockReset();
  doctypeMock.mockReset();
});

describe('tokenizeAttributes', () => {

  let attributes: IArrayLike<IAttributeToken>;

  beforeEach(() => {
    attributes = {length: 0};
  });

  it('reads a double quoted attribute', () => {
    expect(tokenizeAttributes('aaa="111"', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(9);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('reads a single quoted attribute', () => {
    expect(tokenizeAttributes('aaa=\'111\'', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(9);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('reads an unquoted attribute', () => {
    expect(tokenizeAttributes('aaa=111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(7);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('reads a mix of quoted attributes separated by spaces', () => {
    expect(tokenizeAttributes('aaa=111 bbb="222" ccc=\'333\'', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(27);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('reads quoted attributes separated by slashes', () => {
    expect(tokenizeAttributes('aaa="111"//bbb=\'222\'//', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(20);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('reads non-separated quoted attributes', () => {
    expect(tokenizeAttributes('aaa="111"bbb=\'222\'', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(18);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('reads an attribute without the value', () => {
    expect(tokenizeAttributes('aaa', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(3);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('reads an attribute with an equals char and without the value', () => {
    expect(tokenizeAttributes('aaa=', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(4);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('treats the slash char as the whitespace in the attribute name', () => {
    expect(tokenizeAttributes('aaa/bbb="222"', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(13);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('ignores leading slashes', () => {
    expect(tokenizeAttributes('//aaa=111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(9);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('ignores leading space chars', () => {
    expect(tokenizeAttributes(' \taaa=111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(9);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('trailing slashes are the part of the unquoted attribute value', () => {
    expect(tokenizeAttributes('aaa=111//', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(9);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('trailing slashes are treated as an unquoted value', () => {
    expect(tokenizeAttributes('aaa=//', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(6);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('trailing slashes after the quoted value are ignored', () => {
    expect(tokenizeAttributes('aaa="111"//', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(9);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('trailing slash without the preceding equals char is ignored', () => {
    expect(tokenizeAttributes('aaa/', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(3);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('ignores trailing spaces', () => {
    expect(tokenizeAttributes('aaa=111  ', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(7);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('ignores spaces around the equals char', () => {
    expect(tokenizeAttributes('aaa  =  111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(11);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('treats the equals char as the part of the attribute value', () => {
    expect(tokenizeAttributes('aaa=111=111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(11);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('treats the quote char as the part of the attribute value', () => {
    expect(tokenizeAttributes('aaa=111"111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(11);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('treats single quot as the part of the attribute value', () => {
    expect(tokenizeAttributes('aaa=111\'111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(11);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('treats slash followed by the equals char as the part of the attribute value', () => {
    expect(tokenizeAttributes('aaa=111/=111 bbb=222', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(20);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('treats leading quotes as the part of the attribute name', () => {
    expect(tokenizeAttributes('""""aaa=111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(11);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('treats trailing quotes as the part of the attribute name', () => {
    expect(tokenizeAttributes('aaa=""""""bbb=222', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(17);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('reads the attribute with the weird name', () => {
    expect(tokenizeAttributes('@#$%*=000', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(9);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('reads the attribute that starts with the less-than char', () => {
    expect(tokenizeAttributes('<=000', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(5);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('does not read after the greater-than char', () => {
    expect(tokenizeAttributes('  >aaa=111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(0);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([]));
  });

  it('decodes the attribute value', () => {
    parserOptions.decodeAttribute = () => '222222';

    expect(tokenizeAttributes('aaa=111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(7);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('renames the attribute', () => {
    parserOptions.renameAttribute = () => 'bbbbbb';

    expect(tokenizeAttributes('aaa=111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(7);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('respects offset', () => {
    expect(tokenizeAttributes('aaa=111', 0, 5, attributes, tokenizerOptions, parserOptions)).toBe(7);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });

  it('cleans up the array-like object', () => {

    attributes = toArrayLike([
      {tokenType: TokenType.ATTRIBUTE, clone} as unknown as IAttributeToken,
      {tokenType: TokenType.ATTRIBUTE, clone} as unknown as IAttributeToken,
      {tokenType: TokenType.ATTRIBUTE, clone} as unknown as IAttributeToken,
    ]);

    expect(tokenizeAttributes('aaa=111', 0, 0, attributes, tokenizerOptions, parserOptions)).toBe(7);
    expect(attributes).toEqual(toArrayLike<IAttributeToken>([
      {
        tokenType: TokenType.ATTRIBUTE,
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
        clone,
      },
    ]));
  });
});

describe('tokenize', () => {

  describe('in non-streaming mode', () => {

    it('parses text', () => {
      tokenize('aaa', false, 0, tokenizerOptions, parserOptions, handler);

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<ITextToken>{
        tokenType: TokenType.TEXT,
        rawData: 'aaa',
        data: 'aaa',
        start: 0,
        end: 3,
        dataStart: 0,
        dataEnd: 3,
        clone,
      });
    });

    it('parses the start tag without attributes', () => {
      tokenize('<a>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a',
        name: 'a',
        attributes: toArrayLike([]),
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
        clone,
      });
    });

    it('parses the start tag with attributes', () => {
      tokenize('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb">', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a',
        name: 'a',
        attributes: toArrayLike<IAttributeToken>([
          {
            tokenType: TokenType.ATTRIBUTE,
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
            clone,
          },
          {
            tokenType: TokenType.ATTRIBUTE,
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
            clone,
          },
          {
            tokenType: TokenType.ATTRIBUTE,
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
            clone,
          },
        ]),
        selfClosing: false,
        start: 0,
        end: 36,
        nameStart: 1,
        nameEnd: 2,
        clone,
      });
    });

    it('parses the start tag without attributes and with spaces before the greater-then char', () => {
      tokenize('<a   >', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a',
        name: 'a',
        attributes: toArrayLike([]),
        selfClosing: false,
        start: 0,
        end: 6,
        nameStart: 1,
        nameEnd: 2,
        clone,
      });
    });

    it('parses the end tag', () => {
      tokenize('</a   >', false, 0, tokenizerOptions, parserOptions, handler);

      expect(endTagMock).toHaveBeenCalledTimes(1);
      expect(endTagMock).toHaveBeenCalledWith(<IEndTagToken>{
        tokenType: TokenType.END_TAG,
        rawName: 'a',
        name: 'a',
        start: 0,
        end: 7,
        nameStart: 2,
        nameEnd: 3,
        clone,
      });
    });

    it('does not emit self-closing tags by default', () => {
      tokenize('<a/>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a',
        name: 'a',
        attributes: toArrayLike([]),
        selfClosing: false,
        start: 0,
        end: 4,
        nameStart: 1,
        nameEnd: 2,
        clone,
      });

      expect(endTagMock).not.toHaveBeenCalled();
    });

    it('parses the self-closing tag without attributes', () => {
      parserOptions.selfClosingEnabled = true;

      tokenize('<a/>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a',
        name: 'a',
        attributes: toArrayLike([]),
        selfClosing: true,
        start: 0,
        end: 4,
        nameStart: 1,
        nameEnd: 2,
        clone,
      });

      expect(endTagMock).not.toHaveBeenCalled();
    });

    it('parses the self-closing tag with attributes', () => {
      parserOptions.selfClosingEnabled = true;

      tokenize('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb"  />', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a',
        name: 'a',
        attributes: toArrayLike<IAttributeToken>([
          {
            tokenType: TokenType.ATTRIBUTE,
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
            clone,
          },
          {
            tokenType: TokenType.ATTRIBUTE,
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
            clone,
          },
          {
            tokenType: TokenType.ATTRIBUTE,
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
            clone,
          },
        ]),
        selfClosing: true,
        start: 0,
        end: 39,
        nameStart: 1,
        nameEnd: 2,
        clone,
      });

      expect(endTagMock).not.toHaveBeenCalled();
    });

    it('does not parse self-closing tag with the unquoted attribute that ends with a slash', () => {
      tokenize('<a foo=123//>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a',
        name: 'a',
        attributes: toArrayLike<IAttributeToken>([
          {
            tokenType: TokenType.ATTRIBUTE,
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
            clone,
          },
        ]),
        selfClosing: false,
        start: 0,
        end: 13,
        nameStart: 1,
        nameEnd: 2,
        clone,
      });

      expect(endTagMock).not.toHaveBeenCalled();
    });

    it('parses the start tag with the invalid syntax as a text', () => {
      tokenize('< a>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<ITextToken>{
        tokenType: TokenType.TEXT,
        rawData: '< a>',
        data: '< a>',
        start: 0,
        end: 4,
        dataStart: 0,
        dataEnd: 4,
        clone,
      });
    });

    it('parses the start tag that starts with the weird char as text', () => {
      tokenize('<@#$%*>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<ITextToken>{
        tokenType: TokenType.TEXT,
        rawData: '<@#$%*>',
        data: '<@#$%*>',
        start: 0,
        end: 7,
        dataStart: 0,
        dataEnd: 7,
        clone,
      });
    });

    it('parses the start tag that contain weird chars and starts with the valid name char', () => {
      tokenize('<a@#$%*>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a@#$%*',
        name: 'a@#$%*',
        attributes: toArrayLike([]),
        selfClosing: false,
        start: 0,
        end: 8,
        nameStart: 1,
        nameEnd: 7,
        clone,
      });
    });

    it('parses the end tag with the invalid syntax as text', () => {
      tokenize('</ a>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<ITextToken>{
        tokenType: TokenType.TEXT,
        rawData: '</ a>',
        data: '</ a>',
        start: 0,
        end: 5,
        dataStart: 0,
        dataEnd: 5,
        clone,
      });
    });

    it('ignores bullshit in closing tags', () => {
      tokenize('</a @#$%*/>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(endTagMock).toHaveBeenCalledTimes(1);
      expect(endTagMock).toHaveBeenCalledWith(<IEndTagToken>{
        tokenType: TokenType.END_TAG,
        rawName: 'a',
        name: 'a',
        start: 0,
        end: 11,
        nameStart: 2,
        nameEnd: 3,
        clone,
      });
    });

    it('parses the trailing text', () => {
      tokenize('<a>okay', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a',
        name: 'a',
        attributes: toArrayLike([]),
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
        clone,
      });

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<ITextToken>{
        tokenType: TokenType.TEXT,
        rawData: 'okay',
        data: 'okay',
        start: 3,
        end: 7,
        dataStart: 3,
        dataEnd: 7,
        clone,
      });
    });

    it('malformed tag becomes part of text', () => {
      tokenize('aaa< /a>bbb<b>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<ITextToken>{
        tokenType: TokenType.TEXT,
        rawData: 'aaa< /a>bbb',
        data: 'aaa< /a>bbb',
        start: 0,
        end: 11,
        dataStart: 0,
        dataEnd: 11,
        clone,
      });

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'b',
        name: 'b',
        attributes: toArrayLike([]),
        selfClosing: false,
        start: 11,
        end: 14,
        nameStart: 12,
        nameEnd: 13,
        clone,
      });
    });

    it('emits start tag with attributes', () => {
      tokenize('<a foo bar=eee>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a',
        name: 'a',
        attributes: toArrayLike<IAttributeToken>([
          {
            tokenType: TokenType.ATTRIBUTE,
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
            clone,
          },
          {
            tokenType: TokenType.ATTRIBUTE,
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
            clone,
          },
        ]),
        selfClosing: false,
        start: 0,
        end: 15,
        nameStart: 1,
        nameEnd: 2,
        clone,
      });
    });

    it('parses terminated XML comments', () => {
      tokenize('<!--foo-->', false, 0, tokenizerOptions, parserOptions, handler);

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<ICommentToken>{
        tokenType: TokenType.COMMENT,
        rawData: 'foo',
        data: 'foo',
        start: 0,
        end: 10,
        dataStart: 4,
        dataEnd: 7,
        clone,
      });
    });

    it('parses unterminated XML comments', () => {
      tokenize('<!--foo', false, 0, tokenizerOptions, parserOptions, handler);

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<ICommentToken>{
        tokenType: TokenType.COMMENT,
        rawData: 'foo',
        data: 'foo',
        start: 0,
        end: 7,
        dataStart: 4,
        dataEnd: 7,
        clone,
      });
    });

    it('parses DTD as comments when CDATA sections are disabled', () => {
      parserOptions.cdataEnabled = false;

      tokenize('<!foo>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<ICommentToken>{
        tokenType: TokenType.COMMENT,
        rawData: 'foo',
        data: 'foo',
        start: 0,
        end: 6,
        dataStart: 2,
        dataEnd: 5,
        clone,
      });
    });

    it('parses incomplete DTD as comments when CDATA sections are disabled', () => {
      parserOptions.cdataEnabled = false;

      tokenize('<!foo', false, 0, tokenizerOptions, parserOptions, handler);

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<ICommentToken>{
        tokenType: TokenType.COMMENT,
        rawData: 'foo',
        data: 'foo',
        start: 0,
        end: 5,
        dataStart: 2,
        dataEnd: 5,
        clone,
      });
    });

    it('ignores DTD when CDATA is enabled', () => {
      parserOptions.cdataEnabled = true;

      tokenize('<!foo>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(commentMock).not.toHaveBeenCalledTimes(1);
      expect(textMock).not.toHaveBeenCalledTimes(1);
    });

    it('parses XML comments that contain minuses', () => {
      tokenize('<!-- foo---->', false, 0, tokenizerOptions, parserOptions, handler);

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<ICommentToken>{
        tokenType: TokenType.COMMENT,
        rawData: ' foo--',
        data: ' foo--',
        start: 0,
        end: 13,
        dataStart: 4,
        dataEnd: 10,
        clone,
      });
    });

    it('parses processing instructions', () => {
      parserOptions.processingInstructionsEnabled = true;

      tokenize('<?xml version="1.0"?>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(processingInstructionMock).toHaveBeenCalledTimes(1);
      expect(processingInstructionMock).toHaveBeenCalledWith(<IProcessingInstructionToken>{
        tokenType: TokenType.PROCESSING_INSTRUCTION,
        rawData: 'xml version="1.0"',
        data: 'xml version="1.0"',
        start: 0,
        end: 21,
        dataStart: 2,
        dataEnd: 19,
        clone,
      });
    });

    it('parses terminated processing instructions as comments', () => {
      tokenize('<?xml version="1.0"?>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<ICommentToken>{
        tokenType: TokenType.COMMENT,
        rawData: '?xml version="1.0"?',
        data: '?xml version="1.0"?',
        start: 0,
        end: 21,
        dataStart: 1,
        dataEnd: 20,
        clone,
      });
    });

    it('parses unterminated processing instructions as comments', () => {
      tokenize('<?xml version="1.0"', false, 0, tokenizerOptions, parserOptions, handler);

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<ICommentToken>{
        tokenType: TokenType.COMMENT,
        rawData: '?xml version="1.0"',
        data: '?xml version="1.0"',
        start: 0,
        end: 19,
        dataStart: 1,
        dataEnd: 19,
        clone,
      });
    });

    it('parses CDATA sections', () => {
      parserOptions.cdataEnabled = true;

      tokenize('<![CDATA[hello]]>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(cdataMock).toHaveBeenCalledTimes(1);
      expect(cdataMock).toHaveBeenCalledWith(<ICdataSectionToken>{
        tokenType: TokenType.CDATA_SECTION,
        rawData: 'hello',
        data: 'hello',
        start: 0,
        end: 17,
        dataStart: 9,
        dataEnd: 14,
        clone,
      });
    });

    it('parses CDATA sections as comments', () => {
      tokenize('<![CDATA[hello]]>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(commentMock).toHaveBeenCalledTimes(1);
      expect(commentMock).toHaveBeenCalledWith(<ICommentToken>{
        tokenType: TokenType.COMMENT,
        rawData: '[CDATA[hello]]',
        data: '[CDATA[hello]]',
        start: 0,
        end: 17,
        dataStart: 2,
        dataEnd: 16,
        clone,
      });
    });

    it('parses doctype', () => {
        tokenize('<!DOCTYPE html>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(doctypeMock).toHaveBeenCalledTimes(1);
      expect(doctypeMock).toHaveBeenCalledWith(<IDoctypeToken>{
        tokenType: TokenType.DOCTYPE,
        rawData: ' html',
        data: ' html',
        start: 0,
        end: 15,
        dataStart: 9,
        dataEnd: 14,
        clone,
      });
    });

    it('parses doctype without spaces', () => {
      tokenize('<!DOCTYPEhtml>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(doctypeMock).toHaveBeenCalledTimes(1);
      expect(doctypeMock).toHaveBeenCalledWith(<IDoctypeToken>{
        tokenType: TokenType.DOCTYPE,
        rawData: 'html',
        data: 'html',
        start: 0,
        end: 14,
        dataStart: 9,
        dataEnd: 13,
        clone,
      });
    });

    it('parses doctype without value', () => {
      tokenize('<!DOCTYPE>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(doctypeMock).toHaveBeenCalledTimes(1);
      expect(doctypeMock).toHaveBeenCalledWith(<IDataToken>{
        tokenType: TokenType.DOCTYPE,
        rawData: '',
        data: '',
        start: 0,
        end: 10,
        dataStart: 9,
        dataEnd: 9,
        clone,
      });
    });

    it('does not parse DTD', () => {
      tokenize('<!DOCTYPE greeting [<!ELEMENT greeting (#PCDATA)>]>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(doctypeMock).toHaveBeenCalledTimes(1);
      expect(doctypeMock).toHaveBeenCalledWith(<IDoctypeToken>{
        tokenType: TokenType.DOCTYPE,
        rawData: ' greeting [<!ELEMENT greeting (#PCDATA)',
        data: ' greeting [<!ELEMENT greeting (#PCDATA)',
        start: 0,
        end: 49,
        dataStart: 9,
        dataEnd: 48,
        clone,
      });

      expect(textMock).toHaveBeenCalledTimes(1);
      expect(textMock).toHaveBeenCalledWith(<ITextToken>{
        tokenType: TokenType.TEXT,
        rawData: ']>',
        data: ']>',
        start: 49,
        end: 51,
        dataStart: 49,
        dataEnd: 51,
        clone,
      });
    });

    it('parses self-closing CDATA tags', () => {
      parserOptions.selfClosingEnabled = true;
      parserOptions.checkCdataTag = (token) => token.name === 'script';

      tokenize('<script/><foo>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(2);
      expect(startTagMock).toHaveBeenNthCalledWith(1, <IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'script',
        name: 'script',
        attributes: toArrayLike([]),
        selfClosing: true,
        start: 0,
        end: 9,
        nameStart: 1,
        nameEnd: 7,
        clone,
      });
      expect(startTagMock).toHaveBeenNthCalledWith(2, <IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'foo',
        name: 'foo',
        attributes: toArrayLike([]),
        selfClosing: false,
        start: 9,
        end: 14,
        nameStart: 10,
        nameEnd: 13,
        clone,
      });

      expect(endTagMock).not.toHaveBeenCalled();
    });

    it('can rewrite tag names', () => {
      parserOptions.renameTag = (name) => name.toUpperCase();

      tokenize('<foo><bar>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(2);
      expect(startTagMock).toHaveBeenNthCalledWith(1, <IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'foo',
        name: 'FOO',
        attributes: toArrayLike([]),
        selfClosing: false,
        start: 0,
        end: 5,
        nameStart: 1,
        nameEnd: 4,
        clone,
      });
      expect(startTagMock).toHaveBeenNthCalledWith(2, <IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'bar',
        name: 'BAR',
        attributes: toArrayLike([]),
        selfClosing: false,
        start: 5,
        end: 10,
        nameStart: 6,
        nameEnd: 9,
        clone,
      });
    });

    it('can rewrite attribute names', () => {
      parserOptions.renameAttribute = (name) => name.toUpperCase();

      tokenize('<foo aaa=111 bbb=222>', false, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'foo',
        name: 'foo',
        attributes: toArrayLike<IAttributeToken>([
          {
            tokenType: TokenType.ATTRIBUTE,
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
            clone,
          },
          {
            tokenType: TokenType.ATTRIBUTE,
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
            clone,
          },
        ]),
        selfClosing: false,
        start: 0,
        end: 21,
        nameStart: 1,
        nameEnd: 4,
        clone,
      });
    });
  });

  describe('in streaming mode', () => {

    it('parses the start tag without attributes', () => {
      tokenize('<a>', true, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a',
        name: 'a',
        attributes: toArrayLike([]),
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
        clone,
      });
    });

    it('does not emit the trailing text', () => {
      tokenize('<a>okay', true, 0, tokenizerOptions, parserOptions, handler);

      expect(startTagMock).toHaveBeenCalledTimes(1);
      expect(startTagMock).toHaveBeenCalledWith(<IStartTagToken>{
        tokenType: TokenType.START_TAG,
        rawName: 'a',
        name: 'a',
        attributes: toArrayLike([]),
        selfClosing: false,
        start: 0,
        end: 3,
        nameStart: 1,
        nameEnd: 2,
        clone,
      });

      expect(textMock).not.toHaveBeenCalled();
    });

    it('does not emit unterminated XML comments', () => {
      tokenize('<!--foo', true, 0, tokenizerOptions, parserOptions, handler);
      expect(commentMock).not.toHaveBeenCalled();
    });

    it('does not emit unterminated DTD when CDATA is disabled', () => {
      tokenize('<!foo', true, 0, tokenizerOptions, parserOptions, handler);
      expect(commentMock).not.toHaveBeenCalled();
    });

    it('does not emit unterminated processing instructions as comments', () => {
      tokenize('<?xml version="1.0"', true, 0, tokenizerOptions, parserOptions, handler);
      expect(commentMock).not.toHaveBeenCalled();
    });
  });
});
