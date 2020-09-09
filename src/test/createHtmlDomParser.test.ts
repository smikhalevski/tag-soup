import {Attribute, createTagSoupElement, createTagSoupText, TagSoupElement, TagSoupNode} from '../main';
import {createHtmlDomParser} from '../main/createHtmlDomParser';

function el(tagName: string, start: number, end: number, selfClosing = false, attrs: Array<Attribute> = [], children: Array<TagSoupNode> = []): TagSoupElement {
  const el = createTagSoupElement(tagName, attrs, selfClosing, start, end);

  el.children = children;
  for (const child of children) {
    child.parent = el;
  }
  return el;
}

const text = createTagSoupText;

describe('createHtmlDomParser', () => {

  it('implicitly closes paragraph', () => {
    const parser = createHtmlDomParser();

    expect(parser.commit('<p><p>aaa</p></p>')).toEqual([
      el('p', 0, 3),
      el('p', 3, 13, false, [], [
        text('aaa', 6, 9),
      ]),
    ]);
  });
});
