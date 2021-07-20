import {IDomHandler, IParser, IParserOptions} from './parser-types';
import {createDomParser} from './createDomParser';
import {htmlParserOptions} from './createHtmlSaxParser';

export function createHtmlDomParser<Node, ContainerNode extends Node>(handler: IDomHandler<Node, ContainerNode>, options?: IParserOptions): IParser<Array<Node>> {
  return createDomParser(handler, Object.assign({}, htmlParserOptions, options));
}
