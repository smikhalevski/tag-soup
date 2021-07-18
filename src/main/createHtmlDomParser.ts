import {IDomHandler, IParser, IParserOptions} from './parser-types';
import {createDomParser} from './createDomParser';
import {htmlParserOptions} from './createHtmlSaxParser';

export function createHtmlDomParser<Node, Element extends Node = Node, Text extends Node = Node>(options?: IParserOptions): IParser<IDomHandler<Node, Element, Text>, Array<Node>> {
  return createDomParser<Node, Element, Text>(Object.assign({}, htmlParserOptions, options));
}
