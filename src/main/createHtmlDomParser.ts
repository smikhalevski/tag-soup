import {IDomHandler, IParser, IParserOptions} from './parser-types';
import {createDomParser} from './createDomParser';
import {htmlParserOptions} from './createHtmlSaxParser';

export function createHtmlDomParser<Node, ContainerNode extends Node>(options?: IParserOptions): IParser<IDomHandler<Node, ContainerNode>, Array<Node>> {
  return createDomParser<Node, ContainerNode>(Object.assign({}, htmlParserOptions, options));
}
