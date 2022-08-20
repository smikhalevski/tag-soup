import { TokenizerState } from 'tokenizer-dsl';

export const enum TokenType {
  /**
   * `<…` a start tag opening bracket and a tag name.
   */
  START_TAG_OPENING = 'START_TAG_OPENING',

  /**
   * `>` a start tag closing bracket.
   */
  START_TAG_CLOSING = 'START_TAG_CLOSING',

  /**
   * `/>` a self-closing tag closing.
   */
  START_TAG_SELF_CLOSING = 'START_TAG_SELF_CLOSING',

  /**
   * The name of the attribute.
   */
  ATTRIBUTE_NAME = 'ATTRIBUTE_NAME',

  /**
   * `"…"` or `'…'` an attribute value surrounded by quotes or apostrophes.
   */
  ATTRIBUTE_VALUE = 'ATTRIBUTE_VALUE',

  /**
   * An attribute value without quotes or apostrophes.
   */
  ATTRIBUTE_UNQUOTED_VALUE = 'ATTRIBUTE_UNQUOTED_VALUE',

  /**
   * `</…` an end tag start bracket and a tag name.
   */
  END_TAG_OPENING = 'END_TAG_OPENING',

  /**
   * `>` an end tag closing bracket.
   */
  END_TAG_CLOSING = 'END_TAG_CLOSING',

  /**
   * Zero-width token that denotes that tag at `stack[cursor]` was implicitly closed.
   */
  IMPLICIT_END_TAG = 'IMPLICIT_END_TAG',

  /**
   * `</…` an end tag start bracket and a tag name. Denotes that the start tag must be implicitly inserted before the
   * end tag.
   */
  IMPLICIT_START_TAG = 'IMPLICIT_START_TAG',

  /**
   * `<!-- … -->` a comment.
   */
  COMMENT = 'COMMENT',

  /**
   * `<? … ?>` a processing instruction.
   */
  PROCESSING_INSTRUCTION = 'PROCESSING_INSTRUCTION',

  /**
   * `<![CDATA[ … ]]>` a CDATA section.
   */
  CDATA_SECTION = 'CDATA_SECTION',

  /**
   * `<!DOCTYPE … >` a doctype section.
   */
  DOCTYPE = 'DOCTYPE',

  /**
   * `<! … >` a DTD section.
   */
  DTD = 'DTD',

  /**
   * A plain text.
   */
  TEXT = 'TEXT',
}

/**
 * Triggered when a token was read from the input stream.
 */
export type LexerHandler = (type: TokenType, chunk: string, offset: number, length: number, state: LexerState) => void;

/**
 * Lexer is a streaming tokenizer that emits tokens is correct order.
 */
export interface Lexer {
  (input: string | LexerState, handler: LexerHandler): LexerState;

  write(chunk: string, state: LexerState | undefined, handler: LexerHandler): LexerState;
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

  /**
   * The index in stack where the closest foreign container starts.
   */
  foreignCursor: number;

  // TODO Move to LexerContext and replace with stack[cursor] if performance doesn't drop significantly
  /**
   * The hash code of the tag name, or 0 if not in a lexical context of a tag.
   */
  activeTag: number;
}

export interface LexerOptions {
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
   * If `true` then tag names are compared case-insensitively, otherwise case-sensitive comparison is used.
   *
   * **Note:** Only ASCII characters in tag names are compared case-insensitively.
   */
  caseInsensitiveTagsEnabled?: boolean;

  /**
   * Map from the foreign tag name to options that must be applied inside to foreign tag children.
   *
   * If tag name is also present in {@link voidTags} or {@link cdataTags} than it is ignored.
   */
  foreignTags?: { [tagName: string]: LexerOptions };
}

/**
 * @internal
 * Returns the hash code of a substring.
 */
export type GetHashCode = (input: string, offset: number, length: number) => number;

/**
 * @internal
 */
export const enum LexerStage {
  DOCUMENT = 'DOCUMENT',
  START_TAG = 'START_TAG',
  ATTRIBUTE_NAME = 'ATTRIBUTE_NAME',
  ATTRIBUTE_VALUE = 'ATTRIBUTE_VALUE',
  END_TAG = 'END_TAG',
  CDATA_TAG = 'CDATA_TAG',
}

/**
 * @internal
 * The config represents coerced options passed to the lexer.
 */
export interface LexerConfig {
  __parentConfig: LexerConfig | null;
  __voidTags: Set<number> | null;
  __cdataTags: Set<number> | null;
  __implicitStartTags: Set<number> | null;
  __implicitEndTagMap: Map<number, Set<number>> | null;
  __foreignTagConfigMap: Map<number, LexerConfig> | null;
  __selfClosingTagsEnabled: boolean;
  __getHashCode: GetHashCode;
}

/**
 * @internal
 * The context that lexer passes down to the tokenizer.
 */
export interface LexerContext {
  __state: LexerState;
  __config: LexerConfig;
  __handler: LexerHandler;
  __endTagCdataModeEnabled: boolean;
}
