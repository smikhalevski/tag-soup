import {IAttributeToken, IDataToken, IStartTagToken, ITagToken} from './parser-types';

export function createStartTagToken(): IStartTagToken {
  return {
    name: '',
    rawName: '',
    attributes: {length: 0},
    selfClosing: false,
    start: 0,
    end: 0,
    nameStart: 0,
    nameEnd: 0,
  };
}

export function createTagToken(): ITagToken {
  return {
    name: '',
    rawName: '',
    start: 0,
    end: 0,
    nameStart: 0,
    nameEnd: 0,
  };
}

export function createDataToken(): IDataToken {
  return {
    data: '',
    rawData: '',
    start: 0,
    end: 0,
    dataStart: 0,
    dataEnd: 0,
  };
}

export function createAttributeToken(): IAttributeToken {
  return {
    name: '',
    rawName: '',
    value: '',
    rawValue: '',
    quoted: false,
    start: 0,
    end: 0,
    nameStart: 0,
    nameEnd: 0,
    valueStart: 0,
    valueEnd: 0,
  };
}
