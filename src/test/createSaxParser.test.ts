import {
  Attribute,
  createSaxParser,
  identity,
  parseSax,
  SaxParser,
  SaxParserOptions,
  parseAttrs,
} from '../main/createSaxParser';
import {ContentMode} from '../main/ContentMode';

describe('parseAttrs', () => {

  let attrs: Array<Attribute>;

  beforeEach(() => {
    attrs = [];
  });

  it('reads a double quoted attr', () => {
    expect(parseAttrs('aaa="111"', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 9},
    ]);
  });

  it('reads a single quoted attr', () => {
    expect(parseAttrs('aaa=\'111\'', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 9},
    ]);
  });

  it('reads an unquoted attr', () => {
    expect(parseAttrs('aaa=111', 0, attrs, identity, identity)).toBe(7);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 7},
    ]);
  });

  it('reads mixed attrs separated by spaces', () => {
    expect(parseAttrs('aaa=111 bbb="222" ccc=\'333\'', 0, attrs, identity, identity)).toBe(27);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 7},
      {name: 'bbb', value: '222', start: 8, end: 17},
      {name: 'ccc', value: '333', start: 18, end: 27},
    ]);
  });

  it('reads quoted attrs separated by slashes', () => {
    expect(parseAttrs('aaa="111"//bbb=\'222\'//', 0, attrs, identity, identity)).toBe(20);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 9},
      {name: 'bbb', value: '222', start: 11, end: 20},
    ]);
  });

  it('reads non-separated quoted attrs', () => {
    expect(parseAttrs('aaa="111"bbb=\'222\'', 0, attrs, identity, identity)).toBe(18);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 9},
      {name: 'bbb', value: '222', start: 9, end: 18},
    ]);
  });

  it('reads an attr without the value', () => {
    expect(parseAttrs('aaa', 0, attrs, identity, identity)).toBe(3);
    expect(attrs).toEqual([
      {name: 'aaa', value: '', start: 0, end: 3},
    ]);
  });

  it('reads a attr with an equals char and without the value', () => {
    expect(parseAttrs('aaa=', 0, attrs, identity, identity)).toBe(4);
    expect(attrs).toEqual([
      {name: 'aaa', value: '', start: 0, end: 4},
    ]);
  });

  it('treats the slash char as the whitespace in the attr name', () => {
    expect(parseAttrs('aaa/bbb="222"', 0, attrs, identity, identity)).toBe(13);
    expect(attrs).toEqual([
      {name: 'aaa', value: '', start: 0, end: 3},
      {name: 'bbb', value: '222', start: 4, end: 13},
    ]);
  });

  it('ignores leading slashes', () => {
    expect(parseAttrs('//aaa=111', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 2, end: 9},
    ]);
  });

  it('ignores leading space chars', () => {
    expect(parseAttrs(' \taaa=111', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 2, end: 9},
    ]);
  });

  it('trailing slashes are the part of the unquoted attr value', () => {
    expect(parseAttrs('aaa=111//', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111//', start: 0, end: 9},
    ]);
  });

  it('trailing slashes are treated as an unquoted value', () => {
    expect(parseAttrs('aaa=//', 0, attrs, identity, identity)).toBe(6);
    expect(attrs).toEqual([
      {name: 'aaa', value: '//', start: 0, end: 6},
    ]);
  });

  it('trailing slashes after the quoted value are ignored', () => {
    expect(parseAttrs('aaa="111"//', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 9},
    ]);
  });

  it('trailing slash without the preceding equals char is ignored', () => {
    expect(parseAttrs('aaa/', 0, attrs, identity, identity)).toBe(3);
    expect(attrs).toEqual([
      {name: 'aaa', value: '', start: 0, end: 3},
    ]);
  });

  it('ignores training spaces', () => {
    expect(parseAttrs('aaa=111  ', 0, attrs, identity, identity)).toBe(7);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 7},
    ]);
  });

  it('ignores spaces around the equals char', () => {
    expect(parseAttrs('aaa  =  111', 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111', start: 0, end: 11},
    ]);
  });

  it('treats the equals char as the part of the attr value', () => {
    expect(parseAttrs('aaa=111=111', 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111=111', start: 0, end: 11},
    ]);
  });

  it('treats the quote char as the part of the attr value', () => {
    expect(parseAttrs('aaa=111"111', 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111"111', start: 0, end: 11},
    ]);
  });

  it('treats single quot as the part of attr value', () => {
    expect(parseAttrs('aaa=111\'111', 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111\'111', start: 0, end: 11},
    ]);
  });

  it('treats slash followed by the equals char as the part of the attr value', () => {
    expect(parseAttrs('aaa=111/=111 bbb=222', 0, attrs, identity, identity)).toBe(20);
    expect(attrs).toEqual([
      {name: 'aaa', value: '111/=111', start: 0, end: 12},
      {name: 'bbb', value: '222', start: 13, end: 20},
    ]);
  });

  it('treats leading quotes as the part of the attr name', () => {
    expect(parseAttrs('""""aaa=111', 0, attrs, identity, identity)).toBe(11);
    expect(attrs).toEqual([
      {name: '""""aaa', value: '111', start: 0, end: 11},
    ]);
  });

  it('treats trailing quotes as the part of the attr name', () => {
    expect(parseAttrs('aaa=""""""bbb=222', 0, attrs, identity, identity)).toBe(17);
    expect(attrs).toEqual([
      {name: 'aaa', value: '', start: 0, end: 6},
      {name: '""""bbb', value: '222', start: 6, end: 17},
    ]);
  });

  it('reads the attr with the weird name', () => {
    expect(parseAttrs('@#$%*=000', 0, attrs, identity, identity)).toBe(9);
    expect(attrs).toEqual([
      {name: '@#$%*', value: '000', start: 0, end: 9},
    ]);
  });

  it('reads the attr that starts with the less-than char', () => {
    expect(parseAttrs('<=000', 0, attrs, identity, identity)).toBe(5);
    expect(attrs).toEqual([
      {name: '<', value: '000', start: 0, end: 5},
    ]);
  });

  it('does not read after the greater-than char', () => {
    expect(parseAttrs('  >aaa=111', 0, attrs, identity, identity)).toBe(0);
    expect(attrs).toEqual([]);
  });

  it('decodes the value', () => {
    expect(parseAttrs('aaa=111', 0, attrs, () => '222', identity)).toBe(7);
    expect(attrs).toEqual([
      {name: 'aaa', value: '222', start: 0, end: 7},
    ]);
  });

  it('renames the attr', () => {
    expect(parseAttrs('aaa=111', 0, attrs, identity, () => 'bbb')).toBe(7);
    expect(attrs).toEqual([
      {name: 'bbb', value: '111', start: 0, end: 7},
    ]);
  });
});

describe('parseSax', () => {
  
  const onStartTagMock = jest.fn();
  const onEndTagMock = jest.fn();
  const onTextMock = jest.fn();
  const onCommentMock = jest.fn();
  const onProcessingInstructionMock = jest.fn();
  const onCdataSectionMock = jest.fn();
  const onDocumentTypeMock = jest.fn();

  const saxParserOptionsMock: SaxParserOptions = {
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
      parseSax('aaa', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'aaa', 0, 3);
    });

    it('parses the start tag without attrs', () => {
      parseSax('<a>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 3);
    });

    it('parses the start tag with attrs', () => {
      parseSax('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb">', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [
        {name: 'foo', value: '', start: 3, end: 6},
        {name: 'bar', value: 'aaa"bbb', start: 7, end: 20},
        {name: 'baz', value: 'aaa\'bbb', start: 22, end: 35},
      ], false, ContentMode.FLOW, 0, 36);
    });

    it('parses the start tag without attrs and with spaces before the greater-then char', () => {
      parseSax('<a   >', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 6);
    });

    it('parses the end tag', () => {
      parseSax('</a   >', false, 0, saxParserOptionsMock);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 0, 7);
    });

    it('does not emit self-closing tags by default', () => {
      parseSax('<a/>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 4);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('parses the self-closing tag without attrs', () => {
      parseSax('<a/>', false, 0, {...saxParserOptionsMock, selfClosingEnabled: true});

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], true, ContentMode.FLOW, 0, 4);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('parses the self-closing tag with attrs', () => {
      parseSax('<a foo bar=\'aaa"bbb\'  baz="aaa\'bbb"  />', false, 0, {
        ...saxParserOptionsMock,
        selfClosingEnabled: true,
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [
        {name: 'foo', value: '', start: 3, end: 6},
        {name: 'bar', value: 'aaa"bbb', start: 7, end: 20},
        {name: 'baz', value: 'aaa\'bbb', start: 22, end: 35},
      ], true, ContentMode.FLOW, 0, 39);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('does not parse self-closing tag with the unquoted attr that ends with a slash', () => {
      parseSax('<a foo=123//>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [
        {name: 'foo', value: '123//', start: 3, end: 12},
      ], false, ContentMode.FLOW, 0, 13);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('parses the start tag with the invalid syntax as a text', () => {
      parseSax('< a>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '< a>', 0, 4);
    });

    it('parses the start tag that start with the weird char as text', () => {
      parseSax('<@#$%*>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '<@#$%*>', 0, 7);
    });

    it('parses the start tag that contain weird chars and starts with the valid name char', () => {
      parseSax('<a@#$%*>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a@#$%*', [], false, ContentMode.FLOW, 0, 8);
    });

    it('parses the end tag with the invalid syntax as text', () => {
      parseSax('</ a>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '</ a>', 0, 5);
    });

    it('ignores bullshit in closing tags', () => {
      parseSax('</a @#$%*/>', false, 0, saxParserOptionsMock);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 0, 11);
    });

    it('parses the trailing text', () => {
      parseSax('<a>okay', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 3);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'okay', 3, 7);
    });

    it('malformed tag becomes part of text', () => {
      parseSax('aaa< /a>bbb<b>', false, 0, saxParserOptionsMock);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'aaa< /a>bbb', 0, 11);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'b', [], false, ContentMode.FLOW, 11, 14);
    });

    it('emits start tag with attrs', () => {
      parseSax('<a foo bar=eee>', false, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [
        {name: 'foo', value: '', start: 3, end: 6},
        {name: 'bar', value: 'eee', start: 7, end: 14},
      ], false, ContentMode.FLOW, 0, 15);
    });

    it('parses terminated XML comments', () => {
      parseSax('<!--foo-->', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 10);
    });

    it('parses unterminated XML comments', () => {
      parseSax('<!--foo', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 7);
    });

    it('parses terminated HTML comments', () => {
      parseSax('<!foo>', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 6);
    });

    it('parses unterminated HTML comments', () => {
      parseSax('<!foo', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 5);
    });

    it('parses HTML comments as text in XML mode', () => {
      parseSax('<!foo>', false, 0, {...saxParserOptionsMock, xmlEnabled: true});

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '<!foo>', 0, 6);
    });

    it('parses XML comments that contain minuses', () => {
      parseSax('<!-- foo---->', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, ' foo--', 0, 13);
    });

    it('parses processing instructions in XML mode', () => {
      parseSax('<?xml version="1.0"?>', false, 0, {xmlEnabled: true, ...saxParserOptionsMock});

      expect(onProcessingInstructionMock).toHaveBeenCalledTimes(1);
      expect(onProcessingInstructionMock).toHaveBeenNthCalledWith(1, 'xml version="1.0"', 0, 21);
    });

    it('parses terminated processing instructions as comments', () => {
      parseSax('<?xml version="1.0"?>', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, '?xml version="1.0"?', 0, 21);
    });

    it('parses unterminated processing instructions as comments', () => {
      parseSax('<?xml version="1.0"', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, '?xml version="1.0"', 0, 19);
    });

    it('parses CDATA blocks in XML mode', () => {
      parseSax('<![CDATA[hello]]>', false, 0, {xmlEnabled: true, ...saxParserOptionsMock});

      expect(onCdataSectionMock).toHaveBeenCalledTimes(1);
      expect(onCdataSectionMock).toHaveBeenNthCalledWith(1, 'hello', 0, 17);
    });

    it('parses CDATA blocks as comments', () => {
      parseSax('<![CDATA[hello]]>', false, 0, saxParserOptionsMock);

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, '[CDATA[hello]]', 0, 17);
    });

    it('parses doctype in XML mode', () => {
      parseSax('<!DOCTYPE html>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenNthCalledWith(1, ' html', 0, 15);
    });

    it('parses doctype without spaces', () => {
      parseSax('<!DOCTYPEhtml>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenNthCalledWith(1, 'html', 0, 14);
    });

    it('parses doctype without value', () => {
      parseSax('<!DOCTYPE>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenNthCalledWith(1, '', 0, 10);
    });

    it('does not parse DTD', () => {
      parseSax('<!DOCTYPE greeting [<!ELEMENT greeting (#PCDATA)>]>', false, 0, saxParserOptionsMock);

      expect(onDocumentTypeMock).toHaveBeenCalledTimes(1);
      expect(onDocumentTypeMock).toHaveBeenNthCalledWith(1, ' greeting [<!ELEMENT greeting (#PCDATA)', 0, 49);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, ']>', 49, 51);
    });

    it('can enforce case-insensitive CDATA tags in HTML mode', () => {
      parseSax('<script><foo aaa=111></SCRIPT>', false, 0, {
        ...saxParserOptionsMock,
        getContentMode: (name) => name === 'script' ? ContentMode.TEXT : undefined,
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'script', [], false, ContentMode.TEXT, 0, 8);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '<foo aaa=111>', 8, 21);

      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'script', 21, 30);
    });

    it('CDATA tags are case-sensitive in XML mode', () => {
      parseSax('<script><foo aaa=111></SCRIPT>', false, 0, {
        ...saxParserOptionsMock,
        xmlEnabled: true,
        getContentMode: (name) => name === 'script' ? ContentMode.TEXT : undefined,
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'script', [], false, ContentMode.TEXT, 0, 8);

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '<foo aaa=111></SCRIPT>', 8, 30);
    });

    it('can enforce CDATA in self-closing tags', () => {
      parseSax('<script/><foo>', false, 0, {
        ...saxParserOptionsMock,
        selfClosingEnabled: true,
        getContentMode: (name) => name === 'script' ? ContentMode.TEXT : undefined,
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'script', [], true, ContentMode.TEXT, 0, 9);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'foo', [], false, ContentMode.FLOW, 9, 14);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('can rewrite tag names', () => {
      parseSax('<foo><bar>', false, 0, {
        ...saxParserOptionsMock,
        renameTag: (name) => name.toUpperCase(),
      });

      expect(onStartTagMock).toHaveBeenCalledTimes(2);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'FOO', [], false, ContentMode.FLOW, 0, 5);
      expect(onStartTagMock).toHaveBeenNthCalledWith(2, 'BAR', [], false, ContentMode.FLOW, 5, 10);
    });

    it('can rewrite attr names', () => {
      parseSax('<foo aaa=111 bbb=222>', false, 0, {...saxParserOptionsMock, renameAttr: (name) => name.toUpperCase()});

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'foo', [
        {name: 'AAA', value: '111', start: 5, end: 12},
        {name: 'BBB', value: '222', start: 13, end: 20},
      ], false, ContentMode.FLOW, 0, 21);
    });
  });

  describe('in streaming mode', () => {

    it('parses the start tag without attrs', () => {
      parseSax('<a>', true, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 3);
    });

    it('does not emit the trailing text', () => {
      parseSax('<a>okay', true, 0, saxParserOptionsMock);

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 3);

      expect(onTextMock).not.toHaveBeenCalled();
    });

    it('does not emit unterminated XML comments', () => {
      parseSax('<!--foo', true, 0, saxParserOptionsMock);
      expect(onCommentMock).not.toHaveBeenCalled();
    });

    it('does not emit unterminated HTML comments', () => {
      parseSax('<!foo', true, 0, saxParserOptionsMock);
      expect(onCommentMock).not.toHaveBeenCalled();
    });

    it('does not emit unterminated processing instructions as comments', () => {
      parseSax('<?xml version="1.0"', true, 0, saxParserOptionsMock);
      expect(onCommentMock).not.toHaveBeenCalled();
    });
  });
});

describe('createSaxParser', () => {

  let parser: SaxParser;

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

      onStartTag: onStartTagMock,
      onEndTag: onEndTagMock,
      onText: onTextMock,
      onComment: onCommentMock,
      onProcessingInstruction: onProcessingInstructionMock,
      onCdataSection: onCdataSectionMock,
      onDocumentType: onDocumentTypeMock,
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
      parser.commit('<www aaa=111 ');

      expect(onStartTagMock).not.toHaveBeenCalled();
      expect(onTextMock).not.toHaveBeenCalled();
    });

    it('emits incomplete comment', () => {
      parser.commit('<!--foo');

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 7);
    });
  });

  describe('in streaming mode', () => {

    it('defers text emit', () => {
      parser.writeStream('<a>foo');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'a', [], false, ContentMode.FLOW, 0, 3);
      expect(onTextMock).not.toHaveBeenCalled();

      parser.writeStream('bar</a>');

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'foobar', 3, 9);
      expect(onEndTagMock).toHaveBeenCalledTimes(1);
      expect(onEndTagMock).toHaveBeenNthCalledWith(1, 'a', 9, 13);
    });

    it('defers start tag emit', () => {
      parser.writeStream('<www aaa=111 ');

      expect(onStartTagMock).not.toHaveBeenCalled();

      parser.writeStream('/>');

      expect(onStartTagMock).toHaveBeenCalledTimes(1);
      expect(onStartTagMock).toHaveBeenNthCalledWith(1, 'www', [
        {name: 'aaa', value: '111', start: 5, end: 12},
      ], true, ContentMode.FLOW, 0, 15);

      expect(onEndTagMock).not.toHaveBeenCalled();
    });

    it('defers comment emit', () => {
      parser.writeStream('<!--foo');

      expect(onCommentMock).not.toHaveBeenCalled();

      parser.writeStream('bar-->');

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foobar', 0, 13);
    });

    it('emits incomplete comment on commit', () => {
      parser.writeStream('<!--foo');

      expect(onCommentMock).not.toHaveBeenCalled();

      parser.commit();

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foo', 0, 7);
    });

    it('emits tail on commit with an additional data', () => {
      parser.writeStream('<!--foo');

      expect(onCommentMock).not.toHaveBeenCalled();

      parser.commit('bar');

      expect(onCommentMock).toHaveBeenCalledTimes(1);
      expect(onCommentMock).toHaveBeenNthCalledWith(1, 'foobar', 0, 10);
    });

    it('can reset the stream', () => {
      parser.writeStream('foo');

      expect(onTextMock).not.toHaveBeenCalled();

      parser.resetStream();
      parser.commit('bar');

      expect(onTextMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, 'bar', 0, 3);
    });
  });
});