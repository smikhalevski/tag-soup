import {IDataToken, IStartTagToken, ITagToken} from './token-types';
import {Rewriter} from './decoder-types';

export interface ISaxParser {

  /**
   * Returns the buffered string that would be used during the next {@link write} or {@link parse} call.
   */
  getBuffer(): string;

  /**
   * Resets the internal state of the parser.
   */
  reset(): void;

  /**
   * Tries to parse a given source chunk. If there's an ambiguity during parsing then the parser is paused until the
   * next {@link write} or {@link parse} invocation. The part of chunk that was not parsed is appended to an internal
   * buffer.
   *
   * @param chunk The source chunk to parse.
   */
  write(chunk: string): void;

  /**
   * Parses the given source. If there's a leftover in the buffer after the last {@link write} call it is also used
   * for parsing. Parser is reset after this method completes.
   *
   * @param str The source to parse.
   */
  parse(str?: string): void;
}

export interface ISaxParserOptions extends ISaxParserDialectOptions, ISaxParserCallbacks {
}

/**
 * Type of the callback triggered by SAX parser that should process a text data token.
 */
export type DataTokenCallback = (token: IDataToken) => void;

export interface ISaxParserDialectOptions {

  /**
   * Determines whether XML rules should be applied during parsing.
   *
   * If set to `true` then:
   * - CDATA sections and processing instructions are parsed;
   * - Self-closing tags are recognized;
   * - Tag names are case-sensitive.
   *
   * If set to `false` then:
   * - CDATA sections and processing instructions are emitted as comments;
   * - Self-closing tags are treated as start tags;
   * - Tag names are case-insensitive.
   *
   * @default false
   */
  xmlEnabled?: boolean;

  /**
   * Enables self-closing tags recognition. This is always enabled if {@link xmlEnabled} is set to `true`.
   *
   * @default false
   */
  selfClosingEnabled?: boolean;

  /**
   * Decodes XML entities in plain text value. By default, only XML entities are decoded.
   *
   * @see createEntitiesDecoder
   */
  decodeText?: Rewriter;

  /**
   * Decodes XML entities in an attribute value. By default, uses rewriter from {@link decodeText}.
   *
   * @see createEntitiesDecoder
   */
  decodeAttr?: Rewriter;

  /**
   * Rewrites tag name. By default, in XML mode tags aren't renamed while in non-XML mode tags are converted to lower
   * case.
   */
  renameTag?: Rewriter;

  /**
   * Rewrites attribute name. By default, there's no rewriting.
   */
  renameAttr?: Rewriter;

  /**
   * Determines whether the container tag content should be interpreted as a markup or as a plain text. Useful when
   * parsing `script` and `style` tags. By default, `false` for all tags.
   *
   * @param token The start tag token read from the source.
   * @returns If `true` than the content inside the container tag would be treated as a plain text.
   */
  isTextContent?: (token: IStartTagToken) => boolean;
}

export interface ISaxParserCallbacks {

  /**
   * Triggered when a start tag and its attributes were read.
   */
  onStartTag?: (token: IStartTagToken) => void;

  /**
   * Triggered when an end tag was read.
   */
  onEndTag?: (token: ITagToken) => void;

  /**
   * Triggered when a chunk of text was read.
   */
  onText?: DataTokenCallback;

  /**
   * Triggered when a comment was read.
   */
  onComment?: DataTokenCallback;

  /**
   * Triggered when a processing instruction was read.
   */
  onProcessingInstruction?: DataTokenCallback;

  /**
   * Triggered when a CDATA section was read. This is triggered only when `xmlEnabled` is set to `true`, otherwise
   * CDATA sections are treated as plain text.
   */
  onCdataSection?: DataTokenCallback;

  /**
   * Triggered when a DOCTYPE was read. This library doesn't process the contents of the DOCTYPE so `data` argument
   * would contain the raw source of the DOCTYPE declaration.
   */
  onDocumentType?: DataTokenCallback;

  /**
   * Triggered after parser was provided a new source chunk.
   *
   * @param sourceChunk The chunk of data that was provided to parser.
   * @param parsedCharCount The total number of characters that were parsed by parser.
   * @see ISaxParser.write
   */
  onWrite?: (sourceChunk: string, parsedCharCount: number) => void;

  /**
   * Triggered after parsing was completed but before the parser is reset.
   *
   * @param source The source that was parsed.
   * @param parsedCharCount The total number of characters that were parsed by parser.
   * @see SaxParser.parse
   */
  onParse?: (source: string, parsedCharCount: number) => void;

  /**
   * Triggered when parser is reset.
   *
   * @see ISaxParser.reset
   */
  onReset?: () => void;

  /**
   * Triggered when an error was thrown during parsing.
   */
  onError?: (error: any) => void;
}

export interface IForgivingSaxParserOptions extends IForgivingSaxParserDialectOptions, ISaxParserCallbacks {
}

export interface IForgivingSaxParserDialectOptions extends ISaxParserDialectOptions {

  /**
   * Determines whether the tag cannot have any content.
   *
   * @param token The start tag token.
   * @returns `true` if the tag would be treated as self-closing even if it isn't marked up as such.
   */
  isVoidContent?: (token: IStartTagToken) => boolean;

  /**
   * Determines whether the container `containerToken` should be implicitly closed with corresponding end tag
   * when start tag `token` is read.
   *
   * @param containerToken The token of the currently opened container tag.
   * @param token The token of the start tag that was read.
   * @returns `true` if start tag `token` should implicitly close the currently opened container `containerToken`. This
   *     would cause that {@link onEndTag} would be triggered for `containerToken` before {@link onStartTag} with
   *     `token`.
   */
  isImplicitEnd?: (containerToken: ITagToken, token: IStartTagToken) => boolean;

  /**
   * Determine whether the container `token` denotes a fragment, so implicitly closed tags should not be checked
   * outside of it.
   *
   * @param token The container tag token.
   */
  isFragment?: (token: ITagToken) => boolean;
}
