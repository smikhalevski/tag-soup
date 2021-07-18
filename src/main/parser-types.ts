import {IDataToken, IStartTagToken, ITagToken} from './token-types';

/**
 * The streaming parser.
 */
export interface IParser<Handler, Result> {

  /**
   * Tries to parse a given source chunk. If there's an ambiguity during parsing then the parser is paused until the
   * next {@link write} or {@link parse} invocation. The part of chunk that wasn't parsed is appended to an internal
   * buffer.
   *
   * @param handler The parsing handler.
   * @param sourceChunk The source chunk to parse.
   */
  write(handler: Handler, sourceChunk: string): Result;

  /**
   * Parses the source. If there's a leftover in the internal buffer after the last {@link write} call it is also used
   * for parsing. Parser is reset after parsing is completed.
   *
   * @param handler The parsing handler.
   * @param source The source to parse.
   */
  parse(handler: Handler, source?: string): Result;

  /**
   * Clears the internal buffer and resets the parser state.
   */
  reset(): void;
}

/**
 * Options of a parser.
 */
export interface IParserOptions {

  /**
   * Enables CDATA sections recognition. If set to `false` then CDATA sections are treated as comments.
   *
   * @default false
   * @see {@link IXmlSaxHandler.cdata}
   */
  cdataSectionsEnabled?: boolean;

  /**
   * Enables processing instructions recognition. If set to `false` then processing instructions are treated as
   * comments.
   *
   * @default false
   * @see {@link IXmlSaxHandler.processingInstruction}
   */
  processingInstructionsEnabled?: boolean;

  /**
   * Enables processing of quirky comments (`<!foo>`). If set to `false` then quirky comments are treated as text.
   *
   * @default false
   */
  quirkyCommentsEnabled?: boolean;

  /**
   * Enables self-closing tags recognition. If set to `false` then slash in self closing tags is ignored or processed
   * as a part of an attribute value, depending on the markup.
   *
   * @default false
   * @see {@link checkVoidTag}
   */
  selfClosingEnabled?: boolean;

  /**
   * Decodes XML entities to plain text value. If `undefined` then no decoding is done.
   *
   * @see {@link createEntitiesDecoder}
   * @default undefined
   */
  decodeText?: (text: string) => string;

  /**
   * Decodes XML entities to an attribute value. If `undefined` then {@link decodeText} callback is used.
   *
   * @see {@link createEntitiesDecoder}
   * @default undefined
   */
  decodeAttribute?: (value: string) => string;

  /**
   * Rewrites a tag name. Start and end tags are matched via tag name comparison. Provide a rewriter to support
   * case-insensitive tag matching.
   *
   * @see {@link xmlEnabled}
   * @see {@link ITagToken.rawName}
   * @default undefined
   */
  renameTag?: (name: string) => string;

  /**
   * Rewrites an attribute name. If `undefined` then no rewriting is done.
   * @default undefined
   */
  renameAttribute?: (name: string) => string;

  /**
   * Checks whether the content of the container tag should be interpreted as a markup or as a character data. Entities
   * aren't decoded in the content of character data tags. Useful when parsing such tags as `script`, `style` and
   * others. If `undefined` then content of all tags is interpreted as a markup.
   *
   * @param token The start tag token read from the source.
   * @returns `true` to interpret the contents of the `token` container tag as a character data, `false` otherwise.
   * @default undefined
   */
  checkCdataTag?: (token: IStartTagToken) => boolean;

  /**
   * Checks whether the tag has no content. Useful when parsing such tags as `hr`, `img` and others. If `undefined`
   * then no tags are interpreted as void.
   *
   * @param token The start tag token.
   * @returns `true` to interpret tag as self-closing even if it isn't marked up as such, `false` otherwise.
   */
  checkVoidTag?: (token: IStartTagToken) => boolean;

  /**
   * Checks whether the container should be implicitly closed with corresponding end tag when start tag is read. Useful
   * when parsing such tags as `p`, `li`, `td` and others.
   *
   * @param ancestorToken The token of the currently opened container tag.
   * @param token The token of the start tag that was read.
   * @returns `true` if start tag `token` should implicitly close the currently opened container `ancestorToken`. This
   *     would cause that {@link endTag} would be triggered for `ancestorToken` before {@link startTag} with `token`.
   */
  checkImplicitEndTag?: (ancestorToken: IStartTagToken, token: IStartTagToken) => boolean;

  /**
   * Checks whether the container `token` is a document fragment boundary, so implicitly closed tags shouldn't be
   * checked outside of it.
   *
   * @param token The container tag token.
   */
  checkFragmentTag?: (token: ITagToken) => boolean;
}

/**
 * Defines callbacks that are invoked during SAX parsing of an XML or an HTML document.
 */
export interface ISaxHandler {

  /**
   * Triggered when a start tag and its attributes were read.
   */
  startTag?: (token: IStartTagToken) => void;

  /**
   * Triggered when an end tag was read.
   */
  endTag?: (token: ITagToken) => void;

  /**
   * Triggered when a text was read.
   */
  text?: (token: IDataToken) => void;

  /**
   * Triggered when a comment was read.
   */
  comment?: (token: IDataToken) => void;

  /**
   * Triggered when a DOCTYPE was read.
   */
  doctype?: (token: IDataToken) => void;
}

/**
 * Defines callbacks that are invoked during SAX parsing of an XML document.
 */
export interface IXmlSaxHandler extends ISaxHandler {

  /**
   * Triggered when a processing instruction was read.
   */
  processingInstruction?: (token: IDataToken) => void;

  /**
   * Triggered when a CDATA section was read.
   */
  cdata?: (token: IDataToken) => void;
}

/**
 * Defines callbacks that are invoked during DOM parsing of an XML or an HTML document.
 */
export interface IDomHandler<Node, Element extends Node = Node, Text extends Node = Node> {

  /**
   * Creates a new element node.
   */
  element: (token: IStartTagToken) => Element;

  /**
   * Triggered when `childNode` must be added to the list of children of an `element`.
   */
  elementChild: (element: Element, childNode: Node) => void;

  /**
   * Triggered when the end tag of the container was fully read from source.
   *
   * @param element The element for which the end tag was read.
   * @param token The token that closes the element.
   */
  elementEnd?: (element: Element, token: ITagToken) => void;

  /**
   * Factory that creates a new text node.
   */
  text?: (token: IDataToken) => Text;

  /**
   * Factory that creates a new DOCTYPE node.
   */
  doctype?: (token: IDataToken) => Node;

  /**
   * Factory that creates a new comment node.
   */
  comment?: (token: IDataToken) => Node;
}

/**
 * Defines callbacks that are invoked during DOM parsing of an XML document.
 */
export interface IXmlDomHandler<Node, Element extends Node = Node, Text extends Node = Node> extends IDomHandler<Node, Element, Text> {

  /**
   * Factory that creates a new processing instruction.
   */
  processingInstruction?: (token: IDataToken) => Node;

  /**
   * Factory that creates a new CDATA section node.
   */
  cdata?: (token: IDataToken) => Node;
}
