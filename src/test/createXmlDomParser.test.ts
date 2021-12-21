import {createXmlDomParser, domHandler} from '../main/createXmlDomParser';
import {IElementNode, ITextNode, Node, NodeType} from '../main/dom-types';
import {IParser} from '../main/parser-types';

export function element(tagName: string, start: number, end: number, selfClosing = false, attributes: Record<string, string> = {}, children: Array<Node> = []): IElementNode {

  const node: IElementNode = {
    nodeType: NodeType.ELEMENT,
    parent: null,
    tagName,
    attributes,
    selfClosing,
    children,
    start,
    end,
  };

  for (const childNode of children) {
    childNode.parent = node;
  }
  return node;
}

export function text(data: string, start: number, end: number): ITextNode {
  return {
    nodeType: NodeType.TEXT,
    parent: null,
    data,
    start,
    end,
  };
}

describe('createXmlDomParser', () => {

  let parser: IParser<Array<Node>>;

  beforeEach(() => {
    parser = createXmlDomParser();
  });

  it('parses a tag with attribute', () => {
    expect(parser.parse('<a foo=bar>')).toEqual([
      element('a', 0, 11, false, {foo: 'bar'}),
    ]);
  });

  it('parses a tag with string content', () => {
    expect(parser.parse('<a>okay</a>')).toEqual([
      element('a', 0, 11, false, {}, [
        text('okay', 3, 7),
      ]),
    ]);
  });

  it('parses a self-closing tag', () => {
    const parser = createXmlDomParser(domHandler, {selfClosingEnabled: true});

    expect(parser.parse('<a/>')).toEqual([
      element('a', 0, 4, true),
    ]);
  });

  it('parses text', () => {
    expect(parser.parse('foo')).toEqual([
      text('foo', 0, 3),
    ]);
  });

  it('parses tag with sibling text', () => {
    expect(parser.parse('<a></a>foo')).toEqual([
      element('a', 0, 7),
      text('foo', 7, 10),
    ]);
  });

  it('parses self-closing tag', () => {
    const parser = createXmlDomParser(domHandler, {selfClosingEnabled: true});

    expect(parser.parse('<a/>foo')).toEqual([
      element('a', 0, 4, true),
      text('foo', 4, 7),
    ]);
  });

  it('ignores unmatched end tags', () => {
    expect(parser.parse('<a>aaa</b>bbb</a>')).toEqual([
      element('a', 0, 17, false, {}, [
        text('aaa', 3, 6),
        text('bbb', 10, 13),
      ]),
    ]);
  });

  it('resolves incorrect order of close tags without excessive elements', () => {
    expect(parser.parse('<a>aaa<b>bbb</a></b>')).toEqual([
      element('a', 0, 16, false, {}, [
        text('aaa', 3, 6),
        element('b', 6, 12, false, {}, [
          text('bbb', 9, 12),
        ]),
      ]),
    ]);
  });

  it('resolves incorrect order of close tags with text', () => {
    expect(parser.parse('<a>aaa<b>bbb</a>ccc</b>')).toEqual([
      element('a', 0, 16, false, {}, [
        text('aaa', 3, 6),
        element('b', 6, 12, false, {}, [
          text('bbb', 9, 12),
        ]),
      ]),
      text('ccc', 16, 19),
    ]);
  });

  it('closes void tags', () => {
    const parser = createXmlDomParser(domHandler, {
      checkVoidTag: (token) => token.name === 'a',
    });

    expect(parser.parse('<a><a><a>')).toEqual([
      element('a', 0, 3, true),
      element('a', 3, 6, true),
      element('a', 6, 9, true),
    ]);
  });

  it('implicitly closes current tag', () => {
    const parser = createXmlDomParser(domHandler, {
      endsAncestorAt: (ancestors, token) => ancestors[0].name === 'p' && token.name === 'p' ? 0 : -1,
    });

    expect(parser.parse('<p>foo<p>bar')).toEqual([
      element('p', 0, 6, false, {}, [
        text('foo', 3, 6),
      ]),
      element('p', 6, 12, false, {}, [
        text('bar', 9, 12),
      ]),
    ]);
  });

  it('implicitly closes current tag with nesting', () => {
    const parser = createXmlDomParser(domHandler, {
      endsAncestorAt: (ancestors, token) => ancestors[0].name === 'p' && token.name === 'p' ? 0 : -1,
    });

    expect(parser.parse('<p><p>aaa</p></p>')).toEqual([
      element('p', 0, 3),
      element('p', 3, 13, false, {}, [
        text('aaa', 6, 9),
      ]),
    ]);
  });
});
