/**
 * The error thrown by a tokenizer or a parser if an {@link MarkupSyntaxError.input input} is malformed.
 * A {@link JSONParser} also throws it if an input doesn't fit {@link JSONParserOptions its options}.
 *
 * Forgiving parsers, like {@link HTMLDOMParser}, never throw this error.
 *
 * @example
 * try {
 *   XMLDOMParser.parseFragment('<p>hello</br>');
 * } catch (error) {
 *   if (error instanceof MarkupSyntaxError) {
 *     error.input.substring(error.startIndex, error.endIndex);
 *     // ⮕ 'br'
 *   }
 * }
 *
 * @group Parser
 */
export class MarkupSyntaxError extends SyntaxError {
  static {
    this.prototype.name = 'MarkupSyntaxError';
  }

  /**
   * Creates a new {@link MarkupSyntaxError} instance.
   *
   * @param message The error message.
   * @param input The text where an error was detected.
   * @param startIndex The index of the first char in text where an error was detected, inclusive, or -1 if unknown.
   * @param endIndex The index of the last char in text where an error was detected, exclusive. Equals to
   * `startIndex` if the error points to a position rather than to a range of chars.
   * @param inputOffset The index in the stream where the input starts, so `inputOffset + startIndex` is the index in
   * the stream where the error was detected. The stream is all chunks that were written to a writer, and the input is
   * the part of the stream that the writer didn't read before, followed by the last written chunk.
   */
  constructor(
    message: string,
    public input: string,
    public startIndex = -1,
    public endIndex = startIndex,
    public inputOffset = 0
  ) {
    super(message);
  }
}
