import {
  createTagSoupDomParser,
  createTagSoupElement,
  createTagSoupText,
  TagSoupElement,
  TagSoupNode,
} from '../main/createTagSoupDomParser';
import {Attribute} from '../main';

function el(tagName: string, start: number, end: number, selfClosing = false, attrs: Array<Attribute> = [], children: Array<TagSoupNode> = []): TagSoupElement {
  const el = createTagSoupElement(tagName, attrs, selfClosing, start, end);

  el.children = children;
  for (const child of children) {
    child.parent = el;
  }
  return el;
}

const text = createTagSoupText;

describe('createTagSoupDomParser', () => {

  it('parses a tag with string content', () => {
    const parser = createTagSoupDomParser();

    expect(parser.commit('<a>okay</a>')).toEqual([
      el('a', 0, 11, false, [], [
        text('okay', 3, 7),
      ]),
    ]);
  });

  it('parses a self-closing tag', () => {
    const parser = createTagSoupDomParser({selfClosingEnabled: true});

    expect(parser.commit('<a/>')).toEqual([
      el('a', 0, 4, true),
    ]);
  });

  it('parses text', () => {
    const parser = createTagSoupDomParser();

    expect(parser.commit('foo')).toEqual([
      text('foo', 0, 3),
    ]);
  });

  it('parses tag with sibling text', () => {
    const parser = createTagSoupDomParser();

    expect(parser.commit('<a></a>foo')).toEqual([
      el('a', 0, 7),
      text('foo', 7, 10),
    ]);
  });

  it('parses self-closing tag as a start tag', () => {
    const parser = createTagSoupDomParser();

    expect(parser.commit('<a/>foo')).toEqual([
      el('a', 0, 7, false, [], [
        text('foo', 4, 7),
      ]),
    ]);
  });

  it('parses self-closing tag', () => {
    const parser = createTagSoupDomParser({selfClosingEnabled: true});

    expect(parser.commit('<a/>foo')).toEqual([
      el('a', 0, 4, true),
      text('foo', 4, 7),
    ]);
  });

  it('ignores unmatched end tags', () => {
    const parser = createTagSoupDomParser();

    expect(parser.commit('<a>aaa</b>bbb</a>')).toEqual([
      el('a', 0, 17, false, [], [
        text('aaa', 3, 6),
        text('bbb', 10, 13),
      ]),
    ]);
  });

  it('resolves incorrect order of close tags without excessive elements', () => {
    const parser = createTagSoupDomParser();

    expect(parser.commit('<a>aaa<b>bbb</a></b>')).toEqual([
      el('a', 0, 16, false, [], [
        text('aaa', 3, 6),
        el('b', 6, 12, false, [], [
          text('bbb', 9, 12),
        ]),
      ]),
    ]);
  });

  it('resolves incorrect order of close tags with text', () => {
    const parser = createTagSoupDomParser();

    expect(parser.commit('<a>aaa<b>bbb</a>ccc</b>')).toEqual([
      el('a', 0, 16, false, [], [
        text('aaa', 3, 6),
        el('b', 6, 12, false, [], [
          text('bbb', 9, 12),
        ]),
      ]),
      text('ccc', 16, 19),
    ]);
  });

  it('closes void tags', () => {
    const parser = createTagSoupDomParser({isVoidContent: (tagName) => tagName === 'a'});

    expect(parser.commit('<a><a><a>')).toEqual([
      el('a', 0, 3, true),
      el('a', 3, 6, true),
      el('a', 6, 9, true),
    ]);
  });

  it('implicitly closes current tag', () => {
    const parser = createTagSoupDomParser({isImplicitEnd: (currentTagName, tagName) => currentTagName === 'p' && tagName === 'p'});

    expect(parser.commit('<p>foo<p>bar')).toEqual([
      el('p', 0, 6, false, [], [
        text('foo', 3, 6),
      ]),
      el('p', 6, 12, false, [], [
        text('bar', 9, 12),
      ]),
    ]);
  });

  it('implicitly closes current tag with nesting', () => {
    const parser = createTagSoupDomParser({isImplicitEnd: (currentTagName, tagName) => currentTagName === 'p' && tagName === 'p'});

    expect(parser.commit('<p><p>aaa</p></p>')).toEqual([
      el('p', 0, 3),
      el('p', 3, 13, false, [], [
        text('aaa', 6, 9),
      ]),
    ]);
  });
});
