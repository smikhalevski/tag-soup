import {
  createTagSoupDomParser,
  createTagSoupElement,
  createTagSoupText,
  TagSoupElement,
  TagSoupNode,
} from '../main/createTagSoupDomParser';

function el(tagName: string, start: number, end: number, attrs: Record<string, string> = {}, children: Array<TagSoupNode> = []): TagSoupElement {
  const el = createTagSoupElement(tagName, attrs, start, end, children);

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
      el('a', 0, 11, {}, [
        text('okay', 3, 7),
      ]),
    ]);
  });

  it('parses a self-closing tag', () => {
    const parser = createTagSoupDomParser({selfClosingEnabled: true});

    expect(parser.commit('<a/>')).toEqual([
      el('a', 0, 4),
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
      el('a', 0, 7, {}, [
        text('foo', 4, 7),
      ]),
    ]);
  });

  it('parses self-closing tag', () => {
    const parser = createTagSoupDomParser({selfClosingEnabled: true});

    expect(parser.commit('<a/>foo')).toEqual([
      el('a', 0, 4),
      text('foo', 4, 7),
    ]);
  });

  it('ignores unmatched end tags', () => {
    const parser = createTagSoupDomParser();

    expect(parser.commit('<a>aaa</b>bbb</a>')).toEqual([
      el('a', 0, 17, {}, [
        text('aaabbb', 3, 13),
      ]),
    ]);
  });

  it('resolves incorrect order of close tags without excessive elements', () => {
    const parser = createTagSoupDomParser();

    expect(parser.commit('<a>aaa<b>bbb</a></b>')).toEqual([
      el('a', 0, 16, {}, [
        text('aaa', 3, 6),
        el('b', 6, 12, {}, [
          text('bbb', 9, 12),
        ]),
      ])
    ]);
  });

  it('resolves incorrect order of close tags with text', () => {
    const parser = createTagSoupDomParser();

    expect(parser.commit('<a>aaa<b>bbb</a>ccc</b>')).toEqual([
      el('a', 0, 16, {}, [
        text('aaa', 3, 6),
        el('b', 6, 12, {}, [
          text('bbb', 9, 12),
        ]),
      ]),
      el('b', 16, 23, {}, [
        text('ccc', 16, 19),
      ]),
    ]);
  });

  it('closes void tags', () => {
    const parser = createTagSoupDomParser({isVoidElement: (el) => el.tagName === 'a'});

    expect(parser.commit('<a><a><a>')).toEqual([
      el('a', 0, 3),
      el('a', 3, 6),
      el('a', 6, 9),
    ]);
  });

  it('source of ignored tags is appended as text', () => {
    const parser = createTagSoupDomParser({isIgnoredTag: (tagName) => tagName === 'a'});

    expect(parser.commit('<b><a></b></a>')).toEqual([
      el('b', 0, 10, {}, [
        text('<a>', 3, 6),
      ]),
      text('</a>', 10, 14),
    ]);
  });

  it('omitted tags are not output', () => {
    const parser = createTagSoupDomParser({isOmittedTag: (tagName) => tagName === 'a'});

    expect(parser.commit('<b><a></a></b>')).toEqual([
      el('b', 0, 14),
    ]);
  });

  it('implicitly closes current tag', () => {
    const parser = createTagSoupDomParser({isImplicitClose: (parentElement, element) => element.tagName === 'p' && parentElement.tagName === element.tagName});

    expect(parser.commit('<p>foo<p>bar')).toEqual([
      el('p', 0, 6, {}, [
          text('foo', 3, 6),
      ]),
      el('p', 6, 12, {}, [
          text('bar', 9, 12),
      ]),
    ]);
  });
});
