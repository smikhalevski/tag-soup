import {IDomHandler, IParser, IParserOptions} from './parser-types';
import {createDomParser} from './createDomParser';
import {htmlParserOptions} from './createHtmlSaxParser';
import {domHandler} from './createXmlDomParser';
import {Node} from './dom-types';

/**
 * Creates a pre-configured HTML DOM parser that uses {@link domHandler}.
 *
 * @see {@link domHandler}
 */
export function createHtmlDomParser(): IParser<Array<Node>>;

/**
 * Creates a pre-configured HTML DOM parser.
 *
 * @template Node The type of object that describes a node in the DOM tree.
 * @template ContainerNode The type of object that describes an element or a document in the DOM tree.
 *
 * @param handler The parsing handler.
 * @param options Options that override the defaults.
 *
 * @see {@link domHandler}
 * @see {@link htmlParserOptions}
 */
export function createHtmlDomParser<Node, ContainerNode extends Node>(handler: IDomHandler<Node, ContainerNode>, options?: IParserOptions): IParser<Array<Node>>;

export function createHtmlDomParser(handler?: IDomHandler<unknown, unknown>, options?: IParserOptions) {
  return createDomParser(handler || domHandler, {...htmlParserOptions, ...options});
}
