import {IElementNode, ITextNode, Node, NodeType} from '../main/dom-types';
import {IParser} from '../main/parser-types';
import {createHtmlDomParser} from '../main/createHtmlDomParser';

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

describe('createHtmlDomParser', () => {

  let parser: IParser<Array<Node>>;

  beforeEach(() => {
    parser = createHtmlDomParser();
  });

  it('parses self-closing tag as a start tag', () => {
    expect(parser.parse('<a/>foo')).toEqual([
      element('a', 0, 7, false, {}, [
        text('foo', 4, 7),
      ]),
    ]);
  });

  it('implicitly closes paragraph', () => {
    expect(parser.parse('<p><p>aaa</p></p>')).toEqual([
      element('p', 0, 3),
      element('p', 3, 13, false, {}, [
        text('aaa', 6, 9),
      ]),
    ]);
  });
});
