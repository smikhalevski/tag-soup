import {IDomHandler, IParser, IParserOptions} from './parser-types';
import {createDomParser} from './createDomParser';
import {htmlParserOptions} from './createHtmlSaxParser';
import {domHandler} from './createXmlDomParser';
import {INode} from './dom-types';

/**
 * Creates a pre-configured HTML DOM parser that uses {@link domHandler}.
 *
 * @see {@link domHandler}
 */
export function createHtmlDomParser(): IParser<Array<INode>>;

/**
 * Creates a pre-configured HTML DOM parser.
 *
 * @param handler The parsing handler.
 * @param options Options that override the defaults.
 *
 * @see {@link domHandler}
 */
export function createHtmlDomParser<Node, ContainerNode extends Node>(handler: IDomHandler<Node, ContainerNode>, options?: IParserOptions): IParser<Array<Node>>;

export function createHtmlDomParser(handler = domHandler, options?: IParserOptions) {
  return createDomParser(handler, Object.assign({}, htmlParserOptions, options));
}
