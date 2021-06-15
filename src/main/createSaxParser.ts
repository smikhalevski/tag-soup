import {Rewriter} from './parser-utils';
import {parseSax} from './parseSax';

export interface IAttribute {

  /**
   * The name of the attribute.
   */
  name: string;

  /**
   * The decoded value of the attribute. If attribute didn't have a value then an empty string.
   */
  value: string;

  /**
   * The index of the char at which attribute declaration starts.
   */
  start: number;

  /**
   * The index of the char at which attribute declaration ends (exclusive).
   */
  end: number;

  nameStart: number;
  nameEnd: number;
  valueStart: number;
  valueEnd: number;
}

export interface IDataToken {
  data: string;
  start: number;
  end: number;
}

export interface IStartTagToken {
  tagName: string;
  attrs: ArrayLike<IAttribute>;
  selfClosing: boolean;
  start: number;
  end: number;
  nameStart: number;
  nameEnd: number;
}

export interface IEndTagToken {
  tagName: string;
  start: number;
  end: number;
  nameStart: number;
  nameEnd: number;
}

/**
 * Type of the callback triggered by SAX parser that should process a plain text data.
 *
 * @param data The text extracted from the source.
 * @param start The index of the char at which the `data` substring starts in the source.
 * @param end The index of the char at which the `data` substring ends in the source.
 */
export type DataCallback = (token: IDataToken) => void;

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
   * Decodes XML entities in an attribute value. By default, only XML entities are decoded.
   *
   * @see {@link createEntitiesDecoder}
   */
  decodeAttr?: Rewriter;

  /**
   * Decodes XML entities in plain text value. By default, only XML entities are decoded.
   *
   * @see {@link createEntitiesDecoder}
   */
  decodeText?: Rewriter;

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
   * Enables self-closing tags recognition. This is always enabled if {@link xmlEnabled} is set to `true`.
   *
   * @default false
   */
  selfClosingEnabled?: boolean;

  /**
   * Determines whether the container tag content should be interpreted as a markup or as a plain text. Useful when
   * parsing `script` and `style` tags. By default, `false` for all tags.
   *
   * @param tagName The name of the start tag.
   * @returns If `true` than the content inside the container tag would be treated as a plain text.
   */
  isTextContent?: (token: IStartTagToken) => boolean;
}

export interface ISaxParserCallbacks {

  /**
   * Triggered when a start tag and its attributes were read.
   *
   * @param tagName The name of the start tag.
   * @param attrs An array-like object that holds pooled objects that would be revoked after this callback finishes. To
   *     preserve parsed attributes make a deep copy of `attrs`. Object pooling is used to reduce memory consumption
   *     during parsing by avoiding excessive allocations.
   * @param selfClosing `true` if tag is self-closing.
   * @param start The index of char at which tag declaration starts.
   * @param end The index of char at which tag declaration ends (exclusive).
   */
  onStartTag?: (token: IStartTagToken) => void;

  /**
   * Triggered when an end tag was read.
   *
   * @param tagName The name of the end tag.
   * @param start The index of char at which tag declaration starts.
   * @param end The index of char at which tag declaration ends (exclusive).s
   */
  onEndTag?: (token: IEndTagToken) => void;

  /**
   * Triggered when a chunk of text was read.
   */
  onText?: DataCallback;

  /**
   * Triggered when a comment was read.
   */
  onComment?: DataCallback;

  /**
   * Triggered when a processing instruction was read.
   */
  onProcessingInstruction?: DataCallback;

  /**
   * Triggered when a CDATA section was read. This is triggered only when `xmlEnabled` is set to `true`, otherwise
   * CDATA sections are treated as plain text.
   */
  onCdataSection?: DataCallback;

  /**
   * Triggered when a DOCTYPE was read. This library doesn't process the contents of the DOCTYPE so `data` argument
   * would contain the raw source of the DOCTYPE declaration.
   */
  onDocumentType?: DataCallback;

  /**
   * Triggered when parser is reset.
   *
   * @see {@link SaxParser.reset}
   */
  onReset?: () => void;

  /**
   * Triggered after parser was provided a new source chunk.
   *
   * @param sourceChunk The chunk of data that was provided to parser.
   * @param parsedCharCount The total number of characters that were parsed by parser.
   * @see {@link SaxParser.write}
   */
  onWrite?: (sourceChunk: string, parsedCharCount: number) => void;

  /**
   * Triggered when parsing has completed but before the parser is reset.
   *
   * @param source The source that was parsed.
   * @param parsedCharCount The total number of characters that were parsed by parser.
   * @see {@link SaxParser.parse}
   */
  onParse?: (source: string, parsedCharCount: number) => void;
}

export interface ISaxParserOptions extends ISaxParserDialectOptions, ISaxParserCallbacks {
}

export interface ISaxParser {

  /**
   * Resets the internal state of the parser.
   */
  reset(): void;

  /**
   * Try to parse a given source chunk. If there's an ambiguity during parsing then the parser is paused until the next
   * {@link write} or {@link parse} invocation. The part of chunk that was not parsed is appended to internal
   * buffer.
   *
   * @param sourceChunk The source chunk to parse.
   * @return The number of chars remaining in buffer. If 0 is returned then all chars were read.
   */
  write(sourceChunk: string): number;

  /**
   * Parses the given source. If there's a leftover in the buffer after the last {@link write} call it is also used
   * for parsing. Parser is reset after this method completes.
   *
   * @param source The source to parse.
   * @return The number of chars at the end of `source` that weren't read. If 0 is returned then all chars were read.
   */
  parse(source?: string): number;
}

/**
 * Creates a streaming SAX parser that emits tags as is.
 */
export function createSaxParser(options: ISaxParserOptions = {}): ISaxParser {
  const {
    onReset,
    onWrite,
    onParse,
  } = options;

  let buffer = '';
  let offset = 0;
  let parsedCharCount = 0;

  const reset = () => {
    buffer = '';
    offset = 0;
    onReset?.();
  };

  return {
    reset,

    write(chunk) {
      buffer += chunk;
      const l = parseSax(buffer, true, offset, options);
      parsedCharCount += l;
      buffer = buffer.substr(l);
      offset += l;
      const remainder = buffer.length;
      onWrite?.(chunk, parsedCharCount);
      return remainder;
    },

    parse(chunk = '') {
      buffer += chunk;
      const l = parseSax(buffer, false, offset, options);
      parsedCharCount += l;
      const remainder = buffer.length - l;
      onParse?.(chunk, parsedCharCount);
      reset();
      return remainder;
    },
  };
}
