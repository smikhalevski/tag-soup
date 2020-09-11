import {createDomParser, DomParser, DomParserOptions} from '../main/createDomParser';

describe('createDomParser', () => {

  let domParserOptions: DomParserOptions<any, any, any> = {
    createElement(tagName, attrs, selfClosing, start, end) {
      return {tagName, attrs, start, end, children: []};
    },
    createTextNode(data, start, end) {
      return {data, start, end};
    },
    appendChild(element, childNode) {
      element.children.push(childNode);
    },
    onContainerEnd(node, start, end) {
      node.end = end;
    },
  };

  let parser: DomParser<any>;

  beforeEach(() => {
    parser = createDomParser(domParserOptions);
  });

  describe('in streaming mode', () => {

    it('defers text parsing', () => {

      expect(parser.write('<a>foo')).toEqual([
        {tagName: 'a', start: 0, end: 3, attrs: {length: 0}, children: []},
      ]);

      expect(parser.write('bar')).toEqual([
        {tagName: 'a', start: 0, end: 3, attrs: {length: 0}, children: []},
      ]);

      expect(parser.write('qux</a>')).toEqual([
        {
          tagName: 'a', start: 0, end: 16, attrs: {length: 0}, children: [
            {data: 'foobarqux', start: 3, end: 12},
          ],
        },
      ]);
    });

  });

  describe('in non-streaming mode', () => {

    it('parses text', () => {
      expect(parser.parse('okay')).toEqual([
        {data: 'okay', start: 0, end: 4},
      ]);
    });

    it('parses tag with text', () => {
      expect(parser.parse('<a>okay</a>')).toEqual([
        {
          tagName: 'a', start: 0, end: 11, attrs: {length: 0}, children: [
            {data: 'okay', start: 3, end: 7},
          ],
        },
      ]);
    });

    it('parses attributes', () => {
      expect(parser.parse('<a foo=bar></a>')).toEqual([
        {
          tagName: 'a',
          start: 0,
          end: 15,
          attrs: {length: 1, 0: {name: 'foo', value: 'bar', start: 3, end: 10}},
          children: [],
        },
      ]);
    });

    it('recognizes void elements', () => {
      parser = createDomParser({
        ...domParserOptions,
        isVoidContent: (tagName) => tagName === 'a',
      });

      expect(parser.parse('<a><a>')).toEqual([
        {tagName: 'a', start: 0, end: 3, attrs: {length: 0}, children: []},
        {tagName: 'a', start: 3, end: 6, attrs: {length: 0}, children: []},
      ]);
    });

    it('renders children of void elements as siblings', () => {
      parser = createDomParser({
        ...domParserOptions,
        isVoidContent: (tagName) => tagName === 'a',
      });

      expect(parser.parse('<a><b></b></a>')).toEqual([
        {tagName: 'a', start: 0, end: 3, attrs: {length: 0}, children: []},
        {tagName: 'b', start: 3, end: 10, attrs: {length: 0}, children: []},
      ]);
    });

    it('parses nested tags', () => {
      expect(parser.parse('<a><b></b></a>')).toEqual([
        {
          tagName: 'a', start: 0, end: 14, attrs: {length: 0}, children: [
            {tagName: 'b', start: 3, end: 10, attrs: {length: 0}, children: []},
          ],
        },
      ]);
    });

    it('parses nested tags that are closed in wrong order', () => {
      expect(parser.parse('<a><b></a></b>')).toEqual([
        {
          tagName: 'a', start: 0, end: 10, attrs: {length: 0}, children: [
            {tagName: 'b', start: 3, end: 6, attrs: {length: 0}, children: []},
          ],
        },
      ]);
    });

    it('parses nested tags that are closed in wrong order with matching parent', () => {
      expect(parser.parse('<b><a><b></a></b>')).toEqual([
        {
          tagName: 'b', start: 0, end: 17, attrs: {length: 0}, children: [
            {
              tagName: 'a', start: 3, end: 13, attrs: {length: 0}, children: [
                {tagName: 'b', start: 6, end: 9, attrs: {length: 0}, children: []},
              ],
            },
          ],
        },
      ]);
    });

    it('ignores unmatched closing tags', () => {
      parser = createDomParser(domParserOptions);

      expect(parser.parse('<a></b>eee')).toEqual([
        {
          tagName: 'a', start: 0, end: 10, attrs: {length: 0}, children: [
            {data: 'eee', start: 7, end: 10},
          ],
        },
      ]);
    });
  });
});
