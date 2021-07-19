export interface IArrayLike<T> {
  [index: number]: T;

  length: number;
}

/**
 * The token read from the source.
 */
export interface IToken {

  /**
   * The index where token starts.
   */
  start: number;

  /**
   * The index where token ends.
   */
  end: number;
}

/**
 * The tag token read from the source.
 */
export interface ITagToken extends IToken {

  /**
   * The tag name as it was read from the source.
   */
  rawName: string;

  /**
   * The tag name after {@link IParserOptions.renameTag} was applied.
   */
  name: string;

  /**
   * The index where the {@link rawName} starts or -1 if this tag doesn't actually present in the source.
   */
  nameStart: number;

  /**
   * The index where the {@link rawName} ends or -1 if this tag doesn't actually present in the source.
   */
  nameEnd: number;
}

/**
 * The start tag token read from the source.
 */
export interface IStartTagToken extends ITagToken {

  /**
   * The list of attributes.
   *
   * This array-like object and {@link IAttributeToken} objects that it contains are pooled. They all are revoked after
   * the handler callback finishes. So if you want to preserve the token be sure to make a deep copy. Object pooling is
   * used to reduce memory consumption during parsing by avoiding excessive object allocation.
   */
  attributes: IArrayLike<IAttributeToken>;

  /**
   * `true` if tag is self-closing, `false` otherwise.
   *
   * @see {@link IParserOptions.selfClosingEnabled}
   */
  selfClosing: boolean;
}

/**
 * The character data token read from the source.
 */
export interface IDataToken extends IToken {

  /**
   * The data as it was read from the source.
   */
  rawData: string;

  /**
   * The data after {@link IParserOptions.decodeText} was applied.
   */
  data: string;

  /**
   * The index where the {@link rawData} starts.
   */
  dataStart: number;

  /**
   * The index where the {@link rawData} ends.
   */
  dataEnd: number;
}

/**
 * The tag attribute token read from the source.
 */
export interface IAttributeToken extends IToken {

  /**
   * The name of the attribute as it was read from the source.
   */
  rawName: string;

  /**
   * The name of the attribute after {@link IParserOptions.renameAttribute} was applied.
   */
  name: string;

  /**
   * The index where {@link rawName} starts.
   */
  nameStart: number;

  /**
   * The index where {@link rawName} ends.
   */
  nameEnd: number;

  /**
   * The value of the attribute as it was read from the source.
   *
   * If value is omitted and name is followed by "=" char (`foo=`) then {@link rawValue} is `null`. If value is omitted
   * and name isn't followed by a "=" char (`foo`) then {@link rawValue} is `undefined`.
   */
  rawValue: string | null | undefined;

  /**
   * The value of the attribute after {@link IParserOptions.decodeAttribute} was applied.
   *
   * If value is omitted and name is followed by "=" char (`foo=`) then {@link value} is `null`. If value is omitted
   * and name isn't followed by a "=" char (`foo`) then {@link value} is `undefined`.
   */
  value: string | null | undefined;

  /**
   * The index where {@link rawValue} starts or -1 if value was omitted.
   */
  valueStart: number;

  /**
   * The index where {@link rawValue} ends or -1 if value was omitted.
   */
  valueEnd: number;

  /**
   * `true` is {@link rawValue} was surrounded with quotes.
   */
  quoted: boolean;
}

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
   * @param source The source to parse. If omitted then content of the internal buffer is parsed.
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
   * Toggles CDATA sections recognition (`<![CDATA[foo]]>`). If set to `false` then CDATA sections are treated as
   * comments.
   *
   * @see {@link ISaxHandler.cdata}
   */
  cdataEnabled?: boolean;

  /**
   * Toggles processing instructions recognition (`<?foo?>`). If set to `false` then processing instructions are
   * treated as comments.
   *
   * @see {@link ISaxHandler.processingInstruction}
   */
  processingInstructionsEnabled?: boolean;

  /**
   * Toggles self-closing tags recognition (`<foo/>`). If set to `false` then slash in self closing tags is ignored or
   * processed as a part of an attribute value, depending on the markup.
   *
   * @see {@link checkVoidTag}
   */
  selfClosingEnabled?: boolean;

  /**
   * Decodes XML entities in a plain text value.
   *
   * @see {@link createEntitiesDecoder}
   */
  decodeText?: (text: string) => string;

  /**
   * Decodes XML entities in an attribute value. If omitted then {@link decodeText} callback is used.
   *
   * @see {@link createEntitiesDecoder}
   */
  decodeAttribute?: (value: string) => string;

  /**
   * Rewrites a tag name. Start and end tags are matched via tag name comparison. Provide a rewriter to support
   * case-insensitive tag matching.
   *
   * @see {@link ITagToken.rawName}
   */
  renameTag?: (name: string) => string;

  /**
   * Rewrites an attribute name.
   */
  renameAttribute?: (name: string) => string;

  /**
   * Checks whether the content of the container tag should be interpreted as a markup or as a character data. Entities
   * aren't decoded in the content of character data tags. Useful when parsing such tags as `script`, `style` and
   * others.
   *
   * @param token The start tag token read from the source.
   * @returns `true` to interpret the contents of the `token` container tag as a character data, `false` otherwise.
   */
  checkCdataTag?: (token: IStartTagToken) => boolean;

  /**
   * Checks whether the tag has no content. Useful when parsing such tags as `hr`, `img` and others.
   *
   * @param token The start tag token.
   * @returns `true` to interpret tag as self-closing even if it isn't marked up as such, `false` otherwise.
   */
  checkVoidTag?: (token: IStartTagToken) => boolean;

  /**
   * Checks whether the container should be implicitly closed with corresponding end tag when start tag is read. Useful
   * when parsing such tags as `p`, `li`, `td` and others.
   *
   * @param ancestorToken The token of an opened container tag.
   * @param token The token of the start tag that was read.
   * @returns `true` if start tag `token` should implicitly close the currently opened container `ancestorToken`. This
   *     causes {@link endTag} to be triggered for `ancestorToken` before {@link startTag} is triggered with `token`.
   */
  checkImplicitEndTag?: (ancestorTagToken: IStartTagToken, token: IStartTagToken) => boolean;

  /**
   * Checks whether the container `token` is a boundary. Implicitly closed tags are checked in scope of the enclosing
   * boundary. For example, you can create custom boundary tags that would allow nesting `p` tags.
   *
   * @param token The container tag token.
   */
  checkBoundaryTag?: (token: ITagToken) => boolean;
}

/**
 * Defines callbacks that are invoked during SAX parsing.
 *
 * **Note:** Don't keep references to tokens! Tokens passed to the handler callbacks are pooled objects that are reused
 * by the parser after callback finishes. Make a deep copy to retain a token.
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
 * Defines node factories and callbacks that are invoked during DOM parsing.
 *
 * **Note:** Don't keep references to tokens! Tokens passed to some of the handler callbacks are pooled objects that
 * are reused by the parser after callback finishes. Make a deep copy to retain a token.
 */
export interface IDomHandler<Node, ContainerNode extends Node> {

  /**
   * Creates a new element node.
   */
  element: (token: IStartTagToken) => ContainerNode;

  /**
   * Triggered when the `node` must be added to the list of children of the `parentNode`.
   */
  appendChild: (parentNode: ContainerNode, node: Node) => void;

  /**
   * Triggered when an element or a document was fully read from source.
   *
   * @param node The element or document node for which the end token was read.
   * @param token The token that closes the container.
   */
  containerEnd?: (node: ContainerNode, token: IToken) => void;

  /**
   * Creates a new text node.
   */
  text?: (token: IDataToken) => Node;

  /**
   * Creates a new document node when a DOCTYPE was read.
   */
  document?: (doctypeToken: IDataToken) => ContainerNode;

  /**
   * Creates a new comment node.
   */
  comment?: (token: IDataToken) => Node;

  /**
   * Creates a new processing instruction node.
   */
  processingInstruction?: (token: IDataToken) => Node;

  /**
   * Creates a new CDATA section node.
   */
  cdata?: (token: IDataToken) => Node;
}
