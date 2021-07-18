import {DomNodeType, IDomAttributeMap, IDomElement, IDomNode, IDomText} from '../main';
import {createHtmlDomParser} from '../main/createHtmlDomParser';

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

describe('createHtmlDomParser', () => {

  it('implicitly closes paragraph', () => {
    const parser = createHtmlDomParser();

    expect(parser.parse('<p><p>aaa</p></p>')).toEqual([
      el('p', 0, 3),
      el('p', 3, 13, false, {}, [
        text('aaa', 6, 9),
      ]),
    ]);
  });
});
