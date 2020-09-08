import {createDomParser, DomParser, DomParserOptions} from '../main/createDomParser';
import {ContentMode} from '../main/ContentMode';

describe('createDomParser', () => {

  const createElementMock = jest.fn((tagName, attrs, selfClosing, start, end) => ({
    tagName,
    start,
    end,
    attrs,
    children: [],
  }));
  const createTextNodeMock = jest.fn((data, start, end) => ({data, start, end}));
  const appendChildMock = jest.fn((element, childNode) => element.children.push(childNode));
  const setEndOffsetsMock = jest.fn((node, start, end) => node.end = end);

  let domParserOptions: DomParserOptions<any, any, any> = {
    createElement: createElementMock,
    createTextNode: createTextNodeMock,
    appendChild: appendChildMock,
    setEndOffsets: setEndOffsetsMock,
  };

  let parser: DomParser<any>;

  beforeEach(() => {
    createElementMock.mockClear();
    createTextNodeMock.mockClear();
    appendChildMock.mockClear();
    setEndOffsetsMock.mockClear();

    parser = createDomParser(domParserOptions);
  });

  it('parses text', () => {
    expect(parser.commit('okay')).toEqual([
      {data: 'okay', start: 0, end: 4},
    ]);
  });

  it('parses tag with text', () => {
    expect(parser.commit('<a>okay</a>')).toEqual([
      {
        tagName: 'a', start: 0, end: 11, attrs: [], children: [
          {data: 'okay', start: 3, end: 7},
        ],
      },
    ]);
  });

  it('parses attributes', () => {
    expect(parser.commit('<a foo=bar></a>')).toEqual([
      {tagName: 'a', start: 0, end: 15, attrs: [{name: 'foo', value: 'bar', start: 3, end: 10}], children: []},
    ]);
  });

  it('recognizes void elements', () => {
    parser = createDomParser({
      ...domParserOptions,
      getContentMode: (tagName) => tagName === 'a' ? ContentMode.VOID : ContentMode.FLOW,
    });

    expect(parser.commit('<a><a>')).toEqual([
      {tagName: 'a', start: 0, end: 3, attrs: [], children: []},
      {tagName: 'a', start: 3, end: 6, attrs: [], children: []},
    ]);
  });

  it('renders children of void elements as siblings', () => {
    parser = createDomParser({
      ...domParserOptions,
      getContentMode: (tagName) => tagName === 'a' ? ContentMode.VOID : ContentMode.FLOW,
    });

    expect(parser.commit('<a><b></b></a>')).toEqual([
      {tagName: 'a', start: 0, end: 3, attrs: [], children: []},
      {tagName: 'b', start: 3, end: 10, attrs: [], children: []},
    ]);
  });

  it('parses nested tags', () => {
    expect(parser.commit('<a><b></b></a>')).toEqual([
      {
        tagName: 'a', start: 0, end: 14, attrs: [], children: [
          {tagName: 'b', start: 3, end: 10, attrs: [], children: []},
        ],
      },
    ]);
  });

  it('parses nested tags that are closed in wrong order', () => {
    expect(parser.commit('<a><b></a></b>')).toEqual([
      {
        tagName: 'a', start: 0, end: 10, attrs: [], children: [
          {tagName: 'b', start: 3, end: 6, attrs: [], children: []},
        ],
      },
    ]);
  });

  it('does not add ignored elements', () => {
    parser = createDomParser({...domParserOptions, isIgnored: (tagName) => tagName === 'b'});

    expect(parser.commit('<a><b><c></a>')).toEqual([
      {
        tagName: 'a', start: 0, end: 13, attrs: [], children: [
          {tagName: 'c', start: 6, end: 9, attrs: [], children: []},
        ],
      },
    ]);
  });

  it('emits raw source instead of an element', () => {
    parser = createDomParser({...domParserOptions, isEmittedAsText: (tagName) => tagName === 'b'});

    expect(parser.commit('<a><b><c></b></a>')).toEqual([
      {
        tagName: 'a', start: 0, end: 17, attrs: [], children: [
          {data: '<b>', start: 3, end: 6},
          {
            tagName: 'c', start: 6, end: 13, attrs: [], children: [
              {data: '</b>', start: 9, end: 13},
            ],
          },
        ],
      },
    ]);
  });

  it('ignores unmatched closing tags', () => {
    parser = createDomParser(domParserOptions);

    expect(parser.commit('<a></b>eee')).toEqual([
      {
        tagName: 'a', start: 0, end: 10, attrs: [], children: [
          {data: 'eee', start: 7, end: 10},
        ],
      },
    ]);
  });
});
