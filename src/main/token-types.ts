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
   * An array that holds pooled objects that would be revoked after the handler callback finishes. An array itself is
   * also a part of the object pool so make a deep copy of this array to preserve attributes, if needed. Object pooling
   * is used to reduce memory consumption during parsing by avoiding excessive object allocation.
   */
  attributes: Array<IAttributeToken>;

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
