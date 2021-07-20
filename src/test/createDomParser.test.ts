import {createDomParser} from '../main/createDomParser';
import {IDomHandler, IParser, IParserOptions} from '../main/parser-types';

describe('createDomParser', () => {

  let options: IParserOptions;
  let parser: IParser<any>;
  let handler: IDomHandler<any, any>;

  beforeEach(() => {
    options = {};
    handler = {

      element(token) {
        return {
          tagName: token.name,
          attributes: Array.from(token.attributes).map((attribute) => {
            return {
              name: attribute.name,
              value: attribute.value,
              start: attribute.start,
              end: attribute.end,
            };
          }),
          start: token.start,
          end: token.end,
          children: [],
        };
      },

      appendChild(element, childNode) {
        element.children.push(childNode);
      },

      containerEnd(element, token) {
        element.end = token.end;
      },

      text(token) {
        return {
          data: token.data,
          start: token.start,
          end: token.end,
        };
      },
    };

    parser = createDomParser(handler, options);
  });

  describe('in streaming mode', () => {

    it('defers text parsing', () => {

      expect(parser.write('<a>foo')).toEqual([
        {tagName: 'a', start: 0, end: 3, attributes: [], children: []},
      ]);

      expect(parser.write('bar')).toEqual([
        {tagName: 'a', start: 0, end: 3, attributes: [], children: []},
      ]);

      expect(parser.write('qux</a>')).toEqual([
        {
          tagName: 'a', start: 0, end: 16, attributes: [], children: [
            {data: 'foobarqux', start: 3, end: 12},
          ],
        },
      ]);
    });

    it('returns the same array on every write', () => {
      const nodes = parser.write('<a>');

      expect(parser.write('</a>')).toBe(nodes);

      expect(nodes).toEqual([
        {tagName: 'a', start: 0, end: 7, attributes: [], children: []},
      ]);
    });

    it('returns the new array after reset', () => {
      const nodes = parser.write('<a>');
      parser.reset();
      expect(parser.write('</a>')).not.toBe(nodes);
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
          tagName: 'a', start: 0, end: 11, attributes: [], children: [
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
          attributes: [{name: 'foo', value: 'bar', start: 3, end: 10}],
          children: [],
        },
      ]);
    });

    it('recognizes void elements', () => {
      options.checkVoidTag = (token) => token.name === 'a';

      parser = createDomParser(handler, options);

      expect(parser.parse('<a><a>')).toEqual([
        {tagName: 'a', start: 0, end: 3, attributes: [], children: []},
        {tagName: 'a', start: 3, end: 6, attributes: [], children: []},
      ]);
    });

    it('renders children of void elements as siblings', () => {
      options.checkVoidTag = (token) => token.name === 'a';

      parser = createDomParser(handler, options);

      expect(parser.parse('<a><b></b></a>')).toEqual([
        {tagName: 'a', start: 0, end: 3, attributes: [], children: []},
        {tagName: 'b', start: 3, end: 10, attributes: [], children: []},
      ]);
    });

    it('parses nested tags', () => {
      expect(parser.parse('<a><b></b></a>')).toEqual([
        {
          tagName: 'a', start: 0, end: 14, attributes: [], children: [
            {tagName: 'b', start: 3, end: 10, attributes: [], children: []},
          ],
        },
      ]);
    });

    it('parses nested tags that are closed in wrong order', () => {
      expect(parser.parse('<a><b></a></b>')).toEqual([
        {
          tagName: 'a', start: 0, end: 10, attributes: [], children: [
            {tagName: 'b', start: 3, end: 6, attributes: [], children: []},
          ],
        },
      ]);
    });

    it('parses nested tags that are closed in wrong order with matching parent', () => {
      expect(parser.parse('<b><a><b></a></b>')).toEqual([
        {
          tagName: 'b', start: 0, end: 17, attributes: [], children: [
            {
              tagName: 'a', start: 3, end: 13, attributes: [], children: [
                {tagName: 'b', start: 6, end: 9, attributes: [], children: []},
              ],
            },
          ],
        },
      ]);
    });

    it('ignores unmatched closing tags', () => {
      expect(parser.parse('<a></b>eee')).toEqual([
        {
          tagName: 'a', start: 0, end: 10, attributes: [], children: [
            {data: 'eee', start: 7, end: 10},
          ],
        },
      ]);
    });
  });
});
