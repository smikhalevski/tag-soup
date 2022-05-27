import {TokenizerState} from 'tokenizer-dsl';

export const enum TokenStage {
  DOCUMENT = 'DOCUMENT',
  START_TAG_OPENING = 'START_TAG_OPENING',
  ATTRIBUTE_NAME = 'ATTRIBUTE_NAME',
  ATTRIBUTE_EQ = 'ATTRIBUTE_EQ',
  END_TAG_OPENING = 'END_TAG_OPENING',
  CDATA_TAG = 'CDATA_TAG',
}

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
   * `<…` a start tag opening bracket and a tag name. Denotes the start of the foreign tag that would use custom lexing
   * options.
   */
  FOREIGN_START_TAG_OPENING = 'FOREIGN_START_TAG_OPENING',

  /**
   * `</…` an end tag start bracket and a tag name. Denotes the end of the foreign tag.
   */
  FOREIGN_END_TAG_OPENING = 'FOREIGN_START_TAG_OPENING',

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
  TEXT = 'TEXT',
}

/**
 * Triggered when a token was read from the input stream.
 */
export type LexerHandler = (type: TokenType, chunk: string, offset: number, length: number, state: LexerState) => void;

export interface LexerState extends TokenizerState<TokenStage> {

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

  /**
   * The hash code of the tag name, or 0 if not in a lexical context of a tag.
   */
  activeTag: number;
}

/**
 * The internal context used by the tokenizer and lexer.
 *
 * @internal
 */
export interface LexerContext {
  state: LexerState,
  handler: LexerHandler;
  voidTags: Set<number> | null;
  cdataTags: Set<number> | null;
  implicitStartTags: Set<number> | null;
  implicitEndTagMap: Map<number, Set<number>> | null;
  selfClosingTagsEnabled: boolean;
  endTagCdataModeEnabled: boolean;

  getHashCode(input: string, offset: number, length: number): number;
}
