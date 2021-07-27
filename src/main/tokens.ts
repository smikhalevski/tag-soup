import {IAttributeToken, IDataToken, IEndTagToken, IStartTagToken, Token, TokenType} from './parser-types';
import {objectCopy} from './misc';

/**
 * Clones an arbitrary token.
 */
export function clone(this: Token): any {
  const token = objectCopy(this);

  if (token.tokenType === TokenType.START_TAG) {
    const attributes = token.attributes = objectCopy(token.attributes);

    for (let i = 0; i < attributes.length; ++i) {
      attributes[i] = objectCopy(attributes[i]);
    }
  }
  return token;
}

export function createStartTagToken(): IStartTagToken {
  return {
    tokenType: TokenType.START_TAG,
    name: '',
    rawName: '',
    attributes: {length: 0},
    selfClosing: false,
    start: 0,
    end: 0,
    nameStart: 0,
    nameEnd: 0,
    clone,
  };
}

export function createEndTagToken(): IEndTagToken {
  return {
    tokenType: TokenType.END_TAG,
    name: '',
    rawName: '',
    start: 0,
    end: 0,
    nameStart: 0,
    nameEnd: 0,
    clone,
  };
}

export function createDataToken(): IDataToken {
  return {
    tokenType: TokenType.TEXT,
    data: '',
    rawData: '',
    start: 0,
    end: 0,
    dataStart: 0,
    dataEnd: 0,
    clone,
  };
}

export function createAttributeToken(): IAttributeToken {
  return {
    tokenType: TokenType.ATTRIBUTE,
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
    clone,
  };
}
