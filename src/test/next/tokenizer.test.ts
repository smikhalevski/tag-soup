import {TokenHandler} from 'tokenizer-dsl';
import {tokenizer} from '../../main/next/tokenizer';
import {LexerContext, TokenStage, TokenType} from '../../main/next/tokenizer-types';
import {getCaseInsensitiveHashCode} from '../../main/next/utils';

describe('tokenizer', () => {

  const tokenCallbackMock = jest.fn();

  const handler: TokenHandler<TokenType, TokenStage, LexerContext> = (type, chunk, offset, length, context, state) => {
    tokenCallbackMock(type, state.chunkOffset + offset, length, /*context*/);
  };

  let context: LexerContext;

  beforeEach(() => {
    tokenCallbackMock.mockRestore();

    context = {
      state: {
        stage: TokenStage.DOCUMENT,
        chunk: '',
        chunkOffset: 0,
        offset: 0,
        stack: [],
        cursor: -1,
        activeTag: 0,
      },
      handler: () => undefined,
      selfClosingTagsEnabled: false,
      voidTags: null,
      cdataTags: null,
      implicitEndTagMap: null,
      implicitStartTags: null,
      getHashCode: getCaseInsensitiveHashCode,
    };
  });

  // Text
  // ----------------------------

  test('tokenizes an empty string', () => {
    tokenizer('', handler, context);

    expect(tokenCallbackMock).not.toHaveBeenCalled();
  });

  test('tokenizes text', () => {
    tokenizer('aaa', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 3);
  });

  test('tokenizes the trailing text', () => {
    tokenizer('<w>okay', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.TEXT, 3, 4);
  });

  test('tokenizes the leading lt as text', () => {
    tokenizer('>a>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 3);
  });

  // Start tag
  // ----------------------------

  test('tokenizes the start tag without attributes', () => {
    tokenizer('<w>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
  });

  test('tokenizes the start tag without attributes and with spaces before the greater-then char', () => {
    tokenizer('<w   >', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 5, 1);
  });

  test('tokenizes the start tag with the opening only', () => {
    const state = tokenizer('<w   ', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(state.offset).toBe(5);
  });

  test('tokenizes the malformed start tag as a text', () => {
    tokenizer('< w>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 4);
  });

  test('tokenizes the start tag that starts with the weird char as a text', () => {
    tokenizer('<@#$%*>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 7);
  });

  test('tokenizes the start tag that contain weird chars and starts with the valid name char', () => {
    tokenizer('<w@#$%*>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 7, 1);
  });

  test('tokenizes the start tag in double brackets', () => {
    tokenizer('<<w>>aaa</w>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(6);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_OPENING, 1, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_CLOSING, 3, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.TEXT, 4, 4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.END_TAG_OPENING, 8, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, TokenType.END_TAG_CLOSING, 11, 1);
  });

  test('tokenizes empty tag names as text', () => {
    tokenizer('< ></ >', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.TEXT, 3, 4);
  });

  test('tokenizes non-alpha tag names as text', () => {
    tokenizer('<12></12>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.TEXT, 4, 5);
  });

  // Attributes
  // ----------------------------

  test('tokenizes apos-quoted attributes', () => {
    tokenizer('<w foo=\'aaa"bbb\' bar=\'aaa"bbb\'>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(6);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_VALUE, 7, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.ATTRIBUTE_NAME, 17, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.ATTRIBUTE_VALUE, 21, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, TokenType.START_TAG_CLOSING, 30, 1);
  });

  test('tokenizes apos-quoted attributes', () => {
    tokenizer('<w foo="aaa\'bbb" bar="aaa\'bbb"  />', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(6);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_VALUE, 7, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.ATTRIBUTE_NAME, 17, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.ATTRIBUTE_VALUE, 21, 9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, TokenType.START_TAG_CLOSING, 32, 2);
  });

  test('tokenizes unquoted attributes', () => {
    tokenizer('<w foo=aaa>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_UNQUOTED_VALUE, 7, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 10, 1);
  });

  test('tokenizes valueless attributes', () => {
    tokenizer('<w foo bar>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_NAME, 7, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 10, 1);
  });

  test('tokenizes entities in attributes', () => {
    tokenizer('<w foo=&amp; bar="&amp;" baz=\'&amp;\' qux=>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_UNQUOTED_VALUE, 7, 5);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.ATTRIBUTE_NAME, 13, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.ATTRIBUTE_VALUE, 17, 7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, TokenType.ATTRIBUTE_NAME, 25, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(7, TokenType.ATTRIBUTE_VALUE, 29, 7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(8, TokenType.ATTRIBUTE_NAME, 37, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(9, TokenType.START_TAG_CLOSING, 41, 1);
  });

  test('ignores leading slash in an attribute name', () => {
    tokenizer('<w /foo></foo w>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(5);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 4, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.START_TAG_CLOSING, 7, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.END_TAG_OPENING, 8, 5);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.END_TAG_CLOSING, 13, 3);
  });

  test('tokenizes spaces between attribute name and value', () => {
    tokenizer('<w foo = "aaa"', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_VALUE, 9, 5);
  });

  test('tokenizes bullshit attribute names', () => {
    tokenizer('<w < = \'\' FAIL>stuff</w><a', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(9);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_VALUE, 7, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.ATTRIBUTE_NAME, 10, 4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.START_TAG_CLOSING, 14, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, TokenType.TEXT, 15, 5);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(7, TokenType.END_TAG_OPENING, 20, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(8, TokenType.END_TAG_CLOSING, 23, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(9, TokenType.START_TAG_OPENING, 24, 2);
  });

  test('tokenizes attributes with unbalanced end quotes', () => {
    tokenizer('<w foo="aaa"bbb"', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_VALUE, 7, 5);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.ATTRIBUTE_NAME, 12, 4);
  });

  // Self-closing start tag
  // ----------------------------

  test('tokenizes the self-closing tag without attributes', () => {
    tokenizer('<w/>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_SELF_CLOSING, 2, 2);
  });

  test('does not tokenize self-closing tag with the unquoted attribute that ends with a slash', () => {
    tokenizer('<w foo=123//>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(4);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.ATTRIBUTE_NAME, 3, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.ATTRIBUTE_UNQUOTED_VALUE, 7, 5);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.START_TAG_CLOSING, 12, 1);
  });

  // End tag
  // ----------------------------

  test('tokenizes the end tag', () => {
    tokenizer('</w   >', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.END_TAG_OPENING, 0, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.END_TAG_CLOSING, 3, 4);
  });

  test('tokenizes the malformed end tag as a text', () => {
    tokenizer('</ w>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.TEXT, 0, 5);
  });

  test('ignores bullshit in closing tags', () => {
    tokenizer('</w @#$%*/>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.END_TAG_OPENING, 0, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.END_TAG_CLOSING, 3, 8);
  });

  // Comments
  // ----------------------------

  test('tokenizes terminated XML comments', () => {
    tokenizer('<!--foo-->', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.COMMENT, 0, 10);
  });

  test('tokenizes unterminated XML comments', () => {
    tokenizer('<!--foo', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.COMMENT, 0, 10);
  });

  test('tokenizes XML comments that contain excessive minus chars', () => {
    tokenizer('<!-- foo---->', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.COMMENT, 0, 13);
  });

  test('tokenizes DTD mixed with comments', () => {
    tokenizer('<!-foo><!-- --- --><!--foo', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.DTD, 0, 7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.COMMENT, 7, 12);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.COMMENT, 19, 10);
  });

  test('tokenizes comment false ending', () => {
    tokenizer('<!-- a-b-> -->', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.COMMENT, 0, 14);
  });

  // Processing instructions
  // ----------------------------

  test('tokenizes processing instructions', () => {
    tokenizer('<?xml version="1.0"?>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.PROCESSING_INSTRUCTION, 0, 21);
  });

  test('tokenizes unterminated processing instructions as comments', () => {
    tokenizer('<?xml version="1.0"', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.PROCESSING_INSTRUCTION, 0, 21);
  });

  // CDATA
  // ----------------------------

  test('tokenizes the CDATA section', () => {
    tokenizer('<![CDATA[hello]]>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.CDATA_SECTION, 0, 17);
  });

  test('tokenizes the CDATA section that contain excessive closing square brackets', () => {
    tokenizer('<![CDATA[hello]]]]>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.CDATA_SECTION, 0, 19);
  });

  // https://github.com/fb55/htmlparser2/blob/78ef1b7f462d2585b9f03d0e762db41a5a7ef745/src/__fixtures__/Events/04-cdata.json
  test('tokenizes the special CDATA section', () => {
    tokenizer('<w><![CDATA[ aaa ><aaa></aaa><> bbb]]></w><![CD>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(6);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 2);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 2, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.CDATA_SECTION, 3, 35);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.END_TAG_OPENING, 38, 3);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.END_TAG_CLOSING, 41, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, TokenType.DTD, 42, 6);
  });

  // CDATA tags
  // ----------------------------

  test('tokenizes CDATA tags', () => {
    context.cdataTags = new Set([context.getHashCode('script', 0, 6)]);

    tokenizer('<script>let str = \'<script></\'+\'script>\';</script>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 7, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.TEXT, 8, 11);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.TEXT, 19, 8);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.TEXT, 27, 14);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, TokenType.END_TAG_OPENING, 41, 8);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(7, TokenType.END_TAG_CLOSING, 49, 1);
  });

  test('emits END_TAG_OPENING inside CDATA tags', () => {
    context.cdataTags = new Set([context.getHashCode('script', 0, 6)]);

    tokenizer('<script></foo></script>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(6);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.START_TAG_OPENING, 0, 7);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(2, TokenType.START_TAG_CLOSING, 7, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(3, TokenType.END_TAG_OPENING, 8, 5);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(4, TokenType.TEXT, 13, 1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(5, TokenType.END_TAG_OPENING, 14, 8);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(6, TokenType.END_TAG_CLOSING, 22, 1);
  });

  // Doctype
  // ----------------------------

  test('tokenizes doctype', () => {
    tokenizer('<!DOCTYPE html>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.DOCTYPE, 0, 15);
  });

  test('tokenizes doctype without spaces', () => {
    tokenizer('<!DOCTYPEhtml>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.DOCTYPE, 0, 14);
  });

  test('tokenizes doctype without value', () => {
    tokenizer('<!DOCTYPE>', handler, context);

    expect(tokenCallbackMock).toHaveBeenCalledTimes(1);
    expect(tokenCallbackMock).toHaveBeenNthCalledWith(1, TokenType.DOCTYPE, 0, 10);
  });

});
