import {createValuePool} from './createValuePool';
import {IAttributeToken, IDataToken, IStartTagToken, ITagToken} from './createSaxParser';

export const attrTokenPool = createValuePool<IAttributeToken>(() => ({
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
}), () => undefined, 100);

export const startTagTokenPool = createValuePool<IStartTagToken>(() => ({
  tagName: '',
  rawTagName: '',
  attributes: [],
  selfClosing: false,
  start: 0,
  end: 0,
  nameStart: 0,
  nameEnd: 0,
}), () => undefined, 100);

export const dataTokenPool = createValuePool<IDataToken>(() => ({
  data: '',
  rawData: '',
  start: 0,
  end: 0,
  dataStart: 0,
  dataEnd: 0,
}), () => undefined, 100);

export const endTagTokenPool = createValuePool<ITagToken>(() => ({
  tagName: '',
  rawTagName: '',
  start: 0,
  end: 0,
  nameStart: 0,
  nameEnd: 0,
}), () => undefined, 100);
