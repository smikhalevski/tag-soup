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
   * The tag name after {@link renameTag} was applied.
   */
  name: string;

  /**
   * The index where the {@link rawName} starts or -1 if this tag doesn't actually present in the source.
   */
  nameStart: number | -1;

  /**
   * The index where the {@link rawName} ends or -1 if this tag doesn't actually present in the source.
   */
  nameEnd: number | -1;
}

/**
 * The start tag token read from the source.
 */
export interface IStartTagToken extends ITagToken {

  /**
   * An array that holds pooled objects that would be revoked after the {@link onStartTag} callback finishes. An array
   * itself is also a part of the object pool so make a deep copy of this array to preserve attributes if needed.
   * Object pooling is used to reduce memory consumption during parsing by avoiding excessive object allocation.
   */
  attrs: Array<IAttrToken>;

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
   * For text, comment, processing instruction and document type this is the data after {@link decodeText} was applied.
   * For CDATA this is the same as {@link rawData}.
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
export interface IAttrToken extends IToken {

  /**
   * The name of the attribute as it was read from the source.
   */
  rawName: string;

  /**
   * The name of the attribute after {@link renameAttr} was applied.
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
   * The value of the attribute after {@link decodeAttr} was applied.
   *
   * If value is omitted and name is followed by "=" char (`foo=`) then {@link value} is `null`. If value is omitted
   * and name isn't followed by a "=" char (`foo`) then {@link value} is `undefined`.
   */
  value: string | null | undefined;

  /**
   * The index where {@link rawValue} starts or -1 if value was omitted.
   */
  valueStart: number | -1;

  /**
   * The index where {@link rawValue} ends or -1 if value was omitted.
   */
  valueEnd: number | -1;

  /**
   * `true` is {@link rawValue} was surrounded with quotes.
   */
  quoted: boolean;
}
