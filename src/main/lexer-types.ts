import { TokenizerState } from 'tokenizer-dsl';

/**
 * The type of a token emitted by the lexer.
 *
 * <dl>
 * <dt><code>START_TAG_OPENING</code></dt>
 * <dd>
 *
 *
 * A start tag opening bracket and a tag name.
 *
 * ```html
 * <tagName
 * ```
 *
 * </dd>
 * <dt><code>START_TAG_CLOSING</code></dt>
 * <dd>
 *
 * A start tag closing bracket.
 *
 * ```html
 * >
 * ```
 *
 * </dd>
 * <dt><code>START_TAG_SELF_CLOSING</code></dt>
 * <dd>
 *
 * A self-closing tag closing.
 *
 * ```html
 * />
 * ```
 *
 * </dd>
 * <dt><code>ATTRIBUTE_NAME</code></dt>
 * <dd>
 *
 * The name of the attribute.
 *
 * </dd>
 * <dt><code>ATTRIBUTE_VALUE</code></dt>
 * <dd>
 *
 * An attribute value surrounded by quotes or apostrophes.
 *
 * ```html
 * "text" or 'text'
 * ```
 *
 * </dd>
 * <dt><code>ATTRIBUTE_UNQUOTED_VALUE</code></dt>
 * <dd>
 *
 * An attribute value without quotes or apostrophes.
 *
 * </dd>
 * <dt><code>END_TAG_OPENING</code></dt>
 * <dd>
 *
 * An end tag start bracket and a tag name.
 *
 * ```html
 * </tagName
 * ```
 *
 * </dd>
 * <dt><code>END_TAG_CLOSING</code></dt>
 * <dd>
 *
 * An end tag closing bracket.
 *
 * ```html
 * >
 * ```
 *
 * </dd>
 * <dt><code>IMPLICIT_END_TAG</code></dt>
 * <dd>
 *
 * Zero-width token that denotes that tag at `state.stack[cursor]` was implicitly closed.
 *
 * </dd>
 * <dt><code>IMPLICIT_START_TAG</code></dt>
 * <dd>
 *
 * An end tag start bracket and a tag name. Denotes that the start tag must be implicitly inserted before the end tag.
 *
 * ```html
 * </tagName
 * ```
 *
 * </dd>
 * <dt><code>COMMENT</code></dt>
 * <dd>
 *
 * A comment.
 *
 * ```html
 * <!-- text -->
 * ```
 *
 * </dd>
 * <dt><code>PROCESSING_INSTRUCTION</code></dt>
 * <dd>
 *
 * A processing instruction.
 *
 * ```xml
 * <? text ?>
 * ```
 *
 * </dd>
 * <dt><code>CDATA_SECTION</code></dt>
 * <dd>
 *
 * A CDATA section.
 *
 * ```xml
 * <![CDATA[ text ]]>
 * ```
 *
 * </dd>
 * <dt><code>DOCTYPE</code></dt>
 * <dd>
 *
 * A doctype section.
 *
 * ```html
 * <!DOCTYPE text >
 * ```
 *
 * </dd>
 * <dt><code>DTD</code></dt>
 * <dd>
 *
 * A DTD section.
 *
 * ```xml
 * <! text >
 * ```
 *
 * </dd>
 * <dt><code>TEXT</code></dt>
 * <dd>
 *
 * A plain text.
 *
 * </dd>
 * </dl>
 */
export type TokenType =
  | 'START_TAG_OPENING'
  | 'START_TAG_CLOSING'
  | 'START_TAG_SELF_CLOSING'
  | 'ATTRIBUTE_NAME'
  | 'ATTRIBUTE_VALUE'
  | 'ATTRIBUTE_UNQUOTED_VALUE'
  | 'END_TAG_OPENING'
  | 'END_TAG_CLOSING'
  | 'IMPLICIT_END_TAG'
  | 'IMPLICIT_START_TAG'
  | 'COMMENT'
  | 'PROCESSING_INSTRUCTION'
  | 'CDATA_SECTION'
  | 'DOCTYPE'
  | 'DTD'
  | 'TEXT';

/**
 * Triggered when a token was read from the input stream.
 */
export type LexerHandler<Context> = (
  type: TokenType,
  chunk: string,
  offset: number,
  length: number,
  context: Context,
  state: LexerState
) => void;

/**
 * Lexer is a streaming tokenizer that emits tokens in the correct order.
 */
export interface Lexer<Context = void> {
  (input: string | LexerState, handler: LexerHandler<Context>, context: Context): LexerState;

  write(chunk: string, state: LexerState | undefined, handler: LexerHandler<Context>, context: Context): LexerState;
}

export interface LexerState extends TokenizerState<LexerStage> {
  /**
   * The list of tag name hash codes.
   */
  stack: number[];

  /**
   * The index in stack that points to the current tag.
   */
  cursor: number;

  // TODO Move to LexerContext and replace with stack[cursor] if performance doesn't drop significantly
  /**
   * The hash code of the tag name, or 0 if not in a lexical context of a tag.
   */
  activeTag: number;
}

export interface LexerOptions extends ForeignLexerOptions {
  /**
   * If `true` then tag names are compared case-insensitively, otherwise case-sensitive comparison is used.
   *
   * **Note:** Only ASCII characters in tag names are compared case-insensitively.
   */
  caseInsensitiveTagsEnabled?: boolean;
}

export interface ForeignLexerOptions {
  /**
   * The list of void tag names. These tags are implicitly closed. Ex. `img`, `link`, `meta`, etc.
   */
  voidTags?: string[];

  /**
   * The list CDATA tags. The content of these tags is interpreted as plain text. Ex. `script`, `style`, etc.
   *
   * If tag name is also present in {@link voidTags} than it is ignored.
   */
  cdataTags?: string[];

  /**
   * The list of tags for which an implicit start tag would be inserted if an orphan end tag is met. Otherwise, an
   * orphan end tag is ignored.
   *
   * For example, in HTML `p` and `br` tags follow this semantics:
   * ```
   * </p>  → <p></p>
   * </br> → <br>
   * ```
   */
  implicitStartTags?: string[];

  /**
   * The map from a tag name (A) to a list of names of tags that must be implicitly closed if tag (A) is started.
   *
   * For example, in HTML `p`, `table`, and many other tags follow this semantics:
   * ```
   * <p>foo<h1>bar → <p>foo</p><h1>bar</h1>
   * ```
   *
   * To achieve the behavior above, set this option to:
   * ```
   * {p: ['h1']}
   * ```
   */
  implicitEndTags?: { [tagName: string]: string[] };

  /**
   * If `true` then lexer would respect self-closing tags, otherwise they are treated as start tags.
   */
  selfClosingTagsEnabled?: boolean;

  /**
   * Map from the foreign tag name to options that must be applied to foreign tag children.
   *
   * If tag name is also present in {@link voidTags} or {@link cdataTags} than it is ignored.
   */
  foreignTags?: { [tagName: string]: ForeignLexerOptions };
}

export const enum LexerStage {
  DOCUMENT = 'DOCUMENT',
  START_TAG = 'START_TAG',
  ATTRIBUTE_NAME = 'ATTRIBUTE_NAME',
  ATTRIBUTE_VALUE = 'ATTRIBUTE_VALUE',
  END_TAG = 'END_TAG',
  CDATA_TAG = 'CDATA_TAG',
}

/**
 * Returns the hash code of a substring.
 */
export type GetHashCode = (input: string, offset: number, length: number) => number;

/**
 * The config represents coerced options passed to the lexer.
 */
export interface LexerConfig {
  /**
   * The parent config of a foreign tag, or `null` if this is the root config.
   */
  parentConfig: LexerConfig | null;

  /**
   * The hash code of the root tag generated by {@link getHashCode}, or 0 if this is the root config.
   */
  rootTag: number;
  voidTags: Set<number> | null;
  cdataTags: Set<number> | null;
  implicitStartTags: Set<number> | null;
  implicitEndTagMap: Map<number, Set<number>> | null;
  foreignTagMap: Map<number, LexerConfig> | null;
  selfClosingTagsEnabled: boolean;
}

/**
 * The context that lexer passes down to the tokenizer.
 */
export interface LexerContext {
  state: LexerState;
  config: LexerConfig;
  handler: LexerHandler<any>;
  context: unknown;
  getHashCode: GetHashCode;
  endTagCdataModeEnabled: boolean;
}
