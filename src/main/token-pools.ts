import {createValuePool} from './createValuePool';
import {IAttributeToken, IDataToken, IStartTagToken, ITagToken} from './createSaxParser';

export const startTagTokenPool = createValuePool(createStartTagToken);
export const prevTagTokenPool = createValuePool(createTagToken);
export const endTagTokenPool = createValuePool(createTagToken);
export const dataTokenPool = createValuePool(createDataToken);
export const attrTokenPool = createValuePool(createAttributeToken);

function createStartTagToken(): IStartTagToken {
  return {
    tagName: '',
    rawTagName: '',
    attributes: [],
    selfClosing: false,
    start: 0,
    end: 0,
    nameStart: 0,
    nameEnd: 0,
  };
}

function createTagToken(): ITagToken {
  return {
    tagName: '',
    rawTagName: '',
    start: 0,
    end: 0,
    nameStart: 0,
    nameEnd: 0,
  };
}

function createDataToken(): IDataToken {
  return {
    data: '',
    rawData: '',
    start: 0,
    end: 0,
    dataStart: 0,
    dataEnd: 0,
  };
}

function createAttributeToken(): IAttributeToken {
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
