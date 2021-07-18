import {createXmlDomParser} from '../main/createXmlDomParser';
import {DomNodeType, IDomAttributeMap, IDomElement, IDomNode, IDomText} from '../main/dom-types';

export function el(tagName: string, start: number, end: number, selfClosing = false, attrs: IDomAttributeMap = {}, children: Array<IDomNode> = []): IDomElement {

  const el: IDomElement = {
    nodeType: DomNodeType.ELEMENT,
    parent: null,
    tagName,
    attributes: attrs,
    selfClosing,
    children,
    start,
    end,
  };

  for (const child of children) {
    child.parent = el;
  }
  return el;
}

export function text(value: string, start: number, end: number): IDomText {
  return {nodeType: 3, parent: null, data: value, start, end};
}

describe('createXmlDomParser', () => {

  it('parses a tag with attribute', () => {
    const parser = createXmlDomParser();

    expect(parser.parse('<a foo=bar>')).toEqual([
      el('a', 0, 11, false, {foo: 'bar'}),
    ]);
  });

  it('parses a tag with string content', () => {
    const parser = createXmlDomParser();

    expect(parser.parse('<a>okay</a>')).toEqual([
      el('a', 0, 11, false, {}, [
        text('okay', 3, 7),
      ]),
    ]);
  });

  it('parses a self-closing tag', () => {
    const parser = createXmlDomParser({selfClosingEnabled: true});

    expect(parser.parse('<a/>')).toEqual([
      el('a', 0, 4, true),
    ]);
  });

  it('parses text', () => {
    const parser = createXmlDomParser();

    expect(parser.parse('foo')).toEqual([
      text('foo', 0, 3),
    ]);
  });

  it('parses tag with sibling text', () => {
    const parser = createXmlDomParser();

    expect(parser.parse('<a></a>foo')).toEqual([
      el('a', 0, 7),
      text('foo', 7, 10),
    ]);
  });

  it('parses self-closing tag as a start tag', () => {
    const parser = createXmlDomParser();

    expect(parser.parse('<a/>foo')).toEqual([
      el('a', 0, 7, false, {}, [
        text('foo', 4, 7),
      ]),
    ]);
  });

  it('parses self-closing tag', () => {
    const parser = createXmlDomParser({selfClosingEnabled: true});

    expect(parser.parse('<a/>foo')).toEqual([
      el('a', 0, 4, true),
      text('foo', 4, 7),
    ]);
  });

  it('ignores unmatched end tags', () => {
    const parser = createXmlDomParser();

    expect(parser.parse('<a>aaa</b>bbb</a>')).toEqual([
      el('a', 0, 17, false, {}, [
        text('aaa', 3, 6),
        text('bbb', 10, 13),
      ]),
    ]);
  });

  it('resolves incorrect order of close tags without excessive elements', () => {
    const parser = createXmlDomParser();

    expect(parser.parse('<a>aaa<b>bbb</a></b>')).toEqual([
      el('a', 0, 16, false, {}, [
        text('aaa', 3, 6),
        el('b', 6, 12, false, {}, [
          text('bbb', 9, 12),
        ]),
      ]),
    ]);
  });

  it('resolves incorrect order of close tags with text', () => {
    const parser = createXmlDomParser();

    expect(parser.parse('<a>aaa<b>bbb</a>ccc</b>')).toEqual([
      el('a', 0, 16, false, {}, [
        text('aaa', 3, 6),
        el('b', 6, 12, false, {}, [
          text('bbb', 9, 12),
        ]),
      ]),
      text('ccc', 16, 19),
    ]);
  });

  it('closes void tags', () => {
    const parser = createXmlDomParser({
      isVoidContent: (token) => token.name === 'a',
    });

    expect(parser.parse('<a><a><a>')).toEqual([
      el('a', 0, 3, true),
      el('a', 3, 6, true),
      el('a', 6, 9, true),
    ]);
  });

  it('implicitly closes current tag', () => {
    const parser = createXmlDomParser({
      isImplicitEnd: (containerToken, token) => containerToken.name === 'p' && token.name === 'p',
    });

    expect(parser.parse('<p>foo<p>bar')).toEqual([
      el('p', 0, 6, false, {}, [
        text('foo', 3, 6),
      ]),
      el('p', 6, 12, false, {}, [
        text('bar', 9, 12),
      ]),
    ]);
  });

  it('implicitly closes current tag with nesting', () => {
    const parser = createXmlDomParser({
      isImplicitEnd: (containerToken, token) => containerToken.name === 'p' && token.name === 'p',
    });

    expect(parser.parse('<p><p>aaa</p></p>')).toEqual([
      el('p', 0, 3),
      el('p', 3, 13, false, {}, [
        text('aaa', 6, 9),
      ]),
    ]);
  });
});
