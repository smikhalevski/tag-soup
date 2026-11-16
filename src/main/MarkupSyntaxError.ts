/**
 * The error thrown by a tokenizer or a parser if an {@link MarkupSyntaxError.input input} is malformed.
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
   * @param input The input where the error was detected.
   * @param startIndex The start index of the error in the input, inclusive, or -1 if unknown.
   * @param endIndex The end index of the error in the input, exclusive. Equals `startIndex` if the error points to a
   * position rather than to a range of chars.
   * @param inputOffset The index in the stream where the input starts, so `inputOffset + startIndex` is the index in
   * the stream where the error was detected. The stream is all chunks that were written to a writer, and the input is
   * the last written chunk, preceded by the part of earlier chunks that wasn't read yet.
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
