import {createDomParser, DomParserOptions} from '../main';
import {DomParser} from '../main/createDomParser';

describe('createDomParser', () => {

  const createElementMock = jest.fn((tagName, start, end) => ({tagName, start, end, attrs: {}, children: []}));
  const createTextNodeMock = jest.fn((data, start, end) => ({data, start, end}));
  const appendChildMock = jest.fn((element, childNode) => element.children.push(childNode));
  const appendDataMock = jest.fn((textNode, data) => textNode.data += data);
  const cloneElementMock = jest.fn((element, start, end) => ({tagName: element.tagName, start, end, attrs: {...element.attrs}, children: []}));
  const setAttributeMock = jest.fn((element, name, value, start, end) => element.attrs[name] = value);
  const setEndOffsetMock = jest.fn((node, end) => node.end = end);

  let domParserOptions: DomParserOptions<any, any, any> = {
    createElement: createElementMock,
    createTextNode: createTextNodeMock,
    appendChild: appendChildMock,
    appendData: appendDataMock,
    cloneElement: cloneElementMock,
    setAttribute: setAttributeMock,
    setEndOffset: setEndOffsetMock,
  };

  let parser: DomParser<any>;

  beforeEach(() => {
    createElementMock.mockClear();
    createTextNodeMock.mockClear();
    appendChildMock.mockClear();
    appendDataMock.mockClear();
    cloneElementMock.mockClear();
    setAttributeMock.mockClear();
    setEndOffsetMock.mockClear();

    parser = createDomParser(domParserOptions);
  });

  it('parses tag with text', () => {
    expect(parser.commit('<a>okay</a>')).toEqual([
      {
        tagName: 'a', start: 0, end: 11, attrs: {}, children: [
          {data: 'okay', start: 3, end: 7},
        ],
      },
    ]);
  });

  it('parses attributes', () => {
    expect(parser.commit('<a foo=bar></a>')).toEqual([
      {tagName: 'a', start: 0, end: 15, attrs: {foo: 'bar'}, children: []},
    ]);
  });

  it('recognizes void elements', () => {
    parser = createDomParser({...domParserOptions, isVoidElement: (element) => element.tagName === 'a'});

    expect(parser.commit('<a><a>')).toEqual([
      {tagName: 'a', start: 0, end: 3, attrs: {}, children: []},
      {tagName: 'a', start: 3, end: 6, attrs: {}, children: []},
    ]);
  });

  it('renders children of void elements as siblings', () => {
    parser = createDomParser({...domParserOptions, isVoidElement: (element) => element.tagName === 'a'});

    expect(parser.commit('<a><b></b></a>')).toEqual([
      {tagName: 'a', start: 0, end: 3, attrs: {}, children: []},
      {tagName: 'b', start: 3, end: 10, attrs: {}, children: []},
    ]);
  });

  it('parses nested tags', () => {
    expect(parser.commit('<a><b></b></a>')).toEqual([
      {
        tagName: 'a', start: 0, end: 14, attrs: {}, children: [
          {tagName: 'b', start: 3, end: 10, attrs: {}, children: []},
        ],
      },
    ]);
  });

  it('parses nested tags that are closed in wrong order', () => {
    expect(parser.commit('<a><b></a></b>')).toEqual([
      {
        tagName: 'a', start: 0, end: 10, attrs: {}, children: [
          {tagName: 'b', start: 3, end: 6, attrs: {}, children: []},
        ],
      },
    ]);
  });

  it('restores orphan elements', () => {
    expect(parser.commit('<a><b><c></a><d>')).toEqual([
      {
        tagName: 'a', start: 0, end: 13, attrs: {}, children: [
          {
            tagName: 'b', start: 3, end: 9, attrs: {}, children: [
              {tagName: 'c', start: 6, end: 9, attrs: {}, children: []},
            ],
          },
        ],
      },
      {
        tagName: 'b', start: 13, end: 16, attrs: {}, children: [
          {
            tagName: 'c', start: 13, end: 16, attrs: {}, children: [
              {tagName: 'd', start: 13, end: 16, attrs: {}, children: []},
            ],
          },
        ],
      },
    ]);
  });
});
