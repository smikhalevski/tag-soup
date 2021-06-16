import {identity, tokenize, tokenizeAttrs} from '../main/tokenize';
import {IAttributeToken, ISaxParserOptions} from '../main/createSaxParser';

describe('parseAttrs', () => {

  let attrs: Array<IAttributeToken>;

  beforeEach(() => {
    attrs = [];
  });

  it('reads a double quoted attr', () => {
    expect(tokenizeAttrs('aaa="111"', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 9},
    ]);
  });

  it('reads a single quoted attr', () => {
    expect(tokenizeAttrs('aaa=\'111\'', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 9},
    ]);
  });

  it('reads an unquoted attr', () => {
    expect(tokenizeAttrs('aaa=111', 0, attrs, identity, identity)).toBe(7);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 7},
    ]);
  });

  it('reads mixed attrs separated by spaces', () => {
    expect(tokenizeAttrs('aaa=111 bbb="222" ccc=\'333\'', 0, attrs, identity, identity)).toBe(27);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 7},
      {name: 'bbb', value: '222', start: 8, end: 17},
      {name: 'ccc', value: '333', start: 18, end: 27},
    ]);
  });

  it('reads quoted attrs separated by slashes', () => {
    expect(tokenizeAttrs('aaa="111"//bbb=\'222\'//', 0, attrs, identity, identity)).toBe(20);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 9},
      {name: 'bbb', value: '222', start: 11, end: 20},
    ]);
  });

  it('reads non-separated quoted attrs', () => {
    expect(tokenizeAttrs('aaa="111"bbb=\'222\'', 0, attrs, identity, identity)).toBe(18);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 9},
      {name: 'bbb', value: '222', start: 9, end: 18},
    ]);
  });

  it('reads an attr without the value', () => {
    expect(tokenizeAttrs('aaa', 0, attrs, identity, identity)).toBe(3);
    expect(attrs).toEqual([
      {name: 'aaa', value: '', start: 0, end: 3},
    ]);
  });

  it('reads a attr with an equals char and without the value', () => {
    expect(tokenizeAttrs('aaa=', 0, attrs, identity, identity)).toBe(4);
    expect(attrs).toEqual([
      {name: 'aaa', value: '', start: 0, end: 4},
    ]);
  });

  it('treats the slash char as the whitespace in the attr name', () => {
    expect(tokenizeAttrs('aaa/bbb="222"', 0, attrs, identity, identity)).toBe(13);
    expect(attrs).toEqual([
      {name: 'aaa', value: '', start: 0, end: 3},
      {name: 'bbb', value: '222', start: 4, end: 13},
    ]);
  });

  it('ignores leading slashes', () => {
    expect(tokenizeAttrs('//aaa=111', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 2, end: 9},
    ]);
  });

  it('ignores leading space chars', () => {
    expect(tokenizeAttrs(' \taaa=111', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 2, end: 9},
    ]);
  });

  it('trailing slashes are the part of the unquoted attr value', () => {
    expect(tokenizeAttrs('aaa=111//', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111//', start: 0, end: 9},
    ]);
  });

  it('trailing slashes are treated as an unquoted value', () => {
    expect(tokenizeAttrs('aaa=//', 0, attrs, identity, identity)).toBe(6);
    expect(attrs).toEqual([
      {name: 'aaa', value: '//', start: 0, end: 6},
    ]);
  });

  it('trailing slashes after the quoted value are ignored', () => {
    expect(tokenizeAttrs('aaa="111"//', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 9},
    ]);
  });

  it('trailing slash without the preceding equals char is ignored', () => {
    expect(tokenizeAttrs('aaa/', 0, attrs, identity, identity)).toBe(3);
    expect(attrs).toEqual([
      {name: 'aaa', value: '', start: 0, end: 3},
    ]);
  });

  it('ignores training spaces', () => {
    expect(tokenizeAttrs('aaa=111  ', 0, attrs, identity, identity)).toBe(7);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 7},
    ]);
  });

  it('ignores spaces around the equals char', () => {
    expect(tokenizeAttrs('aaa  =  111', 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 11},
    ]);
  });

  it('treats the equals char as the part of the attr value', () => {
    expect(tokenizeAttrs('aaa=111=111', 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111=111', start: 0, end: 11},
    ]);
  });

  it('treats the quote char as the part of the attr value', () => {
    expect(tokenizeAttrs('aaa=111"111', 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111"111', start: 0, end: 11},
    ]);
  });

  it('treats single quot as the part of attr value', () => {
    expect(tokenizeAttrs('aaa=111\'111', 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111\'111', start: 0, end: 11},
    ]);
  });

  it('treats slash followed by the equals char as the part of the attr value', () => {
    expect(tokenizeAttrs('aaa=111/=111 bbb=222', 0, attrs, identity, identity)).toBe(20);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111/=111', start: 0, end: 12},
      {name: 'bbb', value: '222', start: 13, end: 20},
    ]);
  });

  it('treats leading quotes as the part of the attr name', () => {
    expect(tokenizeAttrs('""""aaa=111', 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual([
      {name: '""""aaa', value: '111', start: 0, end: 11},
    ]);
  });

  it('treats trailing quotes as the part of the attr name', () => {
    expect(tokenizeAttrs('aaa=""""""bbb=222', 0, attrs, identity, identity)).toBe(17);
    expect(attrs).toEqual([
      {name: 'aaa', value: '', start: 0, end: 6},
      {name: '""""bbb', value: '222', start: 6, end: 17},
    ]);
  });

  it('reads the attr with the weird name', () => {
    expect(tokenizeAttrs('@#$%*=000', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: '@#$%*', value: '000', start: 0, end: 9},
    ]);
  });

  it('reads the attr that starts with the less-than char', () => {
    expect(tokenizeAttrs('<=000', 0, attrs, identity, identity)).toBe(5);
    expect(attrs).toEqual([
      {name: '<', value: '000', start: 0, end: 5},
    ]);
  });

  it('does not read after the greater-than char', () => {
    expect(tokenizeAttrs('  >aaa=111', 0, attrs, identity, identity)).toBe(0);
    expect(attrs).toEqual([]);
  });

  it('decodes the value', () => {
    expect(tokenizeAttrs('aaa=111', 0, attrs, () => '222', identity)).toBe(7);
    expect(attrs).toEqual([
      {name: 'aaa', value: '222', start: 0, end: 7},
    ]);
  });

  it('renames the attr', () => {
    expect(tokenizeAttrs('aaa=111', 0, attrs, identity, () => 'bbb')).toBe(7);
    expect(attrs).toEqual([
      {name: 'bbb', value: '111', start: 0, end: 7},
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
    onStartTag: onStartTagMock,
    onEndTag: onEndTagMock,
    onText: onTextMock,
    onComment: onCommentMock,
    onProcessingInstruction: onProcessingInstructionMock,
    onCdataSection: onCdataSectionMock,
    onDocumentType: onDocumentTypeMock,
  };

  beforeEach(() => {
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
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'aaa', 0, 3);
    });

    it('parses the start tag without attrs', () => {
      tokenize('<a>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 3);
    });

    it('parses the start tag with attrs', () => {
      tokenize('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb">', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {
        length: 3,
        0: {name: 'foo', value: '', start: 3, end: 6},
        1: {name: 'bar', value: 'aaa"bbb', start: 7, end: 20},
        2: {name: 'baz', value: 'aaa\'bbb', start: 22, end: 35},
      }, false, 0, 36);
    });

    it('parses the start tag without attrs and with spaces before the greater-then char', () => {
      tokenize('<a   >', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 6);
    });

    it('parses the end tag', () => {
      tokenize('</a   >', false, 0, saxParserOptionsMock);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 0, 7);
    });

    it('does not emit self-closing tags by default', () => {
      tokenize('<a/>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 4);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('parses the self-closing tag without attrs', () => {
      tokenize('<a/>', false, 0, {...saxParserOptionsMock, selfClosingEnabled: true});

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, true, 0, 4);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('parses the self-closing tag with attrs', () => {
      tokenize('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb"  />', false, 0, {
        ...saxParserOptionsMock,
        selfClosingEnabled: true,
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {
        length: 3,
        0: {name: 'foo', value: '', start: 3, end: 6},
        1: {name: 'bar', value: 'aaa"bbb', start: 7, end: 20},
        2: {name: 'baz', value: 'aaa\'bbb', start: 22, end: 35},
      }, true, 0, 39);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('does not parse self-closing tag with the unquoted attr that ends with a slash', () => {
      tokenize('<a foo=123//>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {
        length: 1,
        0: {name: 'foo', value: '123//', start: 3, end: 12},
      }, false, 0, 13);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('parses the start tag with the invalid syntax as a text', () => {
      tokenize('< a>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '< a>', 0, 4);
    });

    it('parses the start tag that start with the weird char as text', () => {
      tokenize('<@#$%*>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '<@#$%*>', 0, 7);
    });

    it('parses the start tag that contain weird chars and starts with the valid name char', () => {
      tokenize('<a@#$%*>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a@#$%*', {length: 0}, false, 0, 8);
    });

    it('parses the end tag with the invalid syntax as text', () => {
      tokenize('</ a>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '</ a>', 0, 5);
    });

    it('ignores bullshit in closing tags', () => {
      tokenize('</a @#$%*/>', false, 0, saxParserOptionsMock);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 0, 11);
    });

    it('parses the trailing text', () => {
      tokenize('<a>okay', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 3);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'okay', 3, 7);
    });

    it('malformed tag becomes part of text', () => {
      tokenize('aaa< /a>bbb<b>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'aaa< /a>bbb', 0, 11);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'b', {length: 0}, false, 11, 14);
    });

    it('emits start tag with attrs', () => {
      tokenize('<a foo bar=eee>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {
        length: 2,
        0: {name: 'foo', value: '', start: 3, end: 6},
        1: {name: 'bar', value: 'eee', start: 7, end: 14},
      }, false, 0, 15);
    });

    it('parses terminated XML comments', () => {
      tokenize('<!--foo-->', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 10);
    });

    it('parses unterminated XML comments', () => {
      tokenize('<!--foo', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 7);
    });

    it('parses terminated HTML comments', () => {
      tokenize('<!foo>', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 6);
    });

    it('parses unterminated HTML comments', () => {
      tokenize('<!foo', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 5);
    });

    it('parses HTML comments as text in XML mode', () => {
      tokenize('<!foo>', false, 0, {...saxParserOptionsMock, xmlEnabled: true});

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '<!foo>', 0, 6);
    });

    it('parses XML comments that contain minuses', () => {
      tokenize('<!-- foo---->', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, ' foo--', 0, 13);
    });

    it('parses processing instructions in XML mode', () => {
      tokenize('<?xml version="1.0"?>', false, 0, {xmlEnabled: true, ...saxParserOptionsMock});

      expect(onProcessingInstructionMock).toHaveBeenCalledTimes(1);
      expect(onProcessingInstructionMock).toHaveBeenNthCalledWith(1, 'xml version="1.0"', 0, 21);
    });

    it('parses terminated processing instructions as comments', () => {
      tokenize('<?xml version="1.0"?>', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, '?xml version="1.0"?', 0, 21);
    });

    it('parses unterminated processing instructions as comments', () => {
      tokenize('<?xml version="1.0"', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, '?xml version="1.0"', 0, 19);
    });

    it('parses CDATA blocks in XML mode', () => {
      tokenize('<![CDATA[hello]]>', false, 0, {xmlEnabled: true, ...saxParserOptionsMock});

      expect(onCdataSectionMock).toHaveBeenCalledTimes(1);
      expect(onCdataSectionMock).toHaveBeenNthCalledWith(1, 'hello', 0, 17);
    });

    it('parses CDATA blocks as comments', () => {
      tokenize('<![CDATA[hello]]>', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, '[CDATA[hello]]', 0, 17);
    });

    it('parses doctype in XML mode', () => {
      tokenize('<!DOCTYPE html>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenNthCalledWith(1, ' html', 0, 15);
    });

    it('parses doctype without spaces', () => {
      tokenize('<!DOCTYPEhtml>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenNthCalledWith(1, 'html', 0, 14);
    });

    it('parses doctype without value', () => {
      tokenize('<!DOCTYPE>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenNthCalledWith(1, '', 0, 10);
    });

    it('does not parse DTD', () => {
      tokenize('<!DOCTYPE greeting [<!ELEMENT greeting (#PCDATA)>]>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenNthCalledWith(1, ' greeting [<!ELEMENT greeting (#PCDATA)', 0, 49);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, ']>', 49, 51);
    });

    it('can enforce case-insensitive CDATA tags in HTML mode', () => {
      tokenize('<script><foo aaa=111></SCRIPT>', false, 0, {
        ...saxParserOptionsMock,
        isTextContent: (token) => token.tagName === 'script',
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'script', {length: 0}, false, 0, 8);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '<foo aaa=111>', 8, 21);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'script', 21, 30);
    });

    it('CDATA tags are case-sensitive in XML mode', () => {
      tokenize('<script><foo aaa=111></SCRIPT>', false, 0, {
        ...saxParserOptionsMock,
        xmlEnabled: true,
        isTextContent: (token) => token.tagName === 'script',
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'script', {length: 0}, false, 0, 8);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '<foo aaa=111></SCRIPT>', 8, 30);
    });

    it('can enforce CDATA in self-closing tags', () => {
      tokenize('<script/><foo>', false, 0, {
        ...saxParserOptionsMock,
        selfClosingEnabled: true,
        isTextContent: (token) => token.tagName === 'script',
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'script', {length: 0}, true, 0, 9);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'foo', {length: 0}, false, 9, 14);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('can rewrite tag names', () => {
      tokenize('<foo><bar>', false, 0, {
        ...saxParserOptionsMock,
        renameTag: (tagName) => tagName.toUpperCase(),
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'FOO', {length: 0}, false, 0, 5);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'BAR', {length: 0}, false, 5, 10);
    });

    it('can rewrite attr names', () => {
      tokenize('<foo aaa=111 bbb=222>', false, 0, {...saxParserOptionsMock, renameAttr: (name) => name.toUpperCase()});

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'foo', {
        length: 2,
        0: {name: 'AAA', value: '111', start: 5, end: 12},
        1: {name: 'BBB', value: '222', start: 13, end: 20},
      }, false, 0, 21);
    });
  });

  describe('in streaming mode', () => {

    it('parses the start tag without attrs', () => {
      tokenize('<a>', true, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 3);
    });

    it('does not emit the trailing text', () => {
      tokenize('<a>okay', true, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', {length: 0}, false, 0, 3);

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
