import {Maybe, Rewriter} from './parser-utils';
import {tokenize} from './tokenize';

/**
 * The token read from the source.
 */
export interface IToken {

  /**
   * The index where token starts in the source.
   */
  start: number;

  /**
   * The index where token ends in the source.
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
  rawTagName: string;

  /**
   * The tag name after {@link renameTag} was applied.
   */
  tagName: string;

  /**
   * The index where {@link rawTagName} name starts.
   */
  nameStart: number;

  /**
   * The index where {@link rawTagName} name ends.
   */
  nameEnd: number;
}

/**
 * The start tag token read from the source.
 */
export interface IStartTagToken extends ITagToken {

  /**
   * An array-like object that holds pooled objects that would be revoked after this callback finishes. To preserve
   * attributes make a deep copy of this object. Object pooling is used to reduce memory consumption during parsing by
   * avoiding excessive object allocation.
   */
  attributes: ArrayLike<IAttributeToken>;

  /**
   * `true` if tag is self-closing, `false` otherwise. Ensure that {@link selfClosingEnabled} or {@link xmlEnabled} is
   * set to `true` to support self-closing tags.
   */
  selfClosing: boolean;
}

/**
 * The text, comment, processing instruction, CDATA or document type token read from the source.
 */
export interface IDataToken extends IToken {

  /**
   * The data as it was read from the source.
   */
  rawData: string;

  /**
   * The data after {@link decodeText} was applied.
   */
  data: string;

  /**
   * The index where the data starts excluding markup.
   */
  dataStart: number;

  /**
   * The index where the data ends excluding markup.
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
   * The name of the attribute after {@link renameAttr} was applied.
   */
  name: string;

  /**
   * The value of the attribute as it was read from the source.
   *
   * When {@link xmlEnabled} is set to `false` and an attribute was defined by name only then {@link value} is
   * `undefined`. If attribute is defined as a name followed by and equals sign, then {@link value} is `null`.
   */
  rawValue: Maybe<string>;

  /**
   * The value of the attribute after {@link decodeAttr} was applied.
   *
   * When {@link xmlEnabled} is set to `false` and an attribute was defined by name only then {@link value} is
   * `undefined`. If attribute is defined as a name followed by and equals sign, then {@link value} is `null`.
   */
  value: Maybe<string>;

  /**
   * `true` if value was surrounded by quote chars.
   */
  quoted: boolean;

  /**
   * The index where {@link rawName} name starts.
   */
  nameStart: number;

  /**
   * The index where {@link rawName} name ends.
   */
  nameEnd: number;

  /**
   * The index where {@link rawValue} starts or -1 if attribute name wasn't followed by an equals sign.
   */
  valueStart: number;

  /**
   * The index where {@link rawValue} ends or -1 if attribute name wasn't followed by an equals sign.
   */
  valueEnd: number;
}

/**
 * Type of the callback triggered by SAX parser that should process a plain text data.
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
   * Decodes XML entities in an attribute value. By default, only XML entities are decoded.
   *
   * @see createEntitiesDecoder
   */
  decodeAttr?: Rewriter;

  /**
   * Decodes XML entities in plain text value. By default, only XML entities are decoded.
   *
   * @see createEntitiesDecoder
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
}

export interface ISaxParserOptions extends ISaxParserDialectOptions, ISaxParserCallbacks {
}

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
   * Try to parse a given source chunk. If there's an ambiguity during parsing then the parser is paused until the next
   * {@link write} or {@link parse} invocation. The part of chunk that was not parsed is appended to an internal buffer.
   *
   * @param sourceChunk The source chunk to parse.
   * @return The number of chars remaining in buffer after parsing. If 0 is returned then all chars were read.
   */
  write(sourceChunk: string): void;

  /**
   * Parses the given source. If there's a leftover in the buffer after the last {@link write} call it is also used
   * for parsing. Parser is reset after this method completes.
   *
   * @param source The source to parse.
   * @return The number of chars that weren't read. If 0 is returned then all chars were read.
   */
  parse(source?: string): void;
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

    getBuffer() {
      return buffer;
    },

    reset,

    write(chunk) {
      chunk ??= '';
      buffer += chunk;
      const l = tokenize(buffer, true, offset, options);
      parsedCharCount += l;

      buffer = buffer.substr(l);
      offset += l;
      onWrite?.('' + chunk, parsedCharCount);
    },

    parse(chunk) {
      chunk ??= '';
      buffer += chunk;
      const l = tokenize(buffer, false, offset, options);
      parsedCharCount += l;

      onParse?.('' + chunk, parsedCharCount);
      reset();
    },
  };
}
