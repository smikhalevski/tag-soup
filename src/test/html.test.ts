import {createTagSoupElement, createTagSoupText, TagSoupElement, TagSoupNode} from '../main/createTagSoupDomParser';
import {createHtmlTagSoupDomParser} from '../main/html';

function el(tagName: string, start: number, end: number, attrs: Record<string, string> = {}, children: Array<TagSoupNode> = []): TagSoupElement {
  const el = createTagSoupElement(tagName, attrs, start, end, children);

  for (const child of children) {
    child.parent = el;
  }
  return el;
}

const text = createTagSoupText;

describe('createHtmlTagSoupDomParser', () => {

  it('implicitly closes paragraph', () => {
    const parser = createHtmlTagSoupDomParser();

    expect(parser.commit('<p><p>aaa</p></p>')).toEqual([
      el('p', 0, 3),
      el('p', 3, 13, {}, [
          text('aaa', 6, 9),
      ]),
      el('p', 0, 6),
    ]);
  });
});
